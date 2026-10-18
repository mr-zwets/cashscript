import {
  binToHex,
  createTestAuthenticationProgramBch,
  createVirtualMachineBch2026,
  encodeAuthenticationInstructions,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToBytecode, bytecodeToScript, encodeInt, Op, optimiseBytecode, Script, scriptToBytecode,
  sourceMapToLocationData,
} from '@cashscript/utils';
import { compileString } from '../src/index.js';

const vm = createVirtualMachineBch2026(false);

// evaluate a compiled contract (no constructor args) directly against pushed spend args
function evaluate(bytecodeAsm: string, args: bigint[]): boolean {
  // spend args are pushed in reverse declaration order (first parameter on top)
  const unlocking = scriptToBytecode([...args].reverse().map((arg) => encodeInt(arg)));
  const state = vm.evaluate(createTestAuthenticationProgramBch({
    lockingBytecode: asmToBytecode(bytecodeAsm),
    unlockingBytecode: unlocking,
    valueSatoshis: 1000n,
  }));
  const top = state.stack[state.stack.length - 1];
  return state.error === undefined && state.stack.length === 1 && top !== undefined && top.length === 1 && top[0] === 1;
}

// slot-heavy single-function contract: many locals with interleaved, repeated reads
// (the access pattern the rescheduler exists to improve), plus a user function that
// stays OP_DEFINE'd, a loop, and a branch
const CONTRACT = `
  function mulmod(int a, int b, int m) returns (int) {
    int p = (a * b) % m;
    return p;
  }
  contract Sched() {
    function spend(int x, int y, int z, int w) {
      int a = x + y;
      int b = y + z;
      int c = z + w;
      int d = a * b + b * c + c * a;
      int e = mulmod(a, b, 1000000007) + mulmod(b, c, 1000000007);
      int acc = 0;
      for (int i = 0; i < 3; i = i + 1) {
        acc = acc + d + e;
      }
      if (acc > 0) {
        require(acc >= d);
      }
      require(a + b + c + d + e + acc > 0);
    }
  }`;

describe('stack rescheduling (rescheduleStacks)', () => {
  it('is off by default and leaves the bytecode unchanged', () => {
    expect(compileString(CONTRACT).bytecode).toEqual(compileString(CONTRACT, {}).bytecode);
  });

  it.each([['opcost'], ['size']] as const)(
    'preserves accept/reject behaviour under the %s objective',
    (optimizeFor) => {
      const plain = compileString(CONTRACT, { optimizeFor });
      const rescheduled = compileString(CONTRACT, { optimizeFor, rescheduleStacks: true });

      const accepts: bigint[][] = [
        [3n, 5n, 7n, 11n],
        [1000n, 2000n, 3000n, 4000n],
        [123456789n, 987654321n, 555555n, 42n],
      ];
      accepts.forEach((args) => {
        expect(evaluate(plain.bytecode, args)).toBe(true);
        expect(evaluate(rescheduled.bytecode, args)).toBe(true);
      });

      // all-zero inputs fail the final require in both compiles
      expect(evaluate(plain.bytecode, [0n, 0n, 0n, 0n])).toBe(false);
      expect(evaluate(rescheduled.bytecode, [0n, 0n, 0n, 0n])).toBe(false);
    },
  );

  it('keeps the debug source map aligned with the script', () => {
    const artifact = compileString(CONTRACT, { rescheduleStacks: true });
    const scriptLength = hexToBin(artifact.debug!.bytecode).length;
    expect(scriptLength).toBeGreaterThan(0);
    // one source-map entry per script element: entries are separated by ';'
    const elementCount = artifact.debug!.sourceMap.split(';').length;
    expect(elementCount).toEqual(bytecodeToScript(hexToBin(artifact.debug!.bytecode)).length);
  });

  it('skips multi-function contracts', () => {
    const multi = `
      contract Multi() {
        function a(int x) { require(x > 0); }
        function b(int y) { require(y > 1); }
      }`;
    expect(compileString(multi, { rescheduleStacks: true }).bytecode)
      .toEqual(compileString(multi).bytecode);
  });
});

// Dead computation: a value that never reaches its block's exit still executes for its
// failure behaviour — rejecting the spend is its only observable effect, so eliminating
// it would ACCEPT witnesses the plain compile rejects (see hasDeadComputation).
describe('dead computation is never eliminated', () => {
  // a void guard function is a zero-output invoke node at the call site — dead by
  // construction; disableInlining pins the OP_DEFINE/OP_INVOKE shape that exercises it
  const VOID_GUARD = `
    function check(int x) { require(x > 500); }
    contract Guard() {
      function spend(int a, int b) {
        check(a);
        check(b);
        require(a + b > 0);
      }
    }`;

  it.each([['opcost'], ['size']] as const)(
    'keeps void guard calls under the %s objective',
    (optimizeFor) => {
      const plain = compileString(VOID_GUARD, { optimizeFor, disableInlining: true });
      const rescheduled = compileString(VOID_GUARD, { optimizeFor, disableInlining: true, rescheduleStacks: true });

      // both call sites survive rescheduling
      const invokeCount = (asm: string): number => [...asm.matchAll(/OP_INVOKE/g)].length;
      expect(invokeCount(rescheduled.bytecode)).toEqual(invokeCount(plain.bytecode));

      expect(evaluate(plain.bytecode, [501n, 1000n])).toBe(true);
      expect(evaluate(rescheduled.bytecode, [501n, 1000n])).toBe(true);

      // each guard must still reject independently
      expect(evaluate(plain.bytecode, [1n, 1000n])).toBe(false);
      expect(evaluate(rescheduled.bytecode, [1n, 1000n])).toBe(false);
      expect(evaluate(plain.bytecode, [1000n, 1n])).toBe(false);
      expect(evaluate(rescheduled.bytecode, [1000n, 1n])).toBe(false);
    },
  );

  it('keeps void guard calls with inlining enabled (default)', () => {
    const plain = compileString(VOID_GUARD);
    const rescheduled = compileString(VOID_GUARD, { rescheduleStacks: true });
    expect(evaluate(plain.bytecode, [501n, 1000n])).toBe(true);
    expect(evaluate(rescheduled.bytecode, [501n, 1000n])).toBe(true);
    expect(evaluate(rescheduled.bytecode, [1n, 1000n])).toBe(false);
    expect(evaluate(rescheduled.bytecode, [1000n, 1n])).toBe(false);
  });

  it.each([['opcost'], ['size']] as const)(
    "keeps an 'unused' variable's failure-capable initializer under the %s objective",
    (optimizeFor) => {
      const UNUSED_DIV = `
        contract DivGuard() {
          function spend(int a) {
            int unused x = 500 / a;
            require(a < 100);
          }
        }`;
      const plain = compileString(UNUSED_DIV, { optimizeFor });
      const rescheduled = compileString(UNUSED_DIV, { optimizeFor, rescheduleStacks: true });

      expect(rescheduled.bytecode).toContain('OP_DIV');

      expect(evaluate(plain.bytecode, [5n])).toBe(true);
      expect(evaluate(rescheduled.bytecode, [5n])).toBe(true);

      // division by zero aborts the script in both compiles
      expect(evaluate(plain.bytecode, [0n])).toBe(false);
      expect(evaluate(rescheduled.bytecode, [0n])).toBe(false);
    },
  );
});

