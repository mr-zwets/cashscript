// Stack rescheduling: re-derive the evaluation schedule of straight-line code from its
// dataflow DAG so operands are on top of the stack when needed, instead of fetching every
// read from a variable slot with `<depth> OP_PICK/OP_ROLL` pairs.
//
// The compiled script is split into basic blocks at control opcodes (IF/ELSE/ENDIF,
// BEGIN/UNTIL) and side-effecting checks (VERIFY-family, CLTV/CSV). Each block is lifted
// to a value DAG over its (opaque) entry stack slots, then re-emitted by a scheduler that
// walks the DAG in dependency order, choosing per operand between consuming moves
// (SWAP/ROT/ROLL), copies (DUP/OVER/PICK) and re-pushing constants. Because every block
// reproduces its exact entry->exit stack layout and the control opcodes are kept verbatim
// and in order, blocks compose and the transform is semantics-preserving by construction.
// Per block the compiler keeps min(original, rescheduled), so no block ever gets worse.
//
// The exit-layout guarantee alone does not cover DEAD COMPUTATION: a value computed but
// never reaching the block's exit. Script failure aborts the whole evaluation, so
// rejecting a spend is the only observable effect a dead node has — and the realistic
// instance is a VOID FUNCTION CALL, whose require() lives inside the OP_DEFINE'd body:
// the call site is an invoke node with zero outputs, dead by construction. The scheduler
// only emits nodes reachable from the exit, so a re-emitted block would silently delete
// the guard (and the well-formedness checks it performs on witness data), accepting
// spends the original rejects. Blocks containing dead computation are therefore never
// re-emitted: they keep their original ops verbatim (see hasDeadComputation), and any
// variant that cannot keep them (permuted entry layout or callee conventions) is
// discarded wholesale.
//
// Objectives (follows `optimizeFor`):
//   'size'   — candidate schedules ranked by serialized bytes.
//   'opcost' — ranked by the BCH2026 op-cost meter (100 per evaluated instruction + the
//              bytes it pushes; SWAP/ROT push 0, copies push the item, ROLL pushes
//              item+depth, so e.g. re-pushing a 32-byte constant (~132) beats PICKing a
//              stashed copy (~234)). Right for op-bound contracts whose unlocking scripts
//              are zero-padded to buy op budget.
//
// OP_DEFINE'd function bodies are additionally validated by a differential test on a
// loosened VM with a finite op-cost budget (random and small input vectors, see TEST VECTORS;
// the rescheduled body must reproduce the original's output stack byte for byte) and, under
// 'opcost', selected by MEASURED op-cost rather than the static estimate. The main routine
// cannot be executed standalone (it reads transaction context), so it relies on the
// per-block structural guarantee and static ranking.
//
// ENTRY-LAYOUT SEARCH: the pass also chooses, per OP_DEFINE'd function, the stack ORDER
// in which its arguments arrive — jointly with the schedule (the optimal order depends
// on the schedule and vice versa), including a small beam search over node orders. Call
// sites already stage arguments explicitly, so a permuted convention costs nothing extra
// there; every caller (and the main routine, when it invokes a permuted callee directly)
// is re-emitted to stage arguments in the callee's chosen order, and the plain-cashc
// variant of any block that invokes a permuted callee is invalid and excluded from the
// per-block min. If any validation fails, the pass falls back to identity layouts
// wholesale.
//
// This pass is opt-in (`rescheduleStacks`), runs after bytecode optimisation, and is
// restricted to single-function contracts (with a function selector, the entry stack
// depth differs per spend path, which this block model does not represent). Scripts and
// bodies containing console.log statements are left untouched (wholesale reordering
// cannot preserve per-instruction log data). Rescheduled regions keep coarse debug info:
// every emitted opcode of a rewritten block maps to the block's merged source span, and
// require() messages re-anchor to their (preserved) verify boundary.
import {
  ConsensusBch2025,
  binToHex,
  createInstructionSetBch2026,
  createTestAuthenticationProgramBch,
  createVirtualMachine,
  ripemd160,
  secp256k1,
  sha1,
  sha256,
} from '@bitauth/libauth';
import {
  DebugFrame,
  FullLocationData,
  Op,
  OpOrData,
  OptimiseBytecodeResult,
  PositionHint,
  RequireStatement,
  Script,
  SingleLocationData,
  SourceTagEntry,
  bytecodeToScript,
  calculateBytesize,
  decodeInt,
  encodeInt,
  generateSourceMap,
  optimiseBytecode,
  scriptToBytecode,
  sourceMapToLocationData,
} from '@cashscript/utils';

export interface FunctionArity { in: number; out: number }

export interface RescheduleOptions {
  arities: Map<number, FunctionArity>; // per OP_DEFINE'd functionId
  mainInArity: number; // spend parameters + constructor parameters
  objective: 'size' | 'opcost';
  constructorParamLength: number;
  crossCallScheduling?: boolean; // see CROSS-CALL SCHEDULING
  // half-wise reversed / swapped entry-layout candidates (about +60 s on a BN254 singleton for
  // about 25 B); default: on under the 'size' objective only
  crossCallHalfwiseLayouts?: boolean;
  // with crossCallScheduling: also choose each function's RETURN layout (Convention.out); default true
  returnLayouts?: boolean;
  // keep untouched bottom entry slots in place at block exit; default: on with crossCallScheduling
  passThroughBottom?: boolean;
  // with crossCallScheduling: main's VERIFY family / void invokes as sink nodes; default true
  verifySinks?: boolean;
  // return-layout finalists: recompile the callers with every strategy (slower); default false
  returnLayoutsExact?: boolean;
  // callee-first convention search passes (fixed-point iteration, stops when stable); default 3
  conventionPasses?: number;
  // with crossCallScheduling under 'size': the byte measure candidates are ranked by instead of
  // serialized bytes (the compiler passes the block-move-aware size when block moves run)
  sizeModel?: (script: Script) => number;
  // with sizeModel: 'bodies' applies it to whole-body rankings only (not per block or to main)
  sizeModelScope?: 'all' | 'bodies';
}

export interface RescheduleOutcome {
  result: OptimiseBytecodeResult;
  frames: DebugFrame[];
}

// CALLING CONVENTION of one OP_DEFINE'd function. `in[j]` is the original argument index held
// at stack position j (bottom -> top) on entry; `out[j]` is the original return index held at
// stack position j on exit. Undefined means the standard (source) order. Call sites stage
// arguments in `in` order and label the results in `out` order; the callee's first block is
// seeded with the `in` layout and its last block assembles its exit in the `out` layout.
export interface Convention { in?: number[]; out?: number[] }
type Conventions = Map<number, Convention>;
const NO_CONV: Conventions = new Map();

// ---------- script-element helpers ----------

const elOpcode = (el: OpOrData): number => (typeof el === 'number' ? el : -1);

// The constant a script element pushes, if it is a push. Small integers may be stored
// either as data (encodeInt) or as OP_0/OP_1..16/OP_1NEGATE opcode numbers (inserted by
// optimisation replacements) — normalise both to their byte content.
function constDataOf(el: OpOrData): Uint8Array | undefined {
  if (el instanceof Uint8Array) return el;
  if (el === Op.OP_0) return Uint8Array.of();
  if (el === Op.OP_1NEGATE) return Uint8Array.of(0x81);
  if (el >= Op.OP_1 && el <= Op.OP_16) return Uint8Array.of(el - (Op.OP_1 - 1));
  return undefined;
}

// the number a push encodes; undefined for anything else, including data that is not a
// minimally-encoded VM number (a bytes literal such as 0x00 or a zero hash is a push like any
// other, but no PICK/ROLL depth, function id or small-number operand: the VM rejects it there)
const constNumOf = (el: OpOrData): number | undefined => {
  const data = constDataOf(el);
  if (data === undefined) return undefined;
  try { return Number(decodeInt(data)); } catch { return undefined; }
};

// ---------- DAG model ----------

type Ref =
  | { k: 'const'; data: Uint8Array }
  | { k: 'in'; i: number }
  | { k: 'ain'; i: number }
  | { k: 'out'; node: DagNode; j: number };

interface DagNode {
  id: number;
  kind: 'prim' | 'invoke';
  code: number; // opcode for prim, functionId for invoke
  ins: Ref[];
  nout: number;
  // with sinks (main): the node is a check or can fail (see ORDERED NODES); `src` is its script
  // index (debug remapping) and `after` the previous ordered node of its block, which the
  // scheduler emits first
  ordered?: boolean;
  src?: number;
  after?: DagNode[];
}

interface BasicBlock {
  entryDepth: number;
  entryAlt: number;
  exit: Ref[];
  exitAlt: Ref[];
  nodes: DagNode[]; // every node created in this block, reachable from the exit or not
  // zero-output nodes kept for their checks (VERIFY family, void invokes) when the block was
  // lifted with sinks; roots of the schedule like the exit values
  sinks: DagNode[];
  rawOps: Script;
  rawStart: number; // element index range in the source script
  rawEnd: number; // exclusive
}

type Item = { block: BasicBlock } | { ctrl: number; index: number };

// value-producing ops that are pure within one transaction evaluation: opcode -> [in, out]
const VALOP = new Map<number, [number, number]>([
  [Op.OP_1ADD, [1, 1]], [Op.OP_1SUB, [1, 1]], [Op.OP_NEGATE, [1, 1]], [Op.OP_ABS, [1, 1]],
  [Op.OP_NOT, [1, 1]], [Op.OP_0NOTEQUAL, [1, 1]],
  [Op.OP_ADD, [2, 1]], [Op.OP_SUB, [2, 1]], [Op.OP_MUL, [2, 1]], [Op.OP_DIV, [2, 1]], [Op.OP_MOD, [2, 1]],
  [Op.OP_LSHIFTNUM, [2, 1]], [Op.OP_RSHIFTNUM, [2, 1]],
  [Op.OP_BOOLAND, [2, 1]], [Op.OP_BOOLOR, [2, 1]],
  [Op.OP_NUMEQUAL, [2, 1]], [Op.OP_NUMNOTEQUAL, [2, 1]],
  [Op.OP_LESSTHAN, [2, 1]], [Op.OP_GREATERTHAN, [2, 1]],
  [Op.OP_LESSTHANOREQUAL, [2, 1]], [Op.OP_GREATERTHANOREQUAL, [2, 1]],
  [Op.OP_MIN, [2, 1]], [Op.OP_MAX, [2, 1]], [Op.OP_WITHIN, [3, 1]],
  [Op.OP_CAT, [2, 1]], [Op.OP_SPLIT, [2, 2]],
  [Op.OP_NUM2BIN, [2, 1]], [Op.OP_BIN2NUM, [1, 1]], [Op.OP_SIZE, [1, 2]],
  [Op.OP_AND, [2, 1]], [Op.OP_OR, [2, 1]], [Op.OP_XOR, [2, 1]], [Op.OP_EQUAL, [2, 1]],
  [Op.OP_REVERSEBYTES, [1, 1]],
  [Op.OP_RIPEMD160, [1, 1]], [Op.OP_SHA1, [1, 1]], [Op.OP_SHA256, [1, 1]],
  [Op.OP_HASH160, [1, 1]], [Op.OP_HASH256, [1, 1]],
  [Op.OP_CHECKSIG, [2, 1]], [Op.OP_CHECKDATASIG, [3, 1]],
  // introspection (constant within the evaluated transaction context)
  [Op.OP_INPUTINDEX, [0, 1]], [Op.OP_ACTIVEBYTECODE, [0, 1]],
  [Op.OP_TXVERSION, [0, 1]], [Op.OP_TXINPUTCOUNT, [0, 1]], [Op.OP_TXOUTPUTCOUNT, [0, 1]], [Op.OP_TXLOCKTIME, [0, 1]],
  [Op.OP_UTXOVALUE, [1, 1]], [Op.OP_UTXOBYTECODE, [1, 1]],
  [Op.OP_OUTPOINTTXHASH, [1, 1]], [Op.OP_OUTPOINTINDEX, [1, 1]],
  [Op.OP_INPUTBYTECODE, [1, 1]], [Op.OP_INPUTSEQUENCENUMBER, [1, 1]],
  [Op.OP_OUTPUTVALUE, [1, 1]], [Op.OP_OUTPUTBYTECODE, [1, 1]],
  [Op.OP_UTXOTOKENCATEGORY, [1, 1]], [Op.OP_UTXOTOKENCOMMITMENT, [1, 1]], [Op.OP_UTXOTOKENAMOUNT, [1, 1]],
  [Op.OP_OUTPUTTOKENCATEGORY, [1, 1]], [Op.OP_OUTPUTTOKENCOMMITMENT, [1, 1]], [Op.OP_OUTPUTTOKENAMOUNT, [1, 1]],
]);

// control/side-effecting opcodes that bound basic blocks: opcode -> main-stack pops.
// (IF/NOTIF/UNTIL pop their condition; the VERIFY family consumes its operands; CLTV/CSV
// only peek. Emitted verbatim between blocks, so their relative order — and therefore
// which check fails first — is preserved. With VERIFY sinks the VERIFY family moves into the
// blocks; ORDERED NODES keep the same guarantee there.)
const CTRL = new Map<number, number>([
  [Op.OP_IF, 1], [Op.OP_NOTIF, 1], [Op.OP_ELSE, 0], [Op.OP_ENDIF, 0],
  [Op.OP_BEGIN, 0], [Op.OP_UNTIL, 1],
  [Op.OP_VERIFY, 1], [Op.OP_EQUALVERIFY, 2], [Op.OP_NUMEQUALVERIFY, 2],
  [Op.OP_CHECKSIGVERIFY, 2], [Op.OP_CHECKDATASIGVERIFY, 3],
  [Op.OP_CHECKLOCKTIMEVERIFY, 0], [Op.OP_CHECKSEQUENCEVERIFY, 0],
]);

// the control-flow subset of CTRL (the rest are checks)
const FLOW_OPS = new Set<number>([Op.OP_IF, Op.OP_NOTIF, Op.OP_ELSE, Op.OP_ENDIF, Op.OP_BEGIN, Op.OP_UNTIL]);

let nodeCounter = 0;

// VERIFY SINKS (verifySinks): the VERIFY family consumes its operands and either aborts the
// whole evaluation or does nothing, so the ORDER of checks is unobservable (any failure rejects
// the spend, and no pure value op has another effect). With `sinks`, these ops (and invokes of
// functions without results, whose checks live in the callee) become zero-output DAG nodes
// inside a block instead of block boundaries; the scheduler emits every one of them exactly
// once. CHECKLOCKTIMEVERIFY / CHECKSEQUENCEVERIFY stay boundaries (they only peek).
// SINK_BLOCK_NODE_LIMIT: merging every check of a long straight-line main into one block makes
// the exact / beamx schedulers (about quadratic in the block's node count) dominate compile time
// (zk-notes/convention.md 7.5: 100 requires took 49 s, 197 s under 'size'). A check met once the
// block already holds this many nodes stays a block boundary, as without sinks; the largest
// sink block of the Groth16 singletons has far fewer nodes. Re-lifting an emitted block for
// translation validation uses no limit.
const SINK_BLOCK_NODE_LIMIT = 120;
const SINK_OPS = new Map<number, number>([
  [Op.OP_VERIFY, 1], [Op.OP_EQUALVERIFY, 2], [Op.OP_NUMEQUALVERIFY, 2],
  [Op.OP_CHECKSIGVERIFY, 2], [Op.OP_CHECKDATASIGVERIFY, 3],
]);

