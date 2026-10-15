import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForWhileNested',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_0 OP_BEGIN OP_DUP OP_2 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_0 OP_SWAP OP_ROT OP_ROT OP_BEGIN OP_DUP OP_2 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_SWAP OP_2 OP_PICK OP_ADD OP_OVER OP_ADD OP_SWAP OP_1ADD OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_SWAP OP_ROT OP_ROT OP_SWAP OP_1ADD OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_4 OP_NUMEQUAL',
      debug: {
        bytecode: '00006576529f766b63007c7b7b6576529f766b637c52799378937c8b686c91667c7b7b7c8b77686c916675549c',
        sourceMap: '3:18:3:19;5:21:5:22;:8:13:9;:24:5:25;:28::29;:24:::1;;;:42:13:9:0;6:20:6:21;8:12:12:13;;;;:19:8:20;:23::24;:19:::1;;;:26:12:13:0;9:22:9:25;:28::29;;:22:::1;:32::33:0;:22:::1;10:20:10:21:0;:::25:1;8:26:12:13;;:12;;;;;5:31:5:40;;::13:9;:42;;:8;;;15:23:15:24:0;:8::26:1',
        logs: [
          {
            ip: 28,
            line: 11,
            data: [
              'sum:',
              { stackIndex: 1, type: 'int', ip: 28 },
              'i:',
              { stackIndex: 2, type: 'int', ip: 28 },
              'j:',
              { stackIndex: 0, type: 'int', ip: 28 },
            ],
          },
        ],
        requires: [{ ip: 45, line: 15 }],
        sourceTags: '28:31:lc;35:37:fu;38:41:lc;42:42:sc',
      },
      fingerprint: '981e192c37e5738a6a095c14a32ff1c9ee33c167418b9a3aed3936e153d358d3',
    },
  },
];
