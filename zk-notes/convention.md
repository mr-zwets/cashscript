# Calling-convention milestone (zk-language)

Branch `zk-language` in `C:/Users/mathi/Desktop/cashscript-zk`, on top of co-8 (dab3f89f). Nothing is
staged or committed. The whole branch diff is in `checkpoints/convention.patch`. Step checkpoints:
`m1-step1-crosscall.patch`, `m1-step2-blockmoves.patch`, `m1-step5-sinks.patch` (steps 3-5 together).
The plan is in `design-decision.md`.

## 1. Result

All rows were measured with `verifier/.zk-measure.mts` (rescheduleStacks on). In every row the
valid proof is accepted and the invalid proof is rejected. The rows are the build after the
third review's fixes (section 7.6; `verify/convention/r4/out/m{b,c,d}-*.txt`). Only the size +
block moves row on BN254 changed in that round (5,055 -> 5,042 B); every other row is byte and
op-cost identical to the second round's. In brackets: the build after the first review's fixes
(`verify/convention/out/matrix-final.jsonl`), then the milestone's first numbers.

| configuration | BN254 B | BN254 opCost | BLS B | BLS opCost |
|---|---|---|---|---|
| co-8 baseline (= all milestone switches off) | 7,617 | 780,281,889 | 6,911 | 987,767,715 |
| **new default** (`optimizeFor` opcost) | **6,421** [6,461; 6,459] | 770,688,378 | **5,637** [5,674; 5,665] | 975,836,858 |
| `verifySinks: false` | 6,463 [6,463; 6,463] | 770,689,180 | 5,679 [5,679; 5,679] | 975,840,157 |
| `optimizeFor: 'size'` | 6,374 [6,405; 6,403] | 766,868,588 | 5,605 [5,652; 5,643] | 978,622,966 |
| `blockMoves: true` (opcost, all helper kinds) | 5,129 [5,132; 5,130] | 862,219,570 | 4,617 [4,618; 4,609] | 1,058,507,329 |
| `blockMoves: { kinds: 'compact' }` (opcost) | 5,169 [5,175; 5,173] | 823,331,590 | 4,661 [4,664; 4,655] | 1,023,950,479 |
| **`{ optimizeFor: 'size', blockMoves: true }`** | **5,042** [5,059; 5,057] | 859,077,224 | **4,491** [4,507; 4,498] | 1,055,203,829 |

Against co-8, the default is -1,196 B (-15.7%) on BN254 and -1,274 B (-18.4%) on BLS, with
op-cost down 1.2%. With size and block moves the singletons are -2,575 B (-33.8%) and -2,420 B
(-35.0%); op-cost is then +10.1% / +6.8%. (The third review's -13 B on BN254 come from the
return-layout check under size + block moves, section 3.6.) The first review's fixes cost +2 B (BN254) and +9 B
(BLS): the ordering of checks and fallible ops inside VERIFY-sink blocks (section 3.5), which
keeps the SDK's report of the first failing require. The second review's fixes gave 1 to 47 B
back (sinks off: unchanged). On the default all of it comes from one of them: shifts by a
non-constant count are now ordered nodes too, and both singletons' main loops shift by the loop
counter; reverting only that change gives 6,461 / 5,674 B again (section 7.5; the other rows
were not bisected). It is a side effect of the sink-block scheduler meeting a
tighter order, not a designed gain. VERIFY sinks now save 42 B on both curves on the default.

Mutation red-team (`tools/mutate.mts`): every single-push mutation of the valid unlocking
(10 pushes x {+1, -1, first byte flipped} = 30 mutants) is rejected, on both curves, for the
default and for size + block moves (re-run on the final build: sections 7.4, 7.5 and 7.6). The stored invalid
vectors are rejected too.

For reference, the hand-tuned genpow singletons are 4,619 B (BN254) and 3,722 B (BLS). They are
compiled from a different source, so the comparison is not like for like.

### Per step (measured as each step landed)

| step | BN254 opcost | BLS opcost | BN254 size+BM | BLS size+BM |
|---|---|---|---|---|
| co-8 | 7,617 | 6,911 | n/a | n/a |
| 1 crosscall (half-wise layouts gated to size) | 6,671 | 5,765 | 6,600 (size, no BM) | 5,740 (size, no BM) |
| 2 + block moves (renumbering not yet default) | 6,671 | 5,765 | 5,149 | 4,535 |
| 2b + id renumbering on by default | 6,633 | n/m | (same, BM renumbers) | |
| 3 + return layouts (1 pass) | 6,631 | 5,739 | 5,138 | 4,531 |
| 4 + pass-through bottom | 6,566 | 5,727 | 5,125 | 4,527 |
| 5 + VERIFY sinks (with per-region fallback) | 6,566 | 5,713 | 5,125 | 4,510 |
| 3' + fixed-point convention passes (3, final default) | **6,459** | **5,665** | **5,057** | **4,498** |

Op-cost with block moves (opcost objective, all kinds) went 873.6M (step 2) -> 862.2M (final) on
BN254 and 1,074.9M -> 1,058.5M on BLS: the source-level levers also make block moves cheaper.

Variants that were measured and not kept as defaults:
- `returnLayoutsExact: true` (finalists judged by full-strategy caller recompiles): identical
  bytes and op-cost on all four configurations; it only costs time.
- Return-layout proxy with forced re-emission of the caller blocks in the reference: BN254
  6,679 B (worse than 6,631). An exact-strategy caller proxy: no change. Both removed.
- VERIFY sinks without the per-region fallback: BN254 6,574 (+8) and 5,139 (+14), BLS 5,713
  and 4,525. The fallback makes sinks never worse per block under the active objective's cost
  (section 3.5; in bytes they can be larger under the opcost objective, see section 7).
- 2 convention passes instead of 3: same result except BN254 size+BM 5,078 (3 passes: 5,057).

### Compile time

Compile-only, two compiles running in parallel on the 16-core machine (`tools/ctime.mts`):

| configuration | BN254 s | BLS s |
|---|---|---|
| co-8 (all switches off) | 33 | 26 |
| step 1 (crosscall only) | 50 | 39 |
| steps 1-5, 1 convention pass | 59 | 45 |
| steps 1-5, 2 passes | 106 | 79 |
| steps 1-5, 3 passes (default) | 109 | 85 |

**Deviation from the plan:** the plan allowed step 3 at most 1.5x of step 1. One pass stays inside
that (1.2x), but the fixed-point passes, which the plan asked for and which turned out to be the
largest part of the step-3 gain (-107 B on BN254 versus -2 B for the single pass), cost 2.2x of
step 1 (3.3x of co-8). I made 3 passes the default because the milestone goal is bytes;
`conventionPasses: 1` restores the 1.2x compile time. A third pass costs 3-7 s when it only
confirms stability. Full `.zk-measure` runs (compile + VM) take 130-270 s per curve in the
batches above.

The table above was measured when the steps landed, before both reviews. Re-measured on the
current build (`tools/ctime.mts`, the two curves in parallel, `verify/convention/r3/out/ctime.txt`):

| configuration | BN254 s | BLS s |
|---|---|---|
| co-8 | 34 | 27 |
| default (3 passes) | 149 | 86 |
| `conventionPasses: 1` | 63 (6,566 B) | 50 (5,681 B) |
| `{ optimizeFor: 'size', blockMoves: true }` | 180 | 114 |

The first review's fixes had made the default slower: the round-2 build takes 179 s on BN254
where this build takes 146 s, run side by side (`r3/out/ctime-r2-vs-r3.txt`). The default is
now 4.3x (BN254) and 3.1x (BLS) of co-8; with one convention pass 1.8x / 1.8x. The third
review's cross-call fallback adds a co-8 compile to every crosscall compile and, under size with
block moves, a compile without return layouts: default 178 / 111 s, size + block moves 365 / 255 s
(section 3.6; `crossCallFallback: false` restores the previous times).

## 2. Syntax

None. The milestone changes no language syntax or semantics. Everything is codegen, behind
internal compiler options (`InternalCompilerOptions` in `src/compiler.ts`). They only act with
`rescheduleStacks: true` and single-function contracts, except `blockMoves` and
`renumberFunctionIds`, which run on any compile.