// Elliptic-curve mixed addition over BN254 (from a Groth16 vk_x MSM): the rescheduled helper body is
// stitched from several blocks, and redundancies across block boundaries (OP_SWAP OP_SWAP,
// OP_DROP OP_DROP) used to survive in it
const P = '21888242871839275222246405745257275088696311157297823662689037894645226208583';
const MADD_CONTRACT = `
  function madd(int aX, int aY, int aZ, int bX, int bY) returns (int, int, int) {
    int z1z1 = (aZ * aZ) % ${P};
    int u2 = (bX * z1z1) % ${P};
    require(u2 != aX);
    int s2 = (z1z1 * aZ % ${P} * bY) % ${P};
    int h = u2 + ${P} - aX;
    int rr = s2 + ${P} - aY;
    int hh = (h * h) % ${P}; int hhh = (h * hh) % ${P};
    int vv = (hh * aX) % ${P};
    int nx = (rr * rr + ${3n * BigInt(P)} - hhh - 2 * vv) % ${P};
    int ny = ((vv - nx + ${P}) * rr + ${BigInt(P) * BigInt(P)} - aY * hhh) % ${P};
    int nz = (aZ * h) % ${P};
    return nx, ny, nz;
  }
  contract Madd() {
    function spend(int x, int y, int z) {
      (int a, int b, int c) = madd(x, y, z, 5, 7);
      (a, b, c) = madd(a, b, c, 11, 13);
      require(a + b + c > 0);
    }
  }
`;

// the main script and every OP_DEFINE'd body, as separate scripts
function scriptsOf(bytecode: Uint8Array): Script[] {
  const script = bytecodeToScript(bytecode);
  const bodies: Script[] = [];
  let i = 0;
  while (i + 2 < script.length && script[i] instanceof Uint8Array && script[i + 2] === Op.OP_DEFINE) {
    bodies.push(bytecodeToScript(script[i] as Uint8Array));
    i += 3;
  }
  return [script.slice(i), ...bodies];
}

describe('rescheduled output is re-optimised', () => {
  it('leaves nothing for the main bytecode optimiser in the main script or any body', () => {
    [CONTRACT, MADD_CONTRACT].forEach((source) => {
      const artifact = compileString(source, { rescheduleStacks: true, disableInlining: true });
      scriptsOf(hexToBin(artifact.debug!.bytecode)).forEach((script) => {
        const location = { location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, positionHint: 0 };
        const optimised = optimiseBytecode(script, script.map(() => location), [], [], [], [], 0).script;
        expect(scriptToBytecode(optimised)).toEqual(scriptToBytecode(script));
      });
    });
  });
});

// Cross-call scheduling (crossCallScheduling, default on): operand adoption, commutative
// staging, and half-swap symmetric callees. `addm`/`mul2` are proven symmetric and may get
// their argument halves swapped at call sites; `subm` is not symmetric and must never be.
const M = 1000003n;
const CROSSCALL_CONTRACT = `
  function addm(int a, int b) returns (int) { return (a + b) % ${M}; }
  function subm(int a, int b) returns (int) { return (a - b + ${M}) % ${M}; }
  function mul2(int a0, int a1, int b0, int b1) returns (int, int) {
    int v0 = (a0 * b0) % ${M};
    int v1 = (a1 * b1) % ${M};
    return subm(v0, v1), subm(((a0 + a1) * (b0 + b1)) % ${M}, addm(v0, v1));
  }
  function t0Of(int v) returns (int) { return subm(v, 1); }
  contract CrossCall() {
    function spend(int x0, int x1, int y0, int y1, int w0, int w1) {
      (int p0, int p1) = mul2(x0, x1, y0, y1);
      (int q0, int q1) = mul2(p0, p1, x0, x1);
      (int r0, int r1) = mul2(y0, y1, q0, q1);
      int s = subm(r0, q1);
      int t = subm(addm(p0, t0Of(r1)), y1);
      require(s == w0);
      require(t == w1);
    }
  }
`;

const mod = (v: bigint): bigint => ((v % M) + M) % M;
const mul2 = (a0: bigint, a1: bigint, b0: bigint, b1: bigint): [bigint, bigint] => {
  const v0 = mod(a0 * b0); const v1 = mod(a1 * b1);
  return [mod(v0 - v1), mod(mod((a0 + a1) * (b0 + b1)) - mod(v0 + v1))];
};
const crossCallExpected = (x0: bigint, x1: bigint, y0: bigint, y1: bigint): [bigint, bigint] => {
  const [p0, p1] = mul2(x0, x1, y0, y1);
  const [q0, q1] = mul2(p0, p1, x0, x1);
  const [r0, r1] = mul2(y0, y1, q0, q1);
  return [mod(r0 - q1), mod(mod(p0 + mod(r1 - 1n)) - y1)];
};

