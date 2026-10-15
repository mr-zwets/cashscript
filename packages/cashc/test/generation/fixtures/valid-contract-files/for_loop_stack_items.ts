import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForLoopBasic',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_1 OP_1 OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_DUP OP_3 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_TUCK OP_ADD OP_SWAP OP_1ADD OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_3 OP_NUMEQUALVERIFY OP_SWAP OP_1 OP_NUMEQUALVERIFY OP_1 OP_NUMEQUAL',
      debug: {
        bytecode: '005151007b727c537a6576539f766b637d937c8b686c916675539d7c519d519c',
        sourceMap: '3:18:3:19;4:16:4:17;5::5;7:21:7:22;:8:9:9;;;;;;:24:7:25;:28::29;:24:::1;;;:39:9:9:0;8:18:8:25;::::1;7:31:7:32:0;:::37:1;:39:9:9;;:8;;;11:23:11:24:0;:8::26:1;12:16:12:17:0;:21::22;:8::24:1;13:21:13:22:0;:8::24:1',
        logs: [],
        requires: [{ ip: 26, line: 11 }, { ip: 29, line: 12 }, { ip: 32, line: 13 }],
        sourceTags: '18:19:fu;20:23:lc;24:24:sc',
      },
      fingerprint: '3ce0f828bb5da0ae1a7d038cafe8992a8ae4ce34304c08ebe389d2308cdde6ec',
    },
  },
];
