import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForLoopBasic',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_0 OP_BEGIN OP_TUCK OP_ADD OP_SWAP OP_1ADD OP_DUP OP_3 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_3 OP_NUMEQUAL',
      debug: {
        bytecode: '0000657d937c8b7653a26675539c',
        sourceMap: '3:18:3:19;5:21:5:22;:8:7:9;6:18:6:25;::::1;5:31:5:32:0;:::34:1;:24::25:0;:28::29;:8:7:9:1;;;9:23:9:24:0;:8::26:1',
        logs: [],
        requires: [{ ip: 14, line: 9 }],
        sourceTags: '5:6:fu;7:10:lc;11:11:sc',
      },
      fingerprint: '68d43f8660481be307afdb4a11e6f5df4763fd5808e4ccc2ef1e23ca8aa35e3f',
    },
  },
  {
    // The same contract with loop inversion disabled: the condition is tested at the top of every
    // iteration and carried over the body on the altstack
    compilerOptions: { loopInversion: false },
    artifact: {
      contractName: 'ForLoopBasic',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_0 OP_BEGIN OP_DUP OP_3 OP_LESSTHAN OP_DUP OP_TOALTSTACK OP_IF OP_TUCK OP_ADD OP_SWAP OP_1ADD OP_ENDIF OP_FROMALTSTACK OP_NOT OP_UNTIL OP_DROP OP_3 OP_NUMEQUAL',
      debug: {
        bytecode: '00006576539f766b637d937c8b686c916675539c',
        sourceMap: '3:18:3:19;5:21:5:22;:8:7:9;:24:5:25;:28::29;:24:::1;;;:36:7:9:0;6:18:6:25;::::1;5:31:5:32:0;:::34:1;:36:7:9;;:8;;;9:23:9:24:0;:8::26:1',
        logs: [],
        requires: [{ ip: 20, line: 9 }],
        sourceTags: '11:12:fu;13:16:lc;17:17:sc',
      },
      fingerprint: '608a42190ad560bd0ce1713235e27d9073777104f1746ef34a5d4e6bcba2bf0f',
    },
  },
];