// the milestone suites compile with the full convention search: generous timeouts, so a loaded
// machine (parallel measurements) does not turn a slow compile into a failure
const SLOW = { timeout: 60_000 };

describe('cross-call scheduling', SLOW, () => {
  it.each([['opcost'], ['size']] as const)(
    'preserves accept/reject behaviour under the %s objective',
    (optimizeFor) => {
      const options = { optimizeFor, rescheduleStacks: true, disableInlining: true };
      const plain = compileString(CROSSCALL_CONTRACT, { ...options, crossCallScheduling: false } as never);
      const crossCall = compileString(CROSSCALL_CONTRACT, options);
      const vectors: bigint[][] = [[3n, 5n, 7n, 11n], [999999n, 123456n, 1n, 0n], [424242n, 77n, 500000n, 1000002n]];
      vectors.forEach(([x0, x1, y0, y1]) => {
        const [e0, e1] = crossCallExpected(x0, x1, y0, y1);
        [plain, crossCall].forEach((artifact) => {
          expect(evaluate(artifact.bytecode, [x0, x1, y0, y1, e0, e1])).toBe(true);
          expect(evaluate(artifact.bytecode, [x0, x1, y0, y1, e0, mod(e1 + 1n)])).toBe(false);
          expect(evaluate(artifact.bytecode, [x0, x1, y0, y1, mod(e0 + 1n), e1])).toBe(false);
        });
      });
    },
  );

  it('never grows the bytecode on this contract under the size objective', () => {
    const options = { optimizeFor: 'size', rescheduleStacks: true, disableInlining: true } as const;
    const plain = compileString(CROSSCALL_CONTRACT, { ...options, crossCallScheduling: false } as never);
    const crossCall = compileString(CROSSCALL_CONTRACT, options);
    expect(hexToBin(crossCall.debug!.bytecode).length).toBeLessThanOrEqual(hexToBin(plain.debug!.bytecode).length);
  });

  // `mix` is symmetric, but it logs its parameters: call sites must stage them in source order
  // (no proven-symmetry relabelling), so the logged values match the plain compile
  it.each([['opcost'], ['size']] as const)('does not relabel the arguments of a logging callee (%s)', (optimizeFor) => {
    const LOGGED = `
      function mix(int a, int b) returns (int) {
        console.log("mix a =", a, "b =", b);
        return (a + b) * (a * b + 7);
      }
      contract S() {
        function spend(int x, int y, int z) {
          int p = mix(y, x);
          int q = mix(z, p);
          int r = mix(q, y);
          int s = mix(x, r);
          require(s != p + q + r + z);
        }
      }`;
    const loggedValues = (options: object): string[] => {
      const artifact = compileString(LOGGED, { disableInlining: true, ...options });
      const frame = artifact.debug!.functions!.find((f) => f.name === 'mix')!;
      const trace = vm.debug(createTestAuthenticationProgramBch({
        lockingBytecode: hexToBin(artifact.debug!.bytecode),
        unlockingBytecode: scriptToBytecode([5n, 3n, 2n].map((arg) => encodeInt(arg))),
        valueSatoshis: 1000n,
      }));
      const values: string[] = [];
      trace.forEach((state) => {
        if (binToHex(encodeAuthenticationInstructions(state.instructions)) !== frame.bytecode) return;
        frame.logs.forEach((log) => log.data.forEach((item) => {
          if (typeof item !== 'string' && item.ip === state.ip) {
            values.push(binToHex(state.stack[state.stack.length - 1 - item.stackIndex]));
          }
        }));
      });
      return values;
    };
    const plain = loggedValues({ optimizeFor });
    expect(plain.length).toBe(8);
    expect(loggedValues({ optimizeFor, rescheduleStacks: true })).toEqual(plain);
  });
});

// Regression switches: with every calling-convention milestone feature switched off
// (CO8_OPTIONS) the compiler must reproduce co-8 (dab3f89f) byte for byte. The hex below was
// captured from co-8's rescheduler.
const CO8_OPTIONS = { crossCallScheduling: false, renumberFunctionIds: false };
const KARATSUBA_CONTRACT = `
    function subm(int a, int b) returns (int) { return (a - b + 1000003) % 1000003; }
    function f2mul(int a0, int a1, int b0, int b1) returns (int, int) {
      int t0 = (a0 * b0) % 1000003;
      int t1 = (a1 * b1) % 1000003;
      int s = ((a0 + a1) * (b0 + b1)) % 1000003;
      return subm(t0, t1), subm(subm(s, t0), t1);
    }
    function f2sub(int a0, int a1, int b0, int b1) returns (int, int) {
      return subm(a0, b0), subm(a1, b1);
    }
    function f4mul(int a0, int a1, int a2, int a3, int b0, int b1, int b2, int b3) returns (int, int, int, int) {
      (int x0, int x1) = f2mul(a0, a1, b0, b1);
      (int y0, int y1) = f2mul(a2, a3, b2, b3);
      (int z0, int z1) = f2mul(a0, a3, b1, b2);
      (int u0, int u1) = f2sub(z0, z1, y1, y0);
      (int v0, int v1) = f2sub(x1, x0, u1, u0);
      return v0, y0, u1, v1;
    }
    contract Conv() {
      function spend(int a, int b, int c, int d, int expect, bytes pad) {
        require(pad.length > 2000);
        (int p0, int p1, int p2, int p3) = f4mul(a, b, c, d, d, c, b, a);
        (int q0, int q1, int q2, int q3) = f4mul(p3, p2, p1, p0, a, c, b, d);
        (int r0, int r1) = f2sub(q0, q2, q1, q3);
        require((r0 * 7 + r1 * 13 + p0) % 1000003 == expect);
      }
    }`;

