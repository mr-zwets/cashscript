// Estimate savings from replacing arithmetic-progression PICK/ROLL runs with loop-helper calls.
// usage: npx tsx runs.mts <internal.js> <source.cash> ['<options json>']
import { pathToFileURL } from 'node:url';
import { decodeAuthenticationInstructions, encodeAuthenticationInstruction, hexToBin, OpcodesBCH as O } from '@bitauth/libauth';

const [compilerPath, file, extra = '{}'] = process.argv.slice(2);
const zk: any = await import(pathToFileURL(compilerPath).href);
const art: any = zk.compileFile(file, { rescheduleStacks: true, ...JSON.parse(extra) });
const code = hexToBin(art.debug.bytecode);
const num = (x: any): number | undefined => {
  if (x.data !== undefined) return x.data.length === 0 ? 0 : x.data.length <= 2 ? Number(BigInt('0x' + Buffer.from([...x.data].reverse()).toString('hex'))) : undefined;
  if (x.opcode >= 0x51 && x.opcode <= 0x60) return x.opcode - 0x50;
  return undefined;
};
const hist = new Map<string, { count: number; bytes: number }>();
const scan = (c: Uint8Array) => {
  const ins = decodeAuthenticationInstructions(c) as any[];
  // pairs (depth, op)
  const pairs: { d: number; op: string; len: number; i: number }[] = [];
  for (let i = 0; i < ins.length; i++) {
    if (ins[i + 2]?.opcode === O.OP_DEFINE && ins[i].data && ins[i].data.length > 8) { scan(ins[i].data); continue; }
    const n = num(ins[i]);
    const nx = ins[i + 1];
    if (n !== undefined && nx && (nx.opcode === O.OP_PICK || nx.opcode === O.OP_ROLL)) {
      pairs.push({ d: n, op: nx.opcode === O.OP_PICK ? 'P' : 'R', len: encodeAuthenticationInstruction(ins[i]).length + 1, i });
      i++;
    } else pairs.push({ d: -1, op: 'x', len: 0, i });
  }
  // find maximal runs with constant step
  let i = 0;
  while (i < pairs.length) {
    const a = pairs[i];
    if (a.op === 'x') { i++; continue; }
    let best = 1, bestStep = 0;
    for (const s of a.op === 'P' ? [0, 2] : [0, 1]) {
      let k = 1;
      while (pairs[i + k] && pairs[i + k].op === a.op && pairs[i + k].d === a.d + k * s && pairs[i + k].i === pairs[i + k - 1].i + 2) k++;
      if (k > best) { best = k; bestStep = s; }
    }
    const bytes = pairs.slice(i, i + best).reduce((x, p) => x + p.len, 0);
    const key = `${a.op}${bestStep} k=${best}`;
    const h = hist.get(key) ?? { count: 0, bytes: 0 };
    h.count++; h.bytes += bytes; hist.set(key, h);
    i += best;
  }
};
scan(code);
let save = 0;
[...hist.entries()].sort().forEach(([k, v]) => {
  const kk = Number(k.split('=')[1]);
  const call = 5; // <D> <k> <id> INVOKE (approx)
  const s = kk >= 3 ? v.bytes - v.count * call : 0;
  if (s > 0) save += s;
  console.log(k.padEnd(10), String(v.count).padStart(4), String(v.bytes).padStart(5), s > 0 ? `save~${s}` : '');
});
console.log('total est save (before helper defs)', save);
