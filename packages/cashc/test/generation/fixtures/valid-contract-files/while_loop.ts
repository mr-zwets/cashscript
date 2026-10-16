import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'Loopy',
      constructorInputs: [],
      abi: [{ name: 'doLoop', inputs: [] }],
      bytecode: 'OP_0 OP_DUP OP_TXINPUTCOUNT OP_LESSTHAN OP_IF OP_BEGIN OP_1ADD OP_DUP OP_TXINPUTCOUNT OP_GREATERTHANOREQUAL OP_UNTIL OP_ENDIF OP_2 OP_GREATERTHAN',
      debug: {
        bytecode: '0076c39f63658b76c3a2666852a0',
        sourceMap: '3:16:3:17;5:15:5:16;:19::35;:15:::1;:37:7:9:0;:8;6:12:6:22:1;5:15:5:16:0;:19::35;:8:7:9:1;;:37;10:20:10:21:0;:8::23:1',
        logs: [
          { ip: 12, line: 9, data: [{ stackIndex: 0, type: 'int', ip: 12 }] },
        ],
        requires: [
          { ip: 14, line: 10 },
        ],
        sourceTags: '7:11:lc',
      },
      fingerprint: 'd70ff35d1b675fa917afbc405983ba91a2e0d6b4043696ac0618a7baadfbf1e9',
    },
  },
];