const CO8_BYTECODE: Record<string, string> = {
  'crosscall/opcost': '0b940343420f930343420f97008906930343420f9751892b785479950343420f97785479950343420f97765279008a7b7b518a7293537a547a93950343420f977c008a52890351008a53897070528a727b5379528a767b5579557a528a538a7c7b008a7c7b518a7b008a537a7c7b537a9d9c',
  'crosscall/size': '0b0343420f7c7b9478937c97008906930343420f975189270343420f5279557995789752795579955279976e008a7b7b518a537a547a93719395537a97008a528904517c008a53897070528a727b5379528a767b5579557a528a7b7b008a547a9d7b7c538a7b518a008a9c',
  'karatsuba/opcost': '0b940343420f930343420f970089286e937c5379950343420f977b5479950343420f976e008a7193547a950343420f97537a008a7b008a5189077b008a7c7b008a5289287070518a547a587a577a557a518a577a567a567a577a518a787c557a567a528a7d71528a7c72537a5389557a827702d007a0697654795479547976707c5679538a577a557a547a547a567a577a5779577a538a7b7b537a528a5d957c579593930343420f979c',
  'karatsuba/size': '0b0343420f7c7b9478937c9700892a0343420f785379935479567993957897537a557a95527997537a547a95537a976e008a7b727c008a008a518906008a7b7b008a52892b785579577a518a7b5379567a5879518a53797c72528a537a717c567a518a537a7b5379537a528a7c72537a5389557a827702d007a06976707c567976707c5679538a7c7b5379557a577a577a587a538a7c7b537a528a5d957c579593930343420f979c',
};

describe('the milestone switches off reproduce co-8', SLOW, () => {
  const sources: Record<string, string> = { crosscall: CROSSCALL_CONTRACT, karatsuba: KARATSUBA_CONTRACT };
  it.each(Object.keys(CO8_BYTECODE))('%s', (key) => {
    const [name, optimizeFor] = key.split('/') as [string, 'opcost' | 'size'];
    const artifact = compileString(sources[name], {
      optimizeFor, rescheduleStacks: true, disableInlining: true, ...CO8_OPTIONS,
    } as never);
    expect(artifact.debug!.bytecode).toBe(CO8_BYTECODE[key]);
  });
});