| option | default | effect |
|---|---|---|
| `crossCallScheduling` | true | master switch for steps 1, 3, 4, 5 (adoption, symmetries, exact/beamx strategies, call-site-aware layouts) |
| `crossCallHalfwiseLayouts` | on under `size` only | half-wise reversed / swapped entry-layout candidates |
| `returnLayouts` | true | choose return layouts (`Convention.out`) |
| `conventionPasses` | 3 | fixed-point passes of the callee-first convention search, stopping when stable |
| `returnLayoutsExact` | false | judge return-layout finalists with full-strategy caller recompiles |
| `passThroughBottom` | true with crossCallScheduling | keep untouched bottom entry slots in place at block exit |
| `verifySinks` | true with crossCallScheduling | main's VERIFY family and void calls become DAG sink nodes |
| `blockMoves` | false | collapse block fetches into looping helpers; `{ kinds: 'compact' \| 'all' \| Kind[], specialise?, renumber? }` |
| `renumberFunctionIds` | true with rescheduleStacks | renumber OP_DEFINE ids by static call count |
| `crossCallFallback` | true with crossCallScheduling | also compile co-8's schedule (and, under `size` with block moves, the schedule without return layouts) and keep it when it is better (section 3.6) |
| `blockMoveAwareCosts` | false | under `size` with block moves, rank rescheduling candidates by their bytes after the block-move pass (`true`), or only whole-body candidates (`'bodies'`); measured mixed, section 3.6 |

`{ crossCallScheduling: false, renumberFunctionIds: false }` reproduces co-8 byte for byte, with
one deliberate exception since the third review: a main routine with a data push that is not a
minimally-encoded number (a bytes literal such as `0x00` or a zero hash) is now rescheduled,
where co-8's rescheduler threw on it and kept main verbatim (section 7.6). That only changes
contracts where rescheduling such a main pays; all 216 compiles of the 96 fixture contracts
(both objectives) are still identical to co-8 (`r4/out/co8-switch-diff.txt`). A fixture test
(`the milestone switches off reproduce co-8`) pins this on two contracts and both objectives,
with hex captured from co-8's own rescheduler. On the singletons the same switches give 7,617 /
6,911 B.

## 3. Semantics and codegen

Everything lives in `src/stack-rescheduling.ts` (DAG rescheduler) and `src/block-moves.ts`
(post-pass). The per-run settings travel in a `CrossCallContext` through `EmitOptions`,
`RecompileOptions` and `rescheduleBodies`; the only module-level state is caches (one VM per
op-cost budget, and the reference runs of the differential test in a `WeakMap` per dissected
program).

### 3.1 Cross-call scheduling (step 1, from proto-crosscall)

- **Operand adoption.** A node's leading operands that already sit on top of the stack in staging
  order are consumed in place, if every later use can still be served by a copy below. The same
  holds for the block exit.
- **Commutative prims** stage the cheaper operand order.
- **Proven argument symmetries** (`findSymmetries`): each OP_DEFINE'd body is lifted and
  canonicalised (commutative prims sort, callees with proven symmetries use canonical argument
  order, shared intern table). Equal canonical exits under a relabelling (half swap, single
  transpositions grouped into components) prove the symmetry. Call sites pick the cheapest
  proven relabelling. BN254: mulFp, addFp, fp2Mul, fp2Add, fp6Mul, fp6Add, fp12Mul.
  A function whose body has console.log gets no symmetry (review fix): a relabelled call would
  log its parameters swapped relative to the source.
- **Exact-cost strategies** `exact` and `beamx` join `topo/greedy/opcost/beam` for bodies and main.
- **Call-site-aware entry layouts**: each non-identity argument layout is ranked by body cost
  plus the static re-emission delta of every direct caller (weight 3 under opcost).
- **Half-wise candidates** are gated: on under `size` (or `crossCallHalfwiseLayouts: true`).

### 3.2 Conventions and return layouts (step 3, ported from proto-convention)

A function's convention is `Convention { in?: number[]; out?: number[] }`:
- `in[j]`: original argument index held at stack position j (bottom -> top) on entry;
- `out[j]`: original return index held at stack position j on exit.

Codegen:
- call sites stage arguments in `in` order (after any proven symmetry relabelling) and label the
  results by `out` (`computeNode`), so the caller's DAG keeps original result indices;
- the callee's first block is seeded with the `in` layout; its last block assembles the exit in
  the `out` layout (`exitPerm`). A return layout is refused (the candidate is dropped) when the
  last block also hands values over on the altstack or has a different width;
- the original cashc ops of a block are only valid under the standard layouts and standard
  callee conventions (`rawValid`);
- `bodyEquiv` runs the candidate on a loosened VM against the original bodies and requires
  candidate output j to equal reference output `out[j]`. It uses 3 random ~254-bit vectors plus
  (review fix) 3 small-input vectors (inputs in 0..3) on a VM with a finite op-cost budget;
  a small vector the reference cannot evaluate is skipped. Random wide inputs never take
  branches guarded by small-value conditions (`if (n < 3)`), which is how the recursion bug
  below went unnoticed;
