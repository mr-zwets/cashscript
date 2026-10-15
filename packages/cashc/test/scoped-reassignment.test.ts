import {
  createTestAuthenticationProgramBch,
  createVirtualMachineBch2026,
} from '@bitauth/libauth';
import { asmToBytecode, encodeInt, scriptToBytecode } from '@cashscript/utils';
import { compileString, InternalCompilerOptions } from '../src/internal.js';

const vm = createVirtualMachineBch2026(false);

// Evaluate a compiled contract (no constructor args) against pushed spend args (first parameter on top).
// The contracts take a final `bytes unused pad` parameter, which buys operation cost budget for the loops.
function evaluate(bytecodeAsm: string, args: bigint[]): boolean {
  const pad = new Uint8Array(2000);
  const unlocking = scriptToBytecode([pad, ...[...args].reverse().map((arg) => encodeInt(arg))]);
  const state = vm.evaluate(createTestAuthenticationProgramBch({
    lockingBytecode: asmToBytecode(bytecodeAsm),
    unlockingBytecode: unlocking,
    valueSatoshis: 1000n,
  }));
  const top = state.stack[state.stack.length - 1];
  return state.error === undefined && state.stack.length === 1 && top !== undefined && top.length === 1 && top[0] === 1;
}

interface Case {
  name: string;
  code: string;
  // spend(n, expected): the contract requires its result to equal expected
  reference: (n: bigint) => bigint;
}

const CASES: Case[] = [
  {
    name: 'nested loops reassigning outer loop-carried variables',
    code: `
      function mix(int x, int y, int k) returns (int, int) { return y + k, x * 3 + 1; }
      contract Nested() {
        function spend(int n, int expected, bytes unused pad) {
          int a = n; int b = 1; int c = 0;
          for (int i = 0; i < 3; i = i + 1) {
            for (int j = 0; j < 2; j = j + 1) {
              (a, b) = mix(a, b, j);
              c = c + a;
            }
            b = b + i;
          }
          require(a + b * 7 + c * 13 == expected);
        }
      }`,
    reference: (n) => {
      let a = n; let b = 1n; let c = 0n;
      for (let i = 0n; i < 3n; i += 1n) {
        for (let j = 0n; j < 2n; j += 1n) {
          [a, b] = [b + j, a * 3n + 1n];
          c += a;
        }
        b += i;
      }
      return a + b * 7n + c * 13n;
    },
  },
  {
    name: 'branches that leave different layouts',
    code: `
      function swapInc(int x, int y) returns (int, int) { return y, x + 1; }
      contract Branches() {
        function spend(int n, int expected, bytes unused pad) {
          int a = n; int b = 2; int c = 3; int d = 4;
          for (int i = 0; i < 5; i = i + 1) {
            if (i % 2 == 0) {
              (a, b) = swapInc(a, b);
              int t = a + c;
              d = d + t;
            } else if (i == 3) {
              c = c * 2 + a;
            } else {
              (c, d) = swapInc(c, d);
              a = a - 1;
            }
          }
          require(a + b * 3 + c * 5 + d * 7 == expected);
        }
      }`,
    reference: (n) => {
      let a = n; let b = 2n; let c = 3n; let d = 4n;
      for (let i = 0n; i < 5n; i += 1n) {
        if (i % 2n === 0n) {
          [a, b] = [b, a + 1n];
          const t = a + c;
          d += t;
        } else if (i === 3n) {
          c = c * 2n + a;
        } else {
          [c, d] = [d, c + 1n];
          a -= 1n;
        }
      }
      return a + b * 3n + c * 5n + d * 7n;
    },
  },
  {
    name: 'a for-loop init that reassigns an existing variable',
    code: `
      contract ForInit() {
        function spend(int n, int expected, bytes unused pad) {
          int i = 100; int acc = n;
          for (i = 0; i < 4; i = i + 1) {
            acc = acc * 2 + i;
          }
          require(i * 1000 + acc == expected);
        }
      }`,
    reference: (n) => {
      let acc = n; let i = 0n;
      for (i = 0n; i < 4n; i += 1n) acc = acc * 2n + i;
      return i * 1000n + acc;
    },
  },
  {
    name: 'tuple reassignment with consumed and non-consumed reads',
    code: `
      function step(int x, int y, int z) returns (int, int, int) { return y + z, x * 2, z + 1; }
      function pair(int x, int y) returns (int, int) { return x + y, x - y; }
      contract Tuples() {
        function spend(int n, int expected, bytes unused pad) {
          int x = n; int y = 1; int z = 2; int keep = 7;
          int k = 0;
          while (k < 3) {
            (x, y, z) = step(x, y, z);
            (x, y) = pair(x, x + y);
            k = k + 1;
          }
          require(x + y * 3 + z * 5 + keep == expected);
        }
      }`,
    reference: (n) => {
      let x = n; let y = 1n; let z = 2n;
      for (let k = 0; k < 3; k += 1) {
        [x, y, z] = [y + z, x * 2n, z + 1n];
        [x, y] = [x + (x + y), x - (x + y)];
      }
      return x + y * 3n + z * 5n + 7n;
    },
  },
  {
    name: 'a do-while loop with deep loop-carried variables',
    code: `
      contract DoWhile() {
        function spend(int n, int expected, bytes unused pad) {
          int a = n; int b = 1; int c = 2; int d = 3; int e = 4; int f = 5;
          int i = 0;
          do {
            a = a + f; b = b * 2 + a; c = c + b; d = d + c; e = e + d; f = f + e;
            i = i + 1;
          } while (i < 3);
          require(a + b + c + d + e + f == expected);
        }
      }`,
    reference: (n) => {
      let a = n; let b = 1n; let c = 2n; let d = 3n; let e = 4n; let f = 5n;
      for (let i = 0; i < 3; i += 1) {
        a += f; b = b * 2n + a; c += b; d += c; e += d; f += e;
      }
      return a + b + c + d + e + f;
    },
  },
];

