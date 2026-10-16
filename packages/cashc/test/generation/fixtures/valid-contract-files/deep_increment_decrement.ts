import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'DeepIncrementDecrement',
      constructorInputs: [],
      abi: [
        { name: 'loop', inputs: [{ name: 'budget', type: 'int' }] },
        {
          name: 'branch',
          inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }, { name: 'z', type: 'int' }],
        },
      ],
      bytecode:
        // function loop(int budget) {
        'OP_DUP OP_0 OP_NUMEQUAL OP_IF '
        // int remaining = budget;
        + 'OP_OVER '
        // int steps = 0;
        + 'OP_0 '
        // int a = 1;
        + 'OP_1 '
        // int b = 2;
        + 'OP_2 '
        // int c = 3;
        + 'OP_3 '
        // for (int i = 0; i < 3; i++) {: 0 < 3 holds, so no entry test
        // the loop head takes the order the body leaves remaining, steps and i in (all on top)
        + 'OP_0 OP_2SWAP OP_3 OP_ROLL OP_2ROT OP_5 OP_ROLL OP_BEGIN '
        // remaining = remaining - 1; (its only read consumes remaining, the new value stays on top)
        + 'OP_ROT OP_1SUB '
        // steps = steps + 1;
        + 'OP_ROT OP_1ADD '
        // i++ (which leaves the stack in the loop head order again)
        + 'OP_ROT OP_1ADD '
        // Loop condition, tested at the bottom
        + 'OP_DUP OP_3 OP_GREATERTHANOREQUAL OP_UNTIL '
        // Cleanup, and put the variables back in their original order
        + 'OP_DROP OP_4 OP_ROLL OP_4 OP_ROLL OP_4 OP_ROLL '
        // require(a + b + c == 6);
        + 'OP_ROT OP_ROT OP_ADD OP_ADD OP_6 OP_NUMEQUALVERIFY '
        // require(remaining + steps == budget);
        + 'OP_ADD OP_ROT OP_NUMEQUAL '
        // Cleanup
        + 'OP_NIP '
        // }
        + 'OP_ELSE '
        // function branch(int x, int y, int z) {
        + 'OP_1 OP_NUMEQUALVERIFY '
        // if (x > y) {
        + 'OP_2DUP OP_LESSTHAN OP_IF '
        // x = x - 1;
        + 'OP_1SUB '
        // y = y - 1;
        + 'OP_SWAP OP_1SUB '
        // z = z - 1;
        + 'OP_ROT OP_1SUB '
        // } restore the entry layout
        + 'OP_SWAP OP_ROT OP_ENDIF '
        // require(x + y + z > 0);
        + 'OP_ADD OP_ADD OP_0 OP_GREATERTHAN '
        // }
        + 'OP_ENDIF',
      debug: {
        bytecode: '76009c6378005152530072537a71557a657b8c7b8b7b8b7653a26675547a547a547a7b7b9393569d937b9c7767519d6e9f638c7c8c7b8c7c7b68939300a068',
        sourceMap: '2:4:16:5;;;;3:24:3:30;4:20:4:21;5:16:5:17;6::6;7::7;9:21:9:22;:8:12:9;;;;;;;10:24:10:33;:::37:1;11:20:11:25:0;:::29:1;9:31:9:32:0;:::34:1;:24::25:0;:28::29;:8:12:9:1;;;;;;;;;14:16:14:17:0;:20::21;:16:::1;:::25;:29::30:0;:8::32:1;15:16:15:33;:37::43:0;:8::45:1;2:30:16:5;:4;18::26::0;;19:12:19:17;::::1;:19:23:9:0;20:16:20:21:1;21::21:17:0;:::21:1;22::22:17:0;:::21:1;19:19:23:9;;;25:16:25:21;:::25;:28::29:0;:8::31:1;1:0:27:1',
        logs: [],
        requires: [{ ip: 39, line: 14 }, { ip: 43, line: 15 }, { ip: 62, line: 25 }],
        sourceTags: '21:22:fu;23:26:lc;27:27:sc;43:43:sc',
      },
      fingerprint: '7e83dd3da0afe76e4d43933f92c71611420ea20eebaa0b20f0079ef5c2c8bb4e',
    },
  },
  // The same contract with reassignments in branches and loops forced to the 'replace' strategy
  // which re-inserts every new value at its variable's slot (see emitReplace)
  {
    compilerOptions: { scopedReassignment: 'replace' },
    artifact: {
      contractName: 'DeepIncrementDecrement',
      constructorInputs: [],
      abi: [
        { name: 'loop', inputs: [{ name: 'budget', type: 'int' }] },
        {
          name: 'branch',
          inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }, { name: 'z', type: 'int' }],
        },
      ],
      bytecode:
        // function loop(int budget) {
        'OP_DUP OP_0 OP_NUMEQUAL OP_IF '
        // int remaining = budget;
        + 'OP_OVER '
        // int steps = 0;
        + 'OP_0 '
        // int a = 1;
        + 'OP_1 '
        // int b = 2;
        + 'OP_2 '
        // int c = 3;
        + 'OP_3 '
        // for (int i = 0; i < 3; i++) {: 0 < 3 holds, so no entry test
        + 'OP_0 OP_BEGIN '
        // remaining = remaining - 1;
        + 'OP_5 OP_ROLL OP_1SUB OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK OP_FROMALTSTACK '
        // steps = steps + 1;
        + 'OP_4 OP_ROLL OP_1ADD OP_SWAP OP_TOALTSTACK OP_SWAP OP_2SWAP OP_ROT OP_FROMALTSTACK '
        // i++
        + 'OP_1ADD '
        // Loop condition, tested at the bottom
        + 'OP_DUP OP_3 OP_GREATERTHANOREQUAL OP_UNTIL '
        // Cleanup
        + 'OP_DROP '
        // require(a + b + c == 6);
        + 'OP_ROT OP_ROT OP_ADD OP_ADD OP_6 OP_NUMEQUALVERIFY '
        // require(remaining + steps == budget);
        + 'OP_ADD OP_ROT OP_NUMEQUAL '
        // Cleanup
        + 'OP_NIP '
        // }
        + 'OP_ELSE '
        // function branch(int x, int y, int z) {
        + 'OP_1 OP_NUMEQUALVERIFY '
        // if (x > y) {
        + 'OP_2DUP OP_LESSTHAN OP_IF '
        // x = x - 1;
        + 'OP_1SUB '
        // y = y - 1;
        + 'OP_SWAP OP_1SUB OP_SWAP '
        // z = z - 1;
        + 'OP_ROT OP_1SUB OP_ROT OP_ROT '
        // }
        + 'OP_ENDIF '
        // require(x + y + z > 0);
        + 'OP_ADD OP_ADD OP_0 OP_GREATERTHAN '
        // }
        + 'OP_ENDIF',
      debug: {
        bytecode: '76009c6378005152530065557a8c7c6b7c6b7c727b6c6c547a8b7c6b7c727b6c8b7653a266757b7b9393569d937b9c7767519d6e9f638c7c8c7c7b8c7b7b68939300a068',
        sourceMap: '2:4:16:5;;;;3:24:3:30;4:20:4:21;5:16:5:17;6::6;7::7;9:21:9:22;:8:12:9;10:12:10:38:1;;;;;;;;;;;;11::11:30;;;;;;;;;9:31:9:34;:24::25:0;:28::29;:8:12:9:1;;;14:16:14:17:0;:20::21;:16:::1;:::25;:29::30:0;:8::32:1;15:16:15:33;:37::43:0;:8::45:1;2:30:16:5;:4;18::26::0;;19:12:19:17;::::1;:19:23:9:0;20:12:20:22:1;21::21;;;22::22;;;;19:19:23:9;25:16:25:21;:::25;:28::29:0;:8::31:1;1:0:27:1',
        logs: [],
        requires: [
          { ip: 43, line: 14 },
          { ip: 47, line: 15 },
          { ip: 67, line: 25 },
        ],
        sourceTags: '32:32:fu;33:36:lc;37:37:sc;47:47:sc',
      },
      fingerprint: '8a16c2de61eacdb78f591bff710ec026715d2376847d85d199d50c9a902f4fd9',
    },
  },
];
