# Prototype: cross-call scheduling ("crosscall" lever)

Worktree `C:/Users/mathi/Desktop/zk-proto-crosscall` (branch `zk-proto-crosscall`, from `zk-language`, uncommitted).
Diff: `checkpoints/proto-crosscall.patch` (intermediate checkpoint: `checkpoints/proto-crosscall-v3.patch`).
Internal option `crossCallScheduling` (default **on** in this branch; `false` reproduces co-8 byte for byte).

## Correction to the premise

The rescheduler did **not** treat OP_INVOKE as a block boundary. `decompile` already lifts an
invoke of a known-arity function into ONE DAG node (`kind: 'invoke'`, in -> out). Blocks are bounded
only by IF/ELSE/ENDIF/BEGIN/UNTIL and the VERIFY family. What it lacked was planning a call's
operand placement together with where the producers left their results. That is what this
prototype adds.

The biggest single finding: **cashc pushes a call's arguments last-first (first parameter on top),
but a function's results come out first-last (first return deepest).** So every chained call
`f(g(x))` on a tuple (millerSingle -> fp12Mul, fp6Mul -> fp6Add, ...) has to reverse the whole
tuple: about 2 bytes per element, for example 24 ROLLs in front of every fp12Mul in main.

## What was implemented (all in `src/stack-rescheduling.ts`)

1. **Operand adoption.** When a node's leading operands already sit on top of the stack in order
   (the results of the previous call), they are consumed in place and only the rest is fetched.
   This is only done when every later use of an adopted value can still be served by a copy
   below. The same applies to the block's exit layout.
2. **Commutative prims** (ADD, MUL, NUMEQUAL, ...) stage whichever operand order is cheaper.
3. **Proven argument symmetries of OP_DEFINE'd functions** (`findSymmetries`). Each body is
   lifted to its DAG and canonicalised: commutative prims sort their operands, invokes of
   already-proven callees use canonical argument order, and all subterms go through one shared
   intern table. This is done for the identity inputs and for each relabelling (half swap
   f(a,b)=f(b,a), and single transpositions grouped into components). Equal canonical exits
   prove the symmetry structurally, with no random testing. Found on BN254: mulFp, addFp, fp2Mul,
   fp2Add (also per component {0,2}{1,3}), fp6Mul, fp6Add (per component), fp12Mul. At call
   sites the scheduler picks the cheapest proven relabelling, then applies the callee's entry perm.
4. **Exact-cost node choice.** New strategies `exact` (greedy on the true emission cost of
   computing a node next, by cloning and emitting) and `beamx` (beam 8x4 over exact costs) join
   the candidate set for bodies and main.
5. **Call-site-aware entry layouts.** This is the big one. The existing per-function layout search
   ranked each candidate argument order by body cost alone, with 1% hysteresis, and ignored the
   callers. Now each non-identity layout is ranked by body cost plus the static cost change of
   re-emitting every direct caller (bodies and main) under it (weight 3 under `opcost`, since the
   measured body cost sums 3 runs). A caller that cannot be re-emitted rules the layout out.
   This lets the search pick "reverse" (and half-wise reversals, added as candidates) for
   fp12Mul, fp6Mul, line, ..., which removes the result-tuple reversals. Permuted bodies went from
   4 to 23 (BN254).

Tests: `test/stack-rescheduling.test.ts` gains a cross-call block. A Karatsuba-style contract
(with a non-symmetric `subm`) gives the same accept/reject results as `crossCallScheduling: false`
under both objectives, and no extra bytes under `size`. cashc: **739/739** (736 + 3 new). Lint
clean. SDK tests (cashscript, run against this source): 222 passed; only the known
pre-existing SignatureTemplate load failure.

## Measurements (`.zk-measure.mts`, default optimizeFor = opcost, rescheduleStacks)

