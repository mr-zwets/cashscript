import {
  binToHex,
  createTestAuthenticationProgramBch,
  createVirtualMachineBch2026,
  encodeAuthenticationInstructions,
  hexToBin,
} from '@bitauth/libauth';
import {
  bytecodeToScript, encodeInt, Op, OpOrData, OptimiseBytecodeResult, parseSourceTags, PositionHint, Script, scriptToAsm,
  scriptToBytecode,
} from '@cashscript/utils';
import {
  ALL_KINDS, applyBlockMoves, BlockMoveOptions, HELPER_BODIES, KIND_PRESETS, renumberFunctions, validateBlockMoveOptions,
} from '../src/block-moves.js';
import { compileStringInternal } from '../src/compiler.js';

const vm = createVirtualMachineBch2026(false);

// run a script over one padding item (it buys op-cost budget and sits below everything the
// program touches); returns the final main stack as hex (or the error)
const PADDING = scriptToBytecode([new Uint8Array(9000)]);
function run(script: Script): string {
  const state = vm.evaluate(createTestAuthenticationProgramBch({
    lockingBytecode: scriptToBytecode(script),
    unlockingBytecode: PADDING,
    valueSatoshis: 1000n,
  }));
  const stack = state.stack.slice(1).map((item: Uint8Array) => Buffer.from(item).toString('hex')).join(',');
  const alt = state.alternateStack.length;
  // the clean-stack / single-item checks are expected to fail for these raw stack programs
  const benign = state.error === undefined || /clean stack|exactly one|single|Non-P2SH/i.test(String(state.error));
  return benign ? `${stack}|alt${alt}` : `error: ${state.error}`;
}

const loc = { location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, positionHint: PositionHint.START };
const pushN = (n: number): OpOrData => (n === 0 ? Op.OP_0 : n <= 16 ? (Op.OP_1 - 1 + n) as Op : encodeInt(BigInt(n)));

// deterministic PRNG
const prng = (seed: number): ((n: number) => number) => {
  let x = seed;
  return (n: number): number => { x = (x * 1103515245 + 12345) % 2147483648; return x % n; };
};

// a random straight-line program over a stack of distinct items: runs of in-order /
// reversed copies and moves of contiguous blocks, scattered fetches, drops and
// altstack-drop sequences, with a dummy defined function in the table
function randomProgram(seed: number): Script {
  const rnd = prng(seed);
  const script: Script = [Uint8Array.of(Op.OP_1ADD), Op.OP_0, Op.OP_DEFINE];
  let depth = 40;
  for (let i = 0; i < depth; i += 1) script.push(encodeInt(BigInt(1000 + i)));
  for (let step = 0; step < 30; step += 1) {
    const kindPick = rnd(8);
    const k = 2 + rnd(10);
    if (kindPick <= 1) {
      // in-order block copy / move
      const op = kindPick === 0 ? Op.OP_PICK : Op.OP_ROLL;
      const d = k - 1 + rnd(Math.max(1, depth - k));
      if (d >= depth) continue;
      for (let j = 0; j < k; j += 1) script.push(pushN(d), op);
      if (op === Op.OP_PICK) depth += k;
    } else if (kindPick === 2) {
      // reversed copy: D, D+2, ...
      const d = rnd(Math.max(1, depth - k));
      if (d + k - 1 >= depth) continue;
      for (let j = 0; j < k; j += 1) script.push(pushN(d + 2 * j), Op.OP_PICK);
      depth += k;
    } else if (kindPick === 3) {
      // reversed move: D, D+1, ...
      const d = rnd(Math.max(1, depth - k));
      if (d + k - 1 >= depth) continue;
      for (let j = 0; j < k; j += 1) script.push(pushN(d + j), Op.OP_ROLL);
    } else if (kindPick === 4) {
      // scattered fetches (list helpers), mixed pick/roll
      for (let j = 0; j < k; j += 1) {
        const pick = rnd(2) === 0;
        script.push(pushN(rnd(depth)), pick ? Op.OP_PICK : Op.OP_ROLL);
        if (pick) depth += 1;
      }
    } else if (kindPick === 5 && depth > 20) {
      // drop a contiguous block (constant or descending depths)
      const d = rnd(8);
      const n = 2 + rnd(5);
      const descending = rnd(2) === 0;
      for (let j = 0; j < n; j += 1) script.push(pushN(descending ? d + n - 1 - j : d), Op.OP_ROLL, Op.OP_DROP);
      depth -= n;
    } else if (kindPick === 6 && depth > 20) {
      const m = 1 + rnd(6);
      const n = 1 + rnd(6);
      for (let j = 0; j < m; j += 1) script.push(Op.OP_TOALTSTACK);
      for (let j = 0; j < n; j += 1) script.push(Op.OP_DROP);
      for (let j = 0; j < m; j += 1) script.push(Op.OP_FROMALTSTACK);
      depth -= n;
    } else {
      const ops = [
        Op.OP_SWAP, Op.OP_ROT, Op.OP_2SWAP, Op.OP_2ROT, Op.OP_OVER, Op.OP_DUP, Op.OP_2DUP, Op.OP_2OVER, Op.OP_TUCK,
        Op.OP_3DUP,
      ];
      const grow = [0, 0, 0, 0, 1, 1, 2, 2, 1, 3];
      const o = rnd(ops.length);
      script.push(ops[o]);
      depth += grow[o];
      // keep the defined function in use
      script.push(Op.OP_0, Op.OP_INVOKE);
    }
  }
  return script;
}

