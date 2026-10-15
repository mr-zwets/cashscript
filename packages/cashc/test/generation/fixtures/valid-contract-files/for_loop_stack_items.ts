import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForLoopBasic',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_1 OP_1 OP_0 OP_BEGIN OP_DUP OP_3 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_ROLL OP_OVER OP_ADD OP_SWAP OP_1ADD OP_SWAP OP_2SWAP OP_3 OP_ROLL OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_ROT OP_3 OP_NUMEQUALVERIFY OP_SWAP OP_1 OP_NUMEQUALVERIFY OP_1 OP_NUMEQUAL',
      debug: {
        bytecode: '005151006576539f766b63537a78937c8b7c72537a686c9166757b539d7c519d519c',
        sourceMap: '3:18:3:19;4:16:4:17;5::5;7:21:7:22;:8:9:9;:24:7:25;:28::29;:24:::1;;;:39:9:9:0;8:18:8:21;;:24::25;:18:::1;7:31:7:32:0;:::37:1;:39:9:9;;;;;;:8;;;11:16:11:19:0;:23::24;:8::26:1;12:16:12:17:0;:21::22;:8::24:1;13:21:13:22:0;:8::24:1',
        logs: [],
        requires: [{ ip: 28, line: 11 }, { ip: 31, line: 12 }, { ip: 34, line: 13 }],
        sourceTags: '15:16:fu;21:24:lc;25:25:sc',
      },
      fingerprint: '791288914542ed2c6199e5d150f4fa6db22d340ef68da6e8e341d510ff9cfa69',
    },
  },
];
