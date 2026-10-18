# Design decision: calling-convention milestone (Oct 17 2026)

Judged on measured bytes first, then op-cost, correctness, implementation risk and how well the
levers compose. All numbers below come from `.zk-measure.mts`, default `optimizeFor` (opcost) and
`rescheduleStacks` unless stated otherwise. Both singletons gave validAccepted = true and
invalidRejected = true in every row.

## 1. Verification of the prototype claims

I re-measured the two strongest prototypes from their existing `dist/internal.js` builds (dist was
newer than src in each worktree) and re-ran their cashc suites:

| build | BN254 B | BN254 opCost | BLS B | BLS opCost | cashc tests |
|---|---|---|---|---|---|
| co-8 baseline | 7,617 | 780,281,889 | 6,911 | 987,767,715 | 736/736 |
| crosscall (re-measured) | **6,646** | 771,560,068 | **5,763** | 976,518,123 | 739/739 (re-run) |
| aggregate `blockMoves:true` (re-measured) | **5,684** | 923,332,452 | **5,179** | 1,097,841,932 | 788/788 (re-run) |
| aggregate, no LM (re-measured, BN254) | 5,721 | 856,747,817 | | | |
| convention v3 (re-measured, BLS) | | | 6,137 | 980,440,123 | not re-run (claimed 738/738); 400 s per compile + measure |

Every claimed number reproduced exactly. Convention (6,935 / 6,125), altstack (7,538 / 6,842) and
borrow (7,561 / 6,775) were not re-measured except where shown. On bytes alone they rank below
crosscall, and the decision does not depend on their exact numbers.

### New measurement: crosscall + block moves compose

Scratch worktree `C:/Users/mathi/Desktop/zk-combo-cc-agg`, detached at dab3f89f. It holds
proto-crosscall.patch plus proto-aggregate.patch; the only conflict was two trivial `compiler.ts`
hunks. Checkpoint: `checkpoints/combo-crosscall-aggregate.patch`. cashc **791/791** (736 + 3 + 52),
eslint clean.

| combo variant | BN254 B | BN254 opCost | BLS B | BLS opCost |
|---|---|---|---|---|
| crosscall + renumber only (`kinds: []`) | 6,608 | 771,812,393 | | |
| crosscall + P0/R0/P2/R1/DB | 5,268 | 830,646,857 (+6.5%) | 4,814 | 1,019,257,374 (+3.2%) |
| crosscall + all but LM | 5,263 | 837,921,787 (+7.4%) | 4,749 | 1,030,648,328 (+4.3%) |
| crosscall + all kinds | 5,233 | 871,770,437 (+11.7%) | 4,715 | 1,074,925,681 (+8.8%) |
| crosscall + all kinds, `optimizeFor: size` | **5,149** | 874,922,801 (+12.1%) | **4,535** | 1,076,546,478 (+9.0%) |

(The op-cost percentages are against the co-8 baseline.)

The levers overlap less than feared. Block moves save 1,933 B on top of co-8, and still 1,413 B
(BN254) and 1,048 B (BLS) on top of crosscall. Together they are -2,384 B (-31%) on BN254 and
-2,196 B (-32%) on BLS. The op-cost-friendly helper set (progression helpers + DB) keeps 97% of
that for about half the op-cost increase. Compile + measure time for the combo was 170-190 s per
curve (crosscall alone: 166-199 s; baseline about 60 s).

## 2. Judgement per lever

- **crosscall: adopt first, as the base.** It is the largest source-level win (-971 / -1,148 B),
  it *lowers* op-cost by about 1%, it is moderately priced in compile time (about 3x), and its
  correctness story is good: structural symmetry proofs, diff-tested bodies, and an identity
  fallback when a caller cannot be re-emitted. The patch applies cleanly to zk-language.
- **aggregate (block moves + renumbering): adopt as an opt-in post-pass.** It is the largest byte
  win (-1.4 kB even after crosscall). It cannot interfere with scheduling because it runs on the
  final bytecode, and its helpers are VM-diff-tested. Its cost is op-cost, so it must be
  objective-gated, and its helper set must be selectable (`kinds`). Renumbering alone is a free
  -38 B and composes with everything. The struct lowering result (structs cost exactly 0 B) is
  the evidence for doing structs as pure desugaring later.