// generous timeout: the random-program and selection tests are slow on a loaded machine
describe('block moves (blockMoves)', { timeout: 60_000 }, () => {
  const KIND_SETS = [ALL_KINDS, ...ALL_KINDS.map((kind) => [kind])];
  const asResult = (script: Script): OptimiseBytecodeResult => ({
    script, locationData: script.map(() => loc), logs: [], requires: [], sourceTags: [], inlineRanges: [],
  });

  it.each(Array.from({ length: 40 }, (_, i) => [i]))('preserves the stack effect of random fetch programs (seed %i)', (seed) => {
    const script = randomProgram(seed + 1);
    const before = run(script);
    expect(before).not.toMatch(/^error/);
    KIND_SETS.forEach((kinds) => {
      const moved = applyBlockMoves(asResult(script), [], 0, { kinds });
      const renumbered = renumberFunctions(moved.result, moved.frames);
      expect(run(moved.result.script)).toEqual(before);
      expect(run(renumbered.result.script)).toEqual(before);
      expect(moved.result.locationData.length).toEqual(moved.result.script.length);
    });
  });

  it.each(ALL_KINDS.map((kind) => [kind]))('uses the %s helper on some random program', (kind) => {
    const body = Buffer.from(scriptToBytecode(HELPER_BODIES[kind])).toString('hex');
    const used = Array.from({ length: 80 }, (_, i) => randomProgram(i + 1)).some((script) => (
      Buffer.from(scriptToBytecode(applyBlockMoves(asResult(script), [], 0, { kinds: [kind] }).result.script))
        .toString('hex').includes(body)
    ));
    expect(used).toBe(true);
  });

  it('shrinks the random programs', () => {
    const script = randomProgram(7);
    const result = {
      script, locationData: script.map(() => loc), logs: [], requires: [], sourceTags: [], inlineRanges: [],
    };
    const moved = applyBlockMoves(result, [], 0, { kinds: ALL_KINDS });
    expect(scriptToBytecode(moved.result.script).length).toBeLessThan(scriptToBytecode(script).length);
  });

  // aggregate-style contract: 12-int arguments copied and consumed as blocks
  const CONTRACT = `
    function add6(int a0, int a1, int a2, int a3, int a4, int a5, int b0, int b1, int b2, int b3, int b4, int b5)
      returns (int, int, int, int, int, int) {
      return (a0 + b0) % 1000003, (a1 + b1) % 1000003, (a2 + b2) % 1000003,
        (a3 + b3) % 1000003, (a4 + b4) % 1000003, (a5 + b5) % 1000003;
    }
    function mul12(int a0, int a1, int a2, int a3, int a4, int a5, int a6, int a7, int a8, int a9, int a10, int a11,
      int b0, int b1, int b2, int b3, int b4, int b5, int b6, int b7, int b8, int b9, int b10, int b11)
      returns (int, int, int, int, int, int, int, int, int, int, int, int) {
      (int c0, int c1, int c2, int c3, int c4, int c5) = add6(a0, a1, a2, a3, a4, a5, b0, b1, b2, b3, b4, b5);
      (int d0, int d1, int d2, int d3, int d4, int d5) = add6(a6, a7, a8, a9, a10, a11, b6, b7, b8, b9, b10, b11);
      (int g0, int g1, int g2, int g3, int g4, int g5) = add6(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
      (int f0, int f1, int f2, int f3, int f4, int f5) = add6(c0, c1, c2, c3, c4, c5, g0, g1, g2, g3, g4, g5);
      return f0, f1, f2, f3, f4, f5, d0, d1, d2, d3, d4, d5;
    }
    contract Agg() {
      function spend(int x, int y) {
        int f0 = x; int f1 = y; int f2 = 3; int f3 = 4; int f4 = 5; int f5 = 6;
        int f6 = 7; int f7 = 8; int f8 = 9; int f9 = 10; int f10 = 11; int f11 = 12;
        for (int i = 0; i < 3; i = i + 1) {
          (f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11) =
            mul12(f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f11, f10, f9, f8, f7, f6, f5, f4, f3, f2, f1, f0);
        }
        require(f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8 + f9 + f10 + f11 != 77);
      }
    }`;

  const evaluate = (bytecode: string, args: bigint[]): boolean => {
    const unlocking = scriptToBytecode([...args].reverse().map((arg) => encodeInt(arg)));
    const state = vm.evaluate(createTestAuthenticationProgramBch({
      lockingBytecode: hexToBin(bytecode), unlockingBytecode: unlocking, valueSatoshis: 1000n,
    }));
    const top = state.stack[state.stack.length - 1];
    return state.error === undefined && state.stack.length === 1 && top !== undefined && top.length === 1 && top[0] === 1;
  };

  it.each([[{ rescheduleStacks: true }], [{}]])('compiles an aggregate contract smaller and equivalently (%o)', (base) => {
    const plain = compileStringInternal(CONTRACT, base);
    const moved = compileStringInternal(CONTRACT, { ...base, blockMoves: { kinds: ALL_KINDS } });
    expect(moved.debug!.bytecode.length).toBeLessThan(plain.debug!.bytecode.length);
    for (const args of [[1n, 2n], [5n, 9n], [123456n, 654321n], [0n, 0n]]) {
      expect(evaluate(moved.debug!.bytecode, args)).toEqual(evaluate(plain.debug!.bytecode, args));
    }
    // one source-map entry per script element
    expect(moved.debug!.sourceMap.split(';').length)
      .toEqual(bytecodeToScript(hexToBin(moved.debug!.bytecode)).length);
  });

  it('ignores non-minimally-encoded data pushes (bytes literals)', () => {
    const script: Script = [
      Uint8Array.of(Op.OP_1ADD), Op.OP_0, Op.OP_DEFINE,
      ...Array.from({ length: 12 }, (_, i) => encodeInt(BigInt(100 + i))),
      Uint8Array.of(0x00), Uint8Array.of(0x00, 0x00), Uint8Array.of(0x01, 0x00), Op.OP_2DROP, Op.OP_DROP,
      ...Array.from({ length: 6 }, () => [Op.OP_8, Op.OP_PICK]).flat(),
      Uint8Array.of(0x80), Op.OP_DROP,
    ];
    const moved = applyBlockMoves(asResult(script), [], 0, { kinds: ALL_KINDS });
    expect(run(moved.result.script)).toEqual(run(script));
    expect(run(renumberFunctions(moved.result, moved.frames).result.script)).toEqual(run(script));
  });

  it('resolves the kind presets', () => {
    const script = randomProgram(11);
    const compact = applyBlockMoves(asResult(script), [], 0, { kinds: 'compact', specialise: false });
    const explicit = applyBlockMoves(asResult(script), [], 0, { kinds: KIND_PRESETS.compact, specialise: false });
    const all = applyBlockMoves(asResult(script), [], 0, { kinds: 'all', specialise: false });
    const allExplicit = applyBlockMoves(asResult(script), [], 0, { kinds: ALL_KINDS, specialise: false });
    expect(compact.result.script).toEqual(explicit.result.script);
    expect(all.result.script).toEqual(allExplicit.result.script);
    expect(run(compact.result.script)).toEqual(run(script));
    // compact never defines a list helper
    const listBodies = (['LP', 'LR', 'LM'] as const).map((kind) => Buffer.from(scriptToBytecode(HELPER_BODIES[kind])).toString('hex'));
    const hex = Buffer.from(scriptToBytecode(compact.result.script)).toString('hex');
    listBodies.forEach((body) => expect(hex.includes(body)).toBe(false));
  });

  // console.log in a global function body: the log's ip and the ips its values are read at
  // must survive the rewrite (no collapsed run may contain them), so the logged values read
  // from a VM trace are those of the plain compile
  it('keeps console.log data of rewritten bodies exact', () => {
    const LOGGED = `
      function h(int a, int b, int c, int d, int e, int f, int g, int i) returns (int) {
        return a - b * 2 + c - d * 3 + e - f + g * 5 - i;
      }
      function body(int a, int b, int c, int d, int e, int f, int g, int i) returns (int) {
        int x = h(a, b, c, d, e, f, g, i);
        int y = h(a, b, c, d, e, f, g, x);
        int z = h(a, b, c, d, e, f, y, x);
        console.log("in body: x =", x, "y =", y, "z =", z, "a =", a);
        return x + y * 3 + z * 7 + a + b + c + d + e + f + g + i;
      }
      contract L() {
        function spend(int a, int b, int c, int d, int e, int f, int g, int i) {
          int r = body(a, b, c, d, e, f, g, i);
          int s = body(i, g, f, e, d, c, b, a);
          require(r != s + 1);
        }
      }`;
    const args = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const loggedValues = (options: object): { values: string[]; bytes: number } => {
      const artifact = compileStringInternal(LOGGED, { disableInlining: true, ...options });
      const frame = artifact.debug!.functions!.find((f) => f.name === 'body')!;
      expect(frame.logs.length).toBe(1);
      const trace = vm.debug(createTestAuthenticationProgramBch({
        lockingBytecode: hexToBin(artifact.debug!.bytecode),
        // a padding item below the arguments buys op-cost budget (it only fails the final clean-stack check)
        unlockingBytecode: scriptToBytecode([new Uint8Array(9000), ...[...args].reverse().map((arg) => encodeInt(arg))]),
        valueSatoshis: 1000n,
      }));
      const values: string[] = [];
      trace.forEach((state) => {
        if (binToHex(encodeAuthenticationInstructions(state.instructions)) !== frame.bytecode) return;
        frame.logs[0].data.forEach((item) => {
          if (typeof item === 'string' || item.ip !== state.ip) return;
          values.push(binToHex(state.stack[state.stack.length - 1 - item.stackIndex]));
        });
      });
      return { values, bytes: hexToBin(artifact.debug!.bytecode).length };
    };
    const plain = loggedValues({});
    expect(plain.values.length).toBe(8); // 4 values x 2 calls
    [{ blockMoves: true }, { rescheduleStacks: true, optimizeFor: 'size', blockMoves: true }].forEach((options) => {
      const moved = loggedValues(options);
      expect(moved.bytes).toBeLessThan(plain.bytes);
      expect(moved.values).toEqual(plain.values);
    });
  });

  // the helper selection starts from several subsets, so allowing more kinds never selects
  // worse than the compact preset or the set without LM. With a single greedy start, 13 of
  // seeds 1..60 selected worse under 'all' (these seeds among them); now none does.
  it.each([[false], [true]])('selects no worse with more allowed kinds (specialise %s)', (specialise) => {
    const bytes = (script: Script, kinds: BlockMoveOptions['kinds']): number => (
      scriptToBytecode(applyBlockMoves(asResult(script), [], 0, { kinds, specialise }).result.script).length
    );
    [5, 10, 17, 18, 21, 34].forEach((seed) => {
      const script = randomProgram(seed);
      const all = bytes(script, 'all');
      expect(all).toBeLessThanOrEqual(bytes(script, 'compact'));
      expect(all).toBeLessThanOrEqual(bytes(script, ALL_KINDS.filter((kind) => kind !== 'LM')));
    });
  });

  it('rejects unknown kinds and presets with a clear error', () => {
    expect(() => compileStringInternal(CONTRACT, { blockMoves: { kinds: 'compactt' as never } }))
      .toThrow(/unknown kinds preset 'compactt'/);
    expect(() => compileStringInternal(CONTRACT, { blockMoves: { kinds: ['P9' as never] } }))
      .toThrow(/unknown helper kind "P9"/);
    expect(() => compileStringInternal(CONTRACT, { blockMoves: { kinds: ['LM#12' as never] } }))
      .toThrow(/unknown helper kind "LM#12"/);
    expect(() => compileStringInternal(CONTRACT, { blockMoves: { kind: 'all' } as never })).toThrow(/unknown option\(s\) kind/);
    expect(() => validateBlockMoveOptions({ kinds: ['P0', 'R1#12', 'DB'], specialise: false })).not.toThrow();
  });

  it('is off by default', () => {
    expect(compileStringInternal(CONTRACT, {}).bytecode)
      .toEqual(compileStringInternal(CONTRACT, { blockMoves: false }).bytecode);
  });
});