// ORDERED NODES (with sinks): consensus only sees accept/reject, but the SDK reports the FIRST
// failing check (its require message, or the line of a failing op). So inside a block lifted
// with sinks, the checks and every op that can fail on well-formed arguments keep their source
// order: each such node is chained `after` the previous one, and the scheduler only moves pure
// infallible ops across them. A guard `require(c != 0)` therefore still runs before the
// division it protects. Fallible here: division and modulo unless by a non-zero constant (a
// push, or a call of a function that only pushes one, such as a lowered global constant),
// LSHIFTNUM / RSHIFTNUM unless by such a non-negative constant (a negative bit count fails, and
// so does an LSHIFTNUM count above the VM's item size in bits), SPLIT / NUM2BIN / BIN2NUM (range
// and encoding errors), AND / OR / XOR (operands of different lengths, which the type checker
// allows for two unbounded `bytes`) and CAT (a result above the VM's item size) unless both
// operands have known sizes that cannot fail (exactSize), signature checks (encoding errors),
// introspection by index, and invokes
// of functions not proven infallible (`Fallibility`, from analyseFallibility: no check, no
// fallible op and no console.log in the body or its callees; a log is an observable effect the
// SDK prints in order). Arithmetic on well-formed numbers is treated as infallible (the VM's
// number-size limit is far above contract values); so is running out of op-cost budget, which
// any op can do.
// The final block's result (the last require(), which has no VERIFY) is chained after the last
// ordered node as well, so its comparison is the last thing the script computes.
const FALLIBLE_OPS = new Set<number>([
  Op.OP_DIV, Op.OP_MOD, Op.OP_LSHIFTNUM, Op.OP_RSHIFTNUM, Op.OP_SPLIT, Op.OP_NUM2BIN, Op.OP_BIN2NUM,
  Op.OP_AND, Op.OP_OR, Op.OP_XOR, Op.OP_CAT,
  Op.OP_CHECKSIG, Op.OP_CHECKDATASIG,
  Op.OP_UTXOVALUE, Op.OP_UTXOBYTECODE, Op.OP_OUTPOINTTXHASH, Op.OP_OUTPOINTINDEX, Op.OP_INPUTBYTECODE,
  Op.OP_INPUTSEQUENCENUMBER, Op.OP_OUTPUTVALUE, Op.OP_OUTPUTBYTECODE, Op.OP_UTXOTOKENCATEGORY,
  Op.OP_UTXOTOKENCOMMITMENT, Op.OP_UTXOTOKENAMOUNT, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_OUTPUTTOKENCOMMITMENT,
  Op.OP_OUTPUTTOKENAMOUNT,
]);
// the BCH 2026 VM's maximum stack item length, and the largest OP_LSHIFTNUM bit count it evaluates
const MAX_ITEM_LENGTH = 10_000;
const MAX_LSHIFT_BITS = MAX_ITEM_LENGTH * 8;
// result sizes of the fixed-width hash ops
const HASH_SIZES = new Map<number, number>([
  [Op.OP_SHA256, 32], [Op.OP_HASH256, 32], [Op.OP_RIPEMD160, 20], [Op.OP_SHA1, 20], [Op.OP_HASH160, 20],
]);
// functions proven infallible, and functions that only push one constant (id -> its data)
interface Fallibility { infallible: ReadonlySet<number>; constFns: ReadonlyMap<number, Uint8Array> }
const NO_FALLIBILITY: Fallibility = { infallible: new Set(), constFns: new Map() };
const isNonzeroData = (data: Uint8Array): boolean => (
  data.some((byte, i) => byte !== 0 && !(i === data.length - 1 && byte === 0x80))
);
// the constant an operand is known to hold: a push, or a call of a constant-pushing function
const constOperand = (ref: Ref, info: Fallibility): Uint8Array | undefined => {
  if (ref.k === 'const') return ref.data;
  if (ref.k === 'out' && ref.node.kind === 'invoke') return info.constFns.get(ref.node.code);
  return undefined;
};
// the exact byte length a value is known to have: a push, a hash, or a CAT of two such values
const exactSize = (ref: Ref, info: Fallibility, depth = 0): number | undefined => {
  const data = constOperand(ref, info);
  if (data !== undefined) return data.length;
  if (ref.k !== 'out' || ref.node.kind !== 'prim' || depth > 16) return undefined;
  const hash = HASH_SIZES.get(ref.node.code);
  if (hash !== undefined) return hash;
  if (ref.node.code !== Op.OP_CAT) return undefined;
  const a = exactSize(ref.node.ins[0], info, depth + 1);
  const b = exactSize(ref.node.ins[1], info, depth + 1);
  return a === undefined || b === undefined ? undefined : a + b;
};
const constNumber = (data: Uint8Array): bigint | undefined => {
  try { return decodeInt(data); } catch { return undefined; } // non-minimal encodings fail in the VM
};
const isFallible = (node: DagNode, info: Fallibility = NO_FALLIBILITY): boolean => {
  if (node.nout === 0 && node.kind === 'prim') return true;
  if (node.kind === 'invoke') return !info.infallible.has(node.code);
  if (!FALLIBLE_OPS.has(node.code)) return false;
  if (node.code === Op.OP_DIV || node.code === Op.OP_MOD) {
    const divisor = constOperand(node.ins[1], info);
    return divisor === undefined || !isNonzeroData(divisor);
  }
  if (node.code === Op.OP_LSHIFTNUM || node.code === Op.OP_RSHIFTNUM) {
    const data = constOperand(node.ins[1], info);
    const bits = data === undefined ? undefined : constNumber(data);
    if (bits === undefined || bits < 0n) return true;
    return node.code === Op.OP_LSHIFTNUM && bits > BigInt(MAX_LSHIFT_BITS);
  }
  if (node.code === Op.OP_AND || node.code === Op.OP_OR || node.code === Op.OP_XOR || node.code === Op.OP_CAT) {
    const a = exactSize(node.ins[0], info);
    const b = exactSize(node.ins[1], info);
    if (a === undefined || b === undefined) return true;
    return node.code === Op.OP_CAT ? a + b > MAX_ITEM_LENGTH : a !== b;
  }
  return true;
};

interface DecompileOptions {
  sinks?: boolean; // see VERIFY SINKS
  inAlt?: number; // opaque entry altstack slots (re-lifting a block for validation)
  fallibility?: Fallibility; // with sinks: which invokes and divisors cannot fail (ORDERED NODES)
  // with sinks: a check met once the block already holds this many nodes stays a boundary
  // (SINK_BLOCK_NODE_LIMIT)
  sinkNodeLimit?: number;
}

// Lift a script into [block | ctrl] items over a symbolic stack of `inArity` opaque
// entry slots. Throws on anything it cannot model (dynamic PICK depths, unknown opcodes,
// OP_DEPTH, ...) — callers treat a throw as "keep the original".
function decompile(
  script: Script, arities: Map<number, FunctionArity>, inArity: number, options: DecompileOptions = {},
): Item[] {
  const items: Item[] = [];
  let main: Ref[] = Array.from({ length: inArity }, (_, i) => ({ k: 'in', i } as Ref));
  let alt: Ref[] = Array.from({ length: options.inAlt ?? 0 }, (_, i) => ({ k: 'ain', i } as Ref));
  let entryDepth = inArity;
  let entryAlt = options.inAlt ?? 0;
  let rawStart = 0;
  let blockNodes: DagNode[] = [];
  let blockSinks: DagNode[] = [];
  let lastOrdered: DagNode | undefined;
  const ctrlDepth: { m: number; a: number }[] = [];
  // ORDERED NODES: chain a check / fallible node after the previous one of its block
  const created = (node: DagNode, index: number): void => {
    blockNodes.push(node);
    if (!options.sinks || !isFallible(node, options.fallibility)) return;
    node.ordered = true;
    node.src = index;
    if (lastOrdered !== undefined) node.after = [lastOrdered];
    lastOrdered = node;
  };

  const beginBlock = (): void => {
    entryDepth = main.length;
    entryAlt = alt.length;
    main = main.map((_, i) => ({ k: 'in', i } as Ref));
    alt = alt.map((_, i) => ({ k: 'ain', i } as Ref));
  };
  const closeBlock = (end: number): void => {
    items.push({
      block: {
        entryDepth,
        entryAlt,
        exit: [...main],
        exitAlt: [...alt],
        nodes: blockNodes,
        sinks: blockSinks,
        rawOps: script.slice(rawStart, end),
        rawStart,
        rawEnd: end,
      },
    });
    blockNodes = [];
    blockSinks = [];
    lastOrdered = undefined;
  };
  const pop = (): Ref => {
    const ref = main.pop();
    if (ref === undefined) throw new Error('stack underflow while decompiling');
    return ref;
  };
  const popConstNum = (): number => {
    const ref = pop();
    if (ref.k !== 'const') throw new Error('dynamic operand for PICK/ROLL/INVOKE');
    return Number(decodeInt(ref.data));
  };

  for (let i = 0; i < script.length; i += 1) {
    const el = script[i];
    const op = elOpcode(el);

    if (options.sinks && SINK_OPS.has(op) && blockNodes.length < (options.sinkNodeLimit ?? Infinity)) {
      const ins: Ref[] = [];
      for (let k = 0; k < SINK_OPS.get(op)!; k += 1) ins.unshift(pop());
      nodeCounter += 1;
      const node: DagNode = { id: nodeCounter, kind: 'prim', code: op, ins, nout: 0 };
      created(node, i);
      blockSinks.push(node);
      continue;
    }

    if (CTRL.has(op)) {
      closeBlock(i);
      if (op === Op.OP_IF || op === Op.OP_NOTIF) {
        pop();
        ctrlDepth.push({ m: main.length, a: alt.length });
      } else if (op === Op.OP_ELSE) {
        const s = ctrlDepth[ctrlDepth.length - 1];
        main.length = s.m;
        alt.length = s.a;
      } else if (op === Op.OP_ENDIF) {
        ctrlDepth.pop();
      } else {
        for (let k = 0; k < CTRL.get(op)!; k += 1) pop();
      }
      items.push({ ctrl: op, index: i });
      rawStart = i + 1;
      beginBlock();
      continue;
    }

    const data = constDataOf(el);
    if (data !== undefined) {
      main.push({ k: 'const', data });
      continue;
    }

    switch (op) {
      case Op.OP_DUP: main.push(main[main.length - 1]); break;
      case Op.OP_DROP: pop(); break;
      case Op.OP_2DROP: pop(); pop(); break;
      case Op.OP_2DUP: { const b = main[main.length - 1]; const a = main[main.length - 2]; main.push(a, b); break; }
      case Op.OP_3DUP: {
        const c = main[main.length - 1]; const b = main[main.length - 2]; const a = main[main.length - 3];
        main.push(a, b, c); break;
      }
      case Op.OP_OVER: main.push(main[main.length - 2]); break;
      case Op.OP_2OVER: { const b = main[main.length - 3]; const a = main[main.length - 4]; main.push(a, b); break; }
      case Op.OP_SWAP: { const n = main.length; [main[n - 1], main[n - 2]] = [main[n - 2], main[n - 1]]; break; }
      case Op.OP_2SWAP: {
        const n = main.length; const a = main[n - 4]; const b = main[n - 3];
        main[n - 4] = main[n - 2]; main[n - 3] = main[n - 1]; main[n - 2] = a; main[n - 1] = b; break;
      }
      case Op.OP_ROT: {
        const n = main.length; const a = main[n - 3];
        main[n - 3] = main[n - 2]; main[n - 2] = main[n - 1]; main[n - 1] = a; break;
      }
      case Op.OP_2ROT: {
        const n = main.length; const a = main[n - 6]; const b = main[n - 5];
        for (let k = n - 6; k < n - 2; k += 1) main[k] = main[k + 2];
        main[n - 2] = a; main[n - 1] = b; break;
      }
      case Op.OP_TUCK: {
        const n = main.length; const b = main[n - 1]; const a = main[n - 2];
        main[n - 2] = b; main[n - 1] = a; main.push(b); break;
      }
      case Op.OP_NIP: main.splice(main.length - 2, 1); break;
      case Op.OP_TOALTSTACK: alt.push(pop()); break;
      case Op.OP_FROMALTSTACK: { const ref = alt.pop(); if (ref === undefined) throw new Error('alt underflow'); main.push(ref); break; }
      case Op.OP_PICK: {
        const n = popConstNum();
        const picked = main[main.length - 1 - n];
        if (picked === undefined) throw new Error('PICK past stack bottom');
        main.push(picked); break;
      }
      case Op.OP_ROLL: {
        const n = popConstNum();
        const idx = main.length - 1 - n;
        if (idx < 0) throw new Error('ROLL past stack bottom');
        const [v] = main.splice(idx, 1);
        main.push(v); break;
      }
      case Op.OP_INVOKE: {
        const id = popConstNum();
        const arity = arities.get(id);
        if (arity === undefined) throw new Error(`unknown function id ${id}`);
        const ins: Ref[] = [];
        for (let k = 0; k < arity.in; k += 1) ins.unshift(pop());
        nodeCounter += 1;
        const node: DagNode = { id: nodeCounter, kind: 'invoke', code: id, ins, nout: arity.out };
        created(node, i);
        if (options.sinks && arity.out === 0) blockSinks.push(node);
        for (let j = 0; j < arity.out; j += 1) main.push({ k: 'out', node, j });
        break;
      }
      default: {
        const valop = VALOP.get(op);
        if (valop === undefined) throw new Error(`unsupported opcode 0x${op.toString(16)}`);
        const [nin, nout] = valop;
        const ins: Ref[] = [];
        for (let k = 0; k < nin; k += 1) ins.unshift(pop());
        nodeCounter += 1;
        const node: DagNode = { id: nodeCounter, kind: 'prim', code: op, ins, nout };
        created(node, i);
        for (let j = 0; j < nout; j += 1) main.push({ k: 'out', node, j });
        break;
      }
    }
  }
  // the script's final result (the last require()) is computed after the last ordered node;
  // only result nodes created after it are chained, so the chain stays acyclic
  if (options.sinks && lastOrdered !== undefined) {
    const last = lastOrdered;
    main.forEach((ref) => {
      if (ref.k === 'out' && ref.node.id > last.id && !(ref.node.after ?? []).includes(last)) {
        ref.node.after = [...(ref.node.after ?? []), last];
      }
    });
  }
  closeBlock(script.length);
  return items;
}

// ---------- scheduler ----------

type Strategy = 'topo' | 'greedy' | 'opcost' | 'beam' | 'exact' | 'beamx';

const keyOf = (ref: Ref): string | undefined => {
  if (ref.k === 'in') return `m${ref.i}`;
  if (ref.k === 'ain') return `a${ref.i}`;
  if (ref.k === 'out') return `n${ref.node.id}_${ref.j}`;
  return undefined;
};

// nominal stack-item length for op-cost estimates (item sizes are unknown statically)
const NOMINAL_LEN = 33;

// incremental per-element op-cost, mirroring opCostEstimate below
function costOfAppend(prev: OpOrData | undefined, el: OpOrData): number {
  const data = constDataOf(el);
  if (data !== undefined) return 100 + data.length;
  switch (elOpcode(el)) {
    case Op.OP_DUP: case Op.OP_OVER: case Op.OP_TUCK: case Op.OP_FROMALTSTACK: case Op.OP_PICK:
      return 100 + NOMINAL_LEN;
    case Op.OP_ROLL: return 100 + NOMINAL_LEN + (prev !== undefined ? (constNumOf(prev) ?? 0) : 0);
    case Op.OP_2DUP: case Op.OP_2OVER: case Op.OP_2ROT: return 100 + 2 * NOMINAL_LEN;
    case Op.OP_3DUP: return 100 + 3 * NOMINAL_LEN;
    default: return 100;
  }
}

// mutable emission state; cloneable for the beam search
interface EmitState {
  out: Script;
  stk: string[];
  useCount: Map<string, number>;
  remaining: Set<number>;
  cost: number; // accumulated static op-cost of `out`
  log?: ScheduleStep[]; // computed nodes in emission order (only when recording, see EmitOptions)
  pre?: string[]; // stack labels just before the exit layout was assembled
}

// one computed node of an emitted schedule and its operand keys (return-layout candidates
// read the order in which a caller consumes a callee's results from these)
interface ScheduleStep { node: DagNode; keys: (string | undefined)[] }

