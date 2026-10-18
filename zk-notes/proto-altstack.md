# Prototype: altstack parking (lever 3)

Worktree `C:/Users/mathi/Desktop/zk-proto-altstack` (branch `zk-proto-altstack` off `zk-language`, uncommitted).
Patch: `checkpoints/proto-altstack.patch` (earlier checkpoint: `checkpoints/proto-altstack-v5.patch`).
Internal option `altstackParking` (default true; only acts under `rescheduleStacks`).

## What it does

Inside the stack rescheduler (`src/stack-rescheduling.ts`), per basic block:

1. Schedule the block as before and record the node order.
2. Replay that order with parking: after each node, while the top of the main stack holds a value
   whose next use is at least 2 steps away (and no other copy is on the main stack), the policy may
   `OP_TOALTSTACK` it. A parked argument is fetched with `OP_FROMALTSTACK` when it is staged
   (a copy is `OP_FROMALTSTACK OP_DUP OP_TOALTSTACK`). LIFO: if a parked argument is not on top
   of the altstack at its turn, everything down to it is unparked first (it then sits on the main
   stack like any value). The exit layout fetches parked values lazily by the same rule.
3. Search: thresholds {2,3,4,6,9,14} steps, each with and without parking exit-only computed
   values, then a hill-climb (up to 4 passes) toggling single values in the best parked set.
   Ranked by bytes, then the static op-cost estimate. The op-cost tiebreak matters: it lets the
   hill-climb move along byte-equal plateaus; ranking by bytes alone measured worse.
4. Translation validation: the chosen parked block is re-lifted to a DAG (with permuted entry
   layouts and callee conventions undone) and must denote exactly the original block's exit main
   and alt stacks, with no dead computation; otherwise the unparked schedule is kept (0 failures on
   both singletons).

Safety rules: parking stays inside one block (all parked values are fetched before the block
exit, above any entry altstack items that pass through untouched). A block is only parked if every
function it invokes is altstack-neutral (`altNeutralFunctions`: the body and all its callees never
pop below their entry altstack depth and return at it on every IF/ELSE and loop path). On both
singletons every function qualifies. Function bodies are still diff-tested on the loosened VM, as
before.

## Measurements (`verifier/.zk-measure.mts`, both curves validAccepted and invalidRejected)

| Build | BN254 bytes | BN254 opCost | BLS bytes | BLS opCost |
|---|---|---|---|---|
| baseline co-8 (default `opcost` objective) | 7,617 | 780,281,889 | 6,911 | 987,767,715 |
| parking, `opcost` objective | **7,538** (-79) | 775,713,579 | **6,842** (-69) | 983,835,881 |
| baseline, `optimizeFor: 'size'` | 7,786 | 771,253,243 | 6,863 | 978,824,303 |
| parking, `optimizeFor: 'size'` | **7,497** (-289) | 769,036,122 | **6,577** (-286) | 977,503,025 |

The best bytes come from parking plus `optimizeFor: 'size'`: BN254 7,497 (-120 vs the default
baseline), BLS 6,577 (-334). That build also has lower op-cost than the default baseline on both
curves (BN254 -1.4%, BLS -1.0%). Under the `opcost` objective most parked blocks lose: block
choices and body choices are ranked by (measured) op-cost, and a TOALT/FROMALT round trip
(~233 op-cost) only ties a shallow ROLL.

Movement bytes (opcost objective): BN254 4,233 -> 4,155; BLS 3,730 -> 3,662. Under size, BN254
main shrank 3,628 -> 3,403 B; the largest body gains were 5-13 B each (bodies 10, 14, 23, 28, 29,
38, 39).

Iterations (all correct unless noted):
- v1, thresholds only, exit-only values parked, everything unparked at the exit: 7,617 / 6,908.
  Parking pass-through values wrecked the in-place exit layout.