- **functions on a call-graph cycle (self-recursion included) keep the standard convention**
  (review fix, `recursiveFunctions`): a body is compiled against the conventions decided so
  far, which on a cycle never include its own candidate, so a recursive call site would stage
  arguments and label results in the standard order while the callee runs permuted. This holds
  for entry layouts (inherited from co-8's layout search) as well as return layouts.

Choice, per function, callee-first (`rescheduleBodies`):
1. the entry layout, as in step 1;
2. with that entry layout fixed, return-layout candidates: reverse, the natural return order of
   the cheapest standard schedule, and the two most frequent consumer orders at the call sites
   (`consumerOrders`: results consumed later go deeper; results consumed by one node follow its
   staging order), plus the joint (reverse, reverse) convention;
3. each candidate is pre-screened by a static proxy: topo/greedy body cost plus the callers'
   re-emission delta against the current choice; at most 2 finalists with a negative proxy are
   compiled with every strategy, measured, VM-diff-tested and accepted if
   `cost + weight * siteDelta` beats the current best.

**Fixed-point passes** (`conventionPasses`, default 3): pass p reruns the callee-first search
with the conventions of pass p-1 visible to the call-site proxy for functions it has not decided
yet (a caller is re-emitted with its other callees' conventions known). Bodies are only compiled
against conventions decided in the current pass, so the result is always self-consistent. The
loop stops when a pass reproduces the previous conventions (BLS: stable at pass 3). Body compiles
are shared between passes in a `CompileCache` keyed by function, convention, strategy and the
callees' conventions and scripts.

Not ported: convention's `searchConventions` (whole-program exact descent) and `adoptableRun`
(crosscall's adoption replaces it).

### 3.3 Pass-through bottom (step 4, from proto-borrow)

In `emitBlock`, exit slots that are the untouched entry slots at the same bottom positions stay in
place; only the exit above them is assembled. Their exit use keeps them alive, so no read while
computing consumes them. The fixed region is computed before crosscall's exit adoption, and
adoption never reaches below it (`adoptablePrefix`'s `floor`). Kept: -65 B BN254 / -12 B BLS
(opcost), -13 / -4 B (size + block moves).

### 3.4 Block moves and id renumbering (step 2, from proto-aggregate)

Post-pass on the final bytecode (`src/block-moves.ts`): runs of single-item fetches over a
contiguous block become calls of OP_DEFINE'd looping helpers (P0/R0/P2/R1 progressions, LP/LR/LM
lists, DB block drop), chosen by a min-bytes DP; then function ids are renumbered by static call
count so the hottest 17 push in one byte. New here:
- presets `kinds: 'compact'` (= P0, R0, P2, R1, DB) and `'all'`;
- **bug fix**: `constNumOf` threw on a non-minimally-encoded data push (any bytes literal such as
  `0x00` in a contract), so every such contract failed to compile with block moves. The SDK suite
  found it (debugging.test.ts did not load with block moves forced on). Such pushes are now not
  fetch depths; a unit test covers it;
- `renumberFunctionIds` (pure relabelling, never larger) runs by default under rescheduleStacks.

Review fixes (section 7):
- the helper selection starts the greedy drop loop from the allowed set, from its compact
  subset and from the set without LM, and keeps the best, so allowing more kinds never selects
  worse than those subsets (`'all'` had selected worse than `'compact'` on 13 of 60 random
  programs);
- `blockMoves` options are validated (`validateBlockMoveOptions`): an unknown preset, kind,
  count or option key is a clear error instead of a TypeError;
- console.log in a global function body: the ips a log fires at and reads its values at are
  pinned (no collapsed run contains them) and the log's data ips are remapped with it, so the
  SDK reads the logged values at the right instruction;
- require ips and the main routine's trailing cleanup (the ops after the final require's
  comparison) are pinned too, so the SDK still finds the final require (see 3.5).
- (third review) main's inline ranges and a rewritten body's source tags and inline ranges are
  remapped instead of dropped (`remapRange`: the start maps like any index, the end covers
  everything its element became), so inlined-callable attribution and loop tags survive.

`blockMoves` stays off by default: it raises op-cost (+10% BN254 here), which matters for op-bound
multi-input entries. `compact` keeps most of the byte gain for less op-cost (row above).

### 3.5 VERIFY sinks (step 5, new)

The VERIFY family (`VERIFY`, `EQUALVERIFY`, `NUMEQUALVERIFY`, `CHECKSIGVERIFY`,
`CHECKDATASIGVERIFY`) consumes its operands and either aborts the evaluation or does nothing, so
the order of checks is unobservable: any failure rejects the spend. With `verifySinks`, `decompile`
lifts these ops in main (and invokes of functions without results, whose checks live in the
callee) as zero-output DAG nodes inside a block instead of block boundaries. Sinks are roots of the
schedule like the exit values, so each is emitted exactly once, and they count as roots for the
dead-computation rule. CHECKLOCKTIMEVERIFY / CHECKSEQUENCEVERIFY (which only peek) stay
boundaries. Bodies are not lifted with sinks (a body containing a require cannot pass the random
differential test anyway).

- **Per-region fallback.** A block that absorbed sinks competes with the plain blocks and verbatim
  checks it replaces; the cheaper side wins (ties keep the split form). Merging can therefore never
  cost more than the old boundaries for the same strategy, measured in the active objective's cost
  (`scriptCost`): under `opcost` a merged block can be a few bytes larger when it is cheaper in
  op-cost (bigint.cash 13 -> 17 B, integer_formatting.cash 51 -> 60 B; section 7). Under `size`
  it is never larger in bytes. Without the fallback, sinks lost bytes on BN254.
- **Translation validator** (`validateBlock`, on for every re-emitted main block whenever
  crossCallScheduling is on): the emitted ops are lifted again (with sinks) and must compute exactly
  the original block's exit stacks (main under the exit permutation, and alt) and exactly the
  original multiset of sinks, from the same entry, with no control flow and no dead computation.
  Values are compared through a hash-consed canonical form (`Canon`) that undoes each side's callee
  conventions and normalises only proven operand symmetries (commutative prims, proven callee
  argument symmetries). A block that fails falls back to its original ops, or the whole strategy is
  dropped if the original ops are invalid there. On both singletons no block failed validation.
- **Ordered nodes** (review fix). Consensus only sees accept/reject, but the SDK reports the
  FIRST failing check (its require message, or the line of a failing op). The first version let
  the scheduler reorder checks freely, so with several failing requires, or a guard
  `require(c != 0)` in front of `a / c`, the SDK named a different statement than co-8. Now,
  inside a block lifted with sinks, every check, every void call and every op that can fail on
  well-formed arguments is chained after the previous one (`DagNode.after`); the scheduler only
  moves infallible ops across them. Fallible: division and modulo unless by a non-zero constant
  (a push, or a call of a function that only pushes one, such as a lowered global constant),
  LSHIFTNUM / RSHIFTNUM unless by such a constant that is non-negative (and at most 80,000 for
  LSHIFTNUM, the VM's item size in bits; second review), SPLIT / NUM2BIN / BIN2NUM, AND / OR /
  XOR and CAT unless both operands have known sizes that cannot fail (equal sizes for the bitwise
  ops, at most 10,000 bytes together for CAT; constants, hashes and CATs of those; third review),
  CHECKSIG /
  CHECKDATASIG, introspection by index, and invokes of functions not proven infallible
  (`analyseFallibility`: a body with no check, no fallible op and no console.log, calling only
  infallible functions; greatest fixed point; the console.log rule is from the second review). The final block's result (the last
  require, which has no VERIFY) is chained after the last ordered node, so its comparison is
  computed last. The translation validator checks the order: the emitted block's ordered nodes
  must be the original's, in the original order. Arithmetic on well-formed numbers and running
  out of op-cost budget are not modelled as failures.
- **Block size limit** (second review). Once a sink block holds `SINK_BLOCK_NODE_LIMIT` = 120
  nodes, the next check is a block boundary again, as without sinks, because the exact and beamx
  strategies are about quadratic in a block's node count. The singletons' largest sink blocks
  have 105 (BN254) and 92 (BLS) nodes, so they are not affected.
- **Debug data.** The validator returns where each original ordered node (check, void call,
  fallible op) landed; `indexRemapper` maps require() ips exactly, and `remapLocationData` keeps
  each such node's own source location (so a failing void call's call-stack line is its own
  statement, not the merged block span) plus the location of the code after the block's last
  ordered node.
- **Final require** (review fix). The SDK attributes a failing final require to the require
  whose ip is one past the last instruction that is not function cleanup (NIP / DROP / 2DROP /
  ELSE / ENDIF) and reports that instruction's line. Rescheduling, the optimiser re-run and
  block moves can drop or move main's trailing cleanup, so `captureFinalRequire` (compiler.ts,
  block-moves.ts) records the final require and its comparison's location before those passes
  and re-anchors both afterwards.

### 3.6 Cross-call fallback and block-move-aware costs (third review)

**Cross-call fallback** (`crossCallFallback`, default on with crossCallScheduling, in
`compileImpl`). The milestone's levers are heuristics; on the review's `symmetric-fallible`
contract crosscall's symmetry relabelling scheduled a body worse than co-8's swapped entry layout
(53 B against 48 B, more op-cost too). The compiler now also runs co-8's schedule
(`crossCallScheduling: false`) through the same post-passes (optimiser re-run, block moves,
renumbering) and keeps it when it is better:
- under `size`: when it has fewer bytes. So a `size` compile is never larger than the same
  options with `crossCallScheduling: false`;
- under `opcost`: only when it dominates, no more bytes and no more static whole-program op-cost
  (`programOpCostEstimate`: main's estimate plus each body's weighted by its static call count)
  and less of one of them. The measured per-body op-costs of two different runs are not
  comparable, and the static estimate ignores loop counts, so it is not trusted to trade bytes
  for op-cost against the measured choice.

Under `size` with block moves (and `returnLayouts` not set explicitly) the fallback also
compiles the schedule without return layouts. Return layouts are chosen on the bytes before the
block-move post-pass, and on BN254 block moves then take back more than the layouts gained: the
per-body comparison (`r4/rl-trace.mts`, `r4/out/rl-bn254-*.json`) gives the bodies -46 B with
return layouts before block moves and +13 B after (millerSingle +8, cycSqr +12, pointAdd -5,
fp4Square -2; main identical). BN254 size + block moves is now 5,042 B (859,077,224 op-cost),
BLS stays 4,491 B (return layouts help there). The singletons never pick co-8's schedule.

Compile time (sequential per curve, the two curves in parallel, `r4/out/ctime-*.txt`): default
BN254 140 -> 178 s, BLS 81 -> 111 s; size + block moves BN254 185 -> 365 s, BLS 108 -> 255 s
(`crossCallFallback: false` gives the left numbers and the old bytes).

**Block-move-aware costs** (`blockMoveAwareCosts`, off). The root-cause alternative to the
return-layout check above: under `size` with block moves, rank every rescheduling candidate by
`blockMovedSizeModel` (the bytes after collapsing its fetch runs with the allowed helper kinds,
1-byte ids, helper definitions left out). Measured with the fallback off: BN254 5,117 B, BLS
4,468 B (`r4/out/mb-*-sizeBM-aware-nofb.txt`, measured on an intermediate build that had the option on
by default, the same as `blockMoveAwareCosts: true`); only for whole-body rankings (`'bodies'`):
5,117 / 4,469 B (`r4/out/mc-*`). Against 5,055 / 4,491 B without it, it wins 23 B on BLS and
loses 62 to 75 B on BN254, and compiled in about 500 s where the same configuration without it
took about 240 s (both with four compiles running in parallel), so it stays an option. The estimate
misses what the real pass decides globally (the helper set, specialised counts, id sizes, runs
across block boundaries).

## 4. Tests

