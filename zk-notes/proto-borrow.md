# Prototype: borrow by depth (lever 4)

Worktree `C:/Users/mathi/Desktop/zk-proto-borrow` (branch `zk-proto-borrow`, from `zk-language`).
Patch: `zk-notes/checkpoints/proto-borrow.patch` (includes the new file `src/generation/borrowing.ts`;
earlier checkpoints v1-v3 are next to it). Everything is behind internal options and **off by default**:
cashc tests 736/736, lint clean.

## What it does

A callee may *borrow* read-only parameters: the caller does not copy the argument to the top; the callee
reads it in place with `<depth> OP_PICK`.

- **Convention (static).** Owned parameters are staged on top as before. Below them sits a *region* of
  `regionSize` slots that the callee reads but never moves or drops. Borrowed parameter j sits at region
  offset `o_j`. The other region slots are gaps (unrelated caller values).
- **Callee codegen.** The frame is seeded with the owned parameters plus region slot names. Borrowed
  parameter names are aliased to their slots and are always PICKed, never ROLLed. Cleanup stops at the
  region.
- **Call sites.** A call is emitted *in place* when, after the owned arguments are staged, every borrowed
  argument variable sits at its region slot. Otherwise there is a fallback: stage a fresh region (borrowed
  values plus `OP_0` gap fillers), invoke, then drop the region under the results. The fallback is always
  correct.
- **Choosing the spec.** A probe compile records, at every emitted call site, the offset each identifier
  argument would have. Observations are tied to the traversal state, so code-generation variants that
  `chooseScopedReassignment` discards do not count. A parameter is borrowed when every site agrees on its
  offset. A check compile then prunes callees that still need a fallback. Finally, a greedy selection
  drops every borrowing callee whose removal makes the final bytecode smaller: first on cheap
  codegen-only compiles, then on full rescheduled compiles.
- **`borrowFinalUse`.** Arguments passed on their final use are candidates too. They are left in place
  as dead values for the caller to drop later.
- **Rescheduler integration.** An `OP_INVOKE` of a borrowing callee is a block boundary in its callers,
  because the region must keep the exact layout codegen produced. Borrowing bodies are decompiled and
  diff-tested over their whole window, with the identity entry layout only.
- **Rescheduler fix (needed).** Without it, borrowing *lost* bytes after rescheduling (BLS +163 B). The
  `finish` step of `emitBlock` re-assembled every exit slot on top, even slots that are untouched entry
  slots at the bottom. The new `passThroughBottom` keeps that bottom in place. It is on whenever
  borrowing is on, and can also be enabled alone with `reschedulePassThrough`. On its own it is worth
  -36 B on each curve.
- **Runtime-depth variant** (`borrowRuntime` / `borrowRuntimeGroups`, experiment). The caller pushes the
  depth of region slot 0 as an extra top argument. The callee reads with
  `<base> PICK <c> ADD PICK`. Only the relative offsets must agree; sites that disagree fall back.

## Measurements (`.zk-measure.mts`, opcost objective, rescheduleStacks)

| Variant | BN254 B | BN254 opCost | BLS B | BLS opCost | valid / invalid |
|---|---|---|---|---|---|
| baseline co-8 | 7617 | 780,281,889 | 6911 | 987,767,715 | ok / ok |
| v1 static, no pass-through fix | 7605 | 780,104,857 | 7074 (worse) | 988,432,916 | ok / ok |
| pass-through fix only | 7581 | 780,267,317 | 6875 | 987,745,979 | ok / ok |
| static borrow + fix, all agreeing callees | 7566 | 780,066,436 | 6801 | 987,821,748 | ok / ok |
| + greedy selection | 7566 | 780,066,436 | 6792 | 987,644,044 | ok / ok |
| **+ borrowFinalUse + selection (best)** | **7561** | **780,085,006** | **6775** | **987,749,061** | ok / ok |
| runtime-depth fp12Mul B-group, codegen only (vs 8283 / 793,784,592) | 8267 | 798,083,299 | | | ok / ok |
| runtime-depth fp12Mul B-group, full pipeline | 7645 (worse) | 790,705,985 | | | ok / ok |

Best settings: `{"borrowArgs":true,"borrowFinalUse":true}`. That is -56 B on BN254 (-0.7%) and -136 B on
BLS (-2.0%). The share that borrowing adds on top of the rescheduler fix is -20 B on BN254 and -100 B on
BLS. Op cost is -0.03% on BN254 and -0.002% on BLS.