- **convention: adopt only its return-layout half, and drop its search driver.** It shows that
  return layouts pay: v1 alone was -352 B over co-8. Its whole-program exact descent, however,
  costs 9.5-15 min per singleton and lands at 6,939 / 6,137, which is worse than crosscall's
  static-proxy search (6,646 / 5,763). Port `Convention {in, out}`, `exitPerm` and
  result labelling, and drive them with crosscall's call-site proxy. Exact recompiles are
  allowed only as a bounded finalist check. Its `adoptableRun` duplicates crosscall's
  adoption, so drop it.
- **borrow: reuse only the `passThroughBottom` fix.** Borrow-by-depth is worth 20 / 100 B, makes
  invokes hard block boundaries (which conflicts with crosscall), and its runtime-depth form is a
  measured loss. The pass-through fix is independent and was worth -36 B per curve on co-8. Its
  value on top of crosscall still has to be measured.
- **altstack: defer.** In-block parking is worth -79 / -69 B under opcost and is reported as
  saturated. Its TOALT/FROMALT output is not collapsed by block moves, so the overlap is
  negative. Revisit it only as cross-block parking (loop-carried Fp12 accumulators) after the
  convention work, and measure it with block moves on.

## 3. Chosen order

1. Crosscall core, from proto-crosscall.patch.
2. Block moves + id renumbering, from proto-aggregate.patch (merged as in
   combo-crosscall-aggregate.patch). Opt-in and objective-gated.
3. Return layouts (`out` conventions) on crosscall's scheduler, ported from
   proto-convention.patch.
4. Pass-through bottom fix, from proto-borrow.patch. Keep it only if it measures smaller.
5. VERIFY-family ops and void invokes as DAG sink nodes in main, from crosscall's next step.
   Not prototyped yet.

Deferred: altstack (cross-block version), borrow-by-depth spec, the exact whole-program descent.

## 4. Concrete plan (zk-language branch, C:/Users/mathi/Desktop/cashscript-zk)

No staging or commits: checkpoint every step with
`git -C C:/Users/mathi/Desktop/cashscript-zk diff > zk-notes/checkpoints/m1-<step>.patch`.
Include untracked new files with `git diff --no-index /dev/null <file> >> ...`, as done for the
combo patch. After every step, run `npx vitest run` and eslint, then measure both curves with
the default objective and with `{"optimizeFor":"size","blockMoves":true}`.

### Step 1: crosscall core (expected 6,646 / 5,763 B)

- `git apply` checkpoints/proto-crosscall.patch. Do not use `--3way`: it stages into the
  index.
- Clean-ups before going further:
  - (a) Thread `crossCall` and `calleeSymmetries` through `RescheduleOptions` and `EmitOptions`
    instead of module-level `let`s.
  - (b) Gate the half-wise layout candidates (about +60 s for 25 B on BN254 and 2 B on BLS)
    behind `optimizeFor: 'size'` or an internal flag.
  - (c) Keep `crossCallScheduling: false`, which reproduces co-8 byte for byte, as the regression
    switch, and add one fixture test that asserts it.
- Exit: 739/739, BN254 6,646 ±25 / BLS 5,763 ±5, op-cost no higher than co-8.

### Step 2: block moves + renumbering (expected 5,233 / 4,715 B under opcost)

- Apply proto-aggregate.patch. Resolve the two `compiler.ts` hunks exactly as in
  combo-crosscall-aggregate.patch: add `blockMoves` next to `crossCallScheduling` in
  `InternalCompilerOptions` and in the destructuring list.
- Policy:
  - `blockMoves` stays internal and off by default.
  - Add an `opCostBudget` or `kinds` preset (`'compact'` = P0/R0/P2/R1/DB, `'all'`) so that
    op-bound multi-input entries can take the cheap set.
  - Renumbering (`kinds: []`) is semantically neutral. It can be on by default once SDK tests pass
    with it (debug frames already remapped).
- Run the SDK suite with block moves forced on (vitest.loopinv.config.ts copied in), since the
  helper bodies have no debug frame.
- Exit: 791/791, BN254 5,233 / BLS 4,715 (all kinds, opcost) and 5,149 / 4,535 (size).

### Step 3: return layouts on crosscall's scheduler (target -150 to -400 B before block moves)

