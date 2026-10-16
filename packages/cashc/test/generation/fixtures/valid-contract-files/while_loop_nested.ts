import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'WhileLoopNested',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode:
        // int i = 0;
        'OP_0 '
        // int total = 0;
        + 'OP_0 '
        // while (i < 2) {: test once on entry
        + 'OP_OVER OP_2 OP_LESSTHAN OP_IF OP_BEGIN '
        // int j = 0;
        + 'OP_0 '
        // while (j < 2) {: test once on entry
        + 'OP_DUP OP_2 OP_LESSTHAN OP_IF OP_BEGIN '
        // total = total + 1;
        + 'OP_SWAP OP_1ADD OP_SWAP '
        // j = j + 1;
        + 'OP_1ADD '
        // Loop condition, re-tested at the bottom
        + 'OP_DUP OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_ENDIF '
        // i = i + 1;
        + 'OP_ROT OP_1ADD '
        // Cleanup, then the loop condition, re-tested at the bottom
        + 'OP_NIP OP_TUCK OP_2 OP_GREATERTHANOREQUAL OP_UNTIL OP_ENDIF '
        // require(i == 2);
        + 'OP_SWAP OP_2 OP_NUMEQUALVERIFY '
        // require(total == 4);
        + 'OP_4 OP_NUMEQUAL',
      fingerprint: 'ee9fb1e5dbed15ffacf0d269513458899a727d2c875c7a9c2c50cb057ee0d521',
      debug: {
        bytecode: '000078529f63650076529f63657c8b7c8b7652a266687b8b777d52a266687c529d549c',
        sourceMap: '3:16:3:17;4:20:4:21;6:15:6:16;:19::20;:15:::1;:22:15:9:0;:8;7:20:7:21;9:19:9:20;:23::24;:19:::1;:26:12:13:0;:12;10:16:10:34:1;;;11::11:26;9:19:9:20:0;:23::24;:12:12:13:1;;:26;14:12:14:22;;6:22:15:9;:15:::0;:19:6:20;:8:15:9:1;;:22;17:16:17:17:0;:21::22;:8::24:1;18:25:18:26:0;:8::28:1',
        logs: [],
        requires: [{ ip: 32, line: 17 }, { ip: 35, line: 18 }],
        sourceTags: '17:21:lc;25:29:lc',
      },
    },
  },
];
