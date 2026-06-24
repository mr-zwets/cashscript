/*   unused-modifier.test.ts
 *
 * Tests the `unused` declaration modifier (issues #125 / #412). An `unused` parameter or local
 * variable is exempt from the unused-variable check, which lets contracts declare non-functional
 * padding bytes that buy a larger compute budget (longer input scripts allow more operations)
 * without referencing them in the contract logic. The modifier changes only the unused-variable
 * check: the parameter is still a real stack item (pushed by the unlocker, cleaned up at end of
 * scope), so it appears in the artifact ABI like any other input and does not affect the logic.
 */

import {
  createTestAuthenticationProgramBch,
  createVirtualMachineBch2026,
} from '@bitauth/libauth';
import { asmToScript, encodeInt, scriptToBytecode } from '@cashscript/utils';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../../src/index.js';
import { InvalidModifierError, UnusedVariableError } from '../../src/Errors.js';

const vm = createVirtualMachineBch2026(false);

// Compile a single-spending-function contract and execute it on the real BCH 2026 VM against the
// provided unlocking-script items. Returns whether the spend is strictly accepted. Unlocking items
// map to parameters in reverse (the last parameter's argument is pushed first).
function evaluateSpend(source: string, unlockingItems: Uint8Array[]): boolean {
  const artifact = compileString(source);
  const lockingBytecode = scriptToBytecode(asmToScript(artifact.bytecode));
  const unlockingBytecode = scriptToBytecode(unlockingItems);
  const program = createTestAuthenticationProgramBch({ lockingBytecode, unlockingBytecode, valueSatoshis: 1000n });
  const state = vm.evaluate(program);
  const top = state.stack[state.stack.length - 1];
  return state.error === undefined && state.stack.length === 1
    && top !== undefined && top.length === 1 && top[0] === 1;
}

describe('The `unused` modifier', () => {
  it('allows an unused function parameter', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int a, int b, bytes unused zeroPadding) {
          require(a + b == 5);
        }
      }`)).not.toThrow();
  });

  it('allows an unused contract (constructor) parameter', () => {
    expect(() => compileString(`
      contract Test(int unused salt) {
        function spend(int a) {
          require(a == 1);
        }
      }`)).not.toThrow();
  });

  it('allows an unused local variable', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int a) {
          int unused scratch = a + 1;
          require(a == 1);
        }
      }`)).not.toThrow();
  });

  it('allows combining `constant` and `unused` on a local variable', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int a) {
          int constant unused magic = 42;
          require(a == 1);
        }
      }`)).not.toThrow();
  });

  it('still rejects a parameter that is NOT marked unused', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int a, bytes zeroPadding) {
          require(a == 1);
        }
      }`)).toThrow(UnusedVariableError);
  });

  it('rejects the `constant` modifier on a parameter', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int constant a) {
          require(a == 1);
        }
      }`)).toThrow(InvalidModifierError);
  });

  it('rejects a duplicate modifier', () => {
    expect(() => compileString(`
      contract Test() {
        function spend(int a, bytes unused unused zeroPadding) {
          require(a == 1);
        }
      }`)).toThrow(InvalidModifierError);
  });

  it('keeps unused parameters in the artifact ABI and constructor inputs', () => {
    const artifact = compileString(`
      contract Test(int unused salt) {
        function spend(int a, int b, bytes unused zeroPadding) {
          require(a + b == 5);
        }
      }`);
    expect(artifact.constructorInputs).toEqual([{ name: 'salt', type: 'int' }]);
    expect(artifact.abi[0].inputs).toEqual([
      { name: 'a', type: 'int' },
      { name: 'b', type: 'int' },
      { name: 'zeroPadding', type: 'bytes' },
    ]);
  });

  describe('Execution on the real BCH 2026 VM', () => {
    const source = `
      contract Test() {
        function spend(int a, int b, bytes unused zeroPadding) {
          require(a + b == 10);
        }
      }`;

    it('accepts regardless of the padding value (padding is non-functional)', () => {
      // unlocking items map to parameters in reverse: [zeroPadding, b, a]
      const noPadding = [hexToBin(''), encodeInt(3n), encodeInt(7n)];
      const withPadding = [hexToBin('00000000000000000000'), encodeInt(3n), encodeInt(7n)];
      expect(evaluateSpend(source, noPadding)).toBe(true);
      expect(evaluateSpend(source, withPadding)).toBe(true);
    });

    it('rejects when the actual logic fails, independent of padding', () => {
      const badArgs = [hexToBin('0000'), encodeInt(4n), encodeInt(7n)];
      expect(evaluateSpend(source, badArgs)).toBe(false);
    });
  });
});