// Return layouts (returnLayouts, on with crossCallScheduling): tuple-returning, non-symmetric
// helpers chained Karatsuba-style, so callers consume permuted results.
describe('return layouts', SLOW, () => {
  // spend args + a 3000-byte pad pushed first (deepest = last parameter)
  const evaluatePadded = (bytecodeAsm: string, args: bigint[]): boolean => {
    const unlocking = scriptToBytecode([new Uint8Array(3000), ...[...args].reverse().map((arg) => encodeInt(arg))]);
    const state = vm.evaluate(createTestAuthenticationProgramBch({
      lockingBytecode: asmToBytecode(bytecodeAsm), unlockingBytecode: unlocking, valueSatoshis: 1000n,
    }));
    const top = state.stack[state.stack.length - 1];
    return state.error === undefined && state.stack.length === 1 && top !== undefined && top.length === 1 && top[0] === 1;
  };
  const Q = 1000003n;
  const reference = (a: bigint, b: bigint, c: bigint, d: bigint): bigint => {
    const subm = (x: bigint, y: bigint): bigint => ((x - y + Q) % Q);
    const f2mul = (a0: bigint, a1: bigint, b0: bigint, b1: bigint): [bigint, bigint] => {
      const t0 = (a0 * b0) % Q; const t1 = (a1 * b1) % Q; const s = ((a0 + a1) * (b0 + b1)) % Q;
      return [subm(t0, t1), subm(subm(s, t0), t1)];
    };
    const f2sub = (a0: bigint, a1: bigint, b0: bigint, b1: bigint): [bigint, bigint] => [subm(a0, b0), subm(a1, b1)];
    const f4mul = (x: bigint[], y: bigint[]): bigint[] => {
      const [x0, x1] = f2mul(x[0], x[1], y[0], y[1]);
      const [y0, y1] = f2mul(x[2], x[3], y[2], y[3]);
      const [z0, z1] = f2mul(x[0], x[3], y[1], y[2]);
      const [u0, u1] = f2sub(z0, z1, y1, y0);
      const [v0, v1] = f2sub(x1, x0, u1, u0);
      return [v0, y0, u1, v1];
    };
    const p = f4mul([a, b, c, d], [d, c, b, a]);
    const q = f4mul([p[3], p[2], p[1], p[0]], [a, c, b, d]);
    const [r0, r1] = f2sub(q[0], q[2], q[1], q[3]);
    return (((r0 * 7n + r1 * 13n + p[0]) % Q) + Q) % Q;
  };

  it.each([['opcost'], ['size']] as const)('stay correct over fixed-point passes (%s)', (optimizeFor) => {
    const base = { optimizeFor, rescheduleStacks: true, disableInlining: true } as const;
    const one = compileString(KARATSUBA_CONTRACT, base);
    const three = compileString(KARATSUBA_CONTRACT, { ...base, conventionPasses: 3 } as never);
    expect(hexToBin(three.debug!.bytecode).length).toBeLessThanOrEqual(hexToBin(one.debug!.bytecode).length + 4);
    [[3n, 5n, 7n, 11n], [999999n, 12345n, 1n, 0n]].forEach(([a, b, c, d]) => {
      const expected = reference(a, b, c, d);
      expect(evaluatePadded(three.bytecode, [a, b, c, d, expected])).toBe(true);
      expect(evaluatePadded(three.bytecode, [a, b, c, d, (expected + 1n) % Q])).toBe(false);
    });
  });

  it.each([['opcost'], ['size']] as const)('match the reference and shrink the script (%s)', (optimizeFor) => {
    const base = { optimizeFor, rescheduleStacks: true, disableInlining: true } as const;
    const off = compileString(KARATSUBA_CONTRACT, { ...base, returnLayouts: false } as never);
    const on = compileString(KARATSUBA_CONTRACT, base);
    expect(hexToBin(on.debug!.bytecode).length).toBeLessThan(hexToBin(off.debug!.bytecode).length);
    const inputs: bigint[][] = [[3n, 5n, 7n, 11n], [999999n, 12345n, 1n, 0n], [424242n, 31337n, 777777n, 2n]];
    inputs.forEach(([a, b, c, d]) => {
      const expected = reference(a, b, c, d);
      [off, on].forEach((artifact) => {
        expect(evaluatePadded(artifact.bytecode, [a, b, c, d, expected])).toBe(true);
        expect(evaluatePadded(artifact.bytecode, [a, b, c, d, (expected + 1n) % Q])).toBe(false);
      });
    });
  });

  // f2mul and f2sub call themselves behind a small-n guard (n = 1, 2 recurse). A function on a
  // call-graph cycle keeps the standard convention: its own recursive call sites are compiled
  // before its convention is known. Before this was enforced, both got reversed return layouts
  // and the script accepted a wrong `expect` for n = 1 and 2.
  const RECURSIVE_CONTRACT = `
    function subm(int a, int b) returns (int) { return (a - b + 1000003) % 1000003; }
    function f2mul(int a0, int a1, int b0, int b1, int n) returns (int, int) {
      int t0 = (a0 * b0) % 1000003;
      int t1 = (a1 * b1) % 1000003;
      if (n > 0) {
        if (n < 3) {
          t0, t1 = f2mul(t1, b0, a1, t0 + 5, n - 1);
        }
      }
      int s = ((a0 + a1) * (b0 + b1)) % 1000003;
      return subm(t0, t1), subm(subm(s, t0), t1);
    }
    function f2sub(int a0, int a1, int b0, int b1, int n) returns (int, int) {
      int x = a0;
      int y = a1;
      if (n > 0) {
        if (n < 3) {
          x, y = f2sub(b1, a0, a1 + 3, b0, n - 1);
        }
      }
      return subm(x, b0), subm(y, b1);
    }
    function f4mul(int a0, int a1, int a2, int a3, int b0, int b1, int b2, int b3, int n) returns (int, int, int, int) {
      (int x0, int x1) = f2mul(a0, a1, b0, b1, n);
      (int y0, int y1) = f2mul(a2, a3, b2, b3, n);
      (int z0, int z1) = f2mul(a0, a3, b1, b2, n);
      (int u0, int u1) = f2sub(z0, z1, y1, y0, n);
      (int v0, int v1) = f2sub(x1, x0, u1, u0, n);
      return v0, y0, u1, v1;
    }
    contract Conv() {
      function spend(int a, int b, int c, int d, int n, int expect, bytes pad) {
        require(pad.length > 2000);
        (int p0, int p1, int p2, int p3) = f4mul(a, b, c, d, d, c, b, a, n);
        (int q0, int q1, int q2, int q3) = f4mul(p3, p2, p1, p0, a, c, b, d, n);
        (int r0, int r1) = f2sub(q0, q2, q1, q3, n);
        require((r0 * 7 + r1 * 13 + p0) % 1000003 == expect);
      }
    }`;
  const recursiveReference = (a: bigint, b: bigint, c: bigint, d: bigint, n: bigint): bigint => {
    const subm = (x: bigint, y: bigint): bigint => ((x - y + Q) % Q);
    const f2mul = (a0: bigint, a1: bigint, b0: bigint, b1: bigint, k: bigint): [bigint, bigint] => {
      let t0 = (a0 * b0) % Q; let t1 = (a1 * b1) % Q;
      if (k > 0n && k < 3n) [t0, t1] = f2mul(t1, b0, a1, t0 + 5n, k - 1n);
      const s = ((a0 + a1) * (b0 + b1)) % Q;
      return [subm(t0, t1), subm(subm(s, t0), t1)];
    };
    const f2sub = (a0: bigint, a1: bigint, b0: bigint, b1: bigint, k: bigint): [bigint, bigint] => {
      let x = a0; let y = a1;
      if (k > 0n && k < 3n) [x, y] = f2sub(b1, a0, a1 + 3n, b0, k - 1n);
      return [subm(x, b0), subm(y, b1)];
    };
    const f4mul = (x: bigint[], y: bigint[]): bigint[] => {
      const [x0, x1] = f2mul(x[0], x[1], y[0], y[1], n);
      const [y0, y1] = f2mul(x[2], x[3], y[2], y[3], n);
      const [z0, z1] = f2mul(x[0], x[3], y[1], y[2], n);
      const [u0, u1] = f2sub(z0, z1, y1, y0, n);
      const [v0, v1] = f2sub(x1, x0, u1, u0, n);
      return [v0, y0, u1, v1];
    };
    const p = f4mul([a, b, c, d], [d, c, b, a]);
    const q = f4mul([p[3], p[2], p[1], p[0]], [a, c, b, d]);
    const [r0, r1] = f2sub(q[0], q[2], q[1], q[3], n);
    return (((r0 * 7n + r1 * 13n + p[0]) % Q) + Q) % Q;
  };

  it.each([['opcost'], ['size']] as const)('keep recursive functions on the standard convention (%s)', (optimizeFor) => {
    const artifact = compileString(RECURSIVE_CONTRACT, { optimizeFor, rescheduleStacks: true, disableInlining: true });
    [0n, 1n, 2n, 3n].forEach((n) => {
      [[3n, 5n, 7n, 11n], [424242n, 31337n, 777777n, 2n]].forEach(([a, b, c, d]) => {
        const expected = recursiveReference(a, b, c, d, n);
        expect(evaluatePadded(artifact.bytecode, [a, b, c, d, n, expected])).toBe(true);
        expect(evaluatePadded(artifact.bytecode, [a, b, c, d, n, (expected + 1n) % Q])).toBe(false);
      });
    });
  });
});

