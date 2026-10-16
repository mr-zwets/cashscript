import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    // A for-loop init that reassigns an existing variable replaces that variable's stack slot, so the loop's
    // final value is what the require after the loop reads (the loop's cleanup does not drop it)
    artifact: {
      contractName: 'ForLoopReassignedInit',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [{ name: 'n', type: 'int' }] }],
      bytecode:
        // int i = 0;
        'OP_0 '
        // for (i = 0; i < n; i++) {: test once on entry
        + 'OP_DROP OP_0 OP_2DUP OP_GREATERTHAN OP_IF OP_BEGIN '
        // require(tx.outputs[i].value >= 1000);
        + 'OP_DUP OP_OUTPUTVALUE e803 OP_GREATERTHANOREQUAL OP_VERIFY '
        // For loop update
        + 'OP_1ADD '
        // Loop condition, re-tested at the bottom
        + 'OP_2DUP OP_LESSTHANOREQUAL OP_UNTIL OP_ENDIF '
        // require(i == tx.outputs.length);
        + 'OP_TXOUTPUTCOUNT OP_NUMEQUAL '
        // Cleanup
        + 'OP_NIP',
      fingerprint: '8ce675d08696a00a5316e52f605030fa80571c20f5dc9c0643bbda34ab345bf1',
      debug: {
        bytecode: '0075006ea0636576cc02e803a2698b6ea16668c49c77',
        sourceMap: '3:16:3:17;5:13:5:18:1;;:20::25:0;::::1;:32:7:9:0;:8;6:31:6:32;:20::39:1;:43::47:0;:20:::1;:12::49;5:27:5:30;:20::25:0;:8:7:9:1;;:32;9:21:9:38:0;:8::40:1;2:26:10:5',
        logs: [],
        requires: [
          { ip: 11, line: 6 },
          { ip: 19, line: 9 },
        ],
        sourceTags: '12:12:fu;13:16:lc;19:19:sc',
      },
    },
  },
];
