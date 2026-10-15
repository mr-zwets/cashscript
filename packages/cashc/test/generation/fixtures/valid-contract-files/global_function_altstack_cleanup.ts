import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'GlobalFunctionAltStackCleanup',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'x', type: 'int' }],
        },
      ],
      bytecode: 'OP_2 OP_1 OP_0 OP_0 OP_4 OP_ROLL OP_0 OP_GREATERTHAN OP_IF OP_NIP OP_OVER OP_SWAP OP_3 OP_PICK OP_NIP OP_ELSE OP_3 OP_PICK OP_NIP OP_NIP OP_OVER OP_ENDIF OP_ROT OP_DROP OP_ROT OP_DROP OP_SWAP OP_1 OP_NUMEQUALVERIFY OP_2 OP_NUMEQUAL',
      fingerprint: '574858fb58109daca5650ed77581830df4425b0c700481d22dab76a2c19b0d8a',
      debug: {
        bytecode: '52510000547a00a06377787c537977675379777778687b757b757c519d529c',
        sourceMap: '16:40:16:41;:37::38;:25::45:1;;;;;;;;;;;;;;;;;;;;;;;;17:16:17:18:0;:22::23;:8::43:1;18:22:18:23:0;:8::43:1',
        logs: [],
        requires: [
          {
            ip: 28,
            line: 17,
            message: 'lo should be 1',
          },
          {
            ip: 31,
            line: 18,
            message: 'hi should be 2',
          },
        ],
        functions: [
          {
            name: 'orderedPair',
            inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }, { name: 'c', type: 'int' }],
            bytecode: '0000547a00a06377787c537977675379777778687b757b75',
            sourceMap: '2:13:2:14;3::3;4:8:4:9;;:12::13;:8:::1;:15:7:5:0;5:8:5:15:1;;;6:13:6:14:0;;:8::15:1;7:11:10:5:0;8:13:8:14;;:8:9:15:1;;9;7:11:10:5;1:61:12:1;;;',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '2:25:orderedPair',
      },
    },
  },
];