const cloneState = (s: EmitState): EmitState => ({
  out: [...s.out],
  stk: [...s.stk],
  useCount: new Map(s.useCount),
  remaining: new Set(s.remaining),
  cost: s.cost,
  ...(s.log !== undefined ? { log: [...s.log] } : {}),
});

// A PROBE state prices one more step (exactCost, operand-order trials) without copying the whole
// state: appendOp's cost only reads the last emitted element, so `out` keeps just that one; the
// log and the remaining set are not read by computeNode, so the probe gets fresh empty ones; and
// use counts read through to the parent (only the probed node's operand counts get written).
// Only the probe's `cost` is ever read, and a probe is never cloned with cloneState.
class UseCountOverlay extends Map<string, number> {
  constructor(private readonly parent: Map<string, number>) { super(); }

  get(key: string): number | undefined { return super.has(key) ? super.get(key) : this.parent.get(key); }

  has(key: string): boolean { return super.has(key) || this.parent.has(key); }
}
const probeState = (s: EmitState): EmitState => ({
  out: s.out.length > 0 ? [s.out[s.out.length - 1]] : [],
  stk: [...s.stk],
  useCount: new UseCountOverlay(s.useCount),
  remaining: new Set(),
  cost: s.cost,
});

const appendOp = (s: EmitState, el: OpOrData): void => {
  s.cost += costOfAppend(s.out[s.out.length - 1], el);
  s.out.push(el);
};

const topmostIndex = (stk: string[], key: string): number => stk.lastIndexOf(key);
const deepestIndex = (stk: string[], key: string): number => stk.indexOf(key);
const pushNum = (s: EmitState, value: number): void => { appendOp(s, encodeInt(BigInt(value))); };

// bring `key` to the top of the stack: a copy targets the shallowest occurrence
// (cheapest); a consuming move targets the deepest (original) so freshly staged copies
// above it are preserved
function bring(s: EmitState, key: string, move: boolean): void {
  const idx = move ? deepestIndex(s.stk, key) : topmostIndex(s.stk, key);
  if (idx < 0) throw new Error(`value not on stack: ${key}`);
  const depth = s.stk.length - 1 - idx;
  if (move) {
    if (depth === 1) appendOp(s, Op.OP_SWAP);
    else if (depth === 2) appendOp(s, Op.OP_ROT);
    else if (depth > 2) { pushNum(s, depth); appendOp(s, Op.OP_ROLL); }
    s.stk.splice(idx, 1);
    s.stk.push(key);
  } else {
    if (depth === 0) appendOp(s, Op.OP_DUP);
    else if (depth === 1) appendOp(s, Op.OP_OVER);
    else { pushNum(s, depth); appendOp(s, Op.OP_PICK); }
    s.stk.push(key);
  }
}

function bringRef(s: EmitState, ref: Ref, consumeContext: boolean, exitNeed: Map<string, number>): void {
  if (ref.k === 'const') { appendOp(s, ref.data); s.stk.push('#k'); return; }
  const key = keyOf(ref)!;
  if (consumeContext) {
    const remNode = s.useCount.get(key) ?? 0; // node-input uses remaining (incl. this one)
    const survives = remNode > 1 || (exitNeed.get(key) ?? 0) > 0;
    bring(s, key, !survives);
    s.useCount.set(key, remNode - 1);
  } else {
    const remExit = exitNeed.get(key) ?? 0;
    bring(s, key, !(remExit > 1));
    exitNeed.set(key, remExit - 1);
  }
}

// CROSS-CALL SCHEDULING (internal option `crossCallScheduling`, set for the duration of one
// applyStackRescheduling run). An OP_INVOKE is already a single DAG node with a fixed stack
// effect (arity.in -> arity.out); what the plain scheduler lacks is planning a node's operand
// placement TOGETHER with where its producers left their results: it always re-fetches every
// operand, so a callee whose arguments are already sitting on top of the stack in order (the
// results of the previous call) still pays a full `<d> ROLL` per argument. With cross-call
// scheduling on:
//   * operand ADOPTION: the longest run of a node's leading operands that is already on top of
//     the stack, in order, is consumed in place (zero moves); only the rest is fetched. The
//     same applies to the block's exit layout.
//   * commutative two-input prims stage whichever operand order is cheaper.
//   * node choice uses the EXACT emission cost of computing a candidate next (clone + emit),
//     so a producer is preferred when its results land where the consumer wants them, and a
//     wider beam searches over those exact costs.
// The settings for one applyStackRescheduling run travel in a CrossCallContext (EmitOptions,
// RecompileOptions, rescheduleBodies), never in module state.
interface CrossCallContext {
  enabled: boolean;
  symmetries: Map<number, Symmetry>; // proven argument symmetries per callee (findSymmetries)
  halfwiseLayouts: boolean; // add half-wise reversed / swapped entry-layout candidates
  returnLayouts: boolean; // also choose permuted return layouts (Convention.out)
  passThroughBottom: boolean; // keep untouched bottom entry slots in place at block exit (emitBlock)
  verifySinks: boolean; // main: VERIFY family and void invokes as sink nodes (see VERIFY SINKS)
  returnLayoutsExact: boolean; // full-strategy caller recompiles for return-layout finalists
  fallibility: Fallibility; // with verifySinks: which invokes and divisors cannot fail (ORDERED NODES)
  // under 'size': the byte measure whole-body candidates (strategies, conventions) are ranked by,
  // and the one per-block choices and main's strategies are ranked by (default: serialized bytes)
  sizeModel?: (script: Script) => number;
  blockSizeModel?: (script: Script) => number;
}

const COMMUTATIVE = new Set<number>([
  Op.OP_ADD, Op.OP_MUL, Op.OP_BOOLAND, Op.OP_BOOLOR, Op.OP_NUMEQUAL, Op.OP_NUMNOTEQUAL,
  Op.OP_MIN, Op.OP_MAX, Op.OP_AND, Op.OP_OR, Op.OP_XOR, Op.OP_EQUAL,
]);

// ARGUMENT SYMMETRIES of OP_DEFINE'd functions, PROVEN structurally (see findSymmetries):
//   half:  f(a, b) == f(b, a) for a = args[0..n/2), b = args[n/2..n) (addFp, mulFp, fp2Add,
//          fp2Mul (Karatsuba), fp6Mul, fp12Mul, ...)
//   comps: groups of argument positions any two of which may be exchanged (fp2Add: {0,2},
//          {1,3}); every proven transposition is a symmetry, and so is any product of them.
// Carried per run in CrossCallContext.symmetries.
interface Symmetry { half: boolean; comps: number[][] }
const NO_CROSSCALL: CrossCallContext = {
  enabled: false, symmetries: new Map(), halfwiseLayouts: false, returnLayouts: false, passThroughBottom: false,
  verifySinks: false, returnLayoutsExact: false, fallibility: NO_FALLIBILITY,
};

// Canonical form of an argument list under a proven symmetry: sort within each component,
// then take the smaller of that and the same for the half-swapped list. Each result is the
// image of the input under a proven symmetry, so equal canonical forms imply equal values
// (the form need not be fully canonical; missing a match only loses a proof).
function canonicalArgs(ins: string[], sym: Symmetry): string[] {
  const sortComps = (list: string[]): string[] => {
    const out = [...list];
    sym.comps.forEach((comp) => {
      const values = comp.map((i) => out[i]).sort();
      comp.forEach((i, k) => { out[i] = values[k]; });
    });
    return out;
  };
  const a = sortComps(ins);
  if (!sym.half) return a;
  const h = ins.length / 2;
  const b = sortComps([...ins.slice(h), ...ins.slice(0, h)]);
  return a.join(',') <= b.join(',') ? a : b;
}

// Structural proof: the callee body must lift to ONE block without control flow, altstack
// use or dead computation. Its exit values are canonicalised (commutative prims sort their
// operands, invokes of callees with proven symmetries use canonicalArgs, every distinct
// subterm is interned in ONE table shared by all passes, so equal ids imply equal terms)
// once over the identity inputs and once per candidate argument relabelling. Equal
// canonical exits mean the relabelled call computes identical values.
// Bodies in `logged` (console.log) get no symmetry: a relabelled call would log its
// parameters swapped relative to the source.
function findSymmetries(
  d: Dissected, arities: Map<number, FunctionArity>, logged: ReadonlySet<number> = new Set(),
): Map<number, Symmetry> {
  const proven = new Map<number, Symmetry>();
  calleeFirstOrder(d).forEach((id) => {
    const arity = arities.get(id);
    if (arity === undefined || arity.in < 2 || logged.has(id)) return;
    let items: Item[];
    try { items = decompile(d.bodies.get(id)!, arities, arity.in); } catch { return; }
    if (items.length !== 1 || !('block' in items[0])) return;
    const { block } = items[0];
    if (block.entryAlt !== 0 || block.exitAlt.length !== 0 || hasDeadComputation(block)) return;
    const n = arity.in;
    const intern = new Map<string, number>();
    const internOf = (str: string): number => {
      if (!intern.has(str)) intern.set(str, intern.size);
      return intern.get(str)!;
    };
    const canon = (relabel: (i: number) => number): string => {
      const memo = new Map<number, number>();
      const refId = (ref: Ref): string => {
        if (ref.k === 'const') return `k${binToHex(ref.data)}`;
        if (ref.k === 'in') return `i${relabel(ref.i)}`;
        if (ref.k === 'ain') return `a${ref.i}`;
        return `n${nodeId(ref.node)}_${ref.j}`;
      };
      const nodeId = (node: DagNode): number => {
        const cached = memo.get(node.id);
        if (cached !== undefined) return cached;
        let ins = node.ins.map(refId);
        if (node.kind === 'prim' && COMMUTATIVE.has(node.code) && ins.length === 2) ins = [...ins].sort();
        const sym = node.kind === 'invoke' ? proven.get(node.code) : undefined;
        if (sym !== undefined) ins = canonicalArgs(ins, sym);
        const value = internOf(`${node.kind}${node.code}(${ins.join(',')})`);
        memo.set(node.id, value);
        return value;
      };
      return block.exit.map(refId).join('|');
    };
    const reference = canon((i) => i);
    const half = n % 2 === 0 && canon((i) => (i < n / 2 ? i + n / 2 : i - n / 2)) === reference;
    // proven transpositions -> connected components (the transpositions of a component
    // generate the full symmetric group on it)
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
      let r = i;
      while (parent[r] !== r) r = parent[r];
      return r;
    };
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (find(i) !== find(j) && canon((x) => (x === i ? j : x === j ? i : x)) === reference) {
          parent[find(j)] = find(i);
        }
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i += 1) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
    const comps = [...groups.values()].filter((g) => g.length > 1);
    if (half || comps.length > 0) proven.set(id, { half, comps });
  });
  return proven;
}

// longest k such that the top k stack labels are exactly staged[0..k) and consuming them in
// place leaves every remaining use of those values satisfiable (another copy stays below).
// Slots below `floor` (pass-through bottom slots) are never adopted.
function adoptablePrefix(s: EmitState, staged: Ref[], remainingUses: (key: string) => number, floor = 0): number {
  const len = s.stk.length;
  for (let k = Math.min(staged.length, len - floor); k > 0; k -= 1) {
    let match = true;
    const adopted = new Map<string, number>();
    for (let i = 0; i < k; i += 1) {
      const key = keyOf(staged[i]);
      if (key === undefined || s.stk[len - k + i] !== key) { match = false; break; }
      adopted.set(key, (adopted.get(key) ?? 0) + 1);
    }
    if (!match) continue;
    const below = s.stk.slice(0, len - k);
    const ok = [...adopted].every(([key, a]) => remainingUses(key) - a <= 0 || below.includes(key));
    if (ok) return k;
  }
  return 0;
}

function stageOperands(s: EmitState, staged: Ref[], exitNeed: Map<string, number>, adopt: boolean): void {
  let adopted = 0;
  if (adopt) {
    adopted = adoptablePrefix(s, staged, (key) => (s.useCount.get(key) ?? 0) + (exitNeed.get(key) ?? 0));
    for (let i = 0; i < adopted; i += 1) {
      const key = keyOf(staged[i])!;
      s.useCount.set(key, (s.useCount.get(key) ?? 0) - 1);
    }
  }
  staged.slice(adopted).forEach((r) => bringRef(s, r, true, exitNeed));
}

// compute one DAG node on top of the stack, staging arguments in the callee's chosen
// entry order and labelling its results in the callee's return order (see Convention)
function computeNode(
  s: EmitState, node: DagNode, exitNeed: Map<string, number>, calleeConv: Conventions, cc: CrossCallContext,
): void {
  s.remaining.delete(node.id);
  s.log?.push({ node, keys: node.ins.map(keyOf) });
  const conv = node.kind === 'invoke' ? calleeConv.get(node.code) : undefined;
  const perm = conv?.in;
  let staged = perm !== undefined ? perm.map((i) => node.ins[i]) : node.ins;
  const trial = (order: Ref[]): number => {
    const t = probeState(s);
    stageOperands(t, order, new Map(exitNeed), cc.enabled);
    return t.cost;
  };
  if (cc.enabled && node.kind === 'prim' && COMMUTATIVE.has(node.code) && staged.length === 2) {
    const swapped = [staged[1], staged[0]];
    if (trial(swapped) < trial(staged)) staged = swapped;
  }
  const sym = cc.enabled && node.kind === 'invoke' ? cc.symmetries.get(node.code) : undefined;
  if (sym !== undefined) {
    // relabel the LOGICAL arguments under proven symmetries (half swap, then improving
    // transpositions within components), then apply the callee's entry permutation
    const stage = (ins: Ref[]): Ref[] => (perm !== undefined ? perm.map((i) => ins[i]) : ins);
    let bestIns = node.ins;
    let bestCost = trial(staged);
    if (sym.half) {
      const h = node.ins.length / 2;
      const swappedIns = [...node.ins.slice(h), ...node.ins.slice(0, h)];
      const cost = trial(stage(swappedIns));
      if (cost < bestCost) { bestIns = swappedIns; bestCost = cost; }
    }
    const transpositions = sym.comps.flatMap((comp) => comp.flatMap((i, a) => comp.slice(a + 1).map((j) => [i, j])));
    for (let pass = 0; pass < 2; pass += 1) {
      let improved = false;
      for (const [i, j] of transpositions) {
        const candidate = [...bestIns];
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        const cost = trial(stage(candidate));
        if (cost < bestCost) { bestIns = candidate; bestCost = cost; improved = true; }
      }
      if (!improved) break;
    }
    staged = stage(bestIns);
  }
  stageOperands(s, staged, exitNeed, cc.enabled);
  if (node.kind === 'invoke') { pushNum(s, node.code); appendOp(s, Op.OP_INVOKE); } else appendOp(s, node.code);
  s.stk.length -= node.ins.length;
  // a callee with a permuted return layout leaves original result out[j] at position j
  const out = conv?.out;
  for (let j = 0; j < node.nout; j += 1) s.stk.push(`n${node.id}_${out !== undefined ? out[j] : j}`);
}

interface EmitOptions {
  entrySeed?: string[]; // stack labels at block entry, bottom -> top (defaults to m0..mN-1)
  exitPerm?: number[]; // permuted main-stack exit layout: position j receives exit[exitPerm[j]]
  calleeConv?: Conventions;
  crossCall?: CrossCallContext;
  recordLog?: boolean; // record the schedule (EmittedBlock.log)
}

interface EmittedBlock { script: Script; log: ScheduleStep[]; pre?: string[] }

const BEAM_WIDTH = 4;
const BEAM_EXPAND = 3;
const BEAMX_WIDTH = 8;
const BEAMX_EXPAND = 4;

