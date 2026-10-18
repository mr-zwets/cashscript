// Block moves: collapse runs of single-item stack fetches that move or copy a CONTIGUOUS
// block of k stack items into one call of a small looping helper function.
//
// Aggregate values (an Fp2 pair, an Fp6 sextuple, an Fp12 of 12 ints) live on the stack as
// contiguous blocks, and staging one as a call argument compiles to k single-item fetches
// whose depth operands form an arithmetic progression:
//
//   in-order copy      D PICK  D PICK  D PICK ...      (step 0)
//   in-order move      D ROLL  D ROLL  D ROLL ...      (step 0)
//   reversed copy      D PICK  D+2 PICK  D+4 PICK ...  (step 2)
//   reversed move      D ROLL  D+1 ROLL  D+2 ROLL ...  (step 1)
//
// Each fetch costs 2 bytes (D <= 16) or 3 bytes (D > 16), so a 12-item move costs 24-36
// bytes. A helper body that loops the fetch costs ~13 bytes once (OP_DEFINE'd) and 4-5
// bytes per call site (`<a> <k|end> <id> OP_INVOKE`). Functions share the main stack, so
// the helper fetches into the caller's stack directly; its two parameters sit on top and
// every fetched item is tucked beneath them (OP_ROT OP_ROT), which keeps the per-item depth
// constant (step 0) or advancing by 1/2 (reversed forms). The trade: ~7 more evaluated
// instructions per moved item (op-cost), for fewer bytes.
//
// The rewrite is exact: every run is replaced by a call that performs precisely the same
// sequence of PICK/ROLL operations on the caller's stack, and the helpers leave nothing
// else behind. It runs last (after rescheduling and the final bytecode optimisation), on
// every OP_DEFINE'd body and on the main routine, and keeps debug data in step (indices
// inside a collapsed run map to the helper call).
import {
  DebugFrame,
  FullLocationData,
  Op,
  OpOrData,
  OptimiseBytecodeResult,
  RequireStatement,
  Script,
  SourceTagEntry,
  bytecodeToScript,
  calculateBytesize,
  decodeInt,
  encodeInt,
  generateSourceMap,
  generateSourceTags,
  parseSourceTags,
  scriptToBytecode,
  sourceMapToLocationData,
} from '@cashscript/utils';
import { binToHex } from '@bitauth/libauth';

export type BaseKind = 'P0' | 'R0' | 'P2' | 'R1' | 'LP' | 'LR' | 'LM' | 'DB';
// a helper kind: a base kind, or a base kind specialised to a fixed count (`R1#12`): the
// count is baked into the body, so its calls push one parameter less
export type Kind = BaseKind | `${BaseKind}#${number}`;

// helper bodies. Parameters on top of the caller's stack:
//   P0/R0: [.. a k]   a = D + 2 (depth of the target with the 2 params on top), k = count
//   P2/R1: [.. end a] a = D + 2, end = a + step * k
//   LP/LR: [.. list]  list = one byte per fetch, d + 1 (the depth with the list on top)
//   LM:    [.. list]  mixed PICK/ROLL list, byte = 2 * (d + 1) + (PICK ? 1 : 0)
//   DB:    [.. a k]   drop the contiguous block of k items whose shallowest is at depth a - 2
export const HELPER_BODIES: Record<BaseKind, Script> = {
  P0: [
    Op.OP_BEGIN, Op.OP_OVER, Op.OP_PICK, Op.OP_ROT, Op.OP_ROT, Op.OP_1SUB, Op.OP_DUP, Op.OP_NOT, Op.OP_UNTIL, Op.OP_2DROP,
  ],
  R0: [
    Op.OP_BEGIN, Op.OP_OVER, Op.OP_ROLL, Op.OP_ROT, Op.OP_ROT, Op.OP_1SUB, Op.OP_DUP, Op.OP_NOT, Op.OP_UNTIL, Op.OP_2DROP,
  ],
  P2: [
    Op.OP_BEGIN, Op.OP_DUP, Op.OP_PICK, Op.OP_ROT, Op.OP_ROT, Op.OP_2, Op.OP_ADD, Op.OP_2DUP, Op.OP_NUMEQUAL, Op.OP_UNTIL,
    Op.OP_2DROP,
  ],
  R1: [
    Op.OP_BEGIN, Op.OP_DUP, Op.OP_ROLL, Op.OP_ROT, Op.OP_ROT, Op.OP_1ADD, Op.OP_2DUP, Op.OP_NUMEQUAL, Op.OP_UNTIL,
    Op.OP_2DROP,
  ],
  LP: [
    Op.OP_BEGIN, Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP, Op.OP_PICK, Op.OP_SWAP, Op.OP_SIZE, Op.OP_NOT, Op.OP_UNTIL, Op.OP_DROP,
  ],
  LR: [
    Op.OP_BEGIN, Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP, Op.OP_ROLL, Op.OP_SWAP, Op.OP_SIZE, Op.OP_NOT, Op.OP_UNTIL, Op.OP_DROP,
  ],
  LM: [
    Op.OP_BEGIN, Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP, Op.OP_DUP, Op.OP_2, Op.OP_MOD, Op.OP_SWAP, Op.OP_2, Op.OP_DIV, Op.OP_SWAP,
    Op.OP_IF, Op.OP_PICK, Op.OP_ELSE, Op.OP_ROLL, Op.OP_ENDIF, Op.OP_SWAP, Op.OP_SIZE, Op.OP_NOT, Op.OP_UNTIL, Op.OP_DROP,
  ],
  DB: [Op.OP_BEGIN, Op.OP_OVER, Op.OP_ROLL, Op.OP_DROP, Op.OP_1SUB, Op.OP_DUP, Op.OP_NOT, Op.OP_UNTIL, Op.OP_2DROP],
};
const STEP: Record<string, number> = { P0: 0, R0: 0, P2: 2, R1: 1 };
export const ALL_KINDS: BaseKind[] = ['P0', 'R0', 'P2', 'R1', 'LP', 'LR', 'LM', 'DB'];
// kind presets: 'compact' keeps the progression helpers and DB (about half the op-cost increase
// of 'all' for about 97% of its byte saving on the Groth16 singletons); 'all' = ALL_KINDS
export const KIND_PRESETS: Record<'compact' | 'all', BaseKind[]> = {
  compact: ['P0', 'R0', 'P2', 'R1', 'DB'],
  all: ALL_KINDS,
};
const SPECIALISABLE = new Set<BaseKind>(['P0', 'R0', 'P2', 'R1', 'DB']);
const baseOf = (kind: Kind): BaseKind => kind.split('#')[0] as BaseKind;
const fixedCountOf = (kind: Kind): number | undefined => (kind.includes('#') ? Number(kind.split('#')[1]) : undefined);

