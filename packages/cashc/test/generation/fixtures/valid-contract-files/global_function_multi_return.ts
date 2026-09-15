import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'GlobalFunctionMultiReturn',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'x', type: 'int' }],
        },
      ],
      bytecode: 'OP_3 OP_SWAP OP_2DUP OP_SWAP OP_DIV OP_SWAP OP_ROT OP_MOD OP_SWAP OP_4 OP_NUMEQUALVERIFY OP_1 OP_NUMEQUAL',
      fingerprint: '71cf12a9155a0e6683799101d65784d3edcf13fb6e2ef3addd6d494d4147bb29',
      debug: {
        bytecode: '537c6e7c967c7b977c549d519c',
        sourceMap: '7:33:7:34;:30::31;:23::35:1;;;;;;8:16:8:17:0;:21::22;:8::24:1;9:21:9:22:0;:8::24:1',
        logs: [],
        requires: [
          { ip: 10, line: 8 },
          { ip: 13, line: 9 },
        ],
        functions: [
          {
            name: 'divmod',
            inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
            bytecode: '6e7c967c7b97',
            sourceMap: '2:11:2:16;;::::1;:18::19:0;:22::23;:18:::1',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '2:7:divmod',
      },
    },
  },
  {
    // A multi-return function — locks in the calling convention: return values are left on the stack
    // in declared order (last value on top) and bound by an N-ary tuple destructuring at the call site.
    compilerOptions: { disableInlining: true },
    artifact: {
      contractName: 'GlobalFunctionMultiReturn',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'x', type: 'int' }],
        },
      ],
      bytecode: '6e7c967c7b97 OP_0 OP_DEFINE OP_3 OP_SWAP OP_0 OP_INVOKE OP_SWAP OP_4 OP_NUMEQUALVERIFY OP_1 OP_NUMEQUAL',
      fingerprint: '13fdcb97e1a0f3546c30fb4f0c29338c1678c729db4e148151a026f93b27652d',
      debug: {
        bytecode: '066e7c967c7b970089537c008a7c549d519c',
        sourceMap: '1::3:1;;::::1;7:33:7:34:0;:30::31;:23::35:1;;8:16:8:17:0;:21::22;:8::24:1;9:21:9:22:0;:8::24:1',
        logs: [],
        requires: [
          { ip: 9, line: 8 },
          { ip: 12, line: 9 },
        ],
        functions: [
          {
            id: 0,
            name: 'divmod',
            inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
            bytecode: '6e7c967c7b97',
            sourceMap: '2:11:2:16;;::::1;:18::19:0;:22::23;:18:::1',
            logs: [],
            requires: [],
          },
        ],
      },
    },
  },
];