// VERIFY sinks (verifySinks, on with crossCallScheduling): main's require() checks and void
// calls are scheduled inside straight-line blocks instead of splitting them. Accept/reject must
// match the plain compile on every input, and require() debug ips must still point at checks.
describe('verify sinks', SLOW, () => {
  const SINKS = `
    function check(int x) { require(x % 7 != 3); }
    contract Sinks() {
      function spend(int a, int b, int c, int d) {
        int s = a * b + c;
        require(s % 11 != 0, "s");
        int t = s * d + a;
        check(t);
        require(t % 13 != 5, "t");
        int u = t * c + b * d;
        check(u);
        require(u % 17 != 2, "u");
        require(a + b + c + d > 3);
      }
    }`;
  const accepts = (a: bigint, b: bigint, c: bigint, d: bigint): boolean => {
    const s = a * b + c; const t = s * d + a; const u = t * c + b * d;
    const ok = (x: bigint): boolean => x % 7n !== 3n;
    return s % 11n !== 0n && ok(t) && t % 13n !== 5n && ok(u) && u % 17n !== 2n && a + b + c + d > 3n;
  };
  const VERIFY_OPS = new Set<number>([Op.OP_VERIFY, Op.OP_EQUALVERIFY, Op.OP_NUMEQUALVERIFY]);

  it.each([['opcost'], ['size']] as const)('match the plain compile on random inputs (%s)', (optimizeFor) => {
    const base = { optimizeFor, rescheduleStacks: true, disableInlining: true } as const;
    const plain = compileString(SINKS, { optimizeFor, disableInlining: true });
    const off = compileString(SINKS, { ...base, verifySinks: false } as never);
    const on = compileString(SINKS, base);
    let seed = 12345;
    const next = (): bigint => { seed = (seed * 1103515245 + 12345) % 2147483648; return BigInt(seed % 200); };
    const vectors = Array.from({ length: 150 }, () => [next(), next(), next(), next()]);
    let accepted = 0;
    vectors.forEach((args) => {
      const expected = accepts(args[0], args[1], args[2], args[3]);
      if (expected) accepted += 1;
      [plain, off, on].forEach((artifact) => expect(evaluate(artifact.bytecode, args)).toBe(expected));
    });
    // the vectors exercise both outcomes
    expect(accepted).toBeGreaterThan(10);
    expect(accepted).toBeLessThan(140);
  });

  it('keeps require() debug ips on the checks', () => {
    const on = compileString(SINKS, { rescheduleStacks: true, disableInlining: true });
    const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
    const messages = on.debug!.requires.filter((req) => req.message !== undefined);
    expect(messages.length).toBe(3);
    messages.forEach((req) => expect(VERIFY_OPS.has(script[req.ip] as number)).toBe(true));
  });

  it('keeps source lines of checks and of the final require', () => {
    const DIVMOD = `
function divmod(int a, int b) returns (int, int) {
  return a / b, a % b;
}

contract Test() {
  function spend(int x) {
    int q, int r = divmod(x, 3);
    require(q == 4, "quotient should be 4");
    require(r == 1, "remainder should be 1");
  }
}
`;
    const on = compileString(DIVMOD, { rescheduleStacks: true });
    const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
    const locations = sourceMapToLocationData(on.debug!.sourceMap);
    const [first, last] = on.debug!.requires;
    expect(locations[first.ip].location.start.line).toBe(9);
    // the final require has no VERIFY: its failure is reported at the last op
    expect(locations[script.length - 1].location.start.line).toBe(10);
    expect(last.line).toBe(10);
  });

  // ORDERED NODES: checks, void calls and fallible ops keep their source order inside a merged
  // block, so the SDK still reports the first failing statement
  const VOID_CALLS = `function chkpos(int x, int y) {
  require(x - y > 0, "chk: x must exceed y");
}

contract A() {
  function spend(int a, int b, int c) {
    require((b * a) != a, "req 0");
    require(b != (b + a), "req 1");
    chkpos(3, (a * b));
    chkpos(b, (c * 3));
    require(b > (2 * a), "req 4");
  }
}
`;
  it.each([['opcost'], ['size']] as const)('keep checks and void calls in source order with their own lines (%s)', (optimizeFor) => {
    const on = compileString(VOID_CALLS, { optimizeFor, rescheduleStacks: true, disableInlining: true });
    const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
    const locations = sourceMapToLocationData(on.debug!.sourceMap);
    // checks in source order
    const ips = on.debug!.requires.map((req) => req.ip);
    expect(ips).toEqual([...ips].sort((x, y) => x - y));
    // each void call keeps its own statement line (the SDK's call-stack line), in source order
    const invokeLines = script.flatMap((el, i) => (el === Op.OP_INVOKE ? [locations[i].location.start.line] : []));
    expect(invokeLines).toEqual([9, 10]);
    // the final require (no VERIFY) is computed last and reported on its own line
    expect(locations[script.length - 1].location.start.line).toBe(11);
    expect(script[script.length - 1]).toBe(Op.OP_GREATERTHAN);
  });

  // the SDK finds a failing final require at one past the last non-cleanup instruction: when a
  // rewrite drops main's trailing OP_NIP cleanup, the require's ip and line must follow
  it.each([[{}], [{ blockMoves: true }], [{ optimizeFor: 'size' }]] as const)('re-anchor the final require (%o)', (extra) => {
    const FINAL = `function chkpos(int x, int y) {
  require(x - y > 0, "chk: x must exceed y");
}
contract A() {
  function spend(int a, int b, int c) {
    chkpos(b, (a - b));
    require(2 < c, "req 1");
  }
}
`;
    [{ disableInlining: true }, { disableInlining: true, rescheduleStacks: true, ...extra }].forEach((options) => {
      const artifact = compileString(FINAL, options);
      const script = bytecodeToScript(hexToBin(artifact.debug!.bytecode));
      const locations = sourceMapToLocationData(artifact.debug!.sourceMap);
      const cleanup = new Set<number>([Op.OP_ENDIF, Op.OP_NIP, Op.OP_ELSE, Op.OP_DROP, Op.OP_2DROP]);
      let last = script.length - 1;
      while (cleanup.has(script[last] as number)) last -= 1;
      const final = artifact.debug!.requires.find((req) => req.message === 'req 1')!;
      expect(final.ip).toBe(last + 1);
      expect(locations[last].location.start.line).toBe(7);
    });
  });

  it.each([['opcost'], ['size']] as const)('keep a guard before the division it protects (%s)', (optimizeFor) => {
    const GUARD = `
      contract G() {
        function spend(int a, int b, int c) {
          require(c != 0, "c must be nonzero");
          int q = a / c;
          require(q * 3 + b > a, "q");
          require(a + b > 0);
        }
      }`;
    const on = compileString(GUARD, { optimizeFor, rescheduleStacks: true });
    const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
    const guard = on.debug!.requires.find((req) => req.message === 'c must be nonzero')!;
    expect(script[guard.ip]).toBe(Op.OP_VERIFY);
    expect(guard.ip).toBeLessThan(script.indexOf(Op.OP_DIV));
    // accept/reject unchanged
    expect(evaluate(on.bytecode, [20n, 5n, 0n])).toBe(false);
    expect(evaluate(on.bytecode, [20n, 5n, 3n])).toBe(true);
  });

  it.each([['opcost'], ['size']] as const)('keep a guard before the shift it protects (%s)', (optimizeFor) => {
    [['<<', Op.OP_LSHIFTNUM], ['>>', Op.OP_RSHIFTNUM]].forEach(([operator, opcode]) => {
      const GUARD = `
        contract G() {
          function spend(int a, int b, int c) {
            require(c >= 0, "c must be nonnegative");
            int q = a ${operator} c;
            require(q * 3 + b > a, "ratio");
            require(a + b > 0, "sum");
          }
        }`;
      const on = compileString(GUARD, { optimizeFor, rescheduleStacks: true });
      const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
      const guard = on.debug!.requires.find((req) => req.message === 'c must be nonnegative')!;
      expect(script[guard.ip]).toBe(Op.OP_VERIFY);
      expect(guard.ip).toBeLessThan(script.indexOf(opcode as Op));
      expect(evaluate(on.bytecode, [20n, 5n, -1n])).toBe(false);
      expect(evaluate(on.bytecode, [20n, 5n, 2n])).toBe(operator === '<<');
    });
  });

  // bitwise ops on two unbounded `bytes` fail on operands of different lengths, and CAT fails
  // above the VM's item size: they stay behind the checks before them (review round 4)
  it.each([['opcost'], ['size']] as const)('keep checks before a bitwise op or CAT on unbounded bytes (%s)', (optimizeFor) => {
    [['^', Op.OP_XOR], ['&', Op.OP_AND], ['|', Op.OP_OR], ['+', Op.OP_CAT]].forEach(([operator, opcode]) => {
      const GUARD = `
        contract A() {
          function spend(bytes x, bytes y, int a) {
            require(a * a != 4, "a1");
            require(a * a * a != 27, "a2");
            require(a + a * a != 11, "a3");
            require(sha256(x ${operator} y) != 0x1111111111111111111111111111111111111111111111111111111111111111, "h");
            require(a != 3, "last");
          }
        }`;
      const on = compileString(GUARD, { optimizeFor, rescheduleStacks: true });
      const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
      const a3 = on.debug!.requires.find((req) => req.message === 'a3')!;
      expect(script[a3.ip]).toBe(Op.OP_VERIFY);
      expect(a3.ip).toBeLessThan(script.indexOf(opcode as Op));
    });
  });

  it('keep calls of logging functions between the checks around them', () => {
    const LOGS = `
      function fa(int x) returns (int) { console.log("A", x); return x * 3 + 1; }
      function fb(int x, int y) returns (int) { console.log("B", x, y); return x * y + 7; }
      contract L() {
        function spend(int a, int b, int c) {
          int q = fb(b, c * 2);
          require(c != 12, "first");
          int p = fa(a);
          require(a * b != 13, "second");
          int r = fa(b - c);
          require(p - q + r != 100, "final");
        }
      }`;
    // (optimizeFor 'size' is not checked: its def-sinking moves the definitions down to their
    // first use before rescheduling, in co-8 too)
    const on = compileString(LOGS, { rescheduleStacks: true, disableInlining: true });
    const script = bytecodeToScript(hexToBin(on.debug!.bytecode));
    const main = script.slice(script.lastIndexOf(Op.OP_DEFINE) + 1);
    const invokes = main.flatMap((el, i) => (el === Op.OP_INVOKE ? [i] : []));
    const verifies = main.flatMap((el, i) => (el === Op.OP_VERIFY ? [i] : []));
    expect(invokes).toHaveLength(3);
    expect(verifies).toHaveLength(2);
    expect(invokes[0]).toBeLessThan(verifies[0]);
    expect(verifies[0]).toBeLessThan(invokes[1]);
    expect(invokes[1]).toBeLessThan(verifies[1]);
    expect(verifies[1]).toBeLessThan(invokes[2]);
  });
});