export interface BlockMoveOptions {
  // helper kinds the pass may use, or a preset (default 'all'; 'compact', or dropping LM / LP / LR,
  // trades bytes for op-cost). An empty list only renumbers function ids.
  kinds?: Kind[] | 'compact' | 'all';
  // add helpers specialised to recurring counts (default true)
  specialise?: boolean;
  // renumber OP_DEFINE'd functions (helpers included) by static call count so the most
  // called ids get 1-byte pushes (ids 0..16)
  renumber?: boolean;
}

// reject malformed options with a clear message (they are internal, so not covered by the
// compiler's option types at runtime)
export function validateBlockMoveOptions(options: unknown): void {
  if (options === undefined || typeof options === 'boolean') return;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error(`blockMoves: expected a boolean or an options object, got ${JSON.stringify(options)}`);
  }
  const { kinds, specialise, renumber, ...rest } = options as BlockMoveOptions;
  const unknown = Object.keys(rest);
  if (unknown.length > 0) throw new Error(`blockMoves: unknown option(s) ${unknown.join(', ')}`);
  if (specialise !== undefined && typeof specialise !== 'boolean') throw new Error('blockMoves: specialise must be a boolean');
  if (renumber !== undefined && typeof renumber !== 'boolean') throw new Error('blockMoves: renumber must be a boolean');
  if (kinds === undefined) return;
  const presets = Object.keys(KIND_PRESETS);
  if (typeof kinds === 'string') {
    if (!presets.includes(kinds)) {
      throw new Error(`blockMoves: unknown kinds preset '${kinds}' (expected ${presets.map((x) => `'${x}'`).join(' or ')}, or a list of kinds)`);
    }
    return;
  }
  if (!Array.isArray(kinds)) throw new Error('blockMoves: kinds must be a preset name or a list of helper kinds');
  kinds.forEach((kind: unknown) => {
    const match = typeof kind === 'string' ? /^([A-Z0-9]+)(?:#(\d+))?$/.exec(kind) : null;
    const base = match?.[1] as BaseKind | undefined;
    const count = match?.[2] === undefined ? undefined : Number(match[2]);
    const valid = match !== null && base !== undefined && ALL_KINDS.includes(base)
      && (count === undefined || (SPECIALISABLE.has(base) && count >= 2 && count <= MAX_CALL_FETCHES));
    if (!valid) {
      throw new Error(`blockMoves: unknown helper kind ${JSON.stringify(kind)} (expected one of ${ALL_KINDS.join(', ')}, `
        + `or P0/R0/P2/R1/DB#<count> with a count in 2..${MAX_CALL_FETCHES})`);
    }
  });
}

const elOpcode = (el: OpOrData): number => (typeof el === 'number' ? el : -1);

// The SDK attributes a failing FINAL require() (which has no VERIFY of its own: the VM checks the
// final stack) to the require whose ip is one past the last instruction that is not function
// cleanup (OP_NIP / OP_DROP / OP_2DROP / OP_ELSE / OP_ENDIF), and reports that instruction's
// source line. Rewrites of the main routine must keep both: this is that ip for `script`.
const SDK_CLEANUP = new Set<number>([Op.OP_ENDIF, Op.OP_NIP, Op.OP_ELSE, Op.OP_DROP, Op.OP_2DROP]);
export function finalVerifyIndex(script: Script): number {
  let i = script.length - 1;
  while (i >= 0 && SDK_CLEANUP.has(elOpcode(script[i]))) i -= 1;
  return i + 1;
}

