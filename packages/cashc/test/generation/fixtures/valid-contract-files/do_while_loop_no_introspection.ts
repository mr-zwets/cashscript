import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'Loopy',
      constructorInputs: [],
      abi: [{ name: 'doLoop', inputs: [] }],
      bytecode: 'OP_0 OP_2 OP_SWAP OP_BEGIN OP_1ADD OP_2DUP OP_ADD OP_10 OP_LESSTHAN OP_VERIFY OP_DUP OP_10 OP_GREATERTHANOREQUAL OP_UNTIL OP_2DROP OP_1',
      debug: {
        bytecode: '00527c658b6e935a9f69765aa2666d51',
        sourceMap: '3:16:3:17;4::4;6:8:10:25;;7:16:7:21:1;9:20:9:25:0;::::1;:28::30:0;:20:::1;:12::32;10:17:10:18:0;:21::23;6:8::25:1;;2:22:11:5;',
        logs: [
          {
            ip: 5,
            line: 8,
            data: [{ stackIndex: 0, type: 'int', ip: 5 }],
          },
        ],
        requires: [{ ip: 9, line: 9 }],
      },
      fingerprint: '285f4304646d2f2117d60cc432b4205854a70790697f527dd0e2f6297d612da3',
    },
  },
];
