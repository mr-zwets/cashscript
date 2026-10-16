import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    // A global function returning a variable that a for-loop init reassigned returns the loop's final value
    artifact: {
      contractName: 'GlobalFunctionForLoopReassignedInit',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [{ name: 'n', type: 'int' }] }],
      bytecode:
        // require(count(n) == n), with count(n) spliced in:
        'OP_DUP '
        // int i = 0;
        + 'OP_0 '
        // for (i = 0; i < n; i++) {: test once on entry
        + 'OP_DROP OP_0 OP_2DUP OP_GREATERTHAN OP_IF OP_BEGIN '
        // require(i < 10);
        + 'OP_DUP OP_10 OP_LESSTHAN OP_VERIFY '
        // For loop update
        + 'OP_1ADD '
        // Loop condition, re-tested at the bottom
        + 'OP_2DUP OP_LESSTHANOREQUAL OP_UNTIL OP_ENDIF '
        // return i;
        + 'OP_NIP '
        // == n
        + 'OP_NUMEQUAL',
      fingerprint: 'ea6ed974a07bc4e7edb4851d1f1c254fe445102e131dad2b9fa88a2c47d9309a',
      debug: {
        bytecode: '760075006ea06365765a9f698b6ea16668779c',
        sourceMap: '13:22:13:23;:16::24:1;;;;;;;;;;;;;;;;;:8::31',
        logs: [],
        requires: [
          { ip: 11, line: 13 },
          { ip: 19, line: 13 },
        ],
        sourceTags: '12:12:fu;13:16:lc;17:17:sc',
        functions: [
          {
            name: 'count',
            inputs: [{ name: 'n', type: 'int' }],
            bytecode: '0075006ea06365765a9f698b6ea1666877',
            sourceMap: '2:12:2:13;4:9:4:14:1;;:16::21:0;::::1;:28:6:5:0;:4;5:16:5:17;:20::22;:16:::1;:8::24;4:23:4:26;:16::21:0;:4:6:5:1;;:28;1:36:9:1',
            sourceTags: '11:11:fu;12:15:lc;16:16:sc',
            logs: [],
            requires: [
              { ip: 10, line: 5 },
            ],
          },
        ],
        inlineRanges: '1:17:count',
      },
    },
  },
  {
    compilerOptions: { disableInlining: true },
    artifact: {
      contractName: 'GlobalFunctionForLoopReassignedInit',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [{ name: 'n', type: 'int' }] }],
      bytecode:
        // OP_DEFINE count (id 0): the same body as the inlined variant, ending in return i (OP_NIP)
        '0075006ea06365765a9f698b6ea1666877 OP_0 OP_DEFINE '
        // require(count(n) == n)
        + 'OP_DUP OP_0 OP_INVOKE OP_NUMEQUAL',
      fingerprint: '33bcf111dab3f5359532cf1f0d54027b49f5f7a708614569d905143b953894f4',
      debug: {
        bytecode: '110075006ea06365765a9f698b6ea1666877008976008a9c',
        sourceMap: '1::9:1;;::::1;13:22:13:23:0;:16::24:1;;:8::31',
        logs: [],
        requires: [
          { ip: 7, line: 13 },
        ],
        functions: [
          {
            id: 0,
            name: 'count',
            inputs: [{ name: 'n', type: 'int' }],
            bytecode: '0075006ea06365765a9f698b6ea1666877',
            sourceMap: '2:12:2:13;4:9:4:14:1;;:16::21:0;::::1;:28:6:5:0;:4;5:16:5:17;:20::22;:16:::1;:8::24;4:23:4:26;:16::21:0;:4:6:5:1;;:28;1:36:9:1',
            sourceTags: '11:11:fu;12:15:lc;16:16:sc',
            logs: [],
            requires: [
              { ip: 10, line: 5 },
            ],
          },
        ],
      },
    },
  },
];
