import { Fixture } from '../../fixture-utils.js';

export const fixtures: Fixture[] = [
  {
    artifact: {
      contractName: 'IfStatement',
      constructorInputs: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }],
      abi: [{ name: 'hello', inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }] }],
      bytecode:
        // int d = a + b
        'OP_2OVER OP_ADD '
        // d = d - a
        + 'OP_DUP OP_4 OP_PICK OP_SUB '
        // if (d == x - 2) {
        + 'OP_DUP OP_3 OP_ROLL OP_2 OP_SUB OP_NUMEQUAL OP_IF '
        // int c = d + b
        + 'OP_DUP OP_5 OP_PICK OP_ADD '
        // d = a + c (the new value stays on top)
        + 'OP_4 OP_PICK OP_OVER OP_ADD '
        // require(c > d) (the final read of c, which was declared in this block, consumes it)
        + 'OP_TUCK OP_GREATERTHAN OP_VERIFY '
        // } else { (drop the old d)
        + 'OP_NIP OP_ELSE '
        // require(d == a) }
        + 'OP_DUP OP_4 OP_PICK OP_NUMEQUALVERIFY OP_ENDIF '
        // d = d + a
        + 'OP_DUP OP_4 OP_ROLL OP_ADD '
        // require(d == y)
        + 'OP_3 OP_ROLL OP_NUMEQUAL '
        + 'OP_NIP OP_NIP OP_NIP',
      debug: {
        bytecode: '70937654799476537a52949c6376557993547978937da06977677654799d6876547a93537a9c777777',
        logs: [],
        requires: [{ ip: 25, line: 8 }, { ip: 31, line: 10 }, { ip: 40, line: 13 }],
        sourceMap: '3:16:3:21;::::1;4:12:4:13:0;:16::17;;:12:::1;5::5:13:0;:17::18;;:21::22;:17:::1;:12;:24:9:9:0;6:20:6:21;:24::25;;:20:::1;7:16:7:17:0;;:20::21;:16:::1;8:20:8:25:0;::::1;:12::27;5:24:9:9;9:15:11::0;10:20:10:21;:25::26;;:12::28:1;9:15:11:9;12:12:12:13:0;:16::17;;:12:::1;13:21:13:22:0;;:8::24:1;2:33:14:5;;',
        sourceTags: '24:24:sc;38:40:sc',
      },
      fingerprint: '7faa268f51ab3ea48d618167a84326b485ec6469be4d416348c4fffd0e32c01a',
    },
  },
];
