import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'UnusedModifier',
      constructorInputs: [{ name: 'salt', type: 'int' }],
      abi: [
        {
          name: 'spend',
          inputs: [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
            { name: 'zeroPadding', type: 'bytes' },
          ],
        },
      ],
      bytecode: 'OP_DROP OP_ROT OP_DROP OP_2DUP OP_ADD OP_DROP 2a OP_DROP 64 OP_DROP OP_ADD OP_5 OP_NUMEQUAL',
      fingerprint: '63c5ea2b3fc243e80628e119b8ffa9b873bf2a5aed664c8529b58d6f79116f7c',
      debug: {
        bytecode: '757b756e9375012a7501647593559c',
        sourceMap: '5:24:5:39;6:33:6:57;;7:29:7:34;::::1;:8::35;8:36:8:38:0;:8::39:1;9:23:9:26:0;:16::27:1;:::31;:35::36:0;:8::38:1',
        logs: [],
        requires: [
          { ip: 14, line: 9 },
        ],
        functions: [
          {
            name: 'pad',
            inputs: [{ name: 'value', type: 'int' }, { name: 'padding', type: 'int' }],
            bytecode: '77',
            sourceMap: '1:24:1:42',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '10:10:pad',
      },
    },
  },
  {
    // The `unused` modifier — unused parameters keep their slot in constructorInputs / abi / frame
    // inputs, but are dropped from the stack: constructor and contract function parameters in the
    // contract prologue (rolled up first if buried), locals right after their initialiser, and
    // global-function parameters in the function-body prologue.
    compilerOptions: { disableInlining: true },
    artifact: {
      contractName: 'UnusedModifier',
      constructorInputs: [{ name: 'salt', type: 'int' }],
      abi: [
        {
          name: 'spend',
          inputs: [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
            { name: 'zeroPadding', type: 'bytes' },
          ],
        },
      ],
      bytecode: '77 OP_0 OP_DEFINE OP_DROP OP_ROT OP_DROP OP_2DUP OP_ADD OP_DROP 2a OP_DROP 64 OP_SWAP OP_0 OP_INVOKE OP_ADD OP_5 OP_NUMEQUAL',
      fingerprint: '776d6c2a2477b7dd5820a5439110bae3a6bf399c3494e06ba4657d90fcc34d8e',
      debug: {
        bytecode: '01770089757b756e9375012a7501647c008a93559c',
        sourceMap: '1::3:1;;::::1;5:24:5:39:0;6:33:6:57;;7:29:7:34;::::1;:8::35;8:36:8:38:0;:8::39:1;9:23:9:26:0;:20::21;:16::27:1;;:::31;:35::36:0;:8::38:1',
        logs: [],
        requires: [
          { ip: 19, line: 9 },
        ],
        functions: [
          {
            id: 0,
            name: 'pad',
            inputs: [{ name: 'value', type: 'int' }, { name: 'padding', type: 'int' }],
            bytecode: '77',
            sourceMap: '1:24:1:42',
            logs: [],
            requires: [],
          },
        ],
      },
    },
  },
];