describe('functions whose loop or recursion depth is an argument', SLOW, () => {
  // body runs during compilation (differential test, op-cost measurement) see ~254-bit random
  // inputs; such a body must not run (practically) forever
  const LOOP = `
    function sumTo(int n, int x) returns (int) {
      int acc = 0;
      int i = 0;
      while (i < n) { acc = acc + x * i; i = i + 1; }
      return acc;
    }
    function down(int n, int a, int b) returns (int, int) {
      int r = a; int s = b;
      if (n > 0) { (s, r) = down(n - 1, b + n, a * 2); }
      return r, s;
    }
    contract C() {
      function spend(int n, int x, int expect) {
        require(within(n, 0, 10));
        int p, int q = down(n, x, 3);
        require(sumTo(n, x) + p * 7 + q == expect);
      }
    }`;
  const expected = (n: bigint, x: bigint): bigint => {
    let acc = 0n;
    for (let i = 0n; i < n; i += 1n) acc += x * i;
    let [a, b] = [x, 3n];
    for (let k = n; k > 0n; k -= 1n) [a, b] = [b + k, a * 2n];
    // down returns (r, s) = (a, b) at the base, swapped back on every level
    let [r, s] = [a, b];
    for (let k = 0n; k < n; k += 1n) [r, s] = [s, r];
    return acc + r * 7n + s;
  };
  it.each([['opcost'], ['size']] as const)('compile in bounded time and stay correct (%s)', (optimizeFor) => {
    const plain = compileString(LOOP, { optimizeFor, disableInlining: true });
    const start = Date.now();
    const on = compileString(LOOP, { optimizeFor, rescheduleStacks: true, disableInlining: true });
    expect(Date.now() - start).toBeLessThan(30_000);
    [[0n, 5n], [1n, 7n], [3n, -4n], [6n, 123456789n]].forEach(([n, x]) => {
      [plain, on].forEach((artifact) => {
        expect(evaluate(artifact.bytecode, [n, x, expected(n, x)])).toBe(true);
        expect(evaluate(artifact.bytecode, [n, x, expected(n, x) + 1n])).toBe(false);
      });
    });
  });
});

