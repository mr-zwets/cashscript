# Lever "aggregate": block moves for contiguous aggregates (prototype)

Worktree `C:/Users/mathi/Desktop/zk-proto-aggregate` (branch `zk-proto-aggregate` from `zk-language`).
Patch: `zk-notes/checkpoints/proto-aggregate.patch` (includes the two new files; applies cleanly to `zk-language`).
Rejected variant: `zk-notes/checkpoints/proto-aggregate-blockaware-rejected.patch`.
Scripts: `zk-notes/proto-aggregate/` (`dump.mts` per-function breakdown + ASM, `runs.mts` run histogram,
`lower-structs.mts` struct desugaring, `bn254-structs/` struct-style sources, `bn254-lowered/` their lowering).

## What

An Fp2/Fp6/Fp12 value lives on the stack as a contiguous block, and staging it as a call argument
compiles to k single-item fetches whose depth operands form a progression:

| pattern | meaning | runs with k >= 4 in BN254 baseline |
|---|---|---|
| `D PICK` x k | copy block, in order | 14 |
| `D ROLL` x k | move block, in order | 27 |
| `D PICK, D+2 PICK, ...` | copy block, reversed | 17 |
| `D ROLL, D+1 ROLL, ...` | move block, reversed | 53 (28 of them k = 12) |

Each fetch costs 2 B (D <= 16) or 3 B, so a 12-item move is 24-36 B. Estimated collapsible movement
before any change: ~1.7 kB of the 7.6 kB singleton.

New internal option `blockMoves: true | { kinds?, specialise?, renumber? }` (off by default), pass
`src/block-moves.ts`, run last (after rescheduling and the final bytecode optimisation):

1. Tokenise every body and main into fetch tokens: `<d> PICK|ROLL`, the 1-byte multi-item ops
   (DUP OVER SWAP ROT 2DUP 3DUP 2OVER 2SWAP 2ROT TUCK, each expanded to its fetch sequence),
   drops (`<d> ROLL DROP`, DROP, NIP, 2DROP) and `TOALTSTACK x m, DROPs, FROMALTSTACK x m`.
2. Per segment of consecutive tokens, a DP picks the min-byte cover by raw tokens and helper calls.
3. Helpers are OP_DEFINE'd looping functions (functions share the main stack; the two parameters
   sit on top and every fetched item is tucked under them, which keeps per-item depth constant):
   - `P0`/`R0` in-order copy/move: `<D+2> <k> <id> INVOKE`, body `BEGIN OVER PICK|ROLL ROT ROT 1SUB DUP NOT UNTIL 2DROP` (10 B)
   - `P2`/`R1` reversed copy/move: `<end> <D+2> <id> INVOKE`, body `BEGIN DUP PICK|ROLL ROT ROT 2 ADD|1ADD 2DUP NUMEQUAL UNTIL 2DROP`
   - `LP`/`LR` arbitrary PICK-only / ROLL-only fetch lists: `<bytes d+1> <id> INVOKE`, body `BEGIN 1 SPLIT SWAP PICK|ROLL SWAP SIZE NOT UNTIL DROP`
   - `LM` mixed PICK/ROLL list (byte = 2(d+1)+isPick), 21 B body with an IF
   - `DB` drop a contiguous block (also replaces the altstack-park-and-drop cleanup)
   Helper set chosen greedily (drop a helper while net saving does not fall).
4. `renumberFunctions`: all OP_DEFINE ids renumbered by static call count, so the hottest 17
   functions (helpers included) push their id in 1 byte. Element counts never change, so debug
   data stays aligned; skipped if any OP_INVOKE id is not an immediate constant.
5. Optional specialised helpers (`R1#12` etc., count baked into the body) are tried and kept only
   if smaller end to end; on both singletons they never win (they compete for the 17 one-byte ids).

Correctness: every replaced run is performed by exactly the same PICK/ROLL sequence inside the
helper, which leaves nothing else behind. Debug data (source map, requires, tags, frames) is
remapped; inline ranges are dropped when main changes (as the rescheduler does). Logged contracts
are skipped.

## Struct desugaring (zero cost, measured)