// Re-emit one block: seed the entry slots, compute the DAG nodes in a strategy-chosen
// dependency order (fetching each operand with the cheapest available move/copy), then
// assemble the exact exit layout and clean leftover slots.
function emitBlock(block: BasicBlock, strategy: Strategy, options: EmitOptions = {}): EmittedBlock {
  const { entryDepth: n, entryAlt: p, exitAlt } = block;
  const exit = options.exitPerm !== undefined ? options.exitPerm.map((i) => block.exit[i]) : block.exit;
  const calleePerms = options.calleeConv ?? NO_CONV;
  const cc = options.crossCall ?? NO_CROSSCALL;

  // topo order of needed nodes (memoised — the DAGs share subtrees heavily)
  const visited = new Set<number>();
  const order: DagNode[] = [];
  const visitNode = (node: DagNode): void => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    node.ins.forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });
    (node.after ?? []).forEach(visitNode);
    order.push(node);
  };
  [...exit, ...exitAlt].forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });
  block.sinks.forEach(visitNode);

  // altstack passthrough: if the entry altstack is returned untouched and never read,
  // leave it there (emit zero alt ops)
  const altReferenced = exit.some((r) => r.k === 'ain') || order.some((nd) => nd.ins.some((r) => r.k === 'ain'));
  const exitAltPass = exitAlt.length === p && exitAlt.every((r, i) => r.k === 'ain' && r.i === i);
  const altPass = exitAltPass && !altReferenced;

  const useCount = new Map<string, number>();
  const exitNeed = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string | undefined): void => {
    if (key !== undefined) map.set(key, (map.get(key) ?? 0) + 1);
  };
  order.forEach((nd) => nd.ins.forEach((r) => bump(useCount, keyOf(r))));
  [...exit, ...exitAlt].forEach((r) => bump(exitNeed, keyOf(r)));

  const initial: EmitState = {
    out: [], stk: [], useCount, remaining: new Set(order.map((nd) => nd.id)), cost: 0,
    ...(options.recordLog === true ? { log: [] } : {}),
  };
  for (let i = 0; i < n; i += 1) initial.stk.push(options.entrySeed?.[i] ?? `m${i}`);
  if (!altPass) for (let i = 0; i < p; i += 1) { appendOp(initial, Op.OP_FROMALTSTACK); initial.stk.push(`a${p - 1 - i}`); }

  // fetch-cost heuristics for choosing the next ready node
  const pushBytesForDepth = (depth: number): number => (depth <= 16 ? 1 : 2);
  const fetchCostBytes = (s: EmitState, nd: DagNode): number => nd.ins.reduce((sum, r) => {
    if (r.k === 'const') return sum + Math.max(1, r.data.length);
    const key = keyOf(r)!;
    const idx = topmostIndex(s.stk, key);
    if (idx < 0) return sum;
    const depth = s.stk.length - 1 - idx;
    const lastUse = (s.useCount.get(key) ?? 0) <= 1 && (exitNeed.get(key) ?? 0) === 0;
    if (lastUse) return sum + (depth === 0 ? 0 : depth <= 2 ? 1 : pushBytesForDepth(depth) + 1);
    return sum + (depth <= 1 ? 1 : pushBytesForDepth(depth) + 1);
  }, 0);
  const fetchCostOp = (s: EmitState, nd: DagNode): number => nd.ins.reduce((sum, r) => {
    if (r.k === 'const') return sum + 100 + r.data.length;
    const key = keyOf(r)!;
    const idx = topmostIndex(s.stk, key);
    if (idx < 0) return sum;
    const depth = s.stk.length - 1 - idx;
    const lastUse = (s.useCount.get(key) ?? 0) <= 1 && (exitNeed.get(key) ?? 0) === 0;
    if (lastUse) return sum + (depth === 0 ? 0 : depth <= 2 ? 100 : 201 + NOMINAL_LEN + depth);
    return sum + (depth <= 1 ? 100 + NOMINAL_LEN : 201 + NOMINAL_LEN);
  }, 0);

  const inputNodeIds = (nd: DagNode): number[] => [
    ...nd.ins.flatMap((r) => (r.k === 'out' ? [r.node.id] : [])), ...(nd.after ?? []).map((a) => a.id),
  ];
  const readyNodes = (s: EmitState): DagNode[] => order.filter(
    (nd) => s.remaining.has(nd.id) && inputNodeIds(nd).every((id) => !s.remaining.has(id)),
  );

  // PASS-THROUGH BOTTOM (cc.passThroughBottom): exit slots that are the untouched entry slots at
  // the same positions stay where they are. Their exit use keeps them alive, so no read while
  // computing ever consumes them (every read copies, adoption needs another copy below), and
  // the exit only has to be assembled above them.
  let fixed = 0;
  if (cc.passThroughBottom) {
    while (
      fixed < exit.length && fixed < n && exit[fixed].k === 'in' && (exit[fixed] as { i: number }).i === fixed
      && (options.entrySeed?.[fixed] ?? `m${fixed}`) === `m${fixed}`
    ) fixed += 1;
  }

  // assemble the exit layout on top (exit-main ++ reverse(exit-alt) unless alt passes
  // through), clean buried junk, and restore the altstack
  const finish = (s: EmitState): void => {
    s.pre = [...s.stk];
    const need = new Map(exitNeed);
    const desired = (altPass ? [...exit] : [...exit, ...[...exitAlt].reverse()]).slice(fixed);
    const desiredKeys = desired.map((r) => (r.k === 'const' ? undefined : keyOf(r)));
    const inPlace = s.stk.length >= fixed + desired.length
      && desiredKeys.every((dk, i) => dk !== undefined && s.stk[s.stk.length - desired.length + i] === dk);
    if (!inPlace) {
      let adopted = 0;
      if (cc.enabled) {
        adopted = adoptablePrefix(s, desired, (key) => need.get(key) ?? 0, fixed);
        for (let i = 0; i < adopted; i += 1) {
          const key = keyOf(desired[i])!;
          need.set(key, (need.get(key) ?? 0) - 1);
        }
      }
      desired.slice(adopted).forEach((r) => bringRef(s, r, false, need));
    }

    const K = desired.length;
    const junk = s.stk.length - fixed - K;
    if (junk > 0) {
      if (2 * K + junk <= 4 * junk) {
        for (let i = 0; i < K; i += 1) appendOp(s, Op.OP_TOALTSTACK);
        for (let i = 0; i < junk; i += 1) appendOp(s, Op.OP_DROP);
        for (let i = 0; i < K; i += 1) appendOp(s, Op.OP_FROMALTSTACK);
        s.stk = [...s.stk.slice(0, fixed), ...s.stk.slice(s.stk.length - K)];
      } else {
        for (let i = 0; i < junk; i += 1) {
          pushNum(s, s.stk.length - 1 - fixed); appendOp(s, Op.OP_ROLL); appendOp(s, Op.OP_DROP); s.stk.splice(fixed, 1);
        }
      }
    }
    if (!altPass) for (let i = 0; i < exitAlt.length; i += 1) appendOp(s, Op.OP_TOALTSTACK);
  };

  // exact incremental cost of computing `nd` next (cross-call scheduling): emit it on a probe state
  const exactCost = (s: EmitState, nd: DagNode): number => {
    const t = probeState(s);
    computeNode(t, nd, new Map(exitNeed), calleePerms, cc);
    return t.cost - s.cost;
  };

  if (strategy !== 'beam' && strategy !== 'beamx') {
    const state = initial;
    while (state.remaining.size > 0) {
      const candidates = readyNodes(state);
      let node = candidates[0];
      if (strategy !== 'topo') {
        const cost = strategy === 'exact' ? exactCost : strategy === 'opcost' ? fetchCostOp : fetchCostBytes;
        let best = cost(state, candidates[0]);
        candidates.forEach((candidate) => {
          const c = cost(state, candidate);
          if (c < best) { best = c; node = candidate; }
        });
      }
      computeNode(state, node, exitNeed, calleePerms, cc);
    }
    finish(state);
    return { script: state.out, log: state.log ?? [], pre: state.pre };
  }

  // beam search: expand each surviving state by its BEAM_EXPAND cheapest ready nodes,
  // keep the BEAM_WIDTH cheapest accumulated schedules (all states have computed the
  // same number of nodes, so accumulated cost is comparable)
  const exactBeam = strategy === 'beamx';
  const width = exactBeam ? BEAMX_WIDTH : BEAM_WIDTH;
  const expand = exactBeam ? BEAMX_EXPAND : BEAM_EXPAND;
  let beam: EmitState[] = [initial];
  for (let step = 0; step < order.length; step += 1) {
    const next: EmitState[] = [];
    beam.forEach((state) => {
      const candidates = readyNodes(state)
        .map((nd) => ({ nd, c: exactBeam ? exactCost(state, nd) : fetchCostOp(state, nd) }))
        .sort((a, b) => a.c - b.c)
        .slice(0, expand);
      candidates.forEach(({ nd }) => {
        const branch = cloneState(state);
        computeNode(branch, nd, exitNeed, calleePerms, cc);
        next.push(branch);
      });
    });
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, width);
  }
  let best: EmitState | undefined;
  let bestCost = Infinity;
  beam.forEach((state) => {
    finish(state);
    if (state.cost < bestCost) { bestCost = state.cost; best = state; }
  });
  // A dead-ended beam means no complete schedule was found; initial.out would be a script that
  // computed nothing, so fail closed — every caller catches and keeps the original body.
  if (best === undefined) throw new Error('beam search dead-ended without a complete schedule');
  const chosen: EmitState = best;
  return { script: chosen.out, log: chosen.log ?? [], pre: chosen.pre };
}

// collapse adjacent single-item stack ops into their multi-item forms (all provably
// stack-equivalent; the main optimiser applies the same families of rewrites)
function peephole(script: Script): Script {
  const isN = (el: OpOrData | undefined, value: number): boolean => (
    el !== undefined && constNumOf(el) === value && constDataOf(el)!.length === 1
  );
  const isOp = (el: OpOrData | undefined, op: number): boolean => el !== undefined && typeof el === 'number' && el === op;
  let ops = script;
  let changed = true;
  while (changed) {
    changed = false;
    const out: Script = [];
    for (let i = 0; i < ops.length; i += 1) {
      const [a, b, c, d, e, f] = [ops[i], ops[i + 1], ops[i + 2], ops[i + 3], ops[i + 4], ops[i + 5]];
      if (isN(a, 2) && isOp(b, Op.OP_PICK) && isN(c, 2) && isOp(d, Op.OP_PICK) && isN(e, 2) && isOp(f, Op.OP_PICK)) {
        out.push(Op.OP_3DUP); i += 5; changed = true; continue;
      }
      if (isOp(a, Op.OP_OVER) && isOp(b, Op.OP_OVER)) { out.push(Op.OP_2DUP); i += 1; changed = true; continue; }
      if (isOp(a, Op.OP_SWAP) && isOp(b, Op.OP_OVER)) { out.push(Op.OP_TUCK); i += 1; changed = true; continue; }
      if (isOp(a, Op.OP_SWAP) && isOp(b, Op.OP_DROP)) { out.push(Op.OP_NIP); i += 1; changed = true; continue; }
      if (isN(a, 3) && isOp(b, Op.OP_PICK) && isN(c, 3) && isOp(d, Op.OP_PICK)) {
        out.push(Op.OP_2OVER); i += 3; changed = true; continue;
      }
      if (isN(a, 3) && isOp(b, Op.OP_ROLL) && isN(c, 3) && isOp(d, Op.OP_ROLL)) {
        out.push(Op.OP_2SWAP); i += 3; changed = true; continue;
      }
      if (isN(a, 5) && isOp(b, Op.OP_ROLL) && isN(c, 5) && isOp(d, Op.OP_ROLL)) {
        out.push(Op.OP_2ROT); i += 3; changed = true; continue;
      }
      out.push(a);
    }
    ops = out;
  }
  return ops;
}

// The rescheduled blocks of a body are emitted and peepholed one at a time, so redundancies that
// straddle a block boundary (OP_SWAP | OP_SWAP, OP_DROP | OP_DROP, ...) survive the local
// peephole above. Run the main bytecode optimiser over the stitched body once more. Body debug
// frames use coarse whole-function source locations, so placeholder location data suffices.
// `ips` (indices into `script`) are carried through the optimiser like require() ips.
function reoptimiseBody(script: Script, ips: number[] = []): { script: Script; ips: number[] } {
  const location: SingleLocationData = {
    location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    positionHint: PositionHint.START,
  };
  const requires: RequireStatement[] = ips.map((ip) => ({ ip, line: 0 }));
  const result = optimiseBytecode(script, script.map(() => location), [], requires, [], [], 0);
  return { script: result.script, ips: result.requires.map((req) => req.ip) };
}

// BODY CHECK IPS: a body is lifted without sinks, so its checks (the VERIFY family, CLTV/CSV) are
// block boundaries that every re-emission keeps verbatim and in order. Map each check's index in
// the original body to its index in a candidate (exact through the block mapping, then through
// the optimiser re-run), so the body's debug frame can re-anchor its require() ips. A check the
// optimiser merged or removed has no entry.
const isCheckOp = (el: OpOrData | undefined): boolean => (
  el !== undefined && CTRL.has(elOpcode(el)) && !FLOW_OPS.has(elOpcode(el))
);
function reoptimiseWithChecks(
  original: Script, recompiled: RecompiledScript,
): { script: Script; checks: Map<number, number> } {
  const olds = original.flatMap((el, i) => (isCheckOp(el) ? [i] : []));
  const remap = indexRemapper(recompiled.mapping, 0);
  const { script, ips } = reoptimiseBody(recompiled.script, olds.map(remap));
  const checks = new Map<number, number>();
  olds.forEach((old, k) => { if (isCheckOp(script[ips[k]])) checks.set(old, ips[k]); });
  return { script, checks };
}

// ---------- cost models ----------

// Static estimate of the schedule-dependent part of the BCH2026 op-cost meter. Value ops'
// own result pushes are identical across schedules of the same DAG and are left out; this
// RANKS schedules, it does not predict absolute cost.
export function opCostEstimate(script: Script): number {
  let cost = 0;
  for (let i = 0; i < script.length; i += 1) {
    cost += costOfAppend(i > 0 ? script[i - 1] : undefined, script[i]);
  }
  return cost;
}

// `sizeModel` replaces plain bytes under 'size' (with block moves: the bytes after the post-pass,
// see blockMovedSizeModel)
const scriptCost = (script: Script, objective: 'size' | 'opcost', sizeModel?: (s: Script) => number): number => (
  // redeem bytes still cost 1 op each in the scriptSig push, which doubles as a tiebreak
  objective === 'opcost' ? opCostEstimate(script) + calculateBytesize(script) : (sizeModel ?? calculateBytesize)(script)
);

// ---------- per-script rescheduling ----------

interface ItemMapping {
  oldStart: number;
  oldEnd: number; // exclusive
  newStart: number;
  newEnd: number; // exclusive
  rewritten: boolean;
  points?: Array<[number, number]>; // exact old -> new indices inside a rewritten block (sinks)
}

interface RecompiledScript {
  script: Script;
  mapping: ItemMapping[];
  changed: boolean;
  log: ScheduleStep[]; // schedules of the re-emitted blocks (with recordLog; raw blocks add nothing)
  // the return order the last block's schedule leaves before its exit shuffle (original
  // result indices, bottom -> top); a return-layout candidate
  naturalOut?: number[];
}

interface RecompileOptions {
  entryPerm?: number[]; // permuted entry layout of the FIRST block (bottom -> top holds slot perm[j])
  exitPerm?: number[]; // permuted exit layout of the LAST block (a function body's return layout)
  calleeConv?: Conventions;
  crossCall?: CrossCallContext;
  recordLog?: boolean;
  sinks?: boolean; // lift with VERIFY sinks (see VERIFY SINKS)
  validate?: boolean; // translation-validate every re-emitted block (see validateBlock)
}