describe('cross-call fallback', SLOW, () => {
  // sd is symmetric and fallible; crosscall's symmetry relabelling schedules sm worse than co-8's
  // swapped entry layout for sd, so the co-8 schedule (crossCallScheduling off) must win
  const SYMFALL = `function sd(int a, int b) returns (int) { return a / b + b / a; }
function sm(int a, int b, int c, int d) returns (int, int) { return sd(a, c) + sd(b, d), sd(a, d) * sd(c, b); }
contract C() { function spend(int x, int y, int z, int expect) {
  int p, int q = sm(x, y, z, x + 1);
  int r, int s = sm(q, p, y, z);
  require(r * 1000 + s == expect);
} }`;
  const sd = (a: bigint, b: bigint): bigint => a / b + b / a;
  const expected = (x: bigint, y: bigint, z: bigint): bigint => {
    const p = sd(x, z) + sd(y, x + 1n); const q = sd(x, x + 1n) * sd(z, y);
    const r = sd(q, y) + sd(p, z); const s = sd(q, z) * sd(y, p);
    return r * 1000n + s;
  };
  const bytes = (artifact: { debug?: { bytecode: string } }): number => artifact.debug!.bytecode.length / 2;

  it.each([['opcost'], ['size']] as const)('is never larger than the co-8 schedule (%s)', (optimizeFor) => {
    const co8 = compileString(SYMFALL, {
      optimizeFor, rescheduleStacks: true, crossCallScheduling: false, renumberFunctionIds: false,
    } as never);
    const on = compileString(SYMFALL, { optimizeFor, rescheduleStacks: true });
    const unguarded = compileString(SYMFALL, { optimizeFor, rescheduleStacks: true, crossCallFallback: false } as never);
    // the case the fallback exists for: crosscall alone is larger here
    expect(bytes(unguarded)).toBeGreaterThan(bytes(co8));
    expect(bytes(on)).toBeLessThanOrEqual(bytes(co8));
    [[3n, 5n, 7n], [11n, 2n, 9n], [1234567n, 89n, 4441n]].forEach(([x, y, z]) => {
      expect(evaluate(on.bytecode, [x, y, z, expected(x, y, z)])).toBe(true);
      expect(evaluate(on.bytecode, [x, y, z, expected(x, y, z) + 1n])).toBe(false);
    });
  });
});

describe('debug data of rescheduled bodies', SLOW, () => {
  const BODY_REQ = `function f(int a, int b, int c) returns (int, int) {
  int t = a * b + c * a;
  require(t != 7, "f-t");
  int u = b * c - a * a + t;
  require(u != 9, "f-u");
  return u * t + b, a + u;
}
contract A() {
  function spend(int x, int y, int z) {
    int p, int q = f(x, y, z);
    int r, int s = f(q, p, x);
    require(r + s != 5, "main");
  }
}`;
  const VERIFY_FAMILY = new Set<number>([Op.OP_VERIFY, Op.OP_EQUALVERIFY, Op.OP_NUMEQUALVERIFY]);
  const frameOf = (options: object): { script: Script; requires: { ip: number; line: number }[]; lines: number[] } => {
    const artifact = compileString(BODY_REQ, { disableInlining: true, ...options } as never);
    const frame = artifact.debug!.functions!.find((candidate) => candidate.name === 'f')!;
    const lines = sourceMapToLocationData(frame.sourceMap).map((entry) => entry.location.start.line);
    return { script: bytecodeToScript(hexToBin(frame.bytecode)), requires: [...frame.requires], lines };
  };

  it.each([
    ['co-8 switches', { rescheduleStacks: true, crossCallScheduling: false, renumberFunctionIds: false }],
    ['default', { rescheduleStacks: true }],
    ['size', { rescheduleStacks: true, optimizeFor: 'size' }],
    ['size + block moves', { rescheduleStacks: true, optimizeFor: 'size', blockMoves: true }],
  ])('keep require() ips and lines on the body checks (%s)', (_, options) => {
    const plain = frameOf({});
    const on = frameOf(options);
    // the body was rewritten, and its checks moved
    expect(scriptToBytecode(on.script)).not.toEqual(scriptToBytecode(plain.script));
    expect(on.requires.map((req) => req.line)).toEqual([3, 5]);
    on.requires.forEach((req) => {
      expect(VERIFY_FAMILY.has(on.script[req.ip] as number)).toBe(true);
      expect(on.lines[req.ip]).toBe(req.line);
    });
  });
});

describe('main routines with non-minimal data pushes', SLOW, () => {
  // a bytes literal such as a zero hash is a push the VM never reads as a number; the
  // rescheduler's peephole must not stop at it (it used to throw, which kept main verbatim)
  const ZERO_HASH = `contract C() {
  function spend(int a, int b) {
    require(a * a != 7, "a1");
    require(a * a * b != 9, "a2");
    require(a + a * b != 11, "a3");
    require(sha256(bytes(a)) != 0x0000000000000000000000000000000000000000000000000000000000000000, "h");
    require(a != 3, "last");
  }
}`;
  it.each([['opcost'], ['size']] as const)('are rescheduled (%s)', (optimizeFor) => {
    const plain = compileString(ZERO_HASH, { optimizeFor });
    const on = compileString(ZERO_HASH, { optimizeFor, rescheduleStacks: true });
    expect(on.debug!.bytecode.length).toBeLessThan(plain.debug!.bytecode.length);
    [[2n, 5n], [1n, 1n], [4n, 3n], [3n, 1n], [2n, 3n]].forEach((args) => {
      expect(evaluate(on.bytecode, args)).toBe(evaluate(plain.bytecode, args));
    });
    expect(evaluate(on.bytecode, [2n, 5n])).toBe(true);
    expect(evaluate(on.bytecode, [3n, 1n])).toBe(false);
  });
});
