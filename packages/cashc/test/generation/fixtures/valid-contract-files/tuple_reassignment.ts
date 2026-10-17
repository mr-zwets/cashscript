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
      bytecode: 'OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_ROT OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_TUCK OP_2 OP_PICK OP_3 OP_ROLL OP_MUL OP_1ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_ROT OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_SWAP OP_ROT OP_TUCK OP_2 OP_PICK OP_3 OP_ROLL OP_MUL OP_1ADD OP_SWAP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_ROT OP_1ADD OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_ROT OP_ROT OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: 'fc68e34e3223f32e4824bd5d637065b5301a7a7cedce5e2041c8a37dffda9839',
      debug: {
        bytecode: '768b6e7c6e7c007b727c537a657c7b7b8b7654a266757b7b007b727c537a657c7b7d5279537a958b00a2697b8b7654a266757b7b007b727c537a657c7b7d5279537a958b7c00a2697b8b7652a266757b7b6e7b7b937b939300a2696d6d51',
        sourceMap: '17:16:18:20;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;;;;;;28:29:28:30;:26::27;27:35:27:36;:::40:1;:24::25:0;:28::29;:8:29:9:1;;;;;33:21:33:22:0;:8:36:9;;;;;;34:37:34:38;:34::35;:29::39:1;;;;;;;35:26:35:27:0;:20:::1;:12::29;33:35:33:36:0;:::40:1;:24::25:0;:28::29;:8:36:9:1;;;;;40:21:40:22:0;:8:43:9;;;;;;41:37:41:38;:34::35;:29::39:1;;;;;;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:35:40:36:0;:::40:1;:24::25:0;:28::29;:8:43:9:1;;;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [
          {
            ip: 42,
            line: 35,
          },
          {
            ip: 71,
            line: 42,
          },
          {
            ip: 90,
            line: 48,
          },
        ],
        sourceTags: '15:16:fu;17:20:lc;21:21:sc;43:44:fu;45:48:lc;49:49:sc;72:73:fu;74:77:lc;78:78:sc',
        functions: [
          {
            name: 'swap',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '',
            sourceMap: '',
            logs: [],
            requires: [],
          },
          {
            name: 'step',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '7d5279537a958b',
            sourceMap: '12:11:12:15;:17::18;;:21::22;;:17:::1;:::26',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '33:39:step;61:67:step',
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
      bytecode: 'OP_DUP OP_1ADD OP_2DUP OP_SWAP OP_2DUP OP_SWAP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_1ADD OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_TUCK OP_2 OP_PICK OP_3 OP_ROLL OP_MUL OP_1ADD OP_TOALTSTACK OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_DUP OP_4 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_0 OP_BEGIN OP_3 OP_PICK OP_2 OP_PICK OP_TUCK OP_2 OP_PICK OP_3 OP_ROLL OP_MUL OP_1ADD OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_FROMALTSTACK OP_TOALTSTACK OP_ROT OP_DROP OP_SWAP OP_FROMALTSTACK OP_DUP OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_1ADD OP_NIP OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_2DUP OP_ROT OP_ROT OP_ADD OP_ROT OP_ADD OP_ADD OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_2DROP OP_2DROP OP_1',
      fingerprint: '0081679d1e7f6d440a0bb76cb33cf8af282b7d401babca040e2e6e1e448c8b27',
      debug: {
        bytecode: '768b6e7c6e7c006553795279557a757c6b7c727b6c7b757c8b7654a266750065537952797d5279537a958b6b557a757c6b7c727b6c7b757c6c7600a2697c8b777654a266750065537952797d5279537a958b567a757c6b7c6b7c727b6c6c6b7b757c6c7600a2697c8b777652a266756e7b7b937b939300a2696d6d51',
        sourceMap: '17:16:18:20;18:::24:1;21:22:21:26:0;;24:26:24:30;;27:21:27:22;:8:29:9;28:29:28:30;;:26::27;;:12::32:1;;;;;;;;;;;;27:31:27:40;:24::25:0;:28::29;:8:29:9:1;;;33:21:33:22:0;:8:36:9;34:37:34:38;;:34::35;;:29::39:1;;;;;;;:12::40;;;;;;;;;;;;;;35:20:35:22:0;:26::27;:20:::1;:12::29;33:31:33:40;;::36:9;:24:33:25:0;:28::29;:8:36:9:1;;;40:21:40:22:0;:8:43:9;41:37:41:38;;:34::35;;:29::39:1;;;;;;;:12::40;;;;;;;;;;;;;;;;;42:20:42:22:0;:26::27;:20:::1;:12::29;40:31:40:40;;::43:9;:24:40:25:0;:28::29;:8:43:9:1;;;46:24:46:28:0;48:16:48:17;:20::21;:16:::1;:24::25:0;:16:::1;:::29;:33::34:0;:16:::1;:8::36;16:29:49:5;;',
        logs: [],
        requires: [
          {
            ip: 60,
            line: 35,
          },
          {
            ip: 102,
            line: 42,
          },
          {
            ip: 120,
            line: 48,
          },
        ],
        sourceTags: '24:24:fu;25:28:lc;29:29:sc;61:63:fu;64:67:lc;68:68:sc;103:105:fu;106:109:lc;110:110:sc',
        functions: [
          {
            name: 'swap',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '',
            sourceMap: '',
            logs: [],
            requires: [],
          },
          {
            name: 'step',
            inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
            bytecode: '7d5279537a958b',
            sourceMap: '12:11:12:15;:17::18;;:21::22;;:17:::1;:::26',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '36:42:step;75:81:step',
      },
    },
  },
];
