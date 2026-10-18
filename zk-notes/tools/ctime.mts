// Sequential compile-time measurement: npx tsx ctime.mts <dist internal.js> <curve> '<json>' ['<json>' ...]
import { pathToFileURL } from 'node:url';
import { hexToBin } from '@bitauth/libauth';

const [compilerPath, curve, ...configs] = process.argv.slice(2);
const cashc: any = await import(pathToFileURL(compilerPath).href);
const file = curve === 'bls'
  ? 'C:/Users/mathi/Desktop/groth16_contract/singleton/bls12-381/groth16.cash'
  : 'C:/Users/mathi/Desktop/groth16_contract/singleton/bn254/groth16.cash';
for (const cfg of configs) {
  const t = Date.now();
  const art = cashc.compileFile(file, { rescheduleStacks: true, ...JSON.parse(cfg) });
  console.log(JSON.stringify({ curve, cfg, secs: (Date.now() - t) / 1000, bytes: hexToBin(art.debug.bytecode).length }));
}