`lower-structs.mts` lowers `struct Fp2 { int c0; int c1; }`, nested `Fp6 {Fp2 c0; c1; c2}`,
`Fp12 {Fp6 c0; Fp6 c1}` (params, returns, declarations, tuple targets, reassignment, `a.c1.c0`
paths, `Fp2(x, y)` literals) to flat ints in declaration order, i.e. a struct is exactly its leaves,
contiguous on the stack. `bn254-structs/` rewrites Fp2 (add/sub/neg/mul/sqr/mulXi), Fp6
(add/sub/neg/mulByV/mul/sqr), Fp12 (mul034/mul/sqr/conj) and Miller (line, millerSingle) with
structs, e.g. `fp12Mul(Fp12 a, Fp12 b)` with `Fp6 t0 = fp6Mul(a.c0, b.c0); ... return Fp12(c0, c1);`.
Compiled via `ZK_SOURCE=.../bn254-lowered/groth16.cash`: 7,617 B / opCost 780,281,889 without
block moves and 5,684 B / 923,332,452 with them: byte-identical behaviour to the flat source, both
verdicts correct. Structs cost nothing and give the compiler exactly the block layout the block-move
pass exploits. Fixed arrays (`int[12]`) would lower the same way (not implemented). A real
implementation belongs in the grammar/AST (desugar before symbol tables); the regex/token tool is
a measurement prototype only.

## Measurements (`.zk-measure.mts`, default objective, rescheduleStacks)

| variant | BN254 B | BN254 opCost | BLS B | BLS opCost |
|---|---|---|---|---|
| baseline co-8 | 7,617 | 780,281,889 | 6,911 | 987,767,715 |
| renumber ids only | 7,579 | 780,534,214 | 6,877 | 987,972,021 |
| progression helpers P0/R0/P2/R1 (no renumber) | 6,035 | 837,310,896 | 5,489 | 1,009,610,727 |
| + renumber | 5,902 | 837,563,184 | 5,389 | 1,009,815,020 |
| P0/R0/P2/R1 + DB + renumber | 5,810 | 838,239,166 | 5,334 | 1,009,918,113 |
| + LP/LR lists | 5,721 | 856,747,817 | 5,221 | 1,027,719,723 |
| + LM mixed list (all kinds, now the default) | **5,684** | 923,332,452 | **5,179** | 1,097,841,932 |
| all kinds, no renumber | 5,828 | 923,080,172 | 5,295 | 1,097,637,655 |
| rejected: block-aware rescheduler ranking (bodies + blocks) | 6,335 | 806,123,496 | 5,542 | 1,003,059,203 |
| rejected: block-aware per-block min only | 6,039 | 837,221,970 | n/m | n/m |

All rows: validAccepted true, invalidRejected true. Best: BN254 -1,933 B (-25.4%), BLS -1,732 B
(-25.1%), op-cost +18.3% / +11.1%. Without LM: -1,896 / -1,690 B for +9.8% / +4.0% op-cost.
`optimizeFor: 'size'` is worse for the baseline (7,786) and with block moves (6,253 with LP/LR).

Per function (BN254, all kinds): fp12Mul 267 -> 138 B, millerSingle 760 -> 473, line 259 -> 179,
fp6Mul 187 -> 162, g2AddAffine 328 -> 255, main 3,770 -> 2,604. Note `.zk-measure`'s movementBytes
does not count helper-call parameter pushes as movement (4,233 -> 1,426 overstates the change;
lockingBytes is the real number).

Tests: cashc 788/788 (736 existing + 52 new in `test/block-moves.test.ts`: VM differential on 40
random fetch programs per helper set and with renumbering, helper coverage per kind, an aggregate
contract compiled with/without the pass, source-map alignment). Lint clean. SDK tests not run
(option is off by default, existing bytecode unchanged).

## Risks

- Op-cost: each moved item costs ~8 evaluated instructions instead of 1-2 (LM ~20). Fine for the
  byte-scored singletons; for op-bound multi-input entries pick `kinds` without LM (or without lists).
- Selection is not op-cost aware and not in the rescheduler's cost model; ranking the rescheduler's
  candidates by collapsed bytes made things worse (body selection by measured op-cost is better).
- Helper ids and renumbering compete for the 17 one-byte ids; renumbering is a static-count heuristic.
- Debug: helper bodies have no debug frame (the SDK falls back to the root frame inside them);
  rewritten bodies get per-element source maps from the run they replace.
- The pass assumes every OP_DEFINE sits in the table prefix and every OP_INVOKE takes a constant id
  (true for cashc output; it bails otherwise).

## Composition with the other levers

- convention / crosscall / borrow: these remove movement at the source; block moves collapse what is
  left, so savings overlap. The more a convention keeps aggregates contiguous and in order (or exactly
  reversed), the more of the residual collapses into 4-byte calls. Borrow-by-depth removes copies that
  P0/P2 would otherwise compress, so the combined gain is less than the sum.
- altstack: altstack parking turns runs into TOALT/FROMALT sequences that are not collapsed (except the
  park-drop-restore cleanup, handled by DB). Apply block moves last; it sees whatever the others emit.
- Renumbering is independent and composes with everything (pure id choice).
- Structs: zero cost by construction, and they make contiguity a source-level guarantee; the
  desugaring should go in before the convention work so conventions can treat a struct as one unit
  (e.g. pass/return an Fp12 as a block in a fixed order).