// Post-passes (rescheduling, the optimiser re-run, block moves) may move, merge or drop the
// main routine's final instructions. Capture the final require before them and re-anchor it
// after them: its ip becomes the new script's finalVerifyIndex, and the instruction before that
// takes the source location the final comparison had (so the SDK reports the require's line).
export function captureFinalRequire(
  result: OptimiseBytecodeResult, constructorParamLength: number,
): (after: OptimiseBytecodeResult) => OptimiseBytecodeResult {
  const before = finalVerifyIndex(result.script);
  const index = result.requires.findIndex((req) => req.ip - constructorParamLength === before);
  const location = result.locationData[before - 1];
  const count = result.requires.length;
  return (after) => {
    const ip = finalVerifyIndex(after.script);
    if (index < 0 || before === 0 || ip === 0 || after.requires.length !== count) return after;
    const requires = after.requires.map((req, i) => (i === index ? { ...req, ip: ip + constructorParamLength } : req));
    const locationData = [...after.locationData];
    if (location !== undefined) locationData[ip - 1] = location;
    return { ...after, requires, locationData };
  };
}

// the small number a push element encodes; undefined for anything else, including data that is
// not a minimally-encoded script number (a bytes literal such as 0x00 is no depth or id: the VM
// would reject it as a PICK/ROLL/INVOKE operand, so it never starts a fetch token)
function constNumOf(el: OpOrData | undefined): number | undefined {
  if (el === undefined) return undefined;
  if (el instanceof Uint8Array) {
    if (el.length > 4) return undefined;
    try { return Number(decodeInt(el)); } catch { return undefined; }
  }
  if (el === Op.OP_0) return 0;
  if (el >= Op.OP_1 && el <= Op.OP_16) return el - (Op.OP_1 - 1);
  return undefined;
}

// minimal push of a small non-negative number (OP_0 / OP_1..16 / data)
const pushOf = (n: number): OpOrData => {
  if (n === 0) return Op.OP_0;
  if (n >= 1 && n <= 16) return (Op.OP_1 - 1 + n) as Op;
  return encodeInt(BigInt(n));
};
const sizeOf = (els: OpOrData[]): number => calculateBytesize(els);

// the body of a helper kind; a specialised body first materialises its fixed parameter
export function helperBody(kind: Kind): Script {
  const base = baseOf(kind);
  const k = fixedCountOf(kind);
  if (k === undefined) return HELPER_BODIES[base];
  // P0/R0/DB take [.. a k]: push k. P2/R1 take [.. end a]: derive end = a + step * k
  const prefix: Script = STEP[base] === undefined || STEP[base] === 0
    ? [pushOf(k)]
    : [Op.OP_DUP, pushOf(STEP[base] * k), Op.OP_ADD, Op.OP_SWAP];
  return [...prefix, ...HELPER_BODIES[base]];
}

// ---------- fetch tokens ----------

// A fetch brings one item to the top: PICK (copy) or ROLL (move) from depth d, measured
// on the stack as it is when that fetch executes. A drop (`<d> ROLL DROP`, NIP, DROP)
// removes the item at depth d instead.
interface Fetch { pick: boolean; d: number; drop?: boolean }
// a token is one or two script elements that perform a fixed sequence of fetches
interface Token { start: number; end: number; fetches: Fetch[]; bytes: number }

const FIXED: Map<number, Fetch[]> = new Map([
  [Op.OP_DUP, [{ pick: true, d: 0 }]],
  [Op.OP_OVER, [{ pick: true, d: 1 }]],
  [Op.OP_SWAP, [{ pick: false, d: 1 }]],
  [Op.OP_ROT, [{ pick: false, d: 2 }]],
  [Op.OP_2DUP, [{ pick: true, d: 1 }, { pick: true, d: 1 }]],
  [Op.OP_3DUP, [{ pick: true, d: 2 }, { pick: true, d: 2 }, { pick: true, d: 2 }]],
  [Op.OP_2OVER, [{ pick: true, d: 3 }, { pick: true, d: 3 }]],
  [Op.OP_2SWAP, [{ pick: false, d: 3 }, { pick: false, d: 3 }]],
  [Op.OP_2ROT, [{ pick: false, d: 5 }, { pick: false, d: 5 }]],
  [Op.OP_TUCK, [{ pick: false, d: 1 }, { pick: true, d: 1 }]],
  [Op.OP_DROP, [{ pick: false, d: 0, drop: true }]],
  [Op.OP_NIP, [{ pick: false, d: 1, drop: true }]],
  [Op.OP_2DROP, [{ pick: false, d: 0, drop: true }, { pick: false, d: 0, drop: true }]],
]);

