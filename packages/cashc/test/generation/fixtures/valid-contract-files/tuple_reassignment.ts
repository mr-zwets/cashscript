import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    // Tuple destructuring into existing variables: top-level renames (with the small helpers
    // inlined at the call sites), and pure, mixed and interleaved reassignment in loops, where the
    // reassigned values are renamed on top and each iteration restores the loop's layout once.
    artifact: {
      contractName: 'TupleReassignment',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'seed', type: 'int' }],
        },
      ],
      bytecode: '7d5279537a958b OP_0 OP_DEFINE OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_ROT OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_0 OP_INVOKE OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_ROT OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_0 OP_INVOKE OP_SWAP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_ROT OP_1ADD OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: '5ee4c4b50ac37ac0a392dd1c4bed960f40033a868453646b4ccd56ff062b7b70',
      debug: {
        bytecode: '077d5279537a958b0089768b6e7c6e7c007b727c537a657c7b7b8b7654a266757b7b007b727c537a657c7b008a00a2697b8b7654a266757b7b007b727c537a657c7b008a7c00a2697b8b7652a266757b7b6e7b7b937b939300a2696d6d51',
        sourceMap: '11::13:1;;::::1;17:16:18:20:0;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;;;;;;28:29:28:30;:26::27;27:35:27:36;:::40:1;:24::25:0;:28::29;:8:29:9:1;;;;;33:21:33:22:0;:8:36:9;;;;;;34:37:34:38;:34::35;:29::39:1;;35:26:35:27:0;:20:::1;:12::29;33:35:33:36:0;:::40:1;:24::25:0;:28::29;:8:36:9:1;;;;;40:21:40:22:0;:8:43:9;;;;;;41:37:41:38;:34::35;:29::39:1;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:35:40:36:0;:::40:1;:24::25:0;:28::29;:8:43:9:1;;;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [{ ip: 40, line: 35 }, { ip: 64, line: 42 }, { ip: 83, line: 48 }],
        sourceTags: '18:19:fu;20:23:lc;24:24:sc;41:42:fu;43:46:lc;47:47:sc;65:66:fu;67:70:lc;71:71:sc',
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
  // The same contract with reassignments in branches and loops forced to the 'replace' strategy
  // which re-inserts every new value at its variable's slot (see emitReplace)
  {
    // Tuple destructuring into existing variables: top-level renames (with the small helpers
    // inlined at the call sites), pure and mixed reassignment in loops, and the interleaved
    // order that parks a declaration value on the altstack mid-fold.
    compilerOptions: { scopedReassignment: 'replace' },
    artifact: {
      contractName: 'TupleReassignment',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'seed', type: 'int' }],
        },
      ],
      bytecode: '7d5279537a958b OP_0 OP_DEFINE OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_TOALTSTACK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_0 OP_INVOKE OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_FROMALTSTACK OP_TOALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: 'bc2175b10bfcdc6cd5d0d37eecff884755f86a2bcfa655746318361c5d58b527',
      debug: {
        bytecode: '077d5279537a958b0089768b6e7c6e7c006553795279557a757c6b7c727b6c7b757c8b7654a26675006553795279008a6b557a757c6b7c727b6c7b757c6c7600a2697c8b777654a26675006553795279008a567a757c6b7c6b7c727b6c6c6b7b757c6c7600a2697c8b777652a266756e7b7b937b939300a2696d6d51',
        sourceMap: '11::13:1;;::::1;17:16:18:20:0;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;28:29:28:30;;:26::27;;:12::32:1;;;;;;;;;;;;27:31:27:40;:24::25:0;:28::29;:8:29:9:1;;;33:21:33:22:0;:8:36:9;34:37:34:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;35:20:35:22:0;:26::27;:20:::1;:12::29;33:31:33:40;;::36:9;:24:33:25:0;:28::29;:8:36:9:1;;;40:21:40:22:0;:8:43:9;41:37:41:38;;:34::35;;:29::39:1;;:12::40;;;;;;;;;;;;;;;;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:31:40:40;;::43:9;:24:40:25:0;:28::29;:8:43:9:1;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [{ ip: 58, line: 35 }, { ip: 95, line: 42 }, { ip: 113, line: 48 }],
        sourceTags: '27:27:fu;28:31:lc;32:32:sc;59:61:fu;62:65:lc;66:66:sc;96:98:fu;99:102:lc;103:103:sc',
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
