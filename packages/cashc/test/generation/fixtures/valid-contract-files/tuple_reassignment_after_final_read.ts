import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ReassignAfterFinalRead',
      constructorInputs: [],
      abi: [
        {
          name: 'ifBranch',
          inputs: [{ name: 'x', type: 'int' }],
        },
        {
          name: 'whileLoop',
          inputs: [{ name: 'x', type: 'int' }],
        },
      ],
      bytecode: 'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_10 OP_0 OP_OVER OP_10 OP_NUMEQUALVERIFY OP_3 OP_PICK OP_1 OP_NUMEQUAL OP_IF OP_3 OP_PICK OP_DUP OP_2 OP_MUL OP_SWAP OP_1ADD OP_ROT OP_DROP OP_ROT OP_DROP OP_ENDIF OP_DUP OP_0 OP_NUMEQUAL OP_SWAP OP_2 OP_NUMEQUAL OP_BOOLOR OP_NIP OP_NIP OP_NIP OP_ELSE OP_1 OP_NUMEQUALVERIFY OP_10 OP_0 OP_OVER OP_10 OP_NUMEQUALVERIFY OP_ROT OP_DUP OP_1 OP_NUMEQUAL OP_IF OP_BEGIN OP_DUP OP_DUP OP_2 OP_MUL OP_SWAP OP_1ADD OP_ROT OP_1ADD OP_3 OP_ROLL OP_DROP OP_3 OP_ROLL OP_DROP OP_DUP OP_1 OP_NUMNOTEQUAL OP_UNTIL OP_ENDIF OP_ROT OP_ROT OP_DUP OP_0 OP_NUMEQUAL OP_SWAP OP_2 OP_NUMEQUAL OP_BOOLOR OP_NIP OP_NIP OP_ENDIF',
      fingerprint: '83f2acc950f5748e46e46cc001656b01e6a3105d5f3ae90566bb0dd7db1c58e3',
      debug: {
        bytecode: '76009c635a00785a9d5379519c6353797652957c8b7b757b756876009c7c529c9b77777767519d5a00785a9d7b76519c6365767652957c8b7b8b537a75537a7576519e66687b7b76009c7c529c9b777768',
        sourceMap: '11:4:19:5;;;;12:16:12:18;13::13:17;14::14;:21::23;:8::25:1;15:12:15:13:0;;:17::18;:12:::1;:20:17:9:0;16:26:16:27;;:21::28:1;;;;;15:20:17:9;;;;;18:16:18:17:0;:21::22;:16:::1;:26::27:0;:31::32;:26:::1;:8::34;11:29:19:5;;;:4;21::30::0;;22:16:22:18;23::23:17;24::24;:21::23;:8::25:1;25::28:9:0;:15:25:16;:20::21;:15:::1;:23:28:9:0;:8;26:26:26:27;:21::28:1;;;;;27:16:27:17:0;:::21:1;25:23:28:9;;;;;;:15:25:16:0;:20::21;:8:28:9:1;;:23;:8;;29:16:29:17:0;:21::22;:16:::1;:26::27:0;:31::32;:26:::1;:8::34;21:30:30:5;;10:0:31:1',
        logs: [],
        requires: [
          {
            ip: 8,
            line: 14,
          },
          {
            ip: 33,
            line: 18,
          },
          {
            ip: 43,
            line: 24,
          },
          {
            ip: 78,
            line: 29,
          },
        ],
        sourceTags: '33:35:sc;64:68:lc;78:79:sc',
        functions: [
          {
            name: 'pair',
            inputs: [{ name: 'n', type: 'int' }],
            bytecode: '7652957c8b',
            sourceMap: '7:11:7:12;:15::16;:11:::1;:18::19:0;:::23:1',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '16:20:pair;51:55:pair',
      },
    },
  },
];