The selected borrowing callees were:
- **BN254:** `powMinusX` (12 args, 3 sites in finalExp) and `g2AddAffine` (B point, 1 loop site).
- **BLS:** `powMinusX`, `fp12Frob2` and `computeVkx`.

`powMinusX` gives most of the gain: on its own it is worth -81 B on BLS.

## Why the lever is small

- **Static agreement is rare.** Library functions are called from different layouts. fp12Mul's B operand
  is ascending at some sites and descending at others, because results come back reversed relative to
  argument order. Its base offset also varies. In practice only callees with a single site, or with a few
  sites in straight-line finalExp code, qualify.
- **Copies are already few after rescheduling.** The upper bound (copy bytes feeding invoke arguments
  whose original survives) is 1,242 B on BN254, but almost all of it sits at sites that cannot agree.
- **Boundaries cost rescheduling.** A borrowing invoke is a block boundary, so callers lose cross-call
  scheduling. Borrowing `line` costs +9 B on BLS for this reason, and the greedy selection removes it.
- **The runtime variant fails on cost.** Each borrowed read costs about +3 bytes and +2 instructions. The
  body has dynamic PICKs, so it cannot be rescheduled (fp12Mul grows from 267 to 361 B). Its callees
  must also keep identity layouts. It saves 16 B before rescheduling but loses 28 B after it, and op cost
  rises by 1.3%.

## Risks

- **Correctness.** Checked by valid/invalid on both singletons. Forcing borrowing on (env
  `CASHC_BORROW_ARGS=1`, plus `borrowFinalUse`) over all test contracts gives 63 changed compiles,
  12,600 differential VM vectors (loosened VM) and 0 mismatches.
- **Fixture diffs.** With borrowing forced on, 10 generation fixtures change bytecode, which is expected;
  their semantics match on the VM. The default is off, so fixtures are unchanged.
- **Compile time.** The selection does |spec|+1 full rescheduled compiles, about 3-5 minutes per singleton
  instead of 1. Codegen-only pre-pruning keeps this bounded.
- **Debug info.** Debug frames still list all parameters, and `console.log` of a runtime-borrowed
  parameter is not supported.
- **Greedy selection** is order-dependent and judged on bytes only. Op cost is not checked; it moved
  slightly up on BLS in some variants.
- **The rescheduler boundary** depends on codegen layouts. Borrowing therefore works against any future
  cross-call scheduling unless the scheduler learns "peek" inputs (see below).

## How it composes with the other levers

- **convention.** Borrowing is a special case of a calling convention: some arguments are read in place
  and left there. The probe shows the main obstacle is result order (tuples come back reversed) and
  varying base depth. A convention lever that fixes argument and result order, for example returning
  results in the order the next call wants, would raise the number of agreeing sites. A convention search
  should therefore include "borrowed" as a per-parameter mode, chosen together with the layout.
- **crosscall.** Today borrowing conflicts with it: a borrowing invoke is a hard block boundary.
  The proper merge is to model a borrowing invoke in the rescheduler DAG as a node that reads (without
  consuming) values at fixed depths below its owned inputs. The scheduler would then place region values
  rather than freeze codegen's layout. The `passThroughBottom` fix (-36 B per curve) is independent and
  helps any lever that creates more blocks.
- **altstack.** Independent. Borrowed values cannot be parked on the altstack while borrowed, but values
  above the region can be.
- **aggregate.** With Fp12 or struct aggregates, borrowing a whole aggregate by one base is the natural
  unit (one relative layout per struct). That favours the runtime-base form only if per-read overhead
  drops, for example with a dedicated `PICK`-relative opcode, which BCH does not have. With static
  layouts, an aggregate makes agreement more likely, because members stay contiguous and in a fixed
  order.

## Estimated full potential

- **Current form:** about -0.7% (BN254) to -2% (BLS) of bytes, mostly from the rescheduler fix and a few
  finalExp-level functions.
- **Combined with a convention lever that makes call-site layouts agree** (fixed result order, aggregates
  kept contiguous) and a DAG-level "peek" invoke in the rescheduler: the upper bound is the copy bytes at
  invoke sites (1,242 B on BN254). A realistic share is perhaps 150-300 B, about 2-4%, because callee
  reads stay and many copies feed tiny callees (fp2Mul, mulFp) where borrowing cannot pay.
- **Runtime-depth form:** not worthwhile on BCH without a cheaper relative-pick idiom.
