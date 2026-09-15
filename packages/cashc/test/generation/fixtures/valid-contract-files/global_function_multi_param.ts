import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'GlobalFunctionMultiParam',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
        },
      ],
      bytecode: 'OP_SWAP OP_SUB OP_7 OP_NUMEQUAL',
      fingerprint: 'e2fc400768dc40234ade786da44ad2a623d43f73ee5b70af21da0647616b162f',
      debug: {
        bytecode: '7c94579c',
        sourceMap: '7:16:7:25:1;;:29::30:0;:8::32:1',
        logs: [],
        requires: [
          { ip: 4, line: 7 },
        ],
        functions: [
          {
            name: 'sub',
            inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
            bytecode: '7c94',
            sourceMap: '2:15:2:16;:11:::1',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '0:1:sub',
      },
    },
  },
  {
    // A multi-parameter global function — locks in the parameter stack-seeding and argument order
    // (the contract OP_SWAPs x and y into place; the body computes a - b directly).
    compilerOptions: { disableInlining: true },
    artifact: {
      contractName: 'GlobalFunctionMultiParam',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
        },
      ],
      bytecode: '7c94 OP_0 OP_DEFINE OP_0 OP_INVOKE OP_7 OP_NUMEQUAL',
      fingerprint: 'ef6dd7819e66a430286fe16f3d6dad7e026cf1970eda6bc620be7e7a3bdd2a4d',
      debug: {
        bytecode: '027c940089008a579c',
        sourceMap: '1::3:1;;::::1;7:16:7:25;;:29::30:0;:8::32:1',
        logs: [],
        requires: [
          { ip: 7, line: 7 },
        ],
        functions: [
          {
            id: 0,
            name: 'sub',
            inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
            bytecode: '7c94',
            sourceMap: '2:15:2:16;:11:::1',
            logs: [],
            requires: [],
          },
        ],
      },
    },
  },
];