- From proto-convention.patch, port:
  - `Convention {in?, out?}` replacing the per-callee `number[]` perms;
  - `exitPerm` in `EmitOptions` and in `recompileScript`'s last block, refusing when
    `exitAlt` is non-empty;
  - result labelling in `computeNode` via `calleeConv.out`;
  - `bodyEquiv` comparing permuted outputs;
  - the `rawValid` rule (raw block only valid under identity in/out and unpermuted callees).
- Candidates per function, scored with crosscall's static call-site proxy (body cost +
  re-emission cost delta of each direct caller, weight 3 under opcost):
  - identity;
  - reverse (this cancels the "args last-first, results first-last" reversal);
  - the body's natural return order (convention's `siteOutCandidate` / natural-order code);
  - the consumer order at the dominant call site;
  - joint (in, out) = (reverse, reverse).
- Iterate the callee-first sweep to a fixed point (at most 3 passes; convention converged at
  -311 / -29 / -4 B per pass), using static proxies only.
- Optional, behind an internal flag: an exact recompile of the top-2 finalists per function. Do
  not port `searchConventions`' full exact descent (9.5-15 min).
- Symmetries: an `out` permutation does not interact with argument symmetries. Apply the
  symmetry relabelling, then `in`, as crosscall does now.
- Tests: port convention's Karatsuba tuple test (reference result, wrong-value rejection,
  strictly smaller). Fixtures may only change after VM differential checks.
- Exit: no compile-time regression beyond 1.5x of step 1. Measure with and without block moves.
  The post-block-moves gain is the number that matters, and it may be much smaller than the
  pre-block-moves gain, because block moves already collapse whole-tuple reversals into 4-byte
  calls.

### Step 4: pass-through bottom (expected 0 to -40 B)

- Port `passThroughBottom` (emitBlock `finish` keeps untouched bottom entry slots in place)
  from proto-borrow.patch, on by default. Merge it with crosscall's exit adoption: compute
  `fixed` first, then adopt only above it.
- Keep it only if it is not larger on either curve.

### Step 5: VERIFY as sink nodes (estimated -50 to -150 B, unprototyped)

- In `decompile`, treat OP_VERIFY/NUMEQUALVERIFY/EQUALVERIFY/CHECK*VERIFY and zero-output
  invokes in main as DAG nodes with no outputs instead of block boundaries. Failure order is
  unobservable because any failure rejects.
- Keep the old boundary behaviour behind a flag. Diff-test with the invalid vectors of both
  singletons plus mutated public inputs.

### After the milestone

- Structs and fixed arrays as AST desugaring. The aggregate prototype shows they cost 0 B, and
  conventions can then treat an Fp12 as one block.
- Then revisit cross-block altstack parking and op-cost-aware helper selection.

## 5. Expected result

| stage | BN254 B | BN254 opCost | BLS B | BLS opCost | status |
|---|---|---|---|---|---|
| co-8 | 7,617 | 780.3M | 6,911 | 987.8M | measured |
| step 1 | 6,646 | 771.6M | 5,763 | 976.5M | measured |
| steps 1+2 (opcost, all kinds) | 5,233 | 871.8M | 4,715 | 1,074.9M | measured |
| steps 1+2 (opcost, compact kinds) | 5,268 | 830.6M | 4,814 | 1,019.3M | measured |
| steps 1+2 (size, all kinds) | 5,149 | 874.9M | 4,535 | 1,076.5M | measured |
| steps 1-5 (size, all kinds) | about 4,900-5,050 | about 870M | about 4,350-4,480 | about 1,070M | estimate |

Reference points: hand-tuned genpow singletons are 4,619 (BN254) and 3,722 (BLS). They use a
different source, so the gap is not apples-to-apples.

## 6. Risks carried forward

- Compile time is about 3x co-8 after step 1. Step 3 must stay on static proxies.
- Block moves raise op-cost by 3-12%. That is harmless for byte-scored singletons but must stay
  opt-in for op-bound multi-input entries, where op-cost turns into more inputs.
- Main is never VM-diff-tested. It relies on the per-block exit-layout guarantee plus the
  end-to-end vectors. Step 5 widens blocks, so add a translation validator for main blocks.
  Altstack's re-lift validator is a reusable starting point (proto-altstack.patch).
- Housekeeping: delete the scratch worktree `C:/Users/mathi/Desktop/zk-combo-cc-agg` only with
  `git worktree remove` after unlinking its two node_modules junctions with `cmd //c rmdir`.
