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
      bytecode: '7652957c8b OP_0 OP_DEFINE OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_10 OP_0 OP_OVER OP_10 OP_NUMEQUALVERIFY OP_3 OP_PICK OP_1 OP_NUMEQUAL OP_IF OP_3 OP_PICK OP_0 OP_INVOKE OP_ROT OP_DROP OP_SWAP OP_ROT OP_DROP OP_SWAP OP_ENDIF OP_DUP OP_0 OP_NUMEQUAL OP_SWAP OP_2 OP_NUMEQUAL OP_BOOLOR OP_NIP OP_NIP OP_NIP OP_ELSE OP_1 OP_NUMEQUALVERIFY OP_10 OP_0 OP_OVER OP_10 OP_NUMEQUALVERIFY OP_BEGIN OP_2 OP_PICK OP_1 OP_NUMEQUAL OP_DUP OP_TOALTSTACK OP_IF OP_2 OP_PICK OP_0 OP_INVOKE OP_ROT OP_DROP OP_SWAP OP_ROT OP_DROP OP_SWAP OP_ROT OP_1ADD OP_ROT OP_ROT OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DUP OP_0 OP_NUMEQUAL OP_SWAP OP_2 OP_NUMEQUAL OP_BOOLOR OP_NIP OP_NIP OP_ENDIF',
      fingerprint: '382367f783df42e6108aa0ea232619c80553def6ba3966bba21a87e983b34bab',
      debug: {
        bytecode: '057652957c8b008976009c635a00785a9d5379519c635379008a7b757c7b757c6876009c7c529c9b77777767519d5a00785a9d655279519c766b635279008a7b757c7b757c7b8b7b7b686c916676009c7c529c9b777768',
        sourceMap: '6::8:1;;::::1;11:4:19:5:0;;;;12:16:12:18;13::13:17;14::14;:21::23;:8::25:1;15:12:15:13:0;;:17::18;:12:::1;:20:17:9:0;16:26:16:27;;:21::28:1;;:12::29;;;;;;15:20:17:9;18:16:18:17:0;:21::22;:16:::1;:26::27:0;:31::32;:26:::1;:8::34;11:29:19:5;;;:4;21::30::0;;22:16:22:18;23::23:17;24::24;:21::23;:8::25:1;25::28:9:0;:15:25:16;;:20::21;:15:::1;;;:23:28:9:0;26:26:26:27;;:21::28:1;;:12::29;;;;;;27::27:22;;;;25:23:28:9;;:8;;29:16:29:17:0;:21::22;:16:::1;:26::27:0;:31::32;:26:::1;:8::34;21:30:30:5;;10:0:31:1',
        logs: [],
        requires: [{ ip: 11, line: 14 }, { ip: 35, line: 18 }, { ip: 45, line: 24 }, { ip: 79, line: 29 }],
        sourceTags: '35:37:sc;68:71:lc;79:80:sc',
        functions: [
          {
            id: 0,
            name: 'pair',
            inputs: [{ name: 'n', type: 'int' }],
            bytecode: '7652957c8b',
            sourceMap: '7:11:7:12;:15::16;:11:::1;:18::19:0;:::23:1',
            logs: [],
            requires: [],
          },
        ],
      },
    },
  },
];
