#!/bin/sh
# Round 4: run the SDK suite with every Contract recompiled from source (recompile-setup.ts) for
# a baseline ('{}', this compiler's defaults) and each forced option set, writing vitest JSON
# reports and recompile counts to <out dir>; compare with compare-recompiled.mjs.
# usage: sh run-recompiled.sh <out dir>   (copies the scratch config into packages/cashscript and
# deletes it afterwards)
OUT=$1
mkdir -p "$OUT"
SDK=C:/Users/mathi/Desktop/cashscript-zk/packages/cashscript
cp C:/Users/mathi/Desktop/cashscript-zk/zk-notes/tools/sdk-forced/vitest.zkrecompile.config.ts "$SDK/"
cd "$SDK" || exit 1
run() {
  label=$1; force=$2
  rm -f "$OUT/counts-$label.jsonl"
  ZK_RECOMPILE=1 ZK_FORCE="$force" ZK_RECOMPILE_LOG="$OUT/counts-$label.jsonl" \
    npx vitest run -c vitest.zkrecompile.config.ts --reporter=json --outputFile="$OUT/report-$label.json" > "$OUT/log-$label.txt" 2>&1
  echo "$label exit $?" >> "$OUT/exits.txt"
}
rm -f "$OUT/exits.txt"
run base '{}'
# the baseline of the size configurations: tests that pin bytecode (precomputed signatures,
# template fixtures) fail on any size-objective bytecode, milestone or not
run plain-size '{"optimizeFor":"size"}'
run resched '{"rescheduleStacks":true}'
run resched-size '{"rescheduleStacks":true,"optimizeFor":"size"}'
run resched-bm '{"rescheduleStacks":true,"blockMoves":true}'
run resched-size-bm '{"rescheduleStacks":true,"optimizeFor":"size","blockMoves":true}'
run bm '{"blockMoves":true}'
run co8 '{"rescheduleStacks":true,"crossCallScheduling":false,"renumberFunctionIds":false}'
# sanity: an invalid option makes every recompile fail; strict mode turns that into test failures
ZK_RECOMPILE_STRICT=1 run bogus '{"blockMoves":{"kinds":"bogus"}}'
rm -f "$SDK/vitest.zkrecompile.config.ts"
