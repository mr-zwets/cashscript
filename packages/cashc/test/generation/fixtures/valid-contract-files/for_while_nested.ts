import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForWhileNested',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_0 OP_BEGIN OP_0 OP_SWAP OP_ROT OP_ROT OP_DUP OP_2 OP_LESSTHAN OP_IF OP_BEGIN OP_SWAP OP_2 OP_PICK OP_ADD OP_OVER OP_ADD OP_SWAP OP_1ADD OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_ENDIF OP_SWAP OP_ROT OP_ROT OP_SWAP OP_1ADD OP_NIP OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_4 OP_NUMEQUAL',
      debug: {
        bytecode: '000065007c7b7b76529f63657c52799378937c8b7652a266687c7b7b7c8b777652a26675549c',
        sourceMap: '3:18:3:19;5:21:5:22;:8:13:9;6:20:6:21;8:12:12:13;;;:19:8:20;:23::24;:19:::1;:26:12:13:0;:12;9:22:9:25;:28::29;;:22:::1;:32::33:0;:22:::1;10:20:10:21:0;:::25:1;8:19:8:20:0;:23::24;:12:12:13:1;;:26;:12;;;5:31:5:40;;::13:9;:24:5:25:0;:28::29;:8:13:9:1;;;15:23:15:24:0;:8::26:1',
        logs: [
          {
            ip: 20,
            line: 11,
            data: [
              'sum:',
              { stackIndex: 1, type: 'int', ip: 20 },
              'i:',
              { stackIndex: 2, type: 'int', ip: 20 },
              'j:',
              { stackIndex: 0, type: 'int', ip: 20 },
            ],
          },
        ],
        requires: [{ ip: 38, line: 15 }],
        sourceTags: '20:24:lc;28:30:fu;31:34:lc;35:35:sc',
      },
      fingerprint: 'e8381cfd7adbd3c06cd22b82d44135a1cc465f68422772d21ef5cdcd734a8b43',
    },
  },
];
