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
      bytecode: '7676958b7b7b OP_0 OP_DEFINE OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_BEGIN OP_DUP OP_4 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_DUP OP_1ADD OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_DUP OP_4 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_3 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_OVER OP_1ADD OP_ROT OP_DROP OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_DUP OP_2 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_TOALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_OVER OP_1ADD OP_ROT OP_DROP OP_NIP OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: '570426822fa0d3f1c7af5051078edfe435ee22e5a3650e651371c7abbce2e0aa',
      debug: {
        bytecode: '067676958b7b7b0089768b6e7c6e7c006576549f766b6353795279557a757c6b7c6b7c6b7c6c6c6c7b757c768b77686c916675006576549f766b6353795279008a567a757c6b7c6b7c6b7c6b7c6c6c6c6c537a757c6b7c6c7600a269788b7b7577686c916675006576529f766b6353795279008a567a757c6b7c6b7c6b7c6b7c6c6c6c6c6b7b757c6c7600a269788b7b7577686c9166756e7b7b937b939300a2696d6d51',
        sourceMap: '11::13:1;;::::1;17:16:18:20:0;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;:24:27:25;:28::29;:24:::1;;;:42:29:9:0;28:29:28:30;;:26::27;;:12::32:1;;;;;;;;;;;;;;;;27:35:27:36:0;:::40:1;:31;:42:29:9;;:8;;;33:21:33:22:0;:8:36:9;:24:33:25;:28::29;:24:::1;;;:42:36:9:0;34:37:34:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;;;;;;;;;;35:20:35:22:0;:26::27;:20:::1;:12::29;33:35:33:36:0;:::40:1;:31;;::36:9;:42;;:8;;;40:21:40:22:0;:8:43:9;:24:40:25;:28::29;:24:::1;;;:42:43:9:0;41:37:41:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;;;;;;;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:35:40:36:0;:::40:1;:31;;::43:9;:42;;:8;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [
          { ip: 85, line: 35 },
          { ip: 134, line: 42 },
          { ip: 154, line: 48 },
        ],
        sourceTags: '37:39:fu;40:43:lc;44:44:sc;86:90:fu;91:94:lc;95:95:sc;135:139:fu;140:143:lc;144:144:sc',
        functions: [
          {
            id: 0,
            name: 'step',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '7676958b7b7b',
            sourceMap: '12:11:12:16;;::::1;:::20;:22::23:0;:25::26',
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