// maximal segments of consecutive fetch tokens. `fixed` holds instruction indices whose stack
// state debug data refers to (console.log entries and the ips their logged values are read
// at): a segment never runs across one and no token straddles one, so every fixed ip stays the
// start of an element whose preceding stack state is unchanged by the rewrite.
function tokenSegments(script: Script, fixed: ReadonlySet<number> = new Set()): Token[][] {
  const segments: Token[][] = [];
  let current: Token[] = [];
  const flush = (): void => { if (current.length > 0) segments.push(current); current = []; };
  const push = (token: Token): void => {
    if (fixed.has(token.start)) flush();
    for (let ip = token.start + 1; ip < token.end; ip += 1) {
      if (fixed.has(ip)) { flush(); return; }
    }
    current.push(token);
  };
  for (let i = 0; i < script.length;) {
    const d = constNumOf(script[i]);
    const next = i + 1 < script.length ? elOpcode(script[i + 1]) : -1;
    // `TOALTSTACK x m, (DROP|2DROP)..., FROMALTSTACK x m` drops a block of items under the top m
    if (elOpcode(script[i]) === Op.OP_TOALTSTACK) {
      let m = 0;
      while (elOpcode(script[i + m]) === Op.OP_TOALTSTACK) m += 1;
      let j = i + m;
      let dropped = 0;
      while (elOpcode(script[j]) === Op.OP_DROP || elOpcode(script[j]) === Op.OP_2DROP) {
        dropped += elOpcode(script[j]) === Op.OP_DROP ? 1 : 2; j += 1;
      }
      let f = 0;
      while (f < m && elOpcode(script[j + f]) === Op.OP_FROMALTSTACK) f += 1;
      if (dropped > 0 && f === m) {
        const fetches = Array.from({ length: dropped }, () => ({ pick: false, d: m, drop: true }));
        push({ start: i, end: j + m, fetches, bytes: sizeOf(script.slice(i, j + m)) });
        i = j + m; continue;
      }
    }
    if (d !== undefined && next === Op.OP_ROLL && elOpcode(script[i + 2] ?? Op.OP_NOP) === Op.OP_DROP) {
      const fetches = [{ pick: false, d, drop: true }];
      push({ start: i, end: i + 3, fetches, bytes: sizeOf(script.slice(i, i + 3)) });
      i += 3; continue;
    }
    if (d !== undefined && (next === Op.OP_PICK || next === Op.OP_ROLL)) {
      const fetches = [{ pick: next === Op.OP_PICK, d }];
      push({ start: i, end: i + 2, fetches, bytes: sizeOf(script.slice(i, i + 2)) });
      i += 2; continue;
    }
    const fixedFetches = FIXED.get(elOpcode(script[i]));
    if (fixedFetches !== undefined) {
      push({ start: i, end: i + 1, fetches: fixedFetches, bytes: 1 });
      i += 1; continue;
    }
    flush(); i += 1;
  }
  flush();
  return segments;
}

// the helper call that performs exactly `fetches` with helper `kind`, if it can
function encodeCall(kind: Kind, fetches: Fetch[], id: number): Script | undefined {
  const k = fixedCountOf(kind);
  const call = encodeBaseCall(baseOf(kind), fetches, id);
  if (k === undefined || call === undefined) return call;
  if (fetches.length !== k) return undefined;
  // drop the parameter the specialised body materialises itself (P0/R0/DB: the count,
  // pushed second; P2/R1: the end, pushed first)
  return STEP[baseOf(kind)] === undefined || STEP[baseOf(kind)] === 0 ? [call[0], ...call.slice(2)] : call.slice(1);
}

function encodeBaseCall(kind: BaseKind, fetches: Fetch[], id: number): Script | undefined {
  const k = fetches.length;
  if (k === 0) return undefined;
  const first = fetches[0];
  if (kind === 'DB') {
    // a contiguous block: constant depth (shallowest first) or depth decreasing by one
    // (deepest first) both remove original depths [min .. min + k - 1]
    if (!fetches.every((f) => f.drop)) return undefined;
    const constant = fetches.every((f) => f.d === first.d);
    const descending = fetches.every((f, j) => f.d === first.d - j);
    if (!constant && !descending) return undefined;
    const shallowest = constant ? first.d : first.d - (k - 1);
    return [pushOf(shallowest + 2), pushOf(k), pushOf(id), Op.OP_INVOKE];
  }
  if (fetches.some((f) => f.drop)) return undefined;
  if (kind === 'LP' || kind === 'LR' || kind === 'LM') {
    if (kind !== 'LM' && fetches.some((f) => f.pick !== (kind === 'LP'))) return undefined;
    const bytes = fetches.map((f) => (kind === 'LM' ? 2 * (f.d + 1) + (f.pick ? 1 : 0) : f.d + 1));
    // each byte is read as a script number: 1..127 are minimal and positive
    if (bytes.some((b) => b < 1 || b > 127)) return undefined;
    return [Uint8Array.from(bytes), pushOf(id), Op.OP_INVOKE];
  }
  const pick = kind[0] === 'P';
  const step = STEP[kind];
  if (!fetches.every((f, j) => f.pick === pick && f.d === first.d + j * step)) return undefined;
  const a = first.d + 2;
  return step === 0
    ? [pushOf(a), pushOf(k), pushOf(id), Op.OP_INVOKE]
    : [pushOf(a + step * k), pushOf(a), pushOf(id), Op.OP_INVOKE];
}

interface Replacement { start: number; end: number; with: Script; kind: Kind; count: number }

// longest fetch sequence one helper call may cover (bounds the planner's work)
const MAX_CALL_FETCHES = 48;
// helper ids are only fixed by the final renumbering: plan with 2-byte id pushes
const ID_BYTES = 2;

// does fetch `cur` extend (towards the front) a sequence helper `kind` can perform, given
// the fetch that follows it (`next`, undefined when cur is the last one)?
function fits(kind: BaseKind, cur: Fetch, next: Fetch | undefined): boolean {
  if (kind === 'DB') return cur.drop === true;
  if (cur.drop) return false;
  if (kind === 'LM') return 2 * (cur.d + 1) + 1 <= 127;
  if (kind === 'LP' || kind === 'LR') return cur.pick === (kind === 'LP') && cur.d + 1 <= 127;
  return cur.pick === (kind[0] === 'P') && (next === undefined || next.d === cur.d + STEP[kind]);
}

