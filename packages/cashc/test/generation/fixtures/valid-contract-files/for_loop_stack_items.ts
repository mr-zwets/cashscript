import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'ForLoopBasic',
      constructorInputs: [],
      abi: [{ name: 'spend', inputs: [] }],
      bytecode: 'OP_0 OP_1 OP_1 OP_0 OP_ROT OP_2SWAP OP_SWAP OP_3 OP_ROLL OP_BEGIN OP_TUCK OP_ADD OP_SWAP OP_1ADD OP_DUP OP_3 OP_GREATERTHANOREQUAL OP_UNTIL OP_DROP OP_3 OP_NUMEQUALVERIFY OP_SWAP OP_1 OP_NUMEQUALVERIFY OP_1 OP_NUMEQUAL',
      debug: {
        bytecode: '005151007b727c537a657d937c8b7653a26675539d7c519d519c',
        sourceMap: '3:18:3:19;4:16:4:17;5::5;7:21:7:22;:8:9:9;;;;;;8:18:8:25;::::1;7:31:7:32:0;:::37:1;:24::25:0;:28::29;:8:9:9:1;;;11:23:11:24:0;:8::26:1;12:16:12:17:0;:21::22;:8::24:1;13:21:13:22:0;:8::24:1',
        logs: [],
        requires: [{ ip: 20, line: 11 }, { ip: 23, line: 12 }, { ip: 26, line: 13 }],
        sourceTags: '12:13:fu;14:17:lc;18:18:sc',
      },
      fingerprint: '23560901eb2f43109dc83519611a758d0dfed13896b757ea91966958320e0911',
    },
  },
];
