// Mutation red-team for a compiled singleton: every single-push mutation of the valid
// unlocking bytecode (public inputs and proof coordinates) must be rejected.
// Usage (cwd C:/Users/mathi/Desktop/verifier):
//   npx tsx --max-old-space-size=8192 <this> <dist internal.js> <bn254|bls> ['<json options>']
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  hexToBin, decodeAuthenticationInstructions, encodeAuthenticationInstruction, encodeDataPush,
  vmNumberToBigInt, bigIntToVmNumber,
} from '@bitauth/libauth';

const { evaluatePair, createLoosenedVm } = await import(pathToFileURL('C:/Users/mathi/Desktop/verifier/src/harness/vm.ts').href);
const [compilerPath, curve = 'bn254', extra = '{}'] = process.argv.slice(2);
const cashc: any = await import(pathToFileURL(compilerPath).href);
const C = curve === 'bls'
  ? { file: 'C:/Users/mathi/Desktop/groth16_contract/singleton/bls12-381/groth16.cash', vec: 'C:/Users/mathi/Desktop/verifier/src/bch/groth16-bls12381-singleton-vectors.json' }
  : { file: 'C:/Users/mathi/Desktop/groth16_contract/singleton/bn254/groth16.cash', vec: 'C:/Users/mathi/Desktop/verifier/src/bch/groth16-singleton-vectors.json' };
const art = cashc.compileFile(C.file, { rescheduleStacks: true, ...JSON.parse(extra) });
const lock = hexToBin(art.debug.bytecode);
const v = JSON.parse(readFileSync(C.vec, 'utf8'));
const vm = createLoosenedVm();
const run = (unl: Uint8Array) => evaluatePair(vm as any, lock, unl, undefined, {
  index: 0, inputs: [{ lockingBytecode: lock, unlockingBytecode: unl, valueSatoshis: 1000n, sequenceNumber: 0 }],
} as any, undefined) as any;

const valid = hexToBin(v.unlocking);
if (!run(valid).accepted) throw new Error('valid proof rejected');
const ins = decodeAuthenticationInstructions(valid) as any[];
const encode = (list: any[]) => {
  const parts = list.map((x) => encodeAuthenticationInstruction(x));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
};
let tried = 0; let accepted = 0;
const acceptedAt: number[] = [];
ins.forEach((x, k) => {
  if (x.data === undefined && !(x.opcode >= 0x51 && x.opcode <= 0x60) && x.opcode !== 0) return;
  const variants: Uint8Array[] = [];
  let value: bigint | undefined;
  try {
    const data = x.data ?? (x.opcode === 0 ? new Uint8Array() : Uint8Array.of(x.opcode - 0x50));
    const n = vmNumberToBigInt(data, { requireMinimalEncoding: false, maximumVmNumberByteLength: 1e6 } as any);
    value = typeof n === 'bigint' ? n : undefined;
  } catch { value = undefined; }
  if (value !== undefined) {
    variants.push(bigIntToVmNumber(value + 1n), bigIntToVmNumber(value - 1n));
  }
  if (x.data !== undefined && x.data.length > 0) {
    const flipped = Uint8Array.from(x.data); flipped[0] ^= 0x01; variants.push(flipped);
  }
  variants.forEach((data) => {
    const mutated = [...ins];
    mutated[k] = decodeAuthenticationInstructions(encodeDataPush(data))[0];
    tried += 1;
    if (run(encode(mutated)).accepted) { accepted += 1; acceptedAt.push(k); }
  });
});
const invalid = run(hexToBin(v.invalidUnlocking));
console.log(JSON.stringify({ curve, options: extra, pushes: ins.length, mutants: tried, mutantsAccepted: accepted, acceptedAt, invalidRejected: !invalid.accepted, lockingBytes: lock.length }));
