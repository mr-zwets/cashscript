// Debug helper: print the require() entries of a small contract and the source-map location of
// the element each one points at, with and without VERIFY sinks.
import { compileString } from 'file:///C:/Users/mathi/Desktop/cashscript-zk/packages/cashc/src/index.ts';
import { sourceMapToLocationData, bytecodeToScript } from 'file:///C:/Users/mathi/Desktop/cashscript-zk/packages/utils/src/index.ts';
import { hexToBin } from '@bitauth/libauth';

const SRC = `
function divmod(int a, int b) returns (int, int) {
  return a / b, a % b;
}

contract Test() {
  function spend(int x) {
    int q, int r = divmod(x, 3);
    require(q == 4, "quotient should be 4");
    require(r == 1, "remainder should be 1");
  }
}
`;
for (const verifySinks of [false, true]) {
  const art = compileString(SRC, { rescheduleStacks: true, verifySinks } as never);
  const script = bytecodeToScript(hexToBin(art.debug!.bytecode));
  const loc = sourceMapToLocationData(art.debug!.sourceMap);
  console.log('verifySinks', verifySinks, art.bytecode);
  art.debug!.requires.forEach((r) => console.log('  require', r, 'op', script[r.ip], 'loc', JSON.stringify(loc[r.ip]?.location)));
}