// estimated call size of `kind` for `count` fetches whose first fetch is `first`
function callSize(kind: Kind, first: Fetch, count: number): number {
  const base = baseOf(kind);
  if (fixedCountOf(kind) !== undefined) return sizeOf([pushOf(first.d + 2)]) + ID_BYTES + 1;
  if (base === 'DB') return 4;
  if (base === 'LP' || base === 'LR' || base === 'LM') return sizeOf([new Uint8Array(count)]) + ID_BYTES + 1;
  const a = first.d + 2;
  const second = STEP[base] === 0 ? count : a + STEP[base] * count;
  return sizeOf([pushOf(a), pushOf(second)]) + ID_BYTES + 1;
}

interface Choice { from: number; call?: Script; kind?: Kind; count?: number }

// optimal (min-bytes) cover of a segment by raw tokens and helper calls (dynamic
// programming over token boundaries; a call covers whole tokens)
function planSegment(seg: Token[], kinds: Kind[], ids: Record<string, number>): { reps: Replacement[]; saved: number } {
  const n = seg.length;
  const cost = new Array<number>(n + 1).fill(Infinity);
  const choice: Choice[] = new Array(n + 1);
  cost[0] = 0;
  for (let j = 1; j <= n; j += 1) {
    cost[j] = cost[j - 1] + seg[j - 1].bytes;
    choice[j] = { from: j - 1 };
    // extend the covered range back one token at a time, tracking per kind whether the
    // fetches of tokens i..j-1 still fit it
    const ok = kinds.map(() => true);
    let dbConst = true;
    let dbDesc = true;
    let count = 0;
    let front: Fetch | undefined;
    for (let i = j - 1; i >= 0 && count <= MAX_CALL_FETCHES; i -= 1) {
      for (let f = seg[i].fetches.length - 1; f >= 0; f -= 1) {
        const cur = seg[i].fetches[f];
        for (let q = 0; q < kinds.length; q += 1) if (ok[q] && !fits(baseOf(kinds[q]), cur, front)) ok[q] = false;
        if (front !== undefined && front.d !== cur.d) dbConst = false;
        if (front !== undefined && front.d !== cur.d - 1) dbDesc = false;
        front = cur;
        count += 1;
      }
      if (count >= 2 && count <= MAX_CALL_FETCHES && front !== undefined) {
        for (let q = 0; q < kinds.length; q += 1) {
          const kind = kinds[q];
          const fixed = fixedCountOf(kind);
          const skip = !ok[q] || (fixed !== undefined && fixed !== count)
            || (baseOf(kind) === 'DB' && !dbConst && !dbDesc);
          if (!skip && cost[i] + callSize(kind, front, count) < cost[j]) {
            const call = encodeCall(kind, seg.slice(i, j).flatMap((t) => t.fetches), ids[kind]);
            if (call !== undefined && cost[i] + sizeOf(call) < cost[j]) {
              cost[j] = cost[i] + sizeOf(call);
              choice[j] = { from: i, call, kind, count };
            }
          }
        }
      }
    }
  }
  const reps: Replacement[] = [];
  for (let j = n; j > 0;) {
    const ch = choice[j];
    if (ch.call !== undefined) {
      reps.push({ start: seg[ch.from].start, end: seg[j - 1].end, with: ch.call, kind: ch.kind!, count: ch.count! });
    }
    j = ch.from;
  }
  const raw = seg.reduce((sum, t) => sum + t.bytes, 0);
  return { reps, saved: raw - cost[n] };
}

interface Plan { reps: Replacement[]; bytes: number }

function planScript(segments: Token[][], kinds: Kind[], ids: Record<string, number>): Plan {
  const reps: Replacement[] = [];
  let saved = 0;
  segments.forEach((seg) => {
    const plan = planSegment(seg, kinds, ids);
    plan.reps.forEach((rep) => reps.push(rep));
    saved += plan.saved;
  });
  reps.sort((x, y) => x.start - y.start);
  return { reps, bytes: saved };
}

// BLOCK-MOVE-AWARE SIZE: the bytes `script` would have after this pass collapsed its fetch runs
// with the helper kinds `kinds` (base kinds, each assumed to get a 1-byte id; specialisation and
// the helpers' own definitions are left out, they do not depend on one script's schedule). The
// rescheduler ranks candidates with it under 'size' with block moves, so it judges schedules and
// layouts by the bytes that remain after the post-pass.
export function blockMovedSizeModel(options: boolean | BlockMoveOptions): (script: Script) => number {
  const moveOptions = options === true || options === false ? {} : options;
  const allowed = typeof moveOptions.kinds === 'string' ? KIND_PRESETS[moveOptions.kinds] : (moveOptions.kinds ?? ALL_KINDS);
  const kinds = [...new Set(allowed.map(baseOf))];
  const ids: Record<string, number> = Object.fromEntries(kinds.map((kind, i) => [kind, i]));
  return (script) => sizeOf(script) - planScript(tokenSegments(script), kinds, ids).bytes;
}

