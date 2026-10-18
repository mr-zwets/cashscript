// Summarise a V8 .cpuprofile: top functions by self time and by inclusive time.
// Usage: node cpuprof-summary.mjs <file.cpuprofile> [top=25]
import { readFileSync } from 'node:fs';

const [file, topArg = '25'] = process.argv.slice(2);
const top = Number(topArg);
const prof = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const parent = new Map();
prof.nodes.forEach((n) => (n.children ?? []).forEach((c) => parent.set(c, n.id)));
const self = new Map();
const dt = prof.timeDeltas;
prof.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)));
const label = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
const selfBy = new Map();
const inclBy = new Map();
prof.nodes.forEach((n) => {
  const t = self.get(n.id) ?? 0;
  if (t === 0) return;
  const l = label(n);
  selfBy.set(l, (selfBy.get(l) ?? 0) + t);
  const seen = new Set();
  for (let cur = n.id; cur !== undefined; cur = parent.get(cur)) {
    const cl = label(byId.get(cur));
    if (seen.has(cl)) continue;
    seen.add(cl);
    inclBy.set(cl, (inclBy.get(cl) ?? 0) + t);
  }
});
const fmt = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([l, t]) => `${(t / 1e6).toFixed(2)}s  ${l}`).join('\n');
console.log('--- self');
console.log(fmt(selfBy));
console.log('--- inclusive');
console.log(fmt(inclBy));
