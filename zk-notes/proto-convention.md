# Prototype: whole-program calling conventions ("convention" lever)

Worktree `C:/Users/mathi/Desktop/zk-proto-convention` (branch `zk-proto-convention`, from `zk-language`, uncommitted).
Diff: `checkpoints/proto-convention.patch`. Intermediate checkpoints: `proto-convention-v2wip.patch` and `proto-convention-v3.patch`.
Internal option `callingConvention` (default **on** in this branch; it only acts under `rescheduleStacks`).
`callingConvention: false` turns off the search and operand adoption, which gives back co-8 behaviour.
Env `CASHC_CONV_GROUPS=1` adds structured layout candidates (v4). They are off by default because they add about 50% compile time for 4-12 B.
Scratch tools (untracked): `packages/cashc/zk-tools/` (compile-only runner, per-function sizes, disassembler).

## What was implemented (`src/stack-rescheduling.ts`)

1. **Return layouts.** A function convention is now `{ in?: number[]; out?: number[] }`.
   - `in` is the existing argument order.
   - `out` is new: stack position j holds original return index `out[j]`.
   - The callee's final block assembles its exit in the permuted order (`exitPerm`).
   - A call site labels the results in that order (`computeNode`).
   - The plain-cashc block is only valid when every layout is the standard one.
   - The differential body test compares the permuted outputs.
2. **Whole-program search (`searchConventions`).** This runs after the existing per-body layout search and starts from its result. It is coordinate descent on the TOTAL compiled bytes (all bodies + main), 3 passes, callee-first.
   - For each candidate (in, out) of function f, it recompiles f, every direct caller, and main (if main calls f), then keeps the candidate only if the total shrinks.
   - So a convention that makes a callee bigger but saves staging at its call sites is adopted.
   - Candidate layouts come from several places:
     - the body itself: the existing `layoutCandidates`, plus the return order its schedule produces naturally before the exit shuffle;
     - every call site in the current schedules: arguments that die at the call, in the order they already lie on the stack (then copies and constants, in both orders), and the order in which the caller consumes the results;
     - joint (in, out) pairs per site, identity, reverse, and optionally half-swap/half-reverse groups.
   - Bodies are ranked by bytes; each candidate is differentially tested, cheapest first.
   - Main uses the existing per-block structural guarantee.
   - The search result is adopted only when it beats the per-body layout result.
   - Memoisation: body picks are keyed by (own convention, callee conventions); main blocks are keyed by block and the conventions of the callees they invoke; reference VM runs are cached.
3. **Operand adoption** (`adoptableRun`). If the leading staged operands of a node already sit on top of the stack in staging order, they are consumed in place, with no ROLLs. This needs either last use or another copy of the value deeper down. Without it, a matching return layout still cost about 2 B per element, because each value was ROLLed over itself. Consume vs copy for the remaining operands was already liveness-driven (`bringRef`); nothing changed there.

Tests: `test/stack-rescheduling.test.ts` gains a Karatsuba-style block with non-symmetric `subm` and tuple returns.
- It checks the reference result plus a wrong-value rejection for both compiles, under `opcost` and `size`.
- It checks that convention mode is strictly smaller (170 -> 164 B; permuted return layouts are chosen).
- cashc: **738/738** (736 + 2). Lint clean.
- SDK (cashscript, against this source): 222 passed. The only failure is the known pre-existing SignatureTemplate load failure.

## Measurements (`.zk-measure.mts`, default optimizeFor = opcost, rescheduleStacks)

| Variant | BN254 bytes | BN254 move | BN254 opCost | BLS bytes | BLS move | BLS opCost |
|---|---|---|---|---|---|---|
| co-8 baseline | 7,617 | 4,233 | 780,281,889 | 6,911 | 3,730 | 987,767,715 |
| v1 return layouts + whole-program descent (2 passes) | 7,265 | 3,885 | 780,384,892 | 6,610 | 3,434 | 983,900,286 |
| v2 + natural-return-order candidate, 3 passes | 7,249 | 3,871 | 783,394,686 | 6,583 | 3,407 | 984,265,627 |
| **v3 + operand adoption (default)** | **6,939** | **3,560** | **782,016,495** | **6,137** | **2,959** | **980,440,123** |
| v4 = v3 + `CASHC_CONV_GROUPS=1` | 6,935 | 3,556 | 782,015,905 | 6,125 | 2,949 | 979,729,893 |

In every row, validAccepted and invalidRejected are both true.

v3 is -678 B (-8.9%) on BN254 and -774 B (-11.2%) on BLS. Op-cost changes by +0.2% on BN254 and -0.7% on BLS: bodies are ranked by bytes inside the search, not by measured op-cost.

Adoption on its own, before any convention change, only moves the search's starting total from 7,551 to 7,520 (BN254). The conventions are what make it pay off, and the two compound.

Per-function view (BN254, v3 vs co-8): define-table bodies went from 3,856 to 3,683 B. Some bodies grew (fp6Mul 187->202, fp6Add 16->21) to make their callers cheaper (fp12Mul 267->226, millerSingle 760->710, fp12Conj 9->3, powMinusX 219->186). Most of the saving is in main (about -500 B).

## Risks / limits

- **Compile time** is the main cost.
  - BN254 compile goes from about 60 s to 9.5-15 min, and BLS to 6.5-11 min, on a machine shared with other workflow runs.
  - Each candidate recompiles all direct callers (4 strategies, VM diff tests), and main when it is a direct caller.
  - Before shipping: cache across compiles, or emit the chosen conventions as a reusable hint, or restrict the search to functions with arity >= 4 or many call sites, or use static cost proxies (as in crosscall) for pruning and exact recompiles only for the finalists.
- Coordinate descent is greedy, and candidates are heuristic. Joint moves across several functions, such as fp6Mul and fp12Mul together, are only reached through passes, which converge after 3 passes (gains per pass: -311/-29/-4 B on BN254).
- `adoptOperands` is module-level state set for one `applyStackRescheduling` run (fine for a prototype; it should be threaded through options).
- Main is not differentially tested; it relies on the per-block exit-layout guarantee, as before. A return-layout mismatch in main would be caught only by the structural model. The singletons' valid/invalid vectors pass.
- Under `opcost` the search optimises bytes, so op-cost can rise slightly (BN254 +0.2%).

## How it composes with the other levers

- **crosscall:** strongest overlap. Crosscall's operand adoption is the same idea as step 3 here, and its "call-site-aware layouts" is a static-proxy version of step 2 for ARGUMENT layouts only. Crosscall reaches 6,646 / 5,763 thanks to proven argument symmetries and its exact-cost scheduler.
  - What this prototype adds on top: RETURN layouts, the callee's natural-return-order candidates, and exact whole-program total-bytes acceptance with multi-pass fixed-point iteration.
  - Expected to stack: put return layouts and the descent on crosscall's scheduler, and use crosscall's static proxy to prune candidates before the exact recompile. Then remove the duplicate adoption code.
- **altstack:** independent per-block post-pass. It should run inside the search's body and main compiles, or once after it; parking does not change call interfaces.
- **borrow:** conflicts at the interface level. Borrowed parameters fix a region below the owned arguments, so permutations should only range over the owned parameters, and the return layout is unaffected. Run convention search after the borrow spec is fixed.
- **aggregate:** orthogonal. Conventions are per OP_DEFINE'd function, so any restructuring that changes which functions exist, or their arities, simply changes the search space.