interface Rewritten { script: Script; remap: (i: number) => number; changed: boolean }

// an inclusive index range [start, end] after a rewrite: the start maps like any index; the end
// covers everything its element became (a collapsed run it ends in, or a run starting after it
// up to the next old element)
const remapRange = (remap: (i: number) => number, start: number, end: number): [number, number] => (
  [remap(start), Math.max(remap(end), remap(end + 1) - 1)]
);

// frame-local debug strings of a rewritten body: source tags ("start:end:kind;...", script
// indices) and inline ranges ("startIp:endIp:name;...", body ips; a body has no constructor offset)
function remapFrameTags(tags: string, remap: (i: number) => number): string {
  return generateSourceTags(parseSourceTags(tags).map((tag) => {
    const [startIndex, endIndex] = remapRange(remap, tag.startIndex, tag.endIndex);
    return { ...tag, startIndex, endIndex };
  }));
}
function remapFrameInlineRanges(ranges: string, remap: (i: number) => number): string {
  if (ranges === '') return ranges;
  return ranges.split(';').map((segment) => {
    const [startStr, endStr, ...name] = segment.split(':');
    const [start, end] = remapRange(remap, Number(startStr), Number(endStr));
    return [start, end, name.join(':')].join(':');
  }).join(';');
}

function applyReplacements(script: Script, reps: Replacement[]): Rewritten {
  const out: Script = [];
  const starts: { oldStart: number; oldEnd: number; newStart: number; newLen: number }[] = [];
  let r = 0;
  for (let i = 0; i < script.length;) {
    if (r < reps.length && reps[r].start === i) {
      starts.push({ oldStart: i, oldEnd: reps[r].end, newStart: out.length, newLen: reps[r].with.length });
      reps[r].with.forEach((el) => out.push(el));
      i = reps[r].end; r += 1;
    } else { out.push(script[i]); i += 1; }
  }
  const remap = (oldIndex: number): number => {
    let shift = 0;
    for (const s of starts) {
      if (oldIndex < s.oldStart) break;
      if (oldIndex < s.oldEnd) return s.newStart + Math.min(oldIndex - s.oldStart, s.newLen - 1);
      shift = s.newStart + s.newLen - s.oldEnd;
    }
    return oldIndex + shift;
  };
  return { script: out, remap, changed: reps.length > 0 };
}