- cashc: **836/836** (736 baseline + 3 crosscall + 4 co-8 regression fixtures + 54 block moves
  + 2 return layouts + 2 fixed-point passes + 4 sinks, 15 from the first review's fixes: recursive
  functions x2, logging callee x2, block-moves console.log, selection monotonicity x2, option
  validation, sink order x2, guard before division x2, final-require anchoring x3; 5 from the
  second review's: guard before shift x2, calls of logging functions between checks,
  argument-bounded loop and recursion x2; and 11 from the third review's: cross-call fallback x2,
  body require ips and lines x4, non-minimal pushes in main x2, checks before bitwise ops and CAT
  x2, block-move debug ranges). No generation fixture changed.
  `npx eslint packages/cashc/src packages/cashc/test` is clean. The milestone suites have a
  60 s timeout (the default 5 s was close for a few tests on a loaded machine, section 7).
  - `the milestone switches off reproduce co-8`: byte-exact against co-8 hex.
  - `return layouts`: Karatsuba tuple contract with non-symmetric `subm`; reference result and
    wrong-value rejection for both compiles, strictly smaller with return layouts (167 -> 163 B
    opcost, 163 -> 160 B size).
  - `verify sinks`: 150 random vectors against a JS reference for the plain, sinks-off and
    sinks-on compiles; require() ips land on VERIFY ops; source lines of a check and of the final
    require.
  - `block moves`: VM differential on 40 random fetch programs per helper set, presets, bytes
    literals.
- SDK with every contract recompiled from source (third review; `tools/sdk-forced/run-recompiled.sh`,
  section 7.6): no test regresses against its baseline in 6 option sets.
- SDK (`packages/cashscript`, run against this source with options forced through a wrapper):
  222 passed with default options, with `rescheduleStacks`, with `rescheduleStacks + blockMoves`,
  with `rescheduleStacks + size + blockMoves`, and with `blockMoves` alone. The only failure is the
  known pre-existing SignatureTemplate load failure. Re-run on the final build with the shim in
  `tools/sdk-forced/` (copy its `vitest.zkforced.config.ts` into `packages/cashscript`, run
  `ZK_FORCE='<json options>' npx vitest run -c vitest.zkforced.config.ts`, delete the copy).
- Singletons: valid accepted, invalid rejected, 30/30 mutants rejected (section 1).

## 5. Limitations and open points

- **Return layouts are a small lever on their own.** With crosscall's reversed entry layouts the
  tuple-reversal penalty is mostly gone; a single pass found -2 B (BN254) / -26 B (BLS). The
  fixed-point passes are what pays (-107 / -48 B more). The plan's estimate for step 3 was -150 to
  -400 B before block moves; measured, steps 3 + passes give -105 / -74 B before block moves.
- The call-site proxy re-emits callers with topo/greedy only, before the callers choose their own
  layouts. The exact variant (`returnLayoutsExact`) measured identical, so the proxy is not the
  bottleneck; the candidate set is.
- VERIFY sinks: -2 B BN254, -5 B BLS on the default after the ordering fix (before it: -4 / -14 B
  as re-measured by the review; the notes had said -0 / -14). Main is still the largest single
  script; its blocks are now wider, but the per-block min means wider blocks only help where the
  rescheduler beats cashc's own code over the whole span.
- Main is still not VM-diff-tested (it reads transaction context). It now has the structural
  translation validator plus the end-to-end vectors and the mutation red-team.
- Compile time: see section 1 (deviation from the plan's 1.5x bound).
- Block moves raise op-cost; keep them off for op-bound multi-input entries, or use `compact`.
- (Fixed in the third review: the rescheduler's `constNumOf` threw on a non-minimal data push,
  and since nothing caught it per block, every main strategy failed and main stayed verbatim;
  this note used to say the block was kept, which was wrong. See section 7.6.)
- Rescheduled bodies keep coarse debug data: the source map spans the whole function except at
  the checks, which keep their own locations and require() ips (section 7.6); a failing non-check
  op in a rescheduled body (a division by zero) is reported on the function's first line. Their
  source tags and inline ranges are dropped. In a rewritten main block, an inline range that
  starts or ends inside the block is dropped too.
- `crossCallFallback` makes a `size` compile never larger than `crossCallScheduling: false`
  under the same options, but under `opcost` it only replaces a dominating co-8 schedule, so an
  opcost compile can still be larger in bytes than co-8's (the documented trade; 4 of 300 gen2
  programs, `r4/out/size-regress-gen2.txt`).
- Under `optimizeFor: 'size'`, console.log output can come in a different order than the source,
  and a log before a failing require can be missing. That is co-8's def-sinking (it moves each
  definition down to its first use, by design, see `src/def-sinking.ts`), not the milestone:
  co-8 emits the same bytecode with or without rescheduleStacks (section 7.5).
- Body differential test (section 7.5): a body whose cost grows with an argument is tested and,
  under opcost, measured on small and medium inputs only (random ~254-bit inputs would loop
  practically forever). Small vectors are only run on candidates when their reference takes a
  different number of instructions than every vector already kept; two different control paths
  of equal length would be compared only once.
- Deferred, as planned: cross-block altstack parking, borrow-by-depth, convention's exact
  whole-program descent. Next per the plan: structs and fixed arrays as AST desugaring.

## 6. Files

Modified (tracked): `packages/cashc/src/compiler.ts`, `packages/cashc/src/stack-rescheduling.ts`,
`packages/cashc/test/stack-rescheduling.test.ts`.

New, untracked (not added to git; included in `checkpoints/convention.patch` via
`git diff --no-index /dev/null <file>`):
- `packages/cashc/src/block-moves.ts`
- `packages/cashc/test/block-moves.test.ts`
- `zk-notes/` (this note, `checkpoints/`, `tools/`): `tools/mutate.mts` (mutation red-team),
  `tools/ctime.mts` (compile timing), `tools/req-check.mts` (require/debug location dump),
  `tools/sdk-forced/` (SDK test shim with forced compiler options), `tools/cpuprof-summary.mjs`
  (top functions of a V8 CPU profile), `verify/convention/` (the reviews' probes and harnesses,
  plus the fix verification scripts of section 7; the second review's in `r2/`, the round-3
  fixes in `r3/`; the third review's in `review3/` and `rv3/`, the round-4 fixes in `r4/`).
  `tools/sdk-forced/` also holds the round-4 recompiling shim (`recompile-setup.ts`,
  `vitest.zkrecompile.config.ts`, `run-recompiled.sh`, `compare-recompiled.mjs`).
  `verify/convention/r4/dist-c/` is a copy of the measured build's `dist` (the matrix and
  timing runs used it, so later rebuilds could not change a running measurement).

The scratch SDK config `packages/cashscript/vitest.zk.config.ts` was deleted after use. The
scratch worktree `C:/Users/mathi/Desktop/zk-combo-cc-agg` was removed (`git worktree remove`) after
unlinking its two node_modules junctions with `cmd //c rmdir`; its diff is preserved in
`checkpoints/combo-crosscall-aggregate.patch` (verified identical first).

## 7. Verification

The milestone was reviewed three times (probes and harnesses in `verify/convention/`, run from
`packages/cashc` unless noted). Every finding was reproduced first, then fixed or explained.
Sections 7.1 to 7.4 are the first review; section 7.5 is the second; section 7.6 the third.
Final state after the third: cashc 836/836, eslint clean, the SDK suite with every contract
recompiled from source shows no regression in 6 option sets, both singletons valid accepted and
invalid rejected in all 6 measured milestone configurations (section 1), checkpoint
`checkpoints/convention.patch` refreshed.

### 7.1 Fixed

**Critical: return layouts (and entry layouts) miscompiled recursive functions.**
Reproduced with `recursion2.mts`: the default compile chose `0:|1,0 1:|1,0` for the
self-recursive f2mul / f2sub and accepted `expect = 199498` for (3,5,7,11,1), where the
reference value is 840934. Root cause: `rescheduleBodies` compiles a body against `conv`, the
conventions decided so far; on a call-graph cycle that never contains the function's own
candidate, so the recursive call site staged arguments and labelled results in the standard
order while the callee ran permuted. Fix: `recursiveFunctions` (call-graph cycles, self-loops
included) keeps those functions on the standard convention, for entry and return layouts alike.
Defence in depth: `bodyEquiv` now also runs 3 small-input vectors (inputs in 0..3) on a VM with a
finite op-cost budget, skipping vectors the reference cannot evaluate. With the cycle rule
disabled, the small vectors alone reject the bad conventions (checked by hand); with both
disabled, the new test fails. After the fix, `recursion2.mts` gives valid-accept / wrong-reject
for n = 0..3 in all 6 configurations (48/48 rows) and the forged `expect` is rejected. Test:
`return layouts > keep recursive functions on the standard convention` (opcost, size).

