import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'GlobalFunctionInControlFlow',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [{ name: 'x', type: 'int' }, { name: 'useLoop', type: 'bool' }] }],
      bytecode:
        // Implicit parameter type enforcement
        'OP_SWAP OP_0NOTEQUAL '
        // int total = 0;
        + 'OP_0 '
        // if (useLoop) {
        + 'OP_SWAP OP_IF '
        // for (int i = 0; i < 3; i = i + 1) {: 0 < 3 holds, so no entry test
        + 'OP_0 OP_BEGIN '
        // total = total + triple(x); (consumes total, the new value stays on top)
        + 'OP_SWAP OP_2 OP_PICK OP_3 OP_MUL OP_ADD '
        // For loop update (consumes i, which restores the entry layout)
        + 'OP_SWAP OP_1ADD '
        // Loop condition, tested at the bottom
        + 'OP_DUP OP_3 OP_GREATERTHANOREQUAL OP_UNTIL '
        // Cleanup
        + 'OP_DROP '
        // } else {
        + 'OP_ELSE '
        // total = triple(x);
        + 'OP_OVER OP_3 OP_MUL OP_NIP '
        // }
        + 'OP_ENDIF '
        // require(total == 9);
        + 'OP_9 OP_NUMEQUAL '
        // Cleanup
        + 'OP_NIP',
      fingerprint: '31cfcb8cfc8c47ff0a5e29bd1e574b91230b237075340a22142f5ef0d2d3c12b',
      debug: {
        bytecode: '7c92007c6300657c52795395937c8b7653a26675677853957768599c77',
        sourceMap: '6:26:6:38;;7:20:7:21;8:12:8:19;:21:12:9;9:25:9:26;:12:11:13;10:24:10:29;:39::40;;:32::41:1;;:24;9:39:9:40:0;:::44:1;:28::29:0;:32::33;:12:11:13:1;;;12:15:14:9:0;13:27:13:28;:20::29:1;;:12::30;12:15:14:9;15:25:15:26:0;:8::28:1;6:40:16:5',
        logs: [],
        requires: [{ ip: 28, line: 15 }],
        sourceTags: '0:1:pv;13:14:fu;15:18:lc;19:19:sc;28:28:sc',
        functions: [
          {
            name: 'triple',
            inputs: [{ name: 'a', type: 'int' }],
            bytecode: '5395',
            sourceMap: '2:15:2:16;:11:::1',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '10:11:triple;22:23:triple',
      },
    },
  },
];