const isIdentityPerm = (perm: number[] | undefined): boolean => perm === undefined || perm.every((v, i) => v === i);
const isStandardConv = (conv: Convention | undefined): boolean => (
  conv === undefined || (isIdentityPerm(conv.in) && isIdentityPerm(conv.out))
);
const convKey = (conv: Convention | undefined): string => (
  isStandardConv(conv) ? '' : `${(conv!.in ?? []).join(',')}|${(conv!.out ?? []).join(',')}`
);
// drop identity halves; undefined for the standard convention
const normaliseConv = (conv: Convention): Convention | undefined => {
  const out: Convention = {};
  if (!isIdentityPerm(conv.in)) out.in = conv.in;
  if (!isIdentityPerm(conv.out)) out.out = conv.out;
  return out.in === undefined && out.out === undefined ? undefined : out;
};

// over ALL block nodes (not just exit-reachable ones): a dead invoke of a permuted callee
// still stages its arguments in the raw ops, which would be the wrong order
const blockInvokesPermuted = (block: BasicBlock, calleeConv: Conventions): boolean => (
  calleeConv.size > 0 && block.nodes.some((nd) => nd.kind === 'invoke' && !isStandardConv(calleeConv.get(nd.code)))
);

// A node unreachable from the block's exit stacks is dead computation: its result never
// leaves the block. Since script failure aborts evaluation, rejecting the spend is the
// only observable effect such a node has — deleting it widens the set of accepted
// witnesses. The realistic case is a void function call (its require lives in the callee,
// so the call site is a zero-output invoke node, dead by construction); an `unused`
// variable's failure-capable initializer (e.g. a division) is the same hole. Blocks
// containing dead computation keep their original ops verbatim.
const hasDeadComputation = (block: BasicBlock): boolean => {
  if (block.nodes.length === 0) return false;
  const reachable = new Set<number>();
  const visitNode = (node: DagNode): void => {
    if (reachable.has(node.id)) return;
    reachable.add(node.id);
    node.ins.forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });
  };
  [...block.exit, ...block.exitAlt].forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });
  block.sinks.forEach(visitNode);
  return block.nodes.some((node) => !reachable.has(node.id));
};

// ---------- translation validation ----------

// Hash-consed canonical names of values: two refs get the same name iff they denote the same
// expression over the block's entry slots, up to the operand orders that are PROVEN equal
// (commutative prims, proven callee argument symmetries). One table is shared by the two
// sides being compared; each side undoes its own callee conventions (a call to a callee with
// convention c stages original argument c.in[j] at position j and leaves original result
// c.out[j] at position j) and names its entry slots by `seed`.
class Canon {
  private table = new Map<string, number>();

  constructor(private symmetries: Map<number, Symmetry>) {}

  side(seed: string[] | undefined, conv: Conventions): { ref: (r: Ref) => string; node: (n: DagNode) => number } {
    const memo = new Map<number, number>();
    const ref = (r: Ref): string => {
      if (r.k === 'const') return `k${binToHex(r.data)}`;
      if (r.k === 'in') return seed?.[r.i] ?? `m${r.i}`;
      if (r.k === 'ain') return `a${r.i}`;
      const c = r.node.kind === 'invoke' ? conv.get(r.node.code) : undefined;
      return `n${node(r.node)}_${c?.out !== undefined ? c.out[r.j] : r.j}`;
    };
    const node = (n: DagNode): number => {
      const known = memo.get(n.id);
      if (known !== undefined) return known;
      const c = n.kind === 'invoke' ? conv.get(n.code) : undefined;
      let ins = n.ins;
      if (c?.in !== undefined) {
        ins = new Array<Ref>(ins.length);
        c.in.forEach((original, j) => { ins[original] = n.ins[j]; });
      }
      let names = ins.map(ref);
      if (n.kind === 'prim' && COMMUTATIVE.has(n.code) && names.length === 2) names = [...names].sort();
      const sym = n.kind === 'invoke' ? this.symmetries.get(n.code) : undefined;
      if (sym !== undefined) names = canonicalArgs(names, sym);
      const key = `${n.kind}${n.code}:${n.nout}(${names.join(',')})`;
      let id = this.table.get(key);
      if (id === undefined) { id = this.table.size; this.table.set(key, id); }
      memo.set(n.id, id);
      return id;
    };
    return { ref, node };
  }
}

interface ValidateContext {
  arities: Map<number, FunctionArity>;
  fallibility?: Fallibility;
  entrySeed?: string[];
  exitPerm?: number[];
  calleeConv: Conventions;
  symmetries: Map<number, Symmetry>;
}

// TRANSLATION VALIDATION of one re-emitted block: lift the emitted ops again (with sinks) and
// require that they compute exactly the original block's exit stacks (main, under the exit
// permutation, and alt) and exactly the original's checks (sink multiset), from the same entry
// stacks, with no control flow and no dead computation, and that the ordered nodes (checks and
// fallible ops, see ORDERED NODES) of a block lifted with sinks are the original's in the
// original order. Returns their position map (original script index -> index in the emitted
// ops) for debug remapping, or undefined.
function validateBlock(block: BasicBlock, emitted: Script, ctx: ValidateContext): Array<[number, number]> | undefined {
  let items: Item[];
  try {
    items = decompile(emitted, ctx.arities, block.entryDepth, {
      sinks: true, inAlt: block.entryAlt, fallibility: ctx.fallibility,
    });
  } catch { return undefined; }
  if (items.length !== 1 || !('block' in items[0])) return undefined;
  const lifted = items[0].block;
  if (hasDeadComputation(lifted)) return undefined;
  const canon = new Canon(ctx.symmetries);
  const original = canon.side(undefined, NO_CONV);
  const emittedSide = canon.side(ctx.entrySeed, ctx.calleeConv);
  const exit = ctx.exitPerm !== undefined ? ctx.exitPerm.map((i) => block.exit[i]) : block.exit;
  const same = (a: Ref[], b: Ref[]): boolean => (
    a.length === b.length && a.every((r, i) => original.ref(r) === emittedSide.ref(b[i]))
  );
  if (!same(exit, lifted.exit) || !same(block.exitAlt, lifted.exitAlt)) return undefined;
  if (block.sinks.length !== lifted.sinks.length) return undefined;
  const pending = new Map<string, DagNode[]>();
  block.sinks.forEach((nd) => {
    const name = `s${original.node(nd)}`;
    pending.set(name, [...(pending.get(name) ?? []), nd]);
  });
  for (const nd of lifted.sinks) {
    const queue = pending.get(`s${emittedSide.node(nd)}`);
    if (queue?.shift() === undefined) return undefined;
  }
  // a block lifted without sinks (the per-region fallback's plain blocks) has no ordered nodes;
  // its fallible ops keep co-8's freedom
  const originalOrdered = block.nodes.filter((nd) => nd.ordered);
  if (originalOrdered.length === 0) return [];
  const liftedOrdered = lifted.nodes.filter((nd) => nd.ordered);
  if (originalOrdered.length !== liftedOrdered.length) return undefined;
  const rank = new Map<string, number[]>();
  originalOrdered.forEach((nd, k) => {
    const name = `o${original.node(nd)}`;
    rank.set(name, [...(rank.get(name) ?? []), k]);
  });
  const points: Array<[number, number]> = [];
  let previous = -1;
  for (const nd of liftedOrdered) {
    const k = rank.get(`o${emittedSide.node(nd)}`)?.shift();
    if (k === undefined || k <= previous) return undefined;
    previous = k;
    points.push([originalOrdered[k].src!, nd.src!]);
  }
  return points;
}

function recompileScript(
  script: Script,
  arities: Map<number, FunctionArity>,
  inArity: number,
  strategy: Strategy,
  objective: 'size' | 'opcost',
  options: RecompileOptions = {},
): RecompiledScript {
  const calleeConv = options.calleeConv ?? NO_CONV;
  const sizeModel = options.crossCall?.blockSizeModel;
  const items = decompile(script, arities, inArity, {
    sinks: options.sinks, fallibility: options.crossCall?.fallibility, sinkNodeLimit: SINK_BLOCK_NODE_LIMIT,
  });
  // with sinks, the plain lift (VERIFY family as boundaries) is the per-region fallback
  const plainItems = options.sinks ? decompile(script, arities, inArity) : undefined;
  const out: Script = [];
  const mapping: ItemMapping[] = [];
  const log: ScheduleStep[] = [];
  let naturalOut: number[] | undefined;
  let changed = false;
  const lastIndex = items.length - 1;

  interface BlockResult {
    block: BasicBlock;
    ops: Script;
    rewritten: boolean;
    points?: Array<[number, number]>;
    log: ScheduleStep[];
  }
  // one block: min(original, rescheduled), both reproduce the block's entry->exit transform
  // AND its boundary layout, so they compose freely
  const emitOne = (block: BasicBlock, isFirst: boolean, isLast: boolean): BlockResult => {
    const entryPerm = isFirst ? options.entryPerm : undefined;
    const entrySeed = entryPerm !== undefined ? entryPerm.map((slot) => `m${slot}`) : undefined;
    // a permuted return layout applies to the main stack at the end of the script; refused
    // when that block also hands values over on the altstack or has a different width
    if (isLast && !isIdentityPerm(options.exitPerm)
      && (block.exit.length !== options.exitPerm!.length || block.exitAlt.length > 0)) {
      throw new Error('return layout does not match the final block');
    }
    const exitPerm = isLast && !isIdentityPerm(options.exitPerm) ? options.exitPerm : undefined;
    // the plain-cashc block is only a valid candidate under the standard entry and exit
    // layouts and standard callee conventions
    const rawValid = isIdentityPerm(entryPerm) && exitPerm === undefined && !blockInvokesPermuted(block, calleeConv);
    // a block with dead computation has no valid re-emission (see hasDeadComputation);
    // if the original ops are not valid either, this whole variant is unusable
    const dead = hasDeadComputation(block);
    if (dead && !rawValid) throw new Error('dead computation in a block that cannot keep its original ops');
    const emitted = dead ? undefined : emitBlock(block, strategy, {
      entrySeed, exitPerm, calleeConv, crossCall: options.crossCall, recordLog: options.recordLog,
    });
    const mine = emitted === undefined ? undefined : peephole(emitted.script);
    let useMine = mine !== undefined
      && (!rawValid || scriptCost(mine, objective, sizeModel) < scriptCost(block.rawOps, objective, sizeModel));
    let points: Array<[number, number]> | undefined;
    if (useMine && options.validate) {
      points = validateBlock(block, mine!, {
        arities, entrySeed, exitPerm, calleeConv, symmetries: options.crossCall?.symmetries ?? new Map(),
        fallibility: options.crossCall?.fallibility,
      });
      if (points === undefined) {
        if (process.env.CASHC_DEBUG_RESCHEDULE !== undefined) {
          console.error(`[reschedule] block ${block.rawStart}-${block.rawEnd} failed translation validation`); // eslint-disable-line no-console
        }
        if (!rawValid) throw new Error('translation validation failed for a block without valid original ops');
        useMine = false;
      }
    }
    if (isLast && emitted?.pre !== undefined && exitPerm === undefined) {
      const pre = emitted.pre;
      const pos = block.exit.map((r) => { const k = keyOf(r); return k === undefined ? -1 : pre.lastIndexOf(k); });
      naturalOut = block.exit.map((_, j) => j).sort((a, b) => (pos[a] - pos[b]) || (a - b));
    }
    return {
      block, ops: useMine ? mine! : block.rawOps, rewritten: useMine, points: useMine ? points : undefined,
      log: useMine ? emitted!.log : [],
    };
  };

  const pushCtrl = (ctrl: number, index: number): void => {
    mapping.push({ oldStart: index, oldEnd: index + 1, newStart: out.length, newEnd: out.length + 1, rewritten: false });
    out.push(ctrl);
  };
  const pushBlock = (res: BlockResult): void => {
    mapping.push({
      oldStart: res.block.rawStart,
      oldEnd: res.block.rawEnd,
      newStart: out.length,
      newEnd: out.length + res.ops.length,
      rewritten: res.rewritten,
      ...(res.points !== undefined && res.points.length > 0
        ? { points: res.points.map(([from, to]) => [from, out.length + to] as [number, number]) } : {}),
    });
    res.ops.forEach((el) => out.push(el));
    res.log.forEach((step) => log.push(step));
    if (res.rewritten) changed = true;
  };

  let firstBlock = true;
  items.forEach((item, itemIndex) => {
    if ('ctrl' in item) { pushCtrl(item.ctrl, item.index); return; }
    const { block } = item;
    const isFirst = firstBlock;
    const isLast = itemIndex === lastIndex;
    firstBlock = false;
    // a block that absorbed sinks competes with the plain blocks (and verbatim checks) it
    // replaces, so merging can never cost more than the boundary-split schedule
    const sub = plainItems === undefined || block.sinks.length === 0 ? [] : plainItems.filter((it) => (
      'ctrl' in it ? it.index >= block.rawStart && it.index < block.rawEnd
        : it.block.rawStart >= block.rawStart && it.block.rawEnd <= block.rawEnd
    ));
    let merged: BlockResult | undefined;
    let mergedError: unknown;
    try { merged = emitOne(block, isFirst, isLast); } catch (e) { mergedError = e; }
    if (sub.length > 1) {
      let split: Array<BlockResult | { ctrl: number; index: number }> | undefined;
      try {
        split = sub.map((it, k) => ('ctrl' in it ? it : emitOne(it.block, isFirst && k === 0, isLast && k === sub.length - 1)));
      } catch { split = undefined; }
      if (split !== undefined) {
        const splitOps = split.flatMap((part) => ('ctrl' in part ? [part.ctrl] : part.ops));
        const splitCost = scriptCost(splitOps, objective, sizeModel);
        if (merged === undefined || splitCost <= scriptCost(merged.ops, objective, sizeModel)) {
          split.forEach((part) => ('ctrl' in part ? pushCtrl(part.ctrl, part.index) : pushBlock(part)));
          return;
        }
      }
    }
    if (merged === undefined) throw mergedError;
    pushBlock(merged);
  });
  return { script: out, mapping, changed, log, naturalOut };
}

// ---------- OP_DEFINE table dissection ----------

interface Dissected {
  order: number[];
  bodies: Map<number, Script>;
  tableLength: number; // element count of the define table prefix
  main: Script;
}

function dissect(script: Script): Dissected {
  const order: number[] = [];
  const bodies = new Map<number, Script>();
  let i = 0;
  while (i + 2 < script.length && script[i] instanceof Uint8Array && elOpcode(script[i + 2]) === Op.OP_DEFINE) {
    const id = constNumOf(script[i + 1]);
    if (id === undefined) break;
    bodies.set(id, bytecodeToScript(script[i] as Uint8Array));
    order.push(id);
    i += 3;
  }
  return { order, bodies, tableLength: i, main: script.slice(i) };
}

// function ids a body invokes (directly)
function bodyInvokes(body: Script): number[] {
  const ids: number[] = [];
  for (let i = 1; i < body.length; i += 1) {
    if (elOpcode(body[i]) === Op.OP_INVOKE) {
      const id = constNumOf(body[i - 1]);
      if (id !== undefined) ids.push(id);
    }
  }
  return ids;
}

// An OP_INVOKE whose callee id is not the immediately preceding constant is invisible to
// bodyInvokes, so a permuted callee would silently receive its arguments in the old order at
// such a call site — layout experiments must not run when one exists anywhere in the program.
const hasAmbiguousInvoke = (script: Script): boolean => script.some((el, i) => (
  elOpcode(el) === Op.OP_INVOKE && (i === 0 || constNumOf(script[i - 1]) === undefined)
));

// callee-first processing order over the call graph (declaration order on cycles)
function calleeFirstOrder(d: Dissected): number[] {
  const visited = new Set<number>();
  const out: number[] = [];
  const visit = (id: number): void => {
    if (visited.has(id) || !d.bodies.has(id)) return;
    visited.add(id);
    bodyInvokes(d.bodies.get(id)!).forEach(visit);
    out.push(id);
  };
  d.order.forEach(visit);
  return out;
}