**Medium: blockMoves broke console.log in global function bodies.** Reproduced with
`bm-body-log.mts` (SDK `debug()` threw "corresponding data entry debug step not found for entry
at ip 50"). Root cause: the log data ips (`StackItem.ip`) were not remapped, and a collapsed run
could have contained them. Fix: the ips a log fires at and reads its values at are pinned in
`tokenSegments` (no run straddles them, so every pinned ip stays the start of an element with
the same stack state) and the data ips are remapped. The probe now accepts with the plain
compile's log lines at the same 95 B. Test: `block moves > keeps console.log data of rewritten
bodies exact` (reads the logged values from a VM trace and compares them with the plain
compile; it fails without the fix).

**Medium: verifySinks corrupted source lines in debug data.** Reproduced with
`repro-final-require-line.mts` (final require reported on line 9 instead of 11) and
`repro-callstack-line.mts` (call stack showed the merged three-statement span). Root causes:
only prim VERIFY sinks had exact location points, and the final comparison could be scheduled
before a void-call sink. Fix: every ordered node (checks, void calls and other fallible ops, see
section 3.5) gets an exact point, and the final block's result is chained after the last ordered
node. Both probes now report the co-8 lines (`A.cash:11 ... req 4`; call stack
`at A.cash:10 — chkpos(b, (c * 3))`), and `sdk-attrib.mts` (seeds 1, 9, 42; 60 programs each)
finds 0 mismatches in every configuration.

While verifying this, the new harness `sdk-first-fail.mts` (below) found one more case, present
before the milestone's sinks as well: when a rewrite drops main's trailing `OP_NIP` cleanup, the
final require's ip was clamped onto the last instruction instead of one past it, so the SDK
reported "Error in transaction ... line 6" instead of the require (`repro-p22.mts`). Fix:
`captureFinalRequire` re-anchors the final require's ip and its comparison's location after all
post-passes (rescheduling, the optimiser re-run, block moves), and block moves pin main's
trailing cleanup and all require ips. Test: `verify sinks > re-anchor the final require`
(default, blockMoves, size; fails without the fix).

**Low: verifySinks reordered checks, changing which require the SDK reports.** Reproduced with
`sdk-sinks.mts` ('two failing requires': `b must be 5` instead of co-8's `c must be 7`) and
`sdk-guard.mts` (the division was emitted before its guard). Fix: ordered nodes (section 3.5),
validated by the translation validator. Both probes now match co-8 in every variant. New
harness `sdk-first-fail.mts`: random contracts mixing requires, void calls, a pure function call
and requires over a division by `c` (fails at c = 0); the SDK must report the FIRST failing
statement in source order for every vector (any number of failing statements). Seeds 5, 77,
201, 333 x 40 programs x 12 vectors x 5 configurations (plain, co8, def, size, size+bm): 0
mismatches (907 vectors with several failing statements). Before the fix it found mismatches in
def / size / size+bm on several programs. The CTRL comment in `stack-rescheduling.ts` now says
how sinks keep the guarantee. Tests: `verify sinks > keep checks and void calls in source order
with their own lines`, `keep a guard before the division it protects` (both fail without the
fix). Cost: +2 B BN254, +9 B BLS (section 1). A variant that treats every invoke as fallible
(no `analyseFallibility`) measured 6,412 / 5,679 B default, 6,386 / 5,657 size, 5,058 / 4,508
size+BM, 5,134 / 4,619 bmAll, 5,183 / 4,665 compact (`out/matrix-allfallible.jsonl`): BLS loses
the whole sink gain, and the BN254 default gain is a side effect of the call-site proxy seeing a
different main, not of the ordering itself. I kept the analysis, which constrains less.

**Low: proven argument symmetries were applied at call sites of a logging callee.**
Reproduced with `sym-log.mts` (default and size logged `a = 2 b = 3` where the source order gives
`a = 3 b = 2`). Fix: `findSymmetries` skips bodies with console.log. The probe now matches plain
and co-8. Test: `cross-call scheduling > does not relabel the arguments of a logging callee`
(VM trace of the logged values; fails without the fix).

**Low: unvalidated blockMoves options.** Reproduced with `bad-kinds.mts` (TypeErrors).
Fix: `validateBlockMoveOptions`, called by the compiler before any work: unknown presets, kinds,
counts outside 2..48 or on a non-specialisable kind, unknown keys and non-boolean flags are
clear errors. Test: `block moves > rejects unknown kinds and presets with a clear error`.

**Low: helper selection not monotonic in the allowed kinds.** Reproduced with
`out/bmcheck.mts` (`all` 240 B, `compact` 230 B on edge.mts 'wide-aggregate'). Root cause: the
greedy drop loop starts from the allowed set, and a helper that only pays together with another
(LM next to the progressions) leaves it in a worse local optimum. Fix: also start from the
compact subset and from the set without LM (both restricted to the allowed kinds) and keep the
best net saving. Now all = compact = 230 B there, and jacAddG1 bmAll = bmCompact = 408 B (was
411 / 408). On 60 random fetch programs the old selection was worse under `'all'` than under
`'compact'` or all-without-LM on 13; now on none. Test: `block moves > selects no worse with more
allowed kinds` (6 of those seeds, specialise on and off).

**Info: one vitest failure (1 of 805) under load.** Not reproduced: two full runs while two
singleton measurements were running passed (817/817 at the time). The slowest milestone tests
take 1.5 to 4 s on an idle machine against vitest's 5 s default, so a timeout under heavy load
is the likely cause. The milestone suites (`cross-call scheduling`, `the milestone switches off
reproduce co-8`, `return layouts`, `verify sinks`, `block moves`) now have a 60 s timeout.

### 7.2 Corrected in the notes

**Measurement nit: sinks are not 0 B on BN254.** Confirmed: before the fixes, sinks saved 4 B
(BN254) and 14 B (BLS). After the ordering fix they save 2 B and 5 B (section 5 updated).

**"Never larger" only holds under the active objective.** Confirmed with `regress.mts`:
bigint.cash 13 -> 17 B and integer_formatting.cash 51 -> 60 B under the default (opcost)
objective, both from VERIFY sinks (13 / 51 B with `verifySinks: false`), both identical to co-8
under `size`. This is the opcost trade (op-cost on accepted vectors 1088 -> 988 and 1562 ->
1252, `opcost-small.mts`): the per-region fallback compares `scriptCost`, which under opcost is
op-cost, not bytes. Sections 1 and 3.5 now say so; no codegen change.

### 7.3 Not compiler problems

**Op-cost density limit on the standard VM (info).** On the standard BCH 2026 VM some random
small contracts get a different verdict than the plain compile because the op-cost budget is
(41 + unlocking bytes) x 800 and the vectors' unlocking scripts are tiny. Every configuration is
affected, including `off` (the co-8 switches), and all of these vectors agree with the JS oracle
on the loosened VM. My re-run `diff-random.mts 7000 150 10` (3,600 vectors, 13 configurations):
0 problems, 23 limit differences (`limitBy`: def 14, off 5, bmOnly 4, size 6, ...). This is the
known op-cost trade of reordered code; no semantics change.

**Proof malleability A.y + p (info).** Both singleton sources accept the valid proof with A.y
replaced by A.y + p, in every configuration including plain and co-8, so it comes from the
contract source (`groth16_contract/singleton/*/groth16.cash` range-checks only some public
inputs), not from the compiler. Out of scope here (groth16_contract must not be edited); the
source should range-check every proof coordinate (`within(x, 0, p)`), as the competition entries
do.

**Loosened VM in measurements (info).** `.zk-measure.mts` and `mutate.mts` lift all resource
limits, so `validAccepted` means "logically correct", not "valid under network limits" (the
singletons need 770M to 1,060M op-cost, far above any single input's budget). Same for co-8; not
a regression.

**Coverage limits (info), and what changed.** Still not covered: CHECKSIGVERIFY /
CHECKDATASIGVERIFY sinks with valid signatures; bytes-typed function bodies outside the fixture
contracts; rescheduling of multi-function contracts (skipped by design; they get block moves and
renumbering only); main is not VM-diff-tested inside the compiler (it reads transaction context)
and relies on the translation validator, the end-to-end vectors and the red-team. Improved:
`bodyEquiv` now runs small-input vectors (branches guarded by small constants), the validator
also checks the order of checks and fallible ops, and the SDK harnesses check attribution for
any number of failing statements.

### 7.4 Re-verification of the final build

- `fix-verify.sh` (log: `out/fix-verify.log`): `sdk-first-fail.mts` 4 seeds x 40 programs, 0
  mismatches; `sdk-attrib.mts` 3 seeds x 60 programs, 0 mismatches; `fuzz.mts 909 60`, 0
  mismatches; `recursion2.mts` 48/48 correct; `diff-random.mts 7000 150 10`, 0 problems.
- `measure-matrix.sh` (logs: `out/matrix-final.jsonl`): section 1.
- Mutation red-team on the final build: 0 of 30 mutants accepted and the invalid vector rejected,
  for default and size + block moves on both curves (`out/mutate-fix-*.log`).
- SDK suites: 222 passed with `{}`, `rescheduleStacks`, `rescheduleStacks + blockMoves`,
  `rescheduleStacks + size + blockMoves`, `blockMoves` (only the pre-existing SignatureTemplate
  load failure).

### 7.5 Second review

The second review (probes in `verify/convention/r2/`) reported nine findings. Each was reproduced
on the build it reviewed, then fixed or explained. To reproduce on that build after changing the
source, I rebuilt it from `checkpoints/convention.patch` (before refreshing it) in a scratch copy
of the source, `packages/cashc/.r2src` (deleted afterwards; the patch with paths relative to
`src/` is kept as `verify/convention/r3/out/convention-r2-src.patch`). This round's probes, logs
and harness copies are in `verify/convention/r3/` (logs in `r3/out/`).

**Medium: no compile end for a function whose loop count is an argument (regression under
`size`; pre-existing in co-8 under opcost).** Reproduced: `r2/loop-param.mts` on the round-2
source exits 124 after 120 s under `size` and under the default (`r3/out/repro-r2-hang.txt`);
co-8 finishes under `size` (0.4 s) and, per the review, hangs under the default. Root cause, now
traced: `runBody` ran bodies on the loosened VM with no op-cost budget, on ~254-bit random inputs,
so `while (i < n)` iterates about 2^254 times. The VM evaluates about 1.2e8 op-cost per second
(`r3/vmspeed.mts`). Under `size` the milestone made a candidate win for this body, so
`bodyEquiv` ran it; under opcost `measureBody` runs every body, in co-8 too. Mutual and self
recursion guarded by `n > 0` are the same case. Fix (TEST VECTORS in `stack-rescheduling.ts`):
- Every body run has an op-cost budget: 4e8 for reference runs (about twice the heaviest
  singleton body, 1.87e8 on BLS and 1.38e8 on BN254 per run, measured with a temporary run log,
  `r3/out/runlog-*.txt`), 8e8 for candidate runs, and a 2e7 probe.
- When a body's first random vector exceeds the probe and its first small vector stays cheap
  (below 1e6), the body has no random vectors. It is tested on small (0..3) and medium (0..9)
  vectors instead and, under opcost, measured on them (or by the static estimate when none
  evaluates). On the singletons every body keeps its random vectors: their heavy bodies cost
  about as much on small inputs as on random ones (`r3/out/runlog-*.txt`).
- A random vector whose reference runs out of budget is skipped; at least one vector must be
  compared, otherwise the candidate is rejected.
- Reference runs are cached (each used to be re-run for every candidate).

Results: loop-param 0.9 s (`size`) and 0.3 s (default). Mutual recursion
(`r2/mutual-time.mts`, every configuration, inlining on and off) 0.06 to 4.2 s (was over 300 s).
`r3/loops.mts`, six contracts whose loop or recursion depth is an argument (guarded and
unguarded loops, a two-result loop with return layouts, self recursion, mutual recursion, nested
loops), 13 configurations, inlining on and off, 1,404 vectors against the plain compile: 0
problems, slowest compile 1.9 s. Test: `functions whose loop or recursion depth is an argument`
(opcost and size: the loop-param shape plus self recursion, compile time and accept/reject).

**Low: `bodyEquiv` compared outputs as VM numbers.** Reproduced with `r2/vmnum.mts`: 00, 0000,
1200, 3400 and 0080 all decode to the same error string. Fix: `runBody` keeps every output item
as its raw bytes (hex), so the comparison is byte-exact. On BN254 no candidate was rejected by
the stricter comparison (temporary instrumentation, `r3/out/eqlog-bn254.txt` has no mismatch),
so the singletons do not change. `r3/edge2.mts bytes` (bytes-returns-nonminimal, bytes-swap): 0
problems in every configuration, and bytes-swap still shrinks (38 to 37 B default, 36 B size,
inlining off).

**Medium: VERIFY sinks moved calls of logging functions across checks.** Reproduced on the
round-2 source with `r3/order-probe.mts`: the default emits the review's contracts (a) and (b)
with all checks first (VVIII and VVII) instead of the source order IVIVI and IVIV
(`r3/out/repro-r2-vs-r3.txt`; I = call, V = VERIFY). Root cause as reported: `analyseFallibility`
counted a body with console.log and no check as infallible. Fix: bodies with console.log are
never infallible, so their calls are ordered nodes in main, and so are calls of functions that
call them (fixed point). Now both contracts keep the source order in the default and the co-8
switches. `r2/sdk-log-order.mts` with contract (a): plain, co8, def and nosink all fail `first`
with `A 10` logged. Under `size` and size + block moves the order still differs ((a) logs nothing
before `first`; (b) logs A before B). That is co-8's def-sinking, which under
`optimizeFor: 'size'` moves each definition down to just before its first use before code
generation; `src/def-sinking.ts` says it "can change which require() fails first on an invalid
witness and the order of console.log output". co-8 emits the same reordered bytecode with and
without rescheduleStacks, and so does this build with `verifySinks: false`
(`r3/logco8.mts`, `r3/out/log-order-size-co8.txt`). Not a milestone change; left as is (section 5).
Test: `verify sinks > keep calls of logging functions between the checks around them` (fails
without the fix).

**Medium: VERIFY-sink compile time superlinear in the number of requires.** Reproduced on the
round-2 source with `r3/sink-one.mts` (the review's contract): N = 50 took 4.7 s (default) and
17.4 s (`size`), N = 100 27.1 s and 95.2 s (`r3/out/repro-r2-hang.txt`). A CPU profile
(`tools/cpuprof-summary.mjs`) put 80% of the time in `cloneState`, called by the exact strategy's
`exactCost` (and the commutative operand `trial`) for every ready node at every step: each call
copied the whole emitted script, the use counts and the remaining set. Two fixes:
1. Probe states (`probeState`): pricing one step copies the stack labels, keeps only the last
   emitted op (all that `appendOp` reads), and reads use counts through a copy-on-write overlay.
   Schedules are unchanged: BN254 compiles to the same 6,421 B with and without (checked by
   reverting), and all fixture tests pass unchanged.
2. `SINK_BLOCK_NODE_LIMIT` (section 3.5): a sink block stops growing at 120 nodes. The singletons'
   largest sink blocks have 105 (BN254) and 92 (BLS) nodes (temporary block log,
   `r3/out/blocklog-*.txt`), so they do not change.

`r2/sink-scaling.mts` now: N = 10, 25, 50, 100 take 0.1, 0.2, 0.5, 0.9 s (default) and 0.2, 0.9,
1.7, 3.5 s (`size`); co-8 0.0 to 0.1 s; N = 200 takes 1.3 s and 4.8 s. Growth is now linear. The
bytecode is identical to co-8 in every row, as before.

**Low: OP_LSHIFTNUM / OP_RSHIFTNUM missing from FALLIBLE_OPS.** Reproduced on the round-2 source
with `r3/order-probe.mts`: under opcost the shift is emitted before the guard (guard ip 16,
shift at 5). Fix: both shifts are fallible unless the bit count is a known constant (a push or a
constant-pushing function, see `constOperand`) that is non-negative and, for LSHIFTNUM, at most
80,000 (the BCH 2026 VM rejects a larger count with a non-zero value). A body that shifts by
anything else is fallible in `analyseFallibility`. Results: `r2/sdk-guard-shift.mts` reports the
guard in all five variants and every configuration; `r2/sdk-shift-guard.mts` seed 99 (80
programs) 0 mismatching vectors (was 8), seed 7 also 0. Test: `verify sinks > keep a guard before
the shift it protects` (opcost and size, LSHIFTNUM and RSHIFTNUM; opcost fails without the fix).
Side effect: both singletons' main loops shift by the loop counter (`(C >> (127 - i)) % 2` on
BN254, `(in0 >> i) % 2` on BLS), so those shifts are ordered nodes now. The default became
smaller (BN254 6,461 to 6,421 B, BLS 5,674 to 5,637 B); compiling the current source with only
the shifts removed from FALLIBLE_OPS gives 6,461 and 5,674 B again (a scratch copy of the source,
deleted afterwards). With `verifySinks: false` nothing changed (6,463 / 5,679 B).

**Low: the relayed report did not match the tree.** Confirmed, and not a code problem: the
relayed figures (805 tests, 6,459 / 5,665 B, 5,057 / 4,498 B) were the numbers before the first
review's fixes, which section 1 listed in brackets. Section 1 now lists this round's measured
numbers first; the headline numbers are those in section 1.

**Low: compile time with every milestone switch off was above co-8 under `size`.** Reproduced
(sequential, idle machine, `integrity/co8-singletons.mts`): BN254 52.3 s against co-8's 32.2 s
under `size` (35.6 against 30.6 s on the default). A CPU profile of both put nearly all of the
difference in `bodyEquiv`: the first review's small vectors added 3 reference and 3 candidate
runs per test, and on the heavy Fp bodies a small vector costs as much as a random one. Fixes:
the reference runs are cached (above), and a small or medium vector is only run on candidates
when its reference executes a number of instructions that no kept vector executed (the same
count almost always means the same control path, which a random vector already compares with
wide data). On the singletons' heavy bodies, whose loops and branches depend only on constants,
this drops the small vectors. The safety net still works: with the recursion rule
(`recursiveFunctions`) disabled, both `keep recursive functions on the standard convention` tests
still pass, because the small and medium vectors reject the bad conventions. Now: BN254 32.9 s
(co-8 30.1 s) default and 40.1 s (31.8 s) `size`; BLS 26.5 s (24.4 s) and 32.5 s (25.9 s); the
bytecode is identical to co-8 in all four (`r3/out/co8-singletons-*.txt`). The rest, about 25%
under `size`, is the small vectors' reference runs (needed to count their instructions) and the
probe. A cache of reference runs across the compile variants that `size` tries was measured
(40.1 to 41.0 s on BN254: the variants' bodies differ) and dropped. The default's own compile
time (3 convention passes) is in section 1: it stays above the plan's 1.5x bound, as disclosed.

**Info: sinks are only "never larger" under the active objective.** Unchanged and documented in
section 7.2: `regress.mts` again gives bigint.cash 13 to 17 B and integer_formatting.cash 51 to
60 B under opcost, identical to co-8 under `size` (`r3/out/regress.log`).

**Harness note.** `r2/edge2.mts` exhausted the JavaScript heap on its mutual-recursion case
(exit 134). The compiles are fine (`r2/mutual-time.mts`, all configurations). The harness itself
evaluates vectors with inputs up to 2^31 on a VM without a budget, and `vm.debug()` in its expect
solver keeps every state of a ~2^31-deep recursion. The round-3 copy `r3/edge2.mts` gives its
VM an op-cost budget (2e5 per byte of unlocking plus 41) and a control-stack depth limit of 1000,
and skips solving `expect` for a vector that runs out of budget; such a vector is then rejected
by every compile alike. (A budget alone was not enough: with 10^6 per byte the mutual-recursion
case still ran for over 40 minutes, so the depth limit was added.)

#### Re-verification of this build

- cashc **825/825**, `npx eslint packages/cashc/src packages/cashc/test` clean
  (`r3/out/vitest.log`).
- SDK suites: 222 passed with `{}`, `rescheduleStacks`, `rescheduleStacks + blockMoves`,
  `rescheduleStacks + size + blockMoves`, `blockMoves` (only the pre-existing SignatureTemplate
  load failure; `r3/out/sdk.log`). The scratch config was deleted after use.
- `r3/verify-all.sh` (log `r3/out/verify-all.log`): the probes above; `sdk-first-fail.mts` seeds
  5, 77, 201, 333 x 40 programs (9,600 runs, 907 vectors with several failing statements): 0
  mismatches; `sdk-attrib.mts` seeds 1, 9, 42 x 60 programs: 0 mismatches; `fuzz.mts 909 60`: 0
  mismatches; `recursion2.mts`: 48/48 valid accepted and wrong rejected; `r3/diff-random.mts 7000
  150 10` (3,600 vectors, 13 configurations): 0 problems (23 op-cost limit differences, as in
  section 7.3); `r3/diff2.mts` 1000 x 150, wide 4000 x 80, multi-function 6000 x 120 (6,980
  vectors): 0 problems (26 generated programs that plain cashc rejects are skipped, as in round 2).
- `r3/edge2.mts`, all 16 hand-written edge cases of round 2, 13 configurations against plain, inlining on
  and off (5,370 vectors): 0 problems (`r3/out/edge2-full.txt`; run separately after the
  harness fix above; the step inside `verify-all.log` is the run that hit the heap limit).
- `measure-matrix.sh` (`r3/out/matrix-r3.jsonl`): section 1, valid accepted and invalid rejected
  in all 12 rows.
- Mutation red-team: 0 of 30 mutants accepted and the invalid vector rejected, for the default
  and for size + block moves on both curves (`r3/out/mutate-*.log`).

### 7.6 Third review

The third review (probes in `verify/convention/review3/` and `rv3/`) reported nine findings,
two of them the same (the relayed report). Each was reproduced on the round-3 build before any
change (`r4/out/before-*.txt`, `rv3/out/probe-symfall.txt`, `rv3/out/size-regress-gen2.txt`),
then fixed or explained. This round's scripts and logs are in `verify/convention/r4/`
(`r4/out/`).

**Low: crosscall made `symmetric-fallible` larger than co-8 under both objectives.** Reproduced:
`rv3/probe-symfall.mts` gave 53 B (12,056 op-cost) against 48 B (11,353) with the switches off,
also under `size`. Traced with `r4/symfall-debug.mts`: co-8's layout search gives `sd` the
swapped entry layout (`0:1,0`); crosscall proves `sd` symmetric (`a / b + b / a`), so it
keeps the standard convention and relabels at each call site instead, and its schedule of `sm`
under that relabelling is 22 B where co-8's is 20 B, plus one more byte in main. The heuristic
loss itself is not fixed (symmetry relabelling is greedy per call); what was missing is the
fallback the claim needs. Fix: the cross-call fallback (section 3.6) compiles co-8's schedule
too and keeps it when it is better under the objective. The probe now gives 48 B (11,353
op-cost) in every configuration. The gen2 scan (`ONLY_WORSE=1 rv3/size-regress.mts 1 0 1 300`,
`r4/out/size-regress-gen2.txt`): 0 programs larger under `size`; under `opcost` the same 4
programs as in the review are 2 to 24 B larger than co-8, the documented op-cost trade (the
fallback replaces only a dominating co-8 schedule there). Test: `cross-call fallback > is never
larger than the co-8 schedule` (opcost and size; it also asserts that `crossCallFallback:
false` is larger, so the test exercises the fallback).

**Low: return layouts made size + block moves 13 B larger on BN254.** Reproduced: 5,055 B with
return layouts, 5,042 B without (`r4/out/rl-trace.log`). Traced per body
(`r4/rl-trace.mts`): the bodies are 46 B smaller with return layouts before block moves and 13 B
larger after them (section 3.6), main is identical; so the review's hypothesis holds: the layouts
are accepted on pre-block-move bytes and the post-pass takes the gain back. Two fixes were
measured. Ranking every candidate by its bytes after block moves (`blockMoveAwareCosts`) is the
direct one, but it measured 5,117 B on BN254 (worse) and 4,468 B on BLS (better): the per-script
estimate cannot see the pass's global choices, so it stays an opt-in option. The kept fix is the
return-layout check of the cross-call fallback: under `size` with block moves the schedule
without return layouts is compiled too and the smaller final result wins. BN254 size + block
moves is now 5,042 B, 859,077,224 op-cost, BLS 4,491 B (return layouts kept; the review's
noRL BLS figure is 4,500 B), valid accepted and invalid rejected (`r4/out/mc-*-sizeBM.txt`).
Cost: compile time of that configuration about doubles (section 3.6). The review's opcost
observation (BLS +18 B for -0.14% op-cost with return layouts) is the objective working as
intended; unchanged.

**Medium (debug info): stale require() ips in rescheduled body frames.** Reproduced
(`r4/out/before-body-req.txt`, `before-frames.txt`): frame ips 11 and 28, VERIFYs at 10 and 26;
co-8 lost one require, default / size / size + block moves both. Root cause as reported: step 5
of `applyStackRescheduling` only clamped the old ips. Fix (BODY CHECK IPS): bodies are lifted
without sinks, so their checks are block boundaries that every candidate keeps in order; each
candidate now carries a map from the original check index to its index in the candidate (exact
through the block mapping, then carried through the optimiser re-run like require ips), and
the frame's require ips use it. The checks also keep their own source location in the coarse
body source map, because the SDK reports the failing op's line. Now every configuration reports
`req L3 "f-t"` and `req L5 "f-u"`, as plain does (`r4/out/after-body-req.txt`; co-8's
switches too, since the fix is in shared code). Test: `debug data of rescheduled bodies > keep
require() ips and lines on the body checks` (co-8 switches, default, size, size + block moves;
each asserts the body really was rewritten).

**Low: AND / OR / XOR missing from FALLIBLE_OPS.** Reproduced (`r4/out/before-xor-guard.txt`):
default and size emitted `OP_XOR` first, and the SDK reported the XOR error on line 3. Fix: AND,
OR and XOR are fallible unless both operands have known equal sizes, and so is CAT (a result
above 10,000 bytes fails; the same class) unless both operands have known sizes adding up to at
most that (`exactSize`: constants, constant-pushing functions, hashes and CATs of those). Bodies
with such ops count as fallible in `analyseFallibility`. Now all variants keep the XOR after the
third VERIFY and report `a1` (line 3) and line 6 like co-8 (`r4/out/after-xor-guard.txt`);
`sdk-bitand-rand.mts` seeds 3 and 77 (70 programs each): 0 differences; `sdk-unsafe-guard.mts`
unchanged. The singletons do not change (no such op in main). Test: `verify sinks > keep checks
before a bitwise op or CAT on unbounded bytes` (opcost and size, all four ops). A review of the
remaining VALOP entries found no other op that fails on type-correct operands outside the
documented policy (arithmetic on well-formed numbers, op-cost).

**Low: a non-minimal data push stopped all main rescheduling.** Reproduced: every main
strategy failed on `xor-hoist3.cash` (70 B), 3 of 96 fixture contracts affected
(`r4/out/before-xor-hoist3.txt`, `review3/out/minimal-fail.txt`). Root cause as reported: the
rescheduler's `constNumOf` decoded every push as a VM number and threw on non-minimal data, and
`peephole`'s `isN` calls it on every emitted block, outside any per-block catch. Section 5 was
wrong to say the block was kept. Fix: `constNumOf` returns undefined for data that is not a
minimally-encoded number (no PICK/ROLL depth, id or small-number operand, the VM would reject
it there; `popConstNum` still throws for such a PICK operand, which keeps that script verbatim).
Now 0 of 96 fixture contracts are affected (`r4/out/after-minimal-fail.txt`) and xor-hoist3 is
67 B (`after-xor-hoist3.txt`). This changes the switches-off build too (section 2), but none of
the 216 fixture compiles (`r4/co8-switch-diff.mts`). Test: `main routines with non-minimal
data pushes > are rescheduled` (opcost and size). Section 5 is corrected.

**Info: block moves dropped main's inline ranges and body frames' tags.** Confirmed by
inspection and with `r4/bm-debug-probe.mts`. Fix: `applyBlockMoves` remaps them (`remapRange`,
section 3.4) instead of dropping them. The probe shows the same inline range and loop tags, over
the same non-movement ops, in the plain and the block-moves compile. The rescheduler also kept
a rewritten body's inline ranges unchanged (stale ips); they are now dropped like its tags, and
main inline ranges that lie outside rewritten blocks are now remapped instead of all being
dropped. Test: `block moves keep debug ranges`.

**Info: the SDK suite only weakly covers the new codegen.** Confirmed: most SDK tests construct
contracts from precompiled artifacts. Fix: a recompiling shim (`tools/sdk-forced/`): with
`ZK_RECOMPILE=1` every `Contract` recompiles its artifact's source with this source, the
artifact's own options and the forced options, and runs on that bytecode and debug data
(injected into `src/Contract.ts` by a scratch vitest config; incomplete artifacts, ones
without source or debug data, and recompiles that fail or change the ABI keep the artifact).
`run-recompiled.sh` runs the whole suite for a baseline (`{}`), a size baseline (`optimizeFor:
'size'` without rescheduling), 6 option sets and an invalid-option sanity run; `compare-recompiled.mjs` lists every test that
passes in its baseline and fails with the option set. Results (`r4/out/sdk-recompiled3/compare.txt`):
17 of 20 test files recompile (128 contract constructions, 72 of them from the cache); 0
regressions for `rescheduleStacks`, `rescheduleStacks + size`, `+ blockMoves`, `+ size +
blockMoves`, `blockMoves` alone and the co-8 switches. Four tests fail with every size compile,
milestone or not (the plain size baseline fails them too): they pin bytecode (a precomputed
transaction signature in HodlVault, template fixtures). Two debugging template tests fail even
in the `{}` baseline for the same reason. The sanity probe: with an invalid `blockMoves` and
`ZK_RECOMPILE_STRICT=1`, 29 test files fail and only 18 tests pass. The honest limit: the SDK's
fixture contracts are small and mostly multi-function (rescheduling is single-function only), so
only 8 constructions (Announcement, BigInt and the debugging `Test` contracts) change bytecode
under `rescheduleStacks`, 15 under `size` (adding Mecenas and HodlVault), and none under
`blockMoves` alone. The suite is a regression check of the integration; the milestone's own
coverage remains the dedicated SDK harnesses (`sdk-first-fail`, `sdk-attrib`, the guard and
log-order probes).

**Info / low (twice): the relayed report did not match the tree.** Confirmed again, and not a code
problem: the relayed figures (805 tests; 6,459 / 5,665 B; 5,057 / 4,498 B) are the numbers from
before the first review's fixes; the tree measured 825 tests and section 1's numbers, as both
reviewers found. The headline numbers are section 1's, measured on the build described here
(`r4/out/`), and the test count in section 4 is from `r4/out/vitest.log`.

#### Re-verification of this build

- cashc **836/836**, `npx eslint packages/cashc/src packages/cashc/test` clean
  (`r4/out/vitest.log`).
- Singletons (section 1): every row of the matrix re-measured (`r4/out/mb-*-default.txt`,
  `mc-*-sizeBM.txt`, `md-*.txt`: 12 runs, plus 4 runs of the block-move-aware experiment); valid
  accepted and invalid rejected in all 16. Only BN254
  size + block moves changed (5,055 -> 5,042 B).
- Mutation red-team: 0 of 30 mutants accepted and the invalid vector rejected, for the default
  and size + block moves on both curves (`r4/out/mutate-*.log`).
- `r4/verify-all.sh` (log `r4/out/verify-all.log`): the review's probes (above); round 2 and 3
  probes: loop-param (size and default) 0 problems, mutual-time all configurations finish,
  `r3/loops.mts` 1,404 vectors 0 problems, `r3/edge2.mts bytes` 720 vectors 0 problems,
  sdk-guard-shift and sdk-shift-guard (seed 99, 80 programs) 0 mismatches, sdk-log-order as in
  round 3, sink-scaling N = 100 in 1.1 s (default) and 6.4 s (`size`, with the fallback's co-8
  compiles; the machine was also running the SDK harness) with bytecode identical to co-8;
  `sdk-first-fail.mts` seeds 5, 77, 201, 333 x 40 programs (9,600 runs, 907 vectors with several
  failing statements): 0 mismatches; `sdk-attrib.mts` seeds 1, 9, 42 x 60: 0 mismatches;
  `fuzz.mts 909 60`: 0 mismatches; `recursion2.mts` 48/48 valid accepted and wrong rejected;
  `r3/edge2.mts` 5,370 vectors 0 problems; `r3/diff-random.mts 7000 150 10` (3,600 vectors, 13
  configurations): 0 problems (23 op-cost limit differences, as before); `r3/diff2.mts` 1000 x
  150, wide 4000 x 80, multi-function 6000 x 120 (6,980 vectors): 0 problems (26 generated
  programs that plain cashc rejects are skipped, as before).
- SDK suite recompiled from source (above, `r4/out/sdk-recompiled3/`): 0 regressions in the 6
  option sets. The scratch config was deleted after each run.
- Checkpoint `checkpoints/convention.patch` refreshed (tracked diff plus the two untracked
  cashc files via `git diff --no-index`).