| Variant | BN254 bytes | BN254 move | BN254 opCost | BLS bytes | BLS move | BLS opCost |
|---|---|---|---|---|---|---|
| co-8 baseline (= `crossCallScheduling:false`) | 7,617 | 4,233 | 780,281,889 | 6,911 | 3,730 | 987,767,715 |
| v1 adoption + commutative + exact/beamx | 7,542 | 4,159 | 779,979,021 | n/a | | |
| v1 with beamx 32x6 (not kept) | 7,526 | 4,143 | 779,965,343 | | | |
| v2 + proven half-swap symmetry | 7,305 | 3,916 | 774,417,646 | 6,542 | 3,357 | 982,391,050 |
| v2b + transposition components | 7,305 | 3,916 | 774,417,070 | | | |
| v3 + call-site-aware layouts | 6,671 | 3,286 | 771,914,641 | 5,765 | 2,583 | 976,518,513 |
| v3 without symmetries (ablation) | 6,984 | 3,605 | 781,670,521 | | | |
| **v4 + half-wise layout candidates (final)** | **6,646** | **3,261** | **771,560,068** | **5,763** | **2,581** | **976,518,123** |
| v4, optimizeFor `size` | 6,600 | 3,343 | 772,721,391 | 5,740 | 2,752 | 977,045,460 |

In every row, validAccepted and invalidRejected are both true. Final result: BN254 is -971 B
(-12.7%) and BLS is -1,148 B (-16.6%). Op-cost also drops by about 1%. Under co-8, `size` was
worse than `opcost` (BN254 7,786). With crosscall it is now slightly better.
Call-site weight sweep (BN254, v4): weight 1 gives 6,661, weight 3 gives 6,646, weight 10 gives 6,676.

## Risks / limits

- **Compile time.** The BN254 measure run went from about 65 s to about 167 s. The extra time
  comes from re-emitting callers per candidate layout, the extra strategies, and two more layout
  candidates. The half-wise candidates add about 60 s and save only 25 B (BN254) / 2 B (BLS).
  They could be dropped or gated.
- The call-site estimate uses static `topo`/`greedy` re-emission of direct callers, made before
  those callers pick their own layouts and strategies. It is a proxy and the choice is greedy in
  callee-first order. A joint fixed point (iterate layouts until stable) may find more.
- Correctness rests on the existing guarantees: per-block exit layout, diff-tested bodies, and a
  fallback to identity layouts when a caller cannot be re-emitted. The symmetry proofs are
  structural and sound by construction (a missed match only loses an optimisation).
  `crossCall` / `calleeSymmetries` are module-level state set for one `applyStackRescheduling`
  run. That is fine for a prototype but should be threaded through options for real.
- Under `opcost`, a small contract can get slightly larger (test contract: 114 to 117 B), because
  bodies are still selected by measured op-cost.

## How it composes with the other levers

- **convention:** strongly overlapping and complementary. Part 5 is a calling-convention change
  (argument order) chosen by cross-call cost. A real convention lever should own the
  "return slots" half too. Emitting results last-first, or per-callee output permutations,
  would let chained calls adopt without reversing the callee's arguments. The machinery here
  (adoption, call-site re-emission cost) is what makes any convention measurable, so the two
  should merge into one "convention chosen by whole-program cost" search.
- **altstack:** orthogonal. Adoption works on the main stack top, and altstack parking would
  reduce the depth of the values that still have to be fetched (fewer 2-byte `<d> PICK`). The
  exit/adoption logic would need to know about parked values. Today altstack is only a block
  boundary passthrough.
- **borrow (callee picks by depth):** partly competing. Borrowed read-only arguments would not
  be staged at all, so there is less for adoption to save on those operands. Results still flow
  through adoption.
- **aggregate (structs / tuples as values):** complementary. Tuple-valued calls are exactly
  where the reversal penalty and adoption matter most. An aggregate lowering should emit tuples
  in the order the consumer's convention wants, which this pass then gets for free.
- Next step inside this lever: treat VERIFY-family ops (and zero-output invokes) as sink nodes
  instead of block boundaries, so main's 21 requires stop pinning variable slots. Failure order
  is unobservable, since any failure rejects.