export function applyBlockMoves(
  result: OptimiseBytecodeResult,
  frames: DebugFrame[],
  constructorParamLength: number,
  options: BlockMoveOptions = {},
): { result: OptimiseBytecodeResult; frames: DebugFrame[] } {
  validateBlockMoveOptions(options);
  const allowed: Kind[] = typeof options.kinds === 'string' ? KIND_PRESETS[options.kinds] : (options.kinds ?? ALL_KINDS);
  // console.log bookkeeping is per-instruction; leave logged contracts untouched
  if (result.logs.length > 0) return { result, frames };

  // dissect the OP_DEFINE table prefix
  const script = result.script;
  const table: { body: Script; idEl: OpOrData; id: number; index: number }[] = [];
  let i = 0;
  while (i + 2 < script.length && script[i] instanceof Uint8Array && elOpcode(script[i + 2]) === Op.OP_DEFINE) {
    const id = constNumOf(script[i + 1]);
    if (id === undefined) break;
    table.push({ body: bytecodeToScript(script[i] as Uint8Array), idEl: script[i + 1], id, index: i });
    i += 3;
  }
  const tableLength = i;
  const main = script.slice(tableLength);
  // the main routine must not define functions itself (ids would be ambiguous)
  if (main.some((el) => elOpcode(el) === Op.OP_DEFINE)) return { result, frames };
  const usedIds = new Set(table.map((t) => t.id));
  let nextFree = 0;
  const helperId: Record<string, number> = {};
  const assignId = (kind: Kind): void => {
    if (helperId[kind] !== undefined) return;
    while (usedIds.has(nextFree)) nextFree += 1;
    helperId[kind] = nextFree;
    usedIds.add(nextFree);
  };
  allowed.forEach(assignId);
  // a body's console.log entries pin the ips they fire at and read their values at
  const frameOf = (body: Script): DebugFrame | undefined => {
    const hex = binToHex(scriptToBytecode(body));
    return frames.find((frame) => frame.bytecode === hex);
  };
  const fixedIps = table.map((t) => {
    const ips = new Set<number>();
    // a require ip stays the start of an element, so its remap is exact (no clamping into a call)
    (frameOf(t.body)?.requires ?? []).forEach((req) => ips.add(req.ip));
    (frameOf(t.body)?.logs ?? []).forEach((log) => {
      ips.add(log.ip);
      log.data.forEach((item) => { if (typeof item !== 'string') ips.add(item.ip); });
    });
    return ips;
  });
  // main's trailing cleanup (and the final-require ip in front of it) stays verbatim, see finalVerifyIndex
  const mainFixed = new Set<number>();
  for (let ip = finalVerifyIndex(main); ip < main.length; ip += 1) mainFixed.add(ip);
  result.requires.forEach((req) => mainFixed.add(req.ip - constructorParamLength - tableLength));
  const allSegments = [...table.map((t, idx) => tokenSegments(t.body, fixedIps[idx])), tokenSegments(main, mainFixed)];

  // choose the helper set: start from all candidate kinds, greedily drop a helper while that
  // does not lower the net saving (call-site savings minus the helper definitions)
  const defineCost = (kind: Kind): number => (
    sizeOf([scriptToBytecode(helperBody(kind)), pushOf(helperId[kind]), Op.OP_DEFINE])
  );
  const netSaving = (kinds: Kind[]): number => (
    allSegments.reduce((sum, segs) => sum + planScript(segs, kinds, helperId).bytes, 0)
    - kinds.reduce((sum, kind) => sum + defineCost(kind), 0)
  );
  const select = (candidates: Kind[]): { kinds: Kind[]; net: number } => {
    let kinds = [...candidates];
    let net = netSaving(kinds);
    for (let improved = true; improved && kinds.length > 0;) {
      improved = false;
      for (const kind of kinds) {
        const trial = kinds.filter((x) => x !== kind);
        const trialNet = netSaving(trial);
        if (trialNet >= net) { net = trialNet; kinds = trial; improved = true; break; }
      }
    }
    return { kinds, net };
  };
  // The greedy drop is not monotonic in the allowed set: a helper that only pays off with
  // another one (LM next to the progressions) can keep the drop loop in a worse local optimum
  // than a smaller allowed set reaches. Also start from the compact preset and from the set
  // without LM (each restricted to the allowed kinds) and keep the best, so a larger allowed
  // set never selects worse than these subsets.
  const starts: Kind[][] = [allowed];
  [allowed.filter((kind) => KIND_PRESETS.compact.includes(baseOf(kind))), allowed.filter((kind) => baseOf(kind) !== 'LM')]
    .forEach((start) => {
      if (start.length > 0 && !starts.some((x) => x.length === start.length && x.every((kind, j) => kind === start[j]))) {
        starts.push(start);
      }
    });
  let { kinds: enabledKinds, net: bestNet } = starts.map(select).reduce((best, x) => (x.net > best.net ? x : best));
  // specialise the counts that recur (e.g. every Fp12 block move of 12 items)
  if (options.specialise !== false && enabledKinds.length > 0) {
    const counts = new Map<string, number>();
    allSegments.forEach((segs) => planScript(segs, enabledKinds, helperId).reps.forEach((rep) => {
      if (!SPECIALISABLE.has(baseOf(rep.kind))) return;
      const key = `${baseOf(rep.kind)}#${rep.count}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }));
    const specials = [...counts.entries()].filter(([, c]) => c >= 3).map(([key]) => key as Kind);
    if (specials.length > 0) {
      specials.forEach(assignId);
      const second = select([...enabledKinds, ...specials]);
      if (second.net > bestNet) ({ kinds: enabledKinds, net: bestNet } = second);
    }
  }
  if (enabledKinds.length === 0 || bestNet <= 0) return { result, frames };

  const rewrite = (s: Script, fixed?: ReadonlySet<number>): Rewritten => (
    applyReplacements(s, planScript(tokenSegments(s, fixed), enabledKinds, helperId).reps)
  );

  // bodies
  const newBodies = table.map((t, idx) => rewrite(t.body, fixedIps[idx]));
  const mainRw = rewrite(main, mainFixed);

  // rebuild: original table (rewritten bodies), helper defines, main
  const out: Script = [];
  const locationData: FullLocationData = [];
  const firstLoc = result.locationData[0];
  table.forEach((t, idx) => {
    out.push(scriptToBytecode(newBodies[idx].script), t.idEl, Op.OP_DEFINE);
    for (let k = 0; k < 3; k += 1) locationData.push(result.locationData[t.index + k]);
  });
  const helperKinds = enabledKinds;
  helperKinds.forEach((kind) => {
    out.push(scriptToBytecode(helperBody(kind)), pushOf(helperId[kind]), Op.OP_DEFINE);
    for (let k = 0; k < 3; k += 1) locationData.push(result.locationData[tableLength - 1] ?? firstLoc);
  });
  const extra = 3 * helperKinds.length;
  mainRw.script.forEach((el) => out.push(el));
  // main location data: each new element takes the location of the old element it maps from
  const mainLoc: FullLocationData = new Array(mainRw.script.length);
  for (let old = 0; old < main.length; old += 1) {
    const n = mainRw.remap(old);
    if (mainLoc[n] === undefined) mainLoc[n] = result.locationData[tableLength + old];
  }
  for (let n = 0; n < mainLoc.length; n += 1) mainLoc[n] ??= mainLoc[n - 1] ?? firstLoc;
  mainLoc.forEach((loc) => locationData.push(loc));

  const remapTop = (oldIndex: number): number => (
    oldIndex < tableLength ? oldIndex : tableLength + extra + mainRw.remap(oldIndex - tableLength)
  );
  const requires = result.requires.map((req: RequireStatement) => ({
    ...req, ip: remapTop(req.ip - constructorParamLength) + constructorParamLength,
  }));
  const sourceTags = result.sourceTags.map((tag: SourceTagEntry) => {
    const [startIndex, endIndex] = tag.startIndex < tableLength
      ? [remapTop(tag.startIndex), remapTop(tag.endIndex)] : remapRange(remapTop, tag.startIndex, tag.endIndex);
    return { ...tag, startIndex, endIndex };
  });
  // inline ranges (ips of main code): shifted past the helper defines, remapped as ranges
  const inlineRanges = result.inlineRanges.map((range) => {
    const start = range.startIp - constructorParamLength;
    const end = range.endIp - constructorParamLength;
    if (start < tableLength) return range;
    const [newStart, newEnd] = remapRange(remapTop, start, end);
    return { ...range, startIp: newStart + constructorParamLength, endIp: newEnd + constructorParamLength };
  });

  // frames of rewritten bodies: remap their source maps and require ips
  const newFrames = frames.map((frame) => {
    const idx = table.findIndex((t) => binToHex(scriptToBytecode(t.body)) === frame.bytecode);
    if (idx < 0 || !newBodies[idx].changed) return frame;
    const rw = newBodies[idx];
    const oldLoc = sourceMapToLocationData(frame.sourceMap);
    const loc: FullLocationData = new Array(rw.script.length);
    for (let old = 0; old < oldLoc.length; old += 1) {
      const n = rw.remap(old);
      if (n < loc.length && loc[n] === undefined) loc[n] = oldLoc[old];
    }
    for (let n = 0; n < loc.length; n += 1) loc[n] ??= loc[n - 1] ?? oldLoc[0];
    return {
      ...frame,
      bytecode: binToHex(scriptToBytecode(rw.script)),
      sourceMap: generateSourceMap(loc),
      requires: frame.requires.map((req) => ({ ...req, ip: rw.remap(req.ip) })),
      // exact: no collapsed run contains a log's ips (tokenSegments' fixed ips)
      logs: frame.logs.map((log) => ({
        ...log,
        ip: rw.remap(log.ip),
        data: log.data.map((item) => (typeof item === 'string' ? item : { ...item, ip: rw.remap(item.ip) })),
      })),
      ...(frame.sourceTags !== undefined ? { sourceTags: remapFrameTags(frame.sourceTags, rw.remap) } : {}),
      ...(frame.inlineRanges !== undefined ? { inlineRanges: remapFrameInlineRanges(frame.inlineRanges, rw.remap) } : {}),
    };
  });

  return {
    result: {
      ...result, script: out, locationData, requires, sourceTags, inlineRanges,
    },
    frames: newFrames,
  };
}

// Renumber the OP_DEFINE'd functions by static call count (most-called first), so the
// hottest call sites push their id with a 1-byte opcode (ids 0..16). Only element
// contents change (never element counts), so source maps and debug ips stay valid. Skipped
// when any OP_INVOKE does not take its id from an immediately preceding constant push, or
// when the main routine defines functions itself.
export function renumberFunctions(
  result: OptimiseBytecodeResult,
  frames: DebugFrame[],
): { result: OptimiseBytecodeResult; frames: DebugFrame[] } {
  const script = result.script;
  const table: { body: Script; id: number; index: number }[] = [];
  let i = 0;
  while (i + 2 < script.length && script[i] instanceof Uint8Array && elOpcode(script[i + 2]) === Op.OP_DEFINE) {
    const id = constNumOf(script[i + 1]);
    if (id === undefined) break;
    table.push({ body: bytecodeToScript(script[i] as Uint8Array), id, index: i });
    i += 3;
  }
  const main = script.slice(i);
  if (table.length === 0 || main.some((el) => elOpcode(el) === Op.OP_DEFINE)) return { result, frames };
  const known = new Set(table.map((t) => t.id));
  const counts = new Map<number, number>(table.map((t) => [t.id, 0]));
  const allScripts = [...table.map((t) => t.body), main];
  for (const s of allScripts) {
    for (let j = 0; j < s.length; j += 1) {
      if (elOpcode(s[j]) !== Op.OP_INVOKE) continue;
      const id = j > 0 ? constNumOf(s[j - 1]) : undefined;
      if (id === undefined || !known.has(id)) return { result, frames };
      counts.set(id, counts.get(id)! + 1);
    }
  }
  const order = [...table.map((t) => t.id)].sort((a, b) => (counts.get(b)! - counts.get(a)!) || (a - b));
  const newId = new Map(order.map((id, idx) => [id, idx]));
  const renumber = (s: Script): Script => s.map((el, j) => (
    j + 1 < s.length && elOpcode(s[j + 1]) === Op.OP_INVOKE ? pushOf(newId.get(constNumOf(el)!)!) : el
  ));
  const out: Script = [...script];
  const bodyHex = new Map<string, { hex: string; id: number }>();
  table.forEach((t) => {
    const body = scriptToBytecode(renumber(t.body));
    bodyHex.set(binToHex(script[t.index] as Uint8Array), { hex: binToHex(body), id: newId.get(t.id)! });
    out[t.index] = body;
    out[t.index + 1] = pushOf(newId.get(t.id)!);
  });
  renumber(main).forEach((el, j) => { out[i + j] = el; });
  const newFrames = frames.map((frame) => {
    if (frame.id === undefined) return frame;
    const entry = bodyHex.get(frame.bytecode);
    const id = newId.get(frame.id);
    return {
      ...frame,
      ...(id !== undefined ? { id } : {}),
      ...(entry !== undefined ? { bytecode: entry.hex } : {}),
    };
  });
  return { result: { ...result, script: out }, frames: newFrames };
}