// Static whole-program op-cost proxy (ranks two compiles of the same contract, see the compiler's
// cross-call fallback): main's estimate plus each body's estimate weighted by its static call
// multiplicity (calls from main, propagated through callers; loops and recursion count once).
export function programOpCostEstimate(script: Script): number {
  const d = dissect(script);
  const mult = new Map<number, number>(d.order.map((id) => [id, 0]));
  const done = new Set<number>();
  const spread = (caller: Script, weight: number): void => {
    bodyInvokes(caller).forEach((id) => { if (mult.has(id) && !done.has(id)) mult.set(id, mult.get(id)! + weight); });
  };
  spread(d.main, 1);
  [...calleeFirstOrder(d)].reverse().forEach((id) => {
    done.add(id);
    spread(d.bodies.get(id)!, mult.get(id)!);
  });
  return d.order.reduce((sum, id) => sum + mult.get(id)! * opCostEstimate(d.bodies.get(id)!), opCostEstimate(d.main));
}

// functions on a call-graph cycle (self-recursion included). Their conventions stay standard:
// a body is compiled against the conventions decided so far, and on a cycle that never
// includes the function's own candidate (or a not-yet-decided cycle member's), so a recursive
// call site inside it would stage arguments and label results in the standard order while the
// callee runs under the candidate convention.
function recursiveFunctions(d: Dissected): Set<number> {
  const out = new Set<number>();
  d.order.forEach((root) => {
    const seen = new Set<number>();
    const stack = [...bodyInvokes(d.bodies.get(root)!)];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === root) { out.add(root); return; }
      if (seen.has(id) || !d.bodies.has(id)) continue;
      seen.add(id);
      bodyInvokes(d.bodies.get(id)!).forEach((callee) => stack.push(callee));
    }
  });
  return out;
}

// ---------- differential testing + measurement on a loosened VM ----------

// Loosened BCH2026 VM: lifts size/stack caps (and, see below, sets its own op-cost budget) so
// any single function body can run on random inputs regardless of contract-level limits.
/* eslint-disable @typescript-eslint/no-explicit-any */
const loosenedConsensus: any = {
  ...ConsensusBch2025,
  baseInstructionCost: 100,
  maximumFunctionIdentifierLength: 7,
  maximumMemorySlots: Number.MAX_SAFE_INTEGER,
  maximumStandardLockingBytecodeLength: -1,
  maximumStandardUnlockingBytecodeLength: Number.MAX_SAFE_INTEGER,
  maximumTokenCommitmentLength: 128,
  operationCostBudgetPerByte: Number.MAX_SAFE_INTEGER,
  maximumStackItemLength: Number.MAX_SAFE_INTEGER,
  maximumVmNumberByteLength: Number.MAX_SAFE_INTEGER,
  maximumStackDepth: Number.MAX_SAFE_INTEGER,
  maximumControlStackDepth: Number.MAX_SAFE_INTEGER,
  maximumBytecodeLength: Number.MAX_SAFE_INTEGER,
  maximumOperationCount: Number.MAX_SAFE_INTEGER,
};