- v2, no exit-only parking: 7,579 (BN254).
- v3, plus a per-value hill-climb: 7,566 / 6,877.
- v4, exit-only computed values parked again, with lazy unparking at the exit: 7,582 / 6,862. The
  hill-climb is non-monotone.
- v5, both exit-only settings searched: 7,544 / 6,855. The translation validator was added here.
  It first reported false failures on permuted callee conventions, which were checker bugs. With
  the fix, all variants validate.
- v6, ranked by bytes then op-cost: 7,538 / 6,842 (opcost); 7,506 / 6,577 (size).
- v7, 4 hill-climb passes, minimum 3 nodes: unchanged under opcost; BN254 size 7,497.
- Tried and dropped: replaying the other strategies' node orders as extra candidates (+4 B BN254,
  +16 B BLS), and ranking parking by the opcost objective (+6..13 B).

Tests: cashc 737/737 (736 + a new differential parking test in `test/stack-rescheduling.test.ts`
that compiles a Karatsuba-style contract with and without parking and checks accept/reject on the
VM). Lint is clean. Compile plus measurement time per singleton was 51-95 s, against about 59 s for the baseline. The timings are noisy and were not benchmarked carefully.

## Risks

- The main routine cannot be VM-diff-tested. Correctness there rests on the per-block construction,
  the new translation validator, and the end-to-end proof vectors.
- Altstack neutrality is checked on the original bodies. Rescheduled bodies keep it by construction
  (blocks preserve entry/exit alt layout, parking is balanced). A future lever that passes
  arguments or results through the altstack (cross-call conventions) must update
  `altNeutralFunctions` or parking becomes unsound across such calls.
- The search is local: the node order is fixed before parking, so the scheduler is not
  alt-aware. Results are non-monotone in the knobs (see v4).
- Gains under the default `opcost` objective are small. The large gains need the `size`
  objective, which changes other choices too (it happens to be better on both bytes and op-cost
  here, but that is not guaranteed for other contracts).

## Composition with the other levers

- **convention** (per-function argument order, consume vs copy, return slots): orthogonal and
  complementary. Parking works on whatever order the convention produces, and it already composes
  with the existing entry-layout search (the validator undoes permutations). A convention that
  returns results in "parking order" would make more exits free.
- **crosscall** (scheduling across OP_INVOKE boundaries / merging blocks): this is the biggest
  multiplier for parking. Today a parked value cannot outlive its block, and the long ROLL chains
  that remain are mostly block-boundary traffic: about 1,625 B of runs of 6+ consecutive ROLLs in
  BN254 (627 items), mostly 12-value Fp12 groups crossing loop iterations, IF branches and function
  entries. With larger blocks, or loop-carried values allowed on the altstack (block boundary alt
  layouts chosen like entry layouts), many of those 2-3 B ROLLs become 1 B FROMALTs.
- **altstack** (this): needs callees to stay altstack-neutral, or the neutrality analysis to model
  callee altstack effects.
- **borrow** (callee PICKs large read-only arguments in place by depth): this conflicts with
  parking only if a borrowed value is parked, since altstack values cannot be PICKed. Borrowed
  values must stay on the main stack. Parking reduces depth variance, which makes borrow depths
  more often static.
- **aggregate** (structs/fixed arrays over the same stack values): neutral. Parking works on the
  flattened values. Group-wise parking of a whole aggregate (12 TOALTs, 12 FROMALTs in order)
  is exactly the in-order pattern parking already produces for multi-output calls.

## Estimated full potential

In-block parking is near saturation: more passes, more candidate orders and lower thresholds give
less than 10 B. The remaining parking opportunity is cross-block. An upper bound from the ROLL-chain
count is about 370 B on BN254 (1,625 B of chains vs about 2 B per item for TOALT+FROMALT). A
realistic cross-block parking (loop-carried Fp12 accumulators and arguments staged across call and
branch boundaries) might save another 100-250 B per singleton on top of the 290 B measured here
under the size objective.
