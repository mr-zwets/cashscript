import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'Test',
      constructorInputs: [],
      abi: [
        {
          name: 'spend',
          inputs: [
            { name: 's', type: 'datasig' },
            { name: 'message', type: 'bytes' },
            { name: 'pk', type: 'pubkey' },
          ],
        },
      ],
      bytecode: 'OP_SWAP OP_ROT OP_CHECKDATASIG',
      fingerprint: '1a1dd563b4b81503ce471252e609976731a2946d4466485eac35594ff2cc47f8',
      debug: {
        bytecode: '7c7bba',
        sourceMap: '7:16:7:42:1;;:8::44',
        logs: [],
        requires: [
          { ip: 3, line: 7 },
        ],
        functions: [
          {
            name: 'verifyData',
            inputs: [
              { name: 's', type: 'datasig' },
              { name: 'message', type: 'bytes' },
              { name: 'pk', type: 'pubkey' },
            ],
            bytecode: '7c7bba',
            sourceMap: '2:27:2:34;:36::38;:11::39:1',
            logs: [],
            requires: [],
          },
        ],
        inlineRanges: '0:2:verifyData',
      },
    },
  },
];