// Every body run is BOUNDED by an op-cost budget: a loop or recursion whose depth depends on an
// argument runs ~2^254 times on a random input, so an unbounded run would hang the compiler.
// The budget is a consensus parameter (`budget / 41` per byte of the empty unlocking script),
// so there is one cached VM per budget.
//   REF_PROBE_BUDGET: first try of a body's first random vector (about 0.2 s of evaluation)
//   REF_BUDGET:       reference runs (original bodies); twice the heaviest Groth16 singleton
//                     body (BLS12-381 ~1.9e8 per run, BN254 ~1.4e8), about 3 s of evaluation
//   CANDIDATE_BUDGET: candidate runs, which only happen where the reference finished
const REF_PROBE_BUDGET = 20_000_000;
const REF_BUDGET = 400_000_000;
const CANDIDATE_BUDGET = 2 * REF_BUDGET;
const cachedVms = new Map<number, any>();
const vmWithBudget = (budget: number): any => {
  let vm = cachedVms.get(budget);
  if (vm === undefined) {
    vm = createVirtualMachine(createInstructionSetBch2026(false, {
      consensus: { ...loosenedConsensus, operationCostBudgetPerByte: Math.ceil(budget / 41) },
      ripemd160, secp256k1, sha1, sha256,
    } as any));
    cachedVms.set(budget, vm);
  }
  return vm;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// deterministic pseudo-random test inputs (~254-bit values, matching wide int math)
const RND_MOD = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
const rnd = (seed: number): bigint => {
  let x = BigInt(seed + 7);
  for (let i = 0; i < 6; i += 1) x = (x * 6364136223846793005n + 1442695040888963407n) % RND_MOD;
  return x;
};

// `stack` holds the raw bytes of every output item (hex), so non-minimally encoded byte strings
// stay distinct; `overBudget` marks a run stopped by the op-cost budget; `instructions` counts
// the evaluated instructions (a proxy for the control path taken)
interface BodyRun { stack?: string[]; opCost: number; instructions: number; error?: string; overBudget?: boolean }

// run one function on the loosened VM. `inputPerm` stages the inputs in the target's
// (possibly permuted) entry order: stack position j receives inputs[perm[j]].
function runBody(
  d: Dissected, overrides: Map<number, Script>, targetId: number, inputs: bigint[], budget: number, inputPerm?: number[],
): BodyRun {
  const program: Script = [];
  d.order.forEach((id) => {
    program.push(scriptToBytecode(overrides.get(id) ?? d.bodies.get(id)!), encodeInt(BigInt(id)), Op.OP_DEFINE);
  });
  const staged = inputPerm !== undefined ? inputPerm.map((i) => inputs[i]) : inputs;
  staged.forEach((input) => program.push(encodeInt(input)));
  program.push(encodeInt(BigInt(targetId)), Op.OP_INVOKE);
  const state = vmWithBudget(budget).evaluate(createTestAuthenticationProgramBch({
    lockingBytecode: scriptToBytecode(program), unlockingBytecode: Uint8Array.of(), valueSatoshis: 1000n,
  }));
  // the only expected "error" is the benign post-evaluation clean-stack check
  const benign = state.error === undefined || /Non-P2SH|clean stack|exactly one|single/i.test(String(state.error));
  return {
    stack: benign ? state.stack.map((item: Uint8Array) => binToHex(item)) : undefined,
    opCost: Number(state.metrics.operationCost),
    instructions: Number(state.metrics.evaluatedInstructionCount),
    error: benign ? undefined : String(state.error),
    overBudget: !benign && /operation cost/i.test(String(state.error)),
  };
}

// TEST VECTORS of one body. Random vectors (~254-bit inputs) are the main differential test
// and, under 'opcost', the measurement. Random inputs never take branches guarded by
// small-value conditions (a recursion base case, `if (n < 3)`), so small vectors (inputs in
// 0..3) follow. A body whose cost grows with an argument (a loop or recursion bounded by it)
// cannot finish a random vector: when the body's first random vector exceeds REF_PROBE_BUDGET
// and its first small vector is cheap (below REF_PROBE_BUDGET / 20; the singletons' heavy
// bodies cost about as much on small inputs as on random ones, see zk-notes/convention.md 7.5),
// random vectors are off for that body and medium vectors (inputs in 0..9) are added instead.
// A small or medium vector is only kept when its reference evaluates and executes a number of
// instructions no kept vector executed: the same count almost always means the same control
// path, which a kept vector already compares (with ~254-bit data); on the singletons' heavy
// bodies, whose loops and branches do not depend on the arguments, this halves the VM time.
const RANDOM_VECTORS = 3;
const SMALL_VECTORS = 3;
const MEDIUM_VECTORS = 3;
const equivVector = (arity: FunctionArity, id: number, t: number): bigint[] => (
  Array.from({ length: arity.in }, (_, i) => rnd(i * 17 + t * 1009 + id))
);
const smallVector = (arity: FunctionArity, t: number): bigint[] => (
  Array.from({ length: arity.in }, (_, i) => BigInt((i * 3 + t * 5 + 1) % 4))
);
const mediumVector = (arity: FunctionArity, t: number): bigint[] => (
  Array.from({ length: arity.in }, (_, i) => BigInt((i * 7 + t * 3 + 2) % 10))
);

// reference runs (original bodies all the way down, standard input order) per Dissected; a run
// that finished under a smaller budget is the run under any larger one
const referenceRuns = new WeakMap<Dissected, Map<string, { run: BodyRun; budget: number }>>();
function referenceRun(d: Dissected, id: number, key: string, inputs: bigint[], budget = REF_BUDGET): BodyRun {
  let runs = referenceRuns.get(d);
  if (runs === undefined) { runs = new Map(); referenceRuns.set(d, runs); }
  const cacheKey = `${id}|${key}`;
  const hit = runs.get(cacheKey);
  if (hit !== undefined && (hit.budget >= budget || !hit.run.overBudget)) return hit.run;
  const run = runBody(d, new Map(), id, inputs, budget);
  runs.set(cacheKey, { run, budget });
  return run;
}
// whether random vectors are usable for body `id` (see TEST VECTORS)
function randomVectorsUsable(d: Dissected, id: number, arity: FunctionArity): boolean {
  const probe = referenceRun(d, id, 'r0', equivVector(arity, id, 0), REF_PROBE_BUDGET);
  if (!probe.overBudget) return true;
  const small = referenceRun(d, id, 's0', smallVector(arity, 0));
  if (!small.overBudget && small.opCost < REF_PROBE_BUDGET / 20) return false;
  return !referenceRun(d, id, 'r0', equivVector(arity, id, 0)).overBudget;
}
// the vectors a body is tested on: [cache key, inputs, random?]
function testVectors(d: Dissected, id: number, arity: FunctionArity, K: number): Array<[string, bigint[], boolean]> {
  const vectors: Array<[string, bigint[], boolean]> = [];
  const paths = new Set<number>();
  const random = randomVectorsUsable(d, id, arity);
  if (random) {
    for (let t = 0; t < K; t += 1) {
      const inputs = equivVector(arity, id, t);
      vectors.push([`r${t}`, inputs, true]);
      const reference = referenceRun(d, id, `r${t}`, inputs);
      if (reference.stack !== undefined) paths.add(reference.instructions);
    }
  }
  const extra: Array<[string, bigint[]]> = [];
  for (let t = 0; t < SMALL_VECTORS; t += 1) extra.push([`s${t}`, smallVector(arity, t)]);
  if (!random) for (let t = 0; t < MEDIUM_VECTORS; t += 1) extra.push([`m${t}`, mediumVector(arity, t)]);
  extra.forEach(([key, inputs]) => {
    const reference = referenceRun(d, id, key, inputs);
    if (reference.stack === undefined || paths.has(reference.instructions)) return;
    paths.add(reference.instructions);
    vectors.push([key, inputs, false]);
  });
  return vectors;
}

// The candidate (with all chosen overrides and its entry permutation) must reproduce the
// ORIGINAL body's output stack, byte for byte, on the body's test vectors. With a permuted
// return layout `out`, candidate stack position j must hold the reference's result out[j]. A
// random vector the reference cannot evaluate fails the candidate, except when it ran out of
// budget; a small or medium vector the reference cannot evaluate (a require, a division by
// zero, the budget) is skipped. At least one vector must be compared.
function bodyEquiv(
  d: Dissected, overrides: Map<number, Script>, id: number,
  candidate: Script, arity: FunctionArity, perm: number[] | undefined, K = RANDOM_VECTORS, out?: number[],
): boolean {
  const matches = (reference: BodyRun, candidateRun: BodyRun): boolean => {
    if (reference.stack === undefined || candidateRun.stack === undefined) return false;
    if (out !== undefined && out.length !== reference.stack.length) return false;
    const expected = out !== undefined ? out.map((i) => reference.stack![i]) : reference.stack;
    return expected.join() === candidateRun.stack.join();
  };
  const withCandidate = new Map([...overrides, [id, candidate]]);
  let compared = 0;
  for (const [key, inputs, random] of testVectors(d, id, arity, K)) {
    const reference = referenceRun(d, id, key, inputs);
    if (reference.stack === undefined) {
      if (random && !reference.overBudget) return false;
      continue;
    }
    if (!matches(reference, runBody(d, withCandidate, id, inputs, CANDIDATE_BUDGET, perm))) return false;
    compared += 1;
  }
  return compared > 0;
}

// measured op-cost of a body, normalised to K runs (Infinity on any error): K fixed random
// vectors, or, when random vectors are off for this body (see TEST VECTORS), the small and
// medium vectors the reference evaluates; the static estimate when there are none
function measureBody(
  d: Dissected, overrides: Map<number, Script>, id: number,
  arity: FunctionArity, perm: number[] | undefined, K = RANDOM_VECTORS,
): number {
  const vectors: bigint[][] = [];
  if (randomVectorsUsable(d, id, arity)) {
    for (let t = 0; t < K; t += 1) vectors.push(Array.from({ length: arity.in }, (_, i) => rnd(i * 23 + t * 811 + id)));
  } else {
    testVectors(d, id, arity, K).forEach(([key, inputs]) => {
      if (referenceRun(d, id, key, inputs).stack !== undefined) vectors.push(inputs);
    });
    if (vectors.length === 0) return K * opCostEstimate(overrides.get(id) ?? d.bodies.get(id)!);
  }
  let total = 0;
  for (const inputs of vectors) {
    const run = runBody(d, overrides, id, inputs, CANDIDATE_BUDGET, perm);
    if (run.error !== undefined || run.stack === undefined) return Infinity;
    total += run.opCost;
  }
  return (total * K) / vectors.length;
}

// ---------- entry-layout candidates ----------

// Candidate argument orders for a body, derived from its first block's DAG: identity,
// reverse, earliest-first-use nearest the top, and most-used nearest the top. A `perm`
// maps stack position j (bottom -> top) to the original entry slot held there.
function layoutCandidates(
  body: Script, arities: Map<number, FunctionArity>, inArity: number, cc: CrossCallContext = NO_CROSSCALL,
): number[][] {
  const identity = Array.from({ length: inArity }, (_, i) => i);
  if (inArity < 2) return [identity];
  let items: Item[];
  try { items = decompile(body, arities, inArity); } catch { return [identity]; }
  const first = items.find((item): item is { block: BasicBlock } => 'block' in item);
  if (first === undefined) return [identity];

  const visited = new Set<number>();
  const order: DagNode[] = [];
  const visitNode = (node: DagNode): void => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    node.ins.forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });
    order.push(node);
  };
  [...first.block.exit, ...first.block.exitAlt].forEach((ref) => { if (ref.k === 'out') visitNode(ref.node); });

  const firstUse = new Array<number>(inArity).fill(Number.MAX_SAFE_INTEGER);
  const useCount = new Array<number>(inArity).fill(0);
  order.forEach((nd, t) => nd.ins.forEach((r) => {
    if (r.k !== 'in' || r.i >= inArity) return;
    firstUse[r.i] = Math.min(firstUse[r.i], t);
    useCount[r.i] += 1;
  }));

  // stable sorts; the deepest position gets the FIRST element of the sorted list
  const byFirstUseDesc = [...identity].sort((a, b) => (firstUse[b] - firstUse[a]) || (a - b));
  const byUseCountAsc = [...identity].sort((a, b) => (useCount[a] - useCount[b]) || (a - b));
  const reverse = [...identity].reverse();

  // cross-call scheduling: half-wise variants, so a two-operand callee can take each
  // operand reversed (matching a producer's first-last results) in either operand order
  const extra: number[][] = [];
  if (cc.enabled && cc.halfwiseLayouts && inArity % 2 === 0 && inArity >= 4) {
    const h = inArity / 2;
    const lo = identity.slice(0, h); const hi = identity.slice(h);
    extra.push([...[...lo].reverse(), ...[...hi].reverse()], [...hi, ...lo]);
  }
  const seen = new Set<string>();
  return [identity, byFirstUseDesc, byUseCountAsc, reverse, ...extra].filter((perm) => {
    const key = perm.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- body selection ----------

const BODY_STRATEGIES: Strategy[] = ['topo', 'greedy', 'opcost'];
const MAIN_STRATEGIES: Strategy[] = ['topo', 'greedy', 'opcost'];
const CROSSCALL_STRATEGIES: Strategy[] = ['exact', 'beamx'];
// adopt a non-identity entry layout only if it beats the best identity variant by >1%
// (its call-site staging costs are not visible in the body-level measurement)
const LAYOUT_HYSTERESIS = 1.01;

interface BodyChoices {
  overrides: Map<number, Script>;
  conv: Conventions; // non-standard conventions only
  // per overridden body: original check index -> its index in the override (BODY CHECK IPS)
  checkMaps: Map<number, Map<number, number>>;
}

// return-layout candidates that survive the static pre-screen and get a full compile
const RETURN_LAYOUT_FINALISTS = 2;

const identityPerm = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

// RETURN LAYOUTS suggested by the call sites of `id` in the callers' schedules: results that are
// consumed later go deeper, results consumed by the same node follow that node's staging order,
// so a matching layout lets the consumer adopt them in place. The (at most) two most frequent
// distinct orders are returned.
function consumerOrders(logs: ScheduleStep[][], id: number, nout: number, conv: Conventions): number[][] {
  const counts = new Map<string, { perm: number[]; n: number }>();
  logs.forEach((log) => log.forEach((step, index) => {
    if (step.node.kind !== 'invoke' || step.node.code !== id) return;
    const rank = Array.from({ length: nout }, (_, j) => {
      const key = `n${step.node.id}_${j}`;
      for (let t = index + 1; t < log.length; t += 1) {
        const i = log[t].keys.indexOf(key);
        if (i < 0) continue;
        const stagedIn = log[t].node.kind === 'invoke' ? conv.get(log[t].node.code)?.in : undefined;
        return { j, t, staged: stagedIn !== undefined ? stagedIn.indexOf(i) : i };
      }
      return { j, t: Number.MAX_SAFE_INTEGER, staged: j };
    });
    rank.sort((a, b) => (b.t - a.t) || (a.staged - b.staged));
    const perm = rank.map((r) => r.j);
    const key = perm.join(',');
    counts.set(key, { perm, n: (counts.get(key)?.n ?? 0) + 1 });
  }));
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((c) => c.perm);
}

// Reschedule every OP_DEFINE'd body; keep, per body, the best diff-test-equivalent
// candidate ('size': smallest bytes; 'opcost': smallest MEASURED op-cost). With
// `layouts`, entry-order permutations and a beam schedule join the candidate set, and
// bodies are processed callee-first so callers re-stage for their callees' chosen
// conventions. Throws if a body whose callee was permuted has no valid replacement (the
// caller falls back to identity layouts wholesale).
// A body compile depends only on the body, its convention, the strategy and its callees'
// conventions and scripts; fixed-point passes share these results through a CompileCache.
interface CachedCompile {
  candidate?: Script; cost: number; naturalOut?: number[]; equiv?: boolean; static?: number; checks?: Map<number, number>;
}
type CompileCache = Map<string, CachedCompile>;

// `prior` (fixed-point passes, see conventionPasses): the conventions of the previous pass,
// visible to the call-site proxy for functions this pass has not decided yet, so a caller is
// re-emitted with its other callees' conventions known. Bodies are only ever compiled against
// conventions decided in THIS pass.
function rescheduleBodies(
  d: Dissected, arities: Map<number, FunctionArity>, objective: 'size' | 'opcost', layouts: boolean,
  cc: CrossCallContext, mainInArity?: number, prior?: Conventions, cache: CompileCache = new Map(),
): BodyChoices {
  const overrides = new Map<number, Script>();
  const conv: Conventions = new Map();
  const checkMaps = new Map<number, Map<number, number>>();
  const base: Strategy[] = cc.enabled ? [...BODY_STRATEGIES, ...CROSSCALL_STRATEGIES] : BODY_STRATEGIES;
  const strategies: Strategy[] = layouts ? [...base, 'beam'] : base;
  const processing = layouts ? calleeFirstOrder(d) : d.order;
  const recursive = layouts ? recursiveFunctions(d) : new Set<number>();
  // measured op-cost sums 3 runs of the body (measureBody's K); weigh one static
  // call-site estimate per run
  const callSiteWeight = objective === 'opcost' ? 3 : 1;

  processing.forEach((id) => {
    const arity = arities.get(id);
    const original = d.bodies.get(id)!;
    const calleesPermuted = bodyInvokes(original).some((callee) => !isStandardConv(conv.get(callee)));
    if (arity === undefined) {
      if (calleesPermuted) throw new Error(`body ${id} invokes a permuted callee but has no arity`);
      return;
    }
    const bodyCost = (candidate: Script, perm: number[] | undefined): number => (
      objective === 'opcost'
        ? measureBody(d, new Map([...overrides, [id, candidate]]), id, arity, perm)
        : scriptCost(candidate, objective, cc.sizeModel)
    );
    // what every compile of this body depends on besides its own convention and strategy
    const calleeKey = [...new Set(bodyInvokes(original))].map((callee) => (
      `${callee}:${convKey(conv.get(callee))}:${binToHex(scriptToBytecode(overrides.get(callee) ?? d.bodies.get(callee) ?? []))}`
    )).join(';');
    const cacheKey = (c: Convention | undefined, strategy: string): string => (
      `${id}|${convKey(c)}|${strategy}|${layouts ? 'L' : ''}${cc.enabled ? 'C' : ''}|${calleeKey}`
    );

    let best: Script | undefined;
    let bestChecks: Map<number, number> | undefined;
    let bestConv: Convention | undefined;
    let bestCost = Infinity;
    // baseline: the untouched cashc body (only valid while its callees are unpermuted)
    if (!calleesPermuted) {
      const key = cacheKey(undefined, 'raw');
      if (!cache.has(key)) {
        cache.set(key, {
          cost: objective === 'opcost' ? measureBody(d, overrides, id, arity, undefined) : scriptCost(original, objective, cc.sizeModel),
        });
      }
      bestCost = cache.get(key)!.cost;
    }
    // the cheapest standard-layout schedule's natural return order (a return-layout candidate)
    let natural: { out: number[]; cost: number } | undefined;

    const candidatesPerms = layouts && !recursive.has(id) ? layoutCandidates(original, arities, arity.in, cc) : [undefined];
    // CALL-SITE-AWARE LAYOUTS (cross-call scheduling): a permuted entry layout changes how
    // every caller stages its arguments, e.g. cashc pushes a call's arguments last-first while
    // results come out first-last, so a chained f(g(x)) re-orders the whole tuple unless f
    // takes its arguments reversed. Rank each layout by body cost PLUS the static cost change
    // of re-emitting every direct caller (bodies and main) under it; a caller that cannot be
    // re-emitted rules the layout out.
    const callers: Array<{ script: Script; inArity: number; main?: boolean }> = [];
    const siteAware = cc.enabled && layouts && mainInArity !== undefined;
    if (siteAware) {
      d.order.forEach((caller) => {
        const callerArity = arities.get(caller);
        if (caller !== id && callerArity !== undefined && bodyInvokes(d.bodies.get(caller)!).includes(id)) {
          callers.push({ script: d.bodies.get(caller)!, inArity: callerArity.in });
        }
      });
      if (bodyInvokes(d.main).includes(id)) callers.push({ script: d.main, inArity: mainInArity!, main: true });
    }
    const callersCost = (
      calleeConv: Conventions, logs?: ScheduleStep[][], proxyStrategies: Strategy[] = ['topo', 'greedy'],
    ): number => callers.reduce((sum, caller) => {
      let bestCaller = Infinity;
      let bestLog: ScheduleStep[] | undefined;
      proxyStrategies.forEach((strategy) => {
        try {
          const recompiled = recompileScript(caller.script, arities, caller.inArity, strategy, objective, {
            calleeConv, crossCall: cc, recordLog: logs !== undefined, sinks: caller.main && cc.verifySinks,
          });
          const cost = scriptCost(recompiled.script, objective, cc.sizeModel);
          if (cost < bestCaller) { bestCaller = cost; bestLog = recompiled.log; }
        } catch { /* not re-emittable under this convention */ }
      });
      if (logs !== undefined && bestLog !== undefined) logs.push(bestLog);
      return sum + bestCaller;
    }, 0);
    // the callers under the current conventions (their schedules feed consumerOrders)
    const callerLogs: ScheduleStep[][] = [];
    let baseCallers: number | undefined;
    // the call-site proxy's view of the other functions' conventions, with this one standard
    const proxyConv = (): Conventions => {
      const view = new Map([...(prior ?? new Map<number, Convention>()), ...conv]);
      view.delete(id);
      return view;
    };
    const baseCallersCost = (): number => {
      baseCallers ??= callersCost(proxyConv(), callerLogs);
      return baseCallers;
    };
    const siteDeltaOf = (c: Convention | undefined): number => {
      if (isStandardConv(c)) return 0;
      const baseline = baseCallersCost();
      const next = proxyConv();
      next.set(id, c!);
      return callersCost(next) - baseline;
    };
    const useCallSites = siteAware && candidatesPerms.length > 1;

    // compile the body under convention `c` with every strategy; keep the best validated one
    const tryConvention = (c: Convention | undefined, siteDelta: number, sitesKnown: boolean): void => {
      if (!Number.isFinite(siteDelta)) return;
      const standard = isStandardConv(c);
      strategies.forEach((strategy) => {
        const key = cacheKey(c, strategy);
        let entry = cache.get(key);
        if (entry === undefined) {
          try {
            const recompiled = recompileScript(original, arities, arity.in, strategy, objective, {
              entryPerm: c?.in, exitPerm: c?.out, calleeConv: conv, crossCall: cc,
            });
            const { script, checks } = reoptimiseWithChecks(original, recompiled);
            entry = { candidate: script, cost: bodyCost(script, c?.in), naturalOut: recompiled.naturalOut, checks };
          } catch { entry = { cost: Infinity }; }
          cache.set(key, entry);
        }
        const { candidate, cost } = entry;
        if (candidate === undefined) return;
        if (isIdentityPerm(c?.out) && isIdentityPerm(c?.in) && entry.naturalOut !== undefined
          && cost < (natural?.cost ?? Infinity)) {
          natural = { out: entry.naturalOut, cost };
        }
        const effective = standard ? cost
          : sitesKnown ? cost + callSiteWeight * siteDelta : cost * LAYOUT_HYSTERESIS;
        if (effective < bestCost) entry.equiv ??= bodyEquiv(d, overrides, id, candidate, arity, c?.in, 3, c?.out);
        if (effective < bestCost && entry.equiv === true) {
          best = candidate;
          bestChecks = entry.checks;
          bestConv = standard ? undefined : c;
          bestCost = effective;
        }
      });
    };

    candidatesPerms.forEach((perm) => {
      const c: Convention | undefined = isIdentityPerm(perm) ? undefined : { in: perm };
      tryConvention(c, useCallSites ? siteDeltaOf(c) : 0, useCallSites);
    });

    // RETURN LAYOUTS (crossCall.returnLayouts): with the entry layout chosen, try permuted
    // return orders (and the joint reverse/reverse convention). Each candidate is pre-screened
    // by a static proxy (topo/greedy body cost + the callers' re-emission delta) against the
    // current choice; only the best RETURN_LAYOUT_FINALISTS that promise a gain are compiled
    // with every strategy, measured and differentially tested.
    if (cc.returnLayouts && siteAware && !recursive.has(id) && arity.out >= 2 && callers.length > 0) {
      const chosenIn = bestConv?.in;
      const reverseOut = identityPerm(arity.out).reverse();
      baseCallersCost(); // fills callerLogs
      const outs = [reverseOut, ...(natural !== undefined ? [natural.out] : [])];
      consumerOrders(callerLogs, id, arity.out, proxyConv()).forEach((perm) => outs.push(perm));
      const raw: Convention[] = outs.map((out) => ({ in: chosenIn, out }));
      if (arity.in >= 2) raw.push({ in: identityPerm(arity.in).reverse(), out: reverseOut });
      const seen = new Set<string>([convKey(bestConv)]);
      const pairs: Convention[] = [];
      raw.forEach((c) => {
        const normal = normaliseConv(c);
        const key = convKey(normal);
        if (normal === undefined || seen.has(key)) return;
        seen.add(key);
        pairs.push(normal);
      });
      const staticBody = (c: Convention | undefined): number => {
        const key = cacheKey(c, 'static');
        const hit = cache.get(key);
        if (hit !== undefined) return hit.cost;
        let cost = Infinity;
        (['topo', 'greedy'] as Strategy[]).forEach((strategy) => {
          try {
            const { script } = reoptimiseBody(recompileScript(original, arities, arity.in, strategy, objective, {
              entryPerm: c?.in, exitPerm: c?.out, calleeConv: conv, crossCall: cc,
            }).script);
            cost = Math.min(cost, scriptCost(script, objective, cc.sizeModel));
          } catch { /* not emittable under this convention */ }
        });
        cache.set(key, { cost });
        return cost;
      };
      if (pairs.length > 0) {
        const withConv = (c: Convention | undefined): Conventions => {
          const next = proxyConv();
          if (c !== undefined) next.set(id, c);
          return next;
        };
        // callers under the current choice (zk-notes/convention.md: forcing the blocks that invoke this
        // function to be re-emitted in this reference, or adding the exact strategy to the
        // proxy, measured no better)
        const refCallers = callersCost(withConv(bestConv));
        const reference = staticBody(bestConv);
        const bestSite = siteDeltaOf(bestConv);
        const scored = pairs.map((c) => {
          const delta = callersCost(withConv(c)) - refCallers;
          return { c, site: bestSite + delta, proxy: staticBody(c) + delta - reference };
        });
        const before = bestConv;
        const finalists = scored
          .filter((x) => Number.isFinite(x.proxy) && x.proxy < 0)
          .sort((a, b) => a.proxy - b.proxy)
          .slice(0, RETURN_LAYOUT_FINALISTS);
        // returnLayoutsExact: the finalists' caller deltas come from recompiling the callers with
        // every scheduling strategy (exact and beam included) instead of the topo/greedy proxy
        const fullStrategies: Strategy[] = [...MAIN_STRATEGIES, ...CROSSCALL_STRATEGIES];
        const fullRef = cc.returnLayoutsExact && finalists.length > 0
          ? callersCost(withConv(bestConv), undefined, fullStrategies) : 0;
        finalists.forEach(({ c, site }) => {
          const exactSite = cc.returnLayoutsExact
            ? bestSite + callersCost(withConv(c), undefined, fullStrategies) - fullRef : site;
          tryConvention(c, exactSite, true);
        });
        if (process.env.CASHC_DEBUG_RESCHEDULE !== undefined) {
          const list = scored.map((x) => `${convKey(x.c)}:${x.proxy}(site ${x.site})`).join(' ');
          // eslint-disable-next-line no-console
          console.error(`[reschedule] f${id} out-layouts [${list}] ${convKey(before)} -> ${convKey(bestConv)}`);
        }
      }
    }

    if (best !== undefined) {
      overrides.set(id, best);
      if (bestChecks !== undefined) checkMaps.set(id, bestChecks);
      if (bestConv !== undefined) conv.set(id, bestConv);
    } else if (calleesPermuted) {
      // the original body is invalid under the new callee conventions and no candidate
      // validated — abort the layout experiment for this contract
      throw new Error(`no valid re-emission for body ${id} under permuted callees`);
    }
  });

  return { overrides, conv, checkMaps };
}

// ---------- debug-information remapping ----------

const mergeLocations = (locations: SingleLocationData[]): SingleLocationData => {
  const lowest = locations.reduce((low, cur) => {
    const { start: a } = low.location; const { start: b } = cur.location;
    return (b.line < a.line || (b.line === a.line && b.column < a.column)) ? cur : low;
  });
  const highest = locations.reduce((high, cur) => {
    const { end: a } = high.location; const { end: b } = cur.location;
    return (b.line > a.line || (b.line === a.line && b.column > a.column)) ? cur : high;
  });
  return {
    location: { start: lowest.location.start, end: highest.location.end },
    positionHint: locations[locations.length - 1]?.positionHint ?? PositionHint.START,
  };
};

// old element index -> new element index. Exact for untouched regions and preserved
// boundary opcodes; indices inside a rewritten block clamp to the block's last opcode
// (the closest instruction to the failing check for error attribution).
const indexRemapper = (mapping: ItemMapping[], offset: number) => (oldIndex: number): number => {
  if (oldIndex < offset) return oldIndex;
  const local = oldIndex - offset;
  for (const m of mapping) {
    if (local >= m.oldStart && local < m.oldEnd) {
      const exact = m.points?.find(([from]) => from === local);
      if (exact !== undefined) return offset + exact[1];
      return offset + (m.rewritten ? Math.max(m.newStart, m.newEnd - 1) : m.newStart + (local - m.oldStart));
    }
  }
  const last = mapping[mapping.length - 1];
  return offset + (last?.newEnd ?? 0) + (local - (last?.oldEnd ?? 0));
};

function remapLocationData(locationData: FullLocationData, mapping: ItemMapping[], offset: number): FullLocationData {
  const out: FullLocationData = locationData.slice(0, offset);
  mapping.forEach((m) => {
    const slice = locationData.slice(offset + m.oldStart, offset + m.oldEnd);
    if (!m.rewritten) { slice.forEach((entry) => out.push(entry)); return; }
    const merged = slice.length > 0 ? mergeLocations(slice) : locationData[offset + m.oldStart - 1];
    // a check scheduled inside the block (VERIFY sink) keeps its own location, so a failing
    // require() still reports its own line
    const exact = new Map((m.points ?? []).map(([from, to]) => [to, locationData[offset + from]]));
    // the ops after the block's last check compute what follows the last original check (for
    // the final block of main: the last require(), which has no VERIFY of its own)
    let tail = merged;
    let tailFrom = m.newEnd;
    if (m.points !== undefined && m.points.length > 0) {
      const lastOld = Math.max(...m.points.map(([from]) => from));
      const after = locationData.slice(offset + lastOld + 1, offset + m.oldEnd);
      if (after.length > 0) { tail = mergeLocations(after); tailFrom = Math.max(...m.points.map(([, to]) => to)) + 1; }
    }
    for (let i = m.newStart; i < m.newEnd; i += 1) out.push(exact.get(i) ?? (i >= tailFrom ? tail : merged));
  });
  return out;
}

// ---------- the pass ----------

// Which OP_DEFINE'd functions can fail on well-formed arguments (see ORDERED NODES). A body is
// infallible when it lifts, contains no check or other block-bounding op besides control flow,
// no fallible prim, and only invokes infallible functions (greatest fixed point, so pure
// recursion stays infallible). Bodies that cannot be lifted count as fallible, and so do bodies
// with console.log (`logged`): moving their calls across a check would drop or reorder logs.
function analyseFallibility(
  d: Dissected, arities: Map<number, FunctionArity>, logged: ReadonlySet<number>,
): Fallibility {
  const constFns = new Map<number, Uint8Array>();
  d.order.forEach((id) => {
    const body = d.bodies.get(id)!;
    const arity = arities.get(id);
    const data = body.length === 1 ? constDataOf(body[0]) : undefined;
    if (arity?.in === 0 && arity.out === 1 && data !== undefined) constFns.set(id, data);
  });
  const info: Fallibility = { infallible: new Set(), constFns };
  const callees = new Map<number, number[]>();
  const candidates = new Set<number>();
  const FLOW = new Set<number>([Op.OP_IF, Op.OP_NOTIF, Op.OP_ELSE, Op.OP_ENDIF, Op.OP_BEGIN, Op.OP_UNTIL]);
  d.order.forEach((id) => {
    const arity = arities.get(id);
    if (arity === undefined || logged.has(id)) return;
    let items: Item[];
    try { items = decompile(d.bodies.get(id)!, arities, arity.in); } catch { return; }
    const invoked: number[] = [];
    let local = true;
    items.forEach((item) => {
      if ('ctrl' in item) { if (!FLOW.has(item.ctrl)) local = false; return; }
      item.block.nodes.forEach((node) => {
        if (node.kind === 'invoke') invoked.push(node.code);
        else if (isFallible(node, info)) local = false;
      });
    });
    if (local) { candidates.add(id); callees.set(id, invoked); }
  });
  for (let changed = true; changed;) {
    changed = false;
    [...candidates].forEach((id) => {
      if (callees.get(id)!.some((callee) => !candidates.has(callee))) { candidates.delete(id); changed = true; }
    });
  }
  return { infallible: candidates, constFns };
}

// OP_DEFINE'd functions whose debug frame has console.log entries
function loggedBodyIds(d: Dissected, frames: DebugFrame[]): Set<number> {
  const framesByBytecode = new Map(frames.map((frame) => [frame.bytecode, frame]));
  return new Set(d.order.filter((id) => {
    const frame = framesByBytecode.get(binToHex(scriptToBytecode(d.bodies.get(id)!)));
    return (frame?.logs.length ?? 0) > 0;
  }));
}

export function applyStackRescheduling(
  optimised: OptimiseBytecodeResult,
  frames: DebugFrame[],
  options: RescheduleOptions,
): RescheduleOutcome {
  const enabled = options.crossCallScheduling ?? false;
  const dissected = dissect(optimised.script);
  const logged = loggedBodyIds(dissected, frames);
  const cc: CrossCallContext = {
    enabled,
    symmetries: enabled ? findSymmetries(dissected, options.arities, logged) : new Map(),
    halfwiseLayouts: options.crossCallHalfwiseLayouts ?? options.objective === 'size',
    returnLayouts: enabled && (options.returnLayouts ?? true),
    passThroughBottom: options.passThroughBottom ?? enabled,
    verifySinks: enabled && (options.verifySinks ?? true),
    returnLayoutsExact: options.returnLayoutsExact ?? false,
    fallibility: enabled ? analyseFallibility(dissected, options.arities, logged) : NO_FALLIBILITY,
    sizeModel: enabled && options.objective === 'size' ? options.sizeModel : undefined,
    blockSizeModel: enabled && options.objective === 'size' && options.sizeModelScope !== 'bodies' ? options.sizeModel : undefined,
  };
  if (process.env.CASHC_DEBUG_RESCHEDULE !== undefined) {
    const list = [...cc.symmetries].map(([id, sym]) => `${id}${sym.half ? 'h' : ''}${sym.comps.map((c) => `{${c.join(',')}}`).join('')}`);
    console.error(`[reschedule] symmetries: ${list.join(' ')}`); // eslint-disable-line no-console
  }
  return applyStackReschedulingInner(optimised, frames, options, cc);
}

function applyStackReschedulingInner(
  optimised: OptimiseBytecodeResult,
  frames: DebugFrame[],
  options: RescheduleOptions,
  cc: CrossCallContext,
): RescheduleOutcome {
  const { arities, objective, constructorParamLength } = options;
  const d = dissect(optimised.script);

  // 1. bodies (skipped for a body with console.log entries — wholesale reordering cannot
  // preserve per-instruction log data)
  const loggedBodies = loggedBodyIds(d, frames);
  const loggableArities = new Map([...arities].filter(([id]) => !loggedBodies.has(id)));

  let choices: BodyChoices;
  // The layout search needs main to be re-writable (it may have to re-stage arguments), and
  // every call site in the whole program must be `<id const> OP_INVOKE` — see hasAmbiguousInvoke.
  const allScripts = [d.main, ...d.order.map((id) => d.bodies.get(id)!)];
  const layouts = optimised.logs.length === 0 && !allScripts.some(hasAmbiguousInvoke);
  const debug = process.env.CASHC_DEBUG_RESCHEDULE !== undefined;
  try {
    const compileCache: CompileCache = new Map();
    choices = rescheduleBodies(d, loggableArities, objective, layouts, cc, options.mainInArity, undefined, compileCache);
    // FIXED-POINT PASSES (conventionPasses > 1): redo the callee-first search with the previous
    // pass's conventions visible to the call-site proxy, until the conventions stop changing
    const passes = cc.enabled && layouts ? Math.max(1, options.conventionPasses ?? 3) : 1;
    for (let pass = 1; pass < passes; pass += 1) {
      const next = rescheduleBodies(
        d, loggableArities, objective, layouts, cc, options.mainInArity, choices.conv, compileCache,
      );
      const key = (c: Conventions): string => [...c].sort(([a], [b]) => a - b).map(([fid, x]) => `${fid}:${convKey(x)}`).join(' ');
      const stable = key(next.conv) === key(choices.conv);
      if (debug) console.error(`[reschedule] convention pass ${pass + 1}: ${stable ? 'stable' : 'changed'}`); // eslint-disable-line no-console
      choices = next;
      if (stable) break;
    }
    if (debug && layouts) {
      // eslint-disable-next-line no-console
      console.error(`[reschedule] conventions: ${choices.conv.size} of ${d.order.length} bodies (${[...choices.conv].map(([id, c]) => `${id}:${convKey(c)}`).join(' ')})`);
    }
  } catch (e) {
    if (debug) console.error(`[reschedule] layout experiment fell back to identity: ${(e as Error).message}`); // eslint-disable-line no-console
    // the layout experiment failed validation somewhere — identity layouts wholesale
    choices = rescheduleBodies(d, loggableArities, objective, false, cc);
  }
  let { overrides, conv, checkMaps } = choices;

  // 2. main routine (kept as-is when the contract logs to console). When any callee's
  // entry layout changed, main MUST be re-emitted (its raw call sites stage the old
  // order); if that fails, redo everything with identity layouts.
  let main = d.main;
  let mainMapping: ItemMapping[] | undefined;
  const rescheduleMain = (): boolean => {
    // main MUST be re-emitted only when it itself stages arguments for a permuted callee;
    // permuted inner helpers (reached through other bodies) don't affect its call sites
    const needsReemit = conv.size > 0 && bodyInvokes(d.main).some((id) => !isStandardConv(conv.get(id)));
    let best: RecompiledScript | undefined;
    let bestCost = needsReemit ? Infinity : scriptCost(d.main, objective, cc.blockSizeModel);
    (cc.enabled ? [...MAIN_STRATEGIES, ...CROSSCALL_STRATEGIES] : MAIN_STRATEGIES).forEach((strategy) => {
      let candidate: RecompiledScript;
      try {
        candidate = recompileScript(d.main, arities, options.mainInArity, strategy, objective, {
          calleeConv: conv, crossCall: cc, sinks: cc.verifySinks, validate: cc.enabled,
        });
      } catch (e) {
        if (debug) console.error(`[reschedule] main (${strategy}) failed: ${(e as Error).message}`); // eslint-disable-line no-console
        return;
      }
      const cost = scriptCost(candidate.script, objective, cc.blockSizeModel);
      if (cost < bestCost && candidate.changed) { best = candidate; bestCost = cost; }
    });
    if (best !== undefined) { main = best.script; mainMapping = best.mapping; }
    return best !== undefined || !needsReemit;
  };
  if (optimised.logs.length === 0) {
    if (!rescheduleMain() && conv.size > 0) {
      ({ overrides, conv, checkMaps } = rescheduleBodies(d, loggableArities, objective, false, cc));
      main = d.main;
      mainMapping = undefined;
      rescheduleMain();
    }
  } else if (conv.size > 0) {
    // main cannot be re-emitted (logs) so callee conventions must stay standard
    ({ overrides, conv, checkMaps } = rescheduleBodies(d, loggableArities, objective, false, cc));
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.error(`[reschedule] final: overrides=${overrides.size} conventions=${conv.size} mainRewritten=${mainMapping !== undefined}`);
  }
  if (overrides.size === 0 && mainMapping === undefined) return { result: optimised, frames };

  // 3. rebuild the script with the rescheduled bodies + main
  const script: Script = [];
  d.order.forEach((id) => {
    script.push(scriptToBytecode(overrides.get(id) ?? d.bodies.get(id)!), encodeInt(BigInt(id)), Op.OP_DEFINE);
  });
  main.forEach((el) => script.push(el));

  // 4. remap top-level debug structures across the main rewrite (the define-table prefix
  // is index-stable: body pushes change bytes, not element positions)
  let { locationData, requires, sourceTags } = optimised;
  if (mainMapping !== undefined) {
    const remap = indexRemapper(mainMapping, d.tableLength);
    locationData = remapLocationData(locationData, mainMapping, d.tableLength);
    // (the final require is re-anchored after all post-passes, see anchorFinalRequire)
    requires = requires.map((req: RequireStatement) => ({
      ...req,
      ip: remap(req.ip - constructorParamLength) + constructorParamLength,
    }));
    sourceTags = sourceTags.map((tag: SourceTagEntry) => ({
      ...tag,
      startIndex: remap(tag.startIndex),
      endIndex: remap(tag.endIndex),
    }));
  }

  // 5. refresh the debug frames of rescheduled bodies: coarse (whole-function) source
  // map, requires re-anchored to their preserved boundaries, tags dropped
  const newFrames = frames.map((frame) => {
    const id = d.order.find((candidate) => binToHex(scriptToBytecode(d.bodies.get(candidate)!)) === frame.bytecode);
    if (id === undefined || !overrides.has(id)) return frame;
    const body = overrides.get(id)!;
    // The frame carries no whole-definition location, so span its own source map instead
    // (first entry's start to last entry's end).
    const frameLocations = sourceMapToLocationData(frame.sourceMap);
    const wholeLocation: SingleLocationData = {
      location: {
        start: frameLocations[0].location.start,
        end: frameLocations[frameLocations.length - 1].location.end,
      },
      positionHint: PositionHint.START,
    };
    const bodyLocationData: FullLocationData = new Array(body.length).fill(wholeLocation);
    // a require() ip is its check's index, remapped exactly (BODY CHECK IPS); an ip that is no
    // check of the original body, or whose check the optimiser merged away, clamps into range
    const checks = checkMaps.get(id);
    const maxIp = Math.max(0, body.length - 1);
    // a remapped check keeps its own source location (the SDK reports the failing op's line)
    checks?.forEach((to, from) => { if (frameLocations[from] !== undefined) bodyLocationData[to] = frameLocations[from]; });
    return {
      ...frame,
      bytecode: binToHex(scriptToBytecode(body)),
      sourceMap: generateSourceMap(bodyLocationData),
      requires: frame.requires.map((req) => ({ ...req, ip: checks?.get(req.ip) ?? Math.min(req.ip, maxIp) })),
      // tags and inline ranges hold frame-local ips of the original body
      ...(frame.sourceTags !== undefined ? { sourceTags: undefined } : {}),
      ...(frame.inlineRanges !== undefined ? { inlineRanges: undefined } : {}),
    };
  });

  // Inline ranges across a main rewrite: a range whose first and last instructions lie outside
  // rewritten blocks is remapped exactly (a rewritten block between them stays inside it, since
  // a block's ops never leave its span); a range that starts or ends inside a rewritten block is
  // dropped, which degrades inlined-callable attribution instead of pointing it at other code.
  const inlineRanges = mainMapping === undefined ? optimised.inlineRanges : optimised.inlineRanges.flatMap((range) => {
    const exact = (ip: number): number | undefined => {
      const index = ip - constructorParamLength;
      if (index < d.tableLength) return ip;
      const local = index - d.tableLength;
      const m = mainMapping!.find((x) => local >= x.oldStart && local < x.oldEnd);
      if (m === undefined || m.rewritten) return undefined;
      return d.tableLength + m.newStart + (local - m.oldStart) + constructorParamLength;
    };
    const startIp = exact(range.startIp);
    const endIp = exact(range.endIp);
    return startIp === undefined || endIp === undefined ? [] : [{ ...range, startIp, endIp }];
  });

  return {
    result: {
      ...optimised, script, locationData, requires, sourceTags, inlineRanges,
    },
    frames: newFrames,
  };
}
