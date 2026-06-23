/*   libraries.test.ts
 *
 * Tests the library / import / global-constant system. A `library` is a file-level bag of reusable
 * (implicitly `internal`) functions and constants; `import "./X.cash";` pulls a library's members
 * into the importing scope; top-level / library `constant`s are folded to a literal and inlined at
 * every use site. Imports/libraries are merged into the single contract (in dependency order, with
 * the diamond deduped) before semantic analysis, so the result is an ordinary contract that executes
 * on libauth's real BCH 2026 VM.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  createTestAuthenticationProgramBch,
  createVirtualMachineBch2026,
} from '@bitauth/libauth';
import {
  asmToScript, encodeInt, scriptToBytecode, Artifact,
} from '@cashscript/utils';
import { compileString, compileFile } from '../../src/index.js';
import {
  ImportResolutionError,
  ImportCycleError,
  ConstantDefinitionError,
  ConstantNameCollisionError,
  FunctionRedefinitionError,
} from '../../src/Errors.js';

const vm = createVirtualMachineBch2026(false);
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'library-fixtures');

function evaluate(artifact: Artifact, unlockingItems: Uint8Array[]): { accepted: boolean, error?: string } {
  const lockingBytecode = scriptToBytecode(asmToScript(artifact.bytecode));
  const unlockingBytecode = scriptToBytecode(unlockingItems);
  const program = createTestAuthenticationProgramBch({ lockingBytecode, unlockingBytecode, valueSatoshis: 1000n });
  const state = vm.evaluate(program);
  const top = state.stack[state.stack.length - 1];
  const accepted = state.error === undefined
    && state.stack.length === 1
    && top !== undefined
    && top.length === 1
    && top[0] === 1;
  return { accepted, error: state.error };
}

describe('Libraries, imports and global constants', () => {
  describe('local library in the same file', () => {
    it('merges a same-file library and inlines its constant', () => {
      const artifact = compileString(`
        pragma cashscript ^0.13.0;
        library Helpers {
          int constant OFFSET = 7;
          function addOffset(int x) returns (int) { return x + OFFSET; }
          function double(int x) returns (int) { return x * 2; }
        }
        contract Test() {
          function spend(int x) {
            require(addOffset(double(x)) == 17);
          }
        }`);

      // double(5)=10, addOffset(10)=17 -> accept; double(6)=12, +7=19 != 17 -> reject.
      expect(evaluate(artifact, [encodeInt(5n)]).accepted).toBe(true);
      expect(evaluate(artifact, [encodeInt(6n)]).accepted).toBe(false);
    });

    it('inlines a top-level constant (no library) and folds constant arithmetic', () => {
      const artifact = compileString(`
        pragma cashscript ^0.13.0;
        int constant A = 10;
        int constant B = A * 2 + 1;
        contract Test() {
          function spend(int x) {
            require(x == B);
          }
        }`);

      expect(evaluate(artifact, [encodeInt(21n)]).accepted).toBe(true);
      expect(evaluate(artifact, [encodeInt(20n)]).accepted).toBe(false);
    });
  });

  describe('imports', () => {
    it('compiles a contract that imports a library and executes correctly', () => {
      const artifact = compileFile(join(fixtures, 'Consumer.cash'));
      expect(evaluate(artifact, [encodeInt(5n)]).accepted).toBe(true);
      expect(evaluate(artifact, [encodeInt(4n)]).accepted).toBe(false);
    });

    it('dedupes a diamond import (same library reached via two paths)', () => {
      const artifact = compileFile(join(fixtures, 'Diamond.cash'));
      // m1(4)=10, m2(4)=8, sum=18 -> accept.
      expect(evaluate(artifact, [encodeInt(4n)]).accepted).toBe(true);
      expect(evaluate(artifact, [encodeInt(3n)]).accepted).toBe(false);
    });

    it('throws on a missing imported file', () => {
      expect(() => compileString(
        'pragma cashscript ^0.13.0; import "./does-not-exist.cash"; contract C() { function f() { require(true); } }',
        { basePath: fixtures },
      )).toThrow(ImportResolutionError);
    });

    it('throws on a circular import', () => {
      expect(() => compileFile(join(fixtures, 'Cycle1.cash'))).toThrow(ImportCycleError);
    });

    it('throws when a string compile with imports has no base path', () => {
      expect(() => compileString(
        'pragma cashscript ^0.13.0; import "./MathLib.cash"; contract C() { function f() { require(true); } }',
      )).toThrow(ImportResolutionError);
    });
  });

  describe('errors', () => {
    it('rejects a constant initialised from a runtime/introspection value', () => {
      expect(() => compileString(`
        pragma cashscript ^0.13.0;
        int constant BAD = tx.inputs.length;
        contract C() { function f() { require(true); } }`)).toThrow(ConstantDefinitionError);
    });

    it('rejects a local that shadows a constant name', () => {
      expect(() => compileString(`
        pragma cashscript ^0.13.0;
        int constant X = 5;
        contract C() { function f(int X) { require(X == 5); } }`)).toThrow(ConstantNameCollisionError);
    });

    it('rejects two libraries defining the same function name', () => {
      expect(() => compileString(`
        pragma cashscript ^0.13.0;
        library A { function dup(int x) returns (int) { return x; } }
        library B { function dup(int x) returns (int) { return x + 1; } }
        contract C() { function f(int x) { require(dup(x) == x); } }`)).toThrow(FunctionRedefinitionError);
    });
  });
});