// review round 4: main's inline ranges and a rewritten body's source tags used to be dropped
describe('block moves keep debug ranges', { timeout: 60_000 }, () => {
  const RANGES = `
function assertPositive(int value) {
  require(value > 0, "must be positive");
}
function mix(int a, int b, int c, int d, int e, int f) returns (int) {
  int acc = 0;
  for (int i = 0; i < 3; i = i + 1) {
    acc = acc + mix6(a, b, c, d, e, f) * i;
  }
  return acc + mix6(a, b, c, d, e, f);
}
function mix6(int a, int b, int c, int d, int e, int f) returns (int) {
  return a * b + c * d + e * f;
}
contract C() {
  function spend(int a, int b, int c, int d, int e, int f, int g) {
    int m = mix(a, b, c, d, e, f);
    assertPositive(g);
    int n = mix(a, b, c, d, e, f) + mix(b, c, d, e, f, a);
    require(m + n + g > 7);
  }
}`;
  // the ops of a range that are not stack movement, pushes or calls (block moves only collapse those)
  const MOVES = /^OP_(PICK|ROLL|DUP|OVER|SWAP|ROT|2DUP|3DUP|2OVER|2SWAP|2ROT|TUCK|NIP|DROP|2DROP|INVOKE|\d+|1NEGATE)$/;
  const core = (script: Script, start: number, end: number): string => scriptToAsm(script.slice(start, end + 1))
    .split(' ').filter((token) => token.startsWith('OP_') && !MOVES.test(token)).join(' ');
  const parse = (ranges: string | undefined): [number, number, string][] => (ranges ?? '').split(';').filter(Boolean)
    .map((range) => { const [start, end, name] = range.split(':'); return [Number(start), Number(end), name]; });

  it('keeps main inline ranges and body source tags on the same code', () => {
    const plain = compileStringInternal(RANGES, {});
    const moved = compileStringInternal(RANGES, { blockMoves: true });
    expect(moved.debug!.bytecode.length).toBeLessThan(plain.debug!.bytecode.length);
    const plainScript = bytecodeToScript(hexToBin(plain.debug!.bytecode));
    const movedScript = bytecodeToScript(hexToBin(moved.debug!.bytecode));
    const plainRanges = parse(plain.debug!.inlineRanges);
    const movedRanges = parse(moved.debug!.inlineRanges);
    expect(plainRanges.length).toBeGreaterThan(0);
    expect(movedRanges.map(([, , name]) => name)).toEqual(plainRanges.map(([, , name]) => name));
    // helper defines were inserted before main, so the ranges moved
    expect(movedRanges[0][0]).not.toBe(plainRanges[0][0]);
    movedRanges.forEach(([start, end], k) => {
      expect(core(movedScript, start, end)).toEqual(core(plainScript, plainRanges[k][0], plainRanges[k][1]));
    });
    // the looping body was rewritten; its loop tags cover the same code
    const frame = (artifact: typeof plain): { script: Script; tags: ReturnType<typeof parseSourceTags> } => {
      const f = artifact.debug!.functions!.find((candidate) => candidate.name === 'mix')!;
      return { script: bytecodeToScript(hexToBin(f.bytecode)), tags: parseSourceTags(f.sourceTags ?? '') };
    };
    const [before, after] = [frame(plain), frame(moved)];
    expect(after.script.length).toBeLessThan(before.script.length);
    expect(before.tags.length).toBeGreaterThan(0);
    expect(after.tags.map((tag) => tag.kind)).toEqual(before.tags.map((tag) => tag.kind));
    after.tags.forEach((tag, k) => {
      expect(core(after.script, tag.startIndex, tag.endIndex))
        .toEqual(core(before.script, before.tags[k].startIndex, before.tags[k].endIndex));
    });
  });
});
