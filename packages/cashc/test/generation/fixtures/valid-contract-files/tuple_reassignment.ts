import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    // Tuple destructuring into existing variables: top-level renames (with the small helpers
    // inlined at the call sites), pure and mixed reassignment in loops, and the interleaved
    // order that parks a declaration value on the altstack mid-fold.
    artifact: {
      contractName: 'TupleReassignment',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'seed', type: 'int' }],
        },
      ],
      bytecode: '7d5279537a958b OP_0 OP_DEFINE OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_BEGIN OP_DUP OP_4 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_1ADD OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_DUP OP_4 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_TOALTSTACK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_DUP OP_2 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_FROMALTSTACK OP_TOALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: '19e09ec6c2f78aee7551a65db37fb72913b7c0ebb75409f6a921be040aeb1eb2',
      debug: {
        bytecode: '077d5279537a958b0089768b6e7c6e7c006576549f766b6353795279557a757c6b7c727b6c7b757c8b686c916675006576549f766b6353795279008a6b557a757c6b7c727b6c7b757c6c7600a2697c8b77686c916675006576529f766b6353795279008a567a757c6b7c6b7c727b6c6c6b7b757c6c7600a2697c8b77686c9166756e7b7b937b939300a2696d6d51',
        sourceMap: '11::13:1;;::::1;17:16:18:20:0;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;:24:27:25;:28::29;:24:::1;;;:42:29:9:0;28:29:28:30;;:26::27;;:12::32:1;;;;;;;;;;;;27:31:27:40;:42:29:9;;:8;;;33:21:33:22:0;:8:36:9;:24:33:25;:28::29;:24:::1;;;:42:36:9:0;34:37:34:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;35:20:35:22:0;:26::27;:20:::1;:12::29;33:31:33:40;;::36:9;:42;;:8;;;40:21:40:22:0;:8:43:9;:24:40:25;:28::29;:24:::1;;;:42:43:9:0;41:37:41:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;;;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:31:40:40;;::43:9;:42;;:8;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [{ ip: 70, line: 35 }, { ip: 113, line: 42 }, { ip: 131, line: 48 }],
        sourceTags: '33:33:fu;34:37:lc;38:38:sc;71:73:fu;74:77:lc;78:78:sc;114:116:fu;117:120:lc;121:121:sc',
        functions: [
          {
            id: 0,
            name: 'step',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '7d5279537a958b',
            sourceMap: '12:11:12:15;:17::18;;:21::22;;:17:::1;:::26',
            logs: [],
            requires: [],
          },
          {
            name: 'swap',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '',
            sourceMap: '',
            logs: [],
            requires: [],
          },
        ],
      },
    },
  },
];
