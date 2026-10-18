// Per-function byte/movement breakdown + optional ASM dump of selected functions.
// usage: npx tsx dump.mts <internal.js> <source.cash> ['<options json>'] [fnName,fnName]
import { pathToFileURL } from 'node:url';
import { decodeAuthenticationInstructions, encodeAuthenticationInstruction, hexToBin, OpcodesBCH as O } from '@bitauth/libauth';

const [compilerPath, file, extra = '{}', show = ''] = process.argv.slice(2);
const zk: any = await import(pathToFileURL(compilerPath).href);
const art: any = zk.compileFile(file, { rescheduleStacks: true, ...JSON.parse(extra) });
const code = hexToBin(art.debug.bytecode);
const MOVE = new Set(['OP_PICK', 'OP_ROLL', 'OP_SWAP', 'OP_ROT', 'OP_DUP', 'OP_OVER', 'OP_NIP', 'OP_DROP', 'OP_TUCK', 'OP_2SWAP', 'OP_2ROT', 'OP_2DUP', 'OP_2OVER', 'OP_3DUP', 'OP_2DROP', 'OP_TOALTSTACK', 'OP_FROMALTSTACK']);
const names = new Map<number, string>((art.debug.functions ?? []).map((f: any) => [f.id, f.name]));
const showSet = new Set(show.split(',').filter(Boolean));
const rows: { name: string; bytes: number; move: number }[] = [];
const asm = (ins: any[]) => ins.map((x) => {
  if (x.data !== undefined) return x.data.length > 4 ? `<${x.data.length}B>` : `${x.data.length === 0 ? 0 : Number(BigInt('0x' + Buffer.from([...x.data].reverse()).toString('hex')))}`;
  const op = String((O as any)[x.opcode]);
  const m = /^OP_([0-9]|1[0-6])$/.exec(op);
  return m ? m[1] : op.replace('OP_', '');
}).join(' ');
const measure = (c: Uint8Array, name: string) => {
  const ins = decodeAuthenticationInstructions(c) as any[];
  let bytes = 0, move = 0;
  const top: any[] = [];
  ins.forEach((x, i) => {
    if (ins[i + 2]?.opcode === O.OP_DEFINE && x.data && x.data.length > 8) {
      const idIns = ins[i + 1];
      const id = idIns.data ? Number(idIns.data[0] ?? 0) : idIns.opcode === 0 ? 0 : idIns.opcode - 0x50;
      measure(x.data, names.get(id) ?? `fn${id}`); return;
    }
    top.push(x);
    const len = encodeAuthenticationInstruction(x).length;
    bytes += len;
    const op = String((O as any)[x.opcode]);
    const isDepth = (x.data !== undefined && x.data.length <= 2) || /^OP_([0-9]|1[0-6])$/.test(op);
    const next = ins[i + 1] ? String((O as any)[ins[i + 1].opcode]) : '';
    if (MOVE.has(op) || (isDepth && (next === 'OP_PICK' || next === 'OP_ROLL'))) move += len;
  });
  rows.push({ name, bytes, move });
  if (showSet.has(name) || showSet.has('all')) console.log(`--- ${name} (${bytes} B, move ${move})\n${asm(top)}`);
};
measure(code, 'main');
const total = rows.reduce((a, r) => a + r.bytes, 0), moveT = rows.reduce((a, r) => a + r.move, 0);
console.log(`total ${code.length} B; movement ${moveT} B`);
rows.sort((a, b) => b.move - a.move).forEach((r) => console.log(`  ${r.name.padEnd(18)} ${String(r.bytes).padStart(5)} B   movement ${String(r.move).padStart(5)} B (${(100 * r.move / r.bytes).toFixed(0)}%)`));
