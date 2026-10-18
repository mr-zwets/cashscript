# zk-language: working notes

Goal: write the Groth16 verifiers in plain CashScript (structs, field types, compile-time
data, multi-input programs) and get output at least as small as today's hand-tuned builds.
Branch `zk-language` on `mr-zwets/cashscript`, based on `compiler-optimizations-8` (dab3f89f).
Not pushed yet; the cashscript repo's CLAUDE.md says not to stage, so commits need the user's OK.

## Baseline (co-8, rescheduleStacks, Oct 17 2026)

Share of compiled bytes that is pure stack movement (PICK/ROLL/swaps/altstack and their depth
pushes), measured with `verifier/.zk-baseline.mts`:

| Contract | Total | Movement |
|---|---|---|
| BN254 singleton (`singleton/bn254/groth16.cash`) | 7,617 B | 4,233 B (55.9%) |
| BLS12-381 singleton | 6,911 B | 3,730 B (54.3%) |

Worst functions (BN254): fp12Mul 90%, line 86%, powMinusX 79%, g2AddAffine 75%,
fp6Mul 74%, millerSingle 72%.

## Key observation

Structs alone are syntax over the same stack values; they do not remove movement. In
Karatsuba-style code (fp12Mul -> fp6Mul -> fp2Mul) every operand is used twice, so it must be
copied, and results must be arranged for the next call. Savings have to come from how calls
are compiled. Candidate levers:

1. Calling convention per function: argument order (co-8 already searches entry layouts),
   consume vs copy, return slots.
2. Scheduling across calls: the rescheduler treats every OP_INVOKE as a block boundary.
3. Altstack parking for values not needed until later.
4. Borrow by depth: pass a runtime depth and let the callee `<d + k> OP_PICK` large read-only
   arguments in place instead of the caller copying them to the top.
5. Outlining of the remaining repeated shuffles (prior art: singleton/bn254/recompiler).

## Plan

1. Design phase: prototype and measure levers 1-4 on fp12Mul / millerSingle / the BN254
   singleton (planned as a parallel workflow once the user opts in).
2. Implement the winning convention, then structs / fixed arrays on top of it.
3. Compile-time parameters and data (const params, embed, table indexing), typed byte parsing.
4. Field types with bound tracking (elide `% P`).
5. Multi-input programs: typed sibling access, shared libraries with hash-pinned loading.

## Milestone 1: calling convention (done, Oct 17 2026)

See `convention.md`. After three review rounds (section 7), default (opcost): BN254 6,421 B /
BLS 5,637 B; with `{ optimizeFor: 'size', blockMoves: true }`: 5,042 / 4,491 B. Both singletons
accept the valid proof and reject the invalid one and all 30 single-push mutants. Whole-branch
diff: `checkpoints/convention.patch`.