const STRATEGIES: Array<InternalCompilerOptions['scopedReassignment']> = ['replace', 'rename', undefined];
const OBJECTIVES = ['opcost', 'size'] as const;

describe('scoped reassignment', () => {
  describe.each(CASES)('$name', ({ code, reference }) => {
    it.each(STRATEGIES.flatMap((strategy) => OBJECTIVES.flatMap((optimizeFor) => (
      [false, true].map((rescheduleStacks) => ({ strategy, optimizeFor, rescheduleStacks }))
    ))))('computes the reference result ($strategy, $optimizeFor, rescheduleStacks: $rescheduleStacks)', (options) => {
      const { bytecode } = compileString(code, {
        optimizeFor: options.optimizeFor,
        rescheduleStacks: options.rescheduleStacks,
        scopedReassignment: options.strategy,
      });

      [0n, 5n, -3n].forEach((n) => {
        expect(evaluate(bytecode, [n, reference(n)])).toBe(true);
        expect(evaluate(bytecode, [n, reference(n) + 1n])).toBe(false);
      });
    });
  });

  it('keeps the replace strategy output unchanged when renaming is not cheaper', () => {
    const code = `
      contract Shallow() {
        function spend(int n) {
          int x = n;
          if (n > 0) { x = x + 1; }
          require(x > 1);
        }
      }`;

    expect(compileString(code).bytecode).toEqual(compileString(code, { scopedReassignment: 'replace' }).bytecode);
  });

  it('does not re-insert deep loop-carried tuple values through the alt stack when renaming', () => {
    const code = `
      function dbl(int x, int y, int z) returns (int, int, int) { return x * x + y, y * z + 1, z * 2; }
      contract Deep() {
        function spend(int n, int expected, bytes unused pad) {
          int x = n; int y = 3; int z = 5; int u = 1; int v = 2; int w = 3;
          for (int i = 0; i < 4; i = i + 1) {
            (x, y, z) = dbl(x, y, z);
          }
          require(x + y + z + u + v + w == expected);
        }
      }`;

    const renamed = compileString(code).bytecode;
    const replaced = compileString(code, { scopedReassignment: 'replace' }).bytecode;
    const loopBody = (asm: string): string => asm.slice(asm.indexOf('OP_BEGIN'), asm.indexOf('OP_UNTIL'));

    expect(loopBody(renamed)).not.toContain('OP_TOALTSTACK OP_SWAP');
    expect(loopBody(renamed).split(' ').length).toBeLessThan(loopBody(replaced).split(' ').length);
  });
});
