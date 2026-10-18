// Round 4: compare the recompiled SDK runs (run-recompiled.sh) against the baseline: every test
// that passes in the baseline and fails with forced options is listed with its first error line.
// usage: node compare-recompiled.mjs <out dir>
import fs from 'node:fs';

const dir = process.argv[2];
const load = (label) => {
  const report = JSON.parse(fs.readFileSync(`${dir}/report-${label}.json`, 'utf8'));
  const tests = new Map();
  report.testResults.forEach((file) => file.assertionResults.forEach((t) => {
    tests.set(`${file.name.replace(/.*packages\/cashscript\//, '')} > ${t.fullName}`, { status: t.status, error: (t.failureMessages[0] ?? '').split('\n')[0] });
  }));
  const fileErrors = report.testResults.filter((file) => file.status === 'failed' && file.assertionResults.length === 0)
    .map((file) => `${file.name.replace(/.*packages\/cashscript\//, '')}: ${(file.message ?? '').split('\n')[0]}`);
  const counts = fs.existsSync(`${dir}/counts-${label}.jsonl`)
    ? fs.readFileSync(`${dir}/counts-${label}.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const total = counts.reduce((acc, c) => { Object.entries(c.counts).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + v; }); return acc; }, {});
  const changedNames = [...new Set(counts.flatMap((c) => c.changed ?? []))];
  const touched = counts.filter((c) => c.counts.recompiled > 0 || c.counts.failed > 0).length;
  return { tests, fileErrors, total, changedNames, touched, files: counts.length, summary: {
    passed: report.numPassedTests, failed: report.numFailedTests, files: report.numTotalTestSuites, failedFiles: report.numFailedTestSuites,
  } };
};
const labels = fs.readdirSync(dir).filter((f) => /^report-.*\.json$/.test(f)).map((f) => f.slice(7, -5));
const base = load('base');
console.log(`base: ${JSON.stringify(base.summary)} recompile counts ${JSON.stringify(base.total)} (${base.touched} of ${base.files} files recompile)`);
base.fileErrors.forEach((e) => console.log(`  base file error: ${e}`));
const baseFailed = [...base.tests].filter(([, t]) => t.status === 'failed').map(([name]) => name);
console.log(`  base failing tests (${baseFailed.length}): ${baseFailed.slice(0, 20).join(' | ')}`);
const plainSize = labels.includes('plain-size') ? load('plain-size') : undefined;
labels.filter((l) => l !== 'base').forEach((label) => {
  const run = load(label);
  // size configurations compare against the plain size compile (see run-recompiled.sh)
  const reference = label !== 'plain-size' && label.includes('size') && plainSize !== undefined ? plainSize : base;
  const regressions = [...run.tests].filter(([name, t]) => t.status === 'failed' && reference.tests.get(name)?.status === 'passed');
  const fixed = [...run.tests].filter(([name, t]) => t.status === 'passed' && reference.tests.get(name)?.status === 'failed');
  console.log(`${label}: ${JSON.stringify(run.summary)} recompile ${JSON.stringify(run.total)}; regressions vs ${reference === base ? 'base' : 'plain-size'}: ${regressions.length}; passing only here: ${fixed.length}; contracts with changed bytecode: ${run.changedNames.join(', ') || 'none'}`);
  run.fileErrors.filter((e) => !base.fileErrors.includes(e)).forEach((e) => console.log(`  new file error: ${e}`));
  regressions.slice(0, 40).forEach(([name, t]) => console.log(`  REGRESSION ${name}: ${t.error}`));
});
