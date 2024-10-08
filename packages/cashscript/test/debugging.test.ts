import { compileString } from 'cashc';
import { Contract, MockNetworkProvider, SignatureAlgorithm, SignatureTemplate } from '../src/index.js';
import {
  alicePriv, alicePub, bobPriv,
  bobPub,
} from './fixture/vars.js';
import '../src/test/JestExtensions.js';
import { randomUtxo } from '../src/utils.js';
import { AuthenticationErrorCommon, binToHex, hexToBin } from '@bitauth/libauth';

const CONTRACT_CODE = `
contract Test() {
  function test_logs() {
    console.log("Hello World");
    require(1 == 2);
  }

  function test_no_logs() {
    require(1 == 2);
  }

  function test_require() {
    require(1 == 2, "1 should equal 2");
  }

  function test_require_no_failure() {
    require(1 == 1, "1 should equal 1");
  }

  function test_multiple_require_statements() {
    require(1 == 2, "1 should equal 2");
    require(1 == 1, "1 should equal 1");
  }

  function test_multiple_require_statements_final_fails() {
    require(1 == 1, "1 should equal 1");
    require(1 == 2, "1 should equal 2");
  }

  function test_multiple_require_statements_no_message_final() {
    require(1 == 1, "1 should equal 1");
    require(1 == 2);
  }

  function test_timeops_as_final_require() {
    require(1 == 1, "1 should equal 1");
    require(tx.time >= 100000000, "time should be HUGE");
  }

  function test_final_require_in_if_statement(int switch) {
    if (switch == 1) {
      int a = 2;
      require(1 == a, "1 should equal 2");
    } else if (switch == 2) {
      int b = 3;
      require(1 == b, "1 should equal 3");
    } else {
      int c = 4;
      require(switch == c, "switch should equal 4");
    }
  }

  function test_final_require_in_if_statement_with_deep_reassignment() {
    int a = 0;
    int b = 1;
    int c = 2;
    int d = 3;
    int e = 4;
    if (a == 0) {
      a =
        10 + 10;
      require(a + b + c + d + e == 10, "sum should equal 10");
    }
  }

  function test_invalid_split_range() {
    bytes test = 0x1234;
    bytes test2 = test.split(4)[0];
    require(test2 == 0x1234);
  }

  function test_invalid_input_index() {
    require(tx.inputs[5].value == 1000);
  }

  function test_fail_checksig(sig s, pubkey pk) {
    require(checkSig(s, pk), "Signatures do not match");
    require(1 == 2, "1 should equal 2");
  }

  function test_fail_checksig_final_verify(sig s, pubkey pk) {
    require(checkSig(s, pk), "Signatures do not match");
  }

  function test_fail_checkdatasig(datasig s, bytes message, pubkey pk) {
    require(checkDataSig(s, message, pk), "Data Signatures do not match");
  }

  function test_fail_checkmultisig(sig s1, pubkey pk1, sig s2, pubkey pk2) {
    require(checkMultiSig([s1, s2], [pk1, pk2]), "Multi Signatures do not match");
  }
}
`;

const CONTRACT_CODE2 = `
contract Test() {
  function test_require_single_function() {
    require(tx.outputs.length == 1, "should have 1 output");
  }
}`;

const CONTRACT_CODE3 = `
contract Test() {
  // We test this because the cleanup looks different and the final OP_VERIFY isn't removed for these kinds of functions
  function test_fail_large_cleanup() {
    int a = 1;
    int b = 2;
    int c = 3;
    int d = 4;
    int e = 5;
    int f = 6;
    int g = 7;
    int h = 8;

    // Use all variables inside this if-statement so they do not get OP_ROLL'ed
    if (
    1
      == 2
    ) {
      require(a + b + c + d + e + f + g + h == 1, "sum should equal 36");
    }

    require(1 == 2, "1 should equal 2");
  }

  function test_fail_multiline_require() {
    require(
      1 == 2,
      "1 should equal 2"
    );

    require(1 == 1);
  }

  function test_fail_multiline_final_require() {
    require(
      1 == 2,
      "1 should equal 2"
    );
  }

  function test_multiline_non_require_error() {
    int x =
      tx.outputs[
        5
      ].value +
      tx.inputs[5].value;
    require(x == 1000);
  }

  function test_multiline_require_with_unary_op() {
    require(
      !(
        0x000000
        .reverse()
        .length
        !=
        -(
          30
            +
          15
        )
      )
    );

    require(1 == 1);
  }

  function test_multiline_require_with_instantiation() {
    require(
      new LockingBytecodeP2PKH(
        hash160(0x000000)
      )
        ==
      new LockingBytecodeNullData([
        0x00,
        bytes("hello world")
      ])
    );

    require(1 == 1);
  }
}
`;

const CONTRACT_CODE_ZERO_HANDLING = `
contract Test(int a) {
  function test_zero_handling(int b) {
    require(a == 0, "a should be 0");
    require(b == 0, "b should be 0");
    require(a == b, "a should equal b");
  }
}
`;

describe('Debugging tests', () => {
  describe('console.log statements', () => {
    const BASE_CONTRACT_CODE = `
      contract Test(pubkey owner) {
        function transfer(sig ownerSig, int num) {
          console.log('Hello First Function');
          require(checkSig(ownerSig, owner));

          bytes2 beef = 0xbeef;
          require(beef != 0xfeed);

          console.log(ownerSig, owner, num, beef, 1, "test", true);

          require(num == 1000);
        }

        function secondFunction() {
          console.log("Hello Second Function");
          require(1 == 1);
        }

        function functionWithIfStatement(int a) {
          int b = 0;

          if (a == 1) {
            console.log("a is 1");
            b = a;
          } else {
            console.log("a is not 1");
            b = 2;
          }

          console.log('a equals', a);
          console.log('b equals', b);

          require(1 == 1);
        }

        function noLogs() {
          require(1 == 1);
        }
      }
    `;

    const artifact = compileString(BASE_CONTRACT_CODE);
    const provider = new MockNetworkProvider();

    it('should log correct values', async () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions
        .transfer(new SignatureTemplate(alicePriv), 1000n)
        .to(contract.address, 10000n);

      // console.log(ownerSig, owner, num, beef, 1, "test", true);
      const expectedLog = new RegExp(`^Test.cash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 1000 0xbeef 1 test true$`);
      await expect(transaction).toLog(expectedLog);
    });

    it('should log when logging happens before a failing require statement', async () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const incorrectNum = 100n;
      const transaction = contract.functions
        .transfer(new SignatureTemplate(alicePriv), incorrectNum)
        .to(contract.address, 10000n);

      // console.log(ownerSig, owner, num, beef, 1, "test", true);
      const expectedLog = new RegExp(`^Test.cash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100 0xbeef 1 test true$`);
      await expect(transaction).toLog(expectedLog);
    });

    it('should not log when logging happens after a failing require statement', async () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const incorrectPriv = bobPriv;
      const transaction = contract.functions
        .transfer(new SignatureTemplate(incorrectPriv), 1000n)
        .to(contract.address, 10000n);

      const expectedLog = new RegExp(`^Test.cash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 1000 0xbeef 1 test true$`);
      await expect(transaction).not.toLog(expectedLog);
    });

    it('should only log console.log statements from the called function', async () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions
        .secondFunction()
        .to(contract.address, 10000n);

      await expect(transaction).toLog(new RegExp('^Test.cash:16 Hello Second Function$'));
      await expect(transaction).not.toLog(/Hello First Function/);
    });

    it('should only log console.log statements from the chosen branch in if-statement', async () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction1 = contract.functions
        .functionWithIfStatement(1n)
        .to(contract.address, 10000n);

      await expect(transaction1).toLog(new RegExp('^Test.cash:24 a is 1$'));
      await expect(transaction1).toLog(new RegExp('^Test.cash:31 a equals 1$'));
      await expect(transaction1).toLog(new RegExp('^Test.cash:32 b equals 1$'));
      await expect(transaction1).not.toLog(/a is not 1/);

      const transaction2 = contract.functions
        .functionWithIfStatement(2n)
        .to(contract.address, 10000n);

      await expect(transaction2).toLog(new RegExp('^Test.cash:27 a is not 1$'));
      await expect(transaction2).toLog(new RegExp('^Test.cash:31 a equals 2$'));
      await expect(transaction2).toLog(new RegExp('^Test.cash:32 b equals 2$'));
      await expect(transaction2).not.toLog(/a is 1/);
    });

    it('should log multiple consecutive console.log statements on separate lines', async () => {
      const contractCode = `
        contract Test(pubkey owner) {
          function transfer(sig ownerSig, int num) {
            require(checkSig(ownerSig, owner));

            bytes2 beef = 0xbeef;
            require(beef != 0xfeed);

            console.log(ownerSig, owner, num);
            console.log(beef, 1, "test", true);

            require(num == 1000);
          }
        }
      `;

      const artifact2 = compileString(contractCode);

      const contract = new Contract(artifact2, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const incorrectNum = 100n;
      const transaction = contract.functions
        .transfer(new SignatureTemplate(alicePriv), incorrectNum)
        .to(contract.address, 10000n);

      // console.log(ownerSig, owner, num, beef);
      await expect(transaction).toLog(new RegExp(`^Test.cash:9 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100$`));
      // console.log(1, "test", true)
      await expect(transaction).toLog(new RegExp('^Test.cash:10 0xbeef 1 test true$'));
    });

    it('should log multiple console.log statements with other statements in between', async () => {
      const contractCode = `
        contract Test(pubkey owner) {
          function transfer(sig ownerSig, int num) {
            require(checkSig(ownerSig, owner));

            console.log(ownerSig, owner, num);

            bytes2 beef = 0xbeef;
            require(beef != 0xfeed);

            console.log(beef, 1, "test", true);

            require(num == 1000);
          }
        }
      `;

      const artifact2 = compileString(contractCode);

      const contract = new Contract(artifact2, [alicePub], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const incorrectNum = 100n;
      const transaction = contract.functions
        .transfer(new SignatureTemplate(alicePriv), incorrectNum)
        .to(contract.address, 10000n);

      // console.log(ownerSig, owner, num);
      const expectedFirstLog = new RegExp(`^Test.cash:6 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100$`);
      await expect(transaction).toLog(expectedFirstLog);

      const expectedSecondLog = new RegExp('^Test.cash:11 0xbeef 1 test true$');
      await expect(transaction).toLog(expectedSecondLog);
    });
  });

  describe('require statements', () => {
    const artifact = compileString(CONTRACT_CODE);
    const artifact2 = compileString(CONTRACT_CODE2);
    const artifact3 = compileString(CONTRACT_CODE3);
    const provider = new MockNetworkProvider();

    // test_require
    it('should fail with error message when require statement fails in a multi-function contract', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:13 Require statement failed at input 0 in contract Test.cash at line 13 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
    });

    // test_require_single_function
    it('should fail with error message when require statement fails in single function', async () => {
      const contract = new Contract(artifact2, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require_single_function()
        .to(contract.address, 1000n)
        .to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:4 Require statement failed at input 0 in contract Test.cash at line 4 with the following message: should have 1 output.');
      await expect(transaction).toFailRequireWith('Failing statement: require(tx.outputs.length == 1, "should have 1 output")');
    });

    // test_multiple_require_statements
    it('it should only fail with correct error message when there are multiple require statements', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_multiple_require_statements().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:21 Require statement failed at input 0 in contract Test.cash at line 21 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
      await expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_multiple_require_statements_final_fails
    it('it should only fail with correct error message when there are multiple require statements where the final statement fails', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_multiple_require_statements_final_fails().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:27 Require statement failed at input 0 in contract Test.cash at line 27 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
      await expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    it('should not fail if no require statements fail', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require_no_failure().to(contract.address, 1000n);
      await expect(transaction).not.toFailRequire();
    });

    // test_multiple_require_statements_no_message_final
    it('should fail without custom message if the final require statement does not have a message', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions
        .test_multiple_require_statements_no_message_final().to(contract.address, 1000n);

      await expect(transaction).toFailRequireWith('Test.cash:32 Require statement failed at input 0 in contract Test.cash at line 32.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2)');
      await expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_timeops_as_final_require
    it('should fail with correct error message for the final TimeOp require statement', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_timeops_as_final_require().to(contract.address, 1000n);

      await expect(transaction).toFailRequireWith('Test.cash:37 Require statement failed at input 0 in contract Test.cash at line 37 with the following message: time should be HUGE.');
      await expect(transaction).toFailRequireWith('Failing statement: require(tx.time >= 100000000, "time should be HUGE")');
      await expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_final_require_in_if_statement
    it('should fail with correct error message for the final require statement in an if statement', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transactionIfBranch = contract.functions
        .test_final_require_in_if_statement(1n)
        .to(contract.address, 1000n);

      await expect(transactionIfBranch).toFailRequireWith('Test.cash:43 Require statement failed at input 0 in contract Test.cash at line 43 with the following message: 1 should equal 2.');
      await expect(transactionIfBranch).toFailRequireWith('Failing statement: require(1 == a, "1 should equal 2")');

      const transactionElseIfBranch = contract.functions
        .test_final_require_in_if_statement(2n)
        .to(contract.address, 1000n);

      await expect(transactionElseIfBranch).toFailRequireWith('Test.cash:46 Require statement failed at input 0 in contract Test.cash at line 46 with the following message: 1 should equal 3.');
      await expect(transactionElseIfBranch).toFailRequireWith('Failing statement: require(1 == b, "1 should equal 3")');

      const transactionElseBranch = contract.functions
        .test_final_require_in_if_statement(3n)
        .to(contract.address, 1000n);

      await expect(transactionElseBranch).toFailRequireWith('Test.cash:49 Require statement failed at input 0 in contract Test.cash at line 49 with the following message: switch should equal 4.');
      await expect(transactionElseBranch).toFailRequireWith('Failing statement: require(switch == c, "switch should equal 4")');
    });

    // test_final_require_in_if_statement_with_deep_reassignment
    it('should fail with correct error message for the final require statement in an if statement with a deep reassignment', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions
        .test_final_require_in_if_statement_with_deep_reassignment()
        .to(contract.address, 1000n);

      await expect(transaction).toFailRequireWith('Test.cash:62 Require statement failed at input 0 in contract Test.cash at line 62 with the following message: sum should equal 10.');
      await expect(transaction).toFailRequireWith('Failing statement: require(a + b + c + d + e == 10, "sum should equal 10")');
    });

    // test_fail_checksig
    it('should fail with correct error message when checkSig fails', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const checkSigTransaction = contract.functions
        .test_fail_checksig(new SignatureTemplate(alicePriv), bobPub)
        .to(contract.address, 1000n);

      await expect(checkSigTransaction).toFailRequireWith('Test.cash:77 Require statement failed at input 0 in contract Test.cash at line 77 with the following message: Signatures do not match.');
      await expect(checkSigTransaction).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');

      const checkSigTransactionNullSignature = contract.functions
        .test_fail_checksig(hexToBin(''), bobPub)
        .to(contract.address, 1000n);

      await expect(checkSigTransactionNullSignature).toFailRequireWith('Test.cash:77 Require statement failed at input 0 in contract Test.cash at line 77 with the following message: Signatures do not match.');
      await expect(checkSigTransactionNullSignature).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');
    });

    // test_fail_checksig_final_verify
    it('should fail with correct error message when checkSig fails as the final verify', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const checkSigTransaction = contract.functions
        .test_fail_checksig_final_verify(new SignatureTemplate(alicePriv), bobPub).to(contract.address, 1000n);
      await expect(checkSigTransaction).toFailRequireWith('Test.cash:82 Require statement failed at input 0 in contract Test.cash at line 82 with the following message: Signatures do not match.');
      await expect(checkSigTransaction).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');
    });

    // test_fail_checkdatasig
    it('should fail with correct error message when checkDataSig fails', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const checkDataSigTransaction = contract.functions
        .test_fail_checkdatasig(new SignatureTemplate(alicePriv).generateSignature(hexToBin('0xbeef')).slice(0, -1), '0xbeef', bobPub)
        .to(contract.address, 1000n);
      await expect(checkDataSigTransaction).toFailRequireWith('Test.cash:86 Require statement failed at input 0 in contract Test.cash at line 86 with the following message: Data Signatures do not match.');
      await expect(checkDataSigTransaction).toFailRequireWith('Failing statement: require(checkDataSig(s, message, pk), "Data Signatures do not match")');

      const checkDataSigTransactionWrongMessage = contract.functions
        .test_fail_checkdatasig(new SignatureTemplate(alicePriv).generateSignature(hexToBin('0xc0ffee')).slice(0, -1), '0xbeef', alicePub)
        .to(contract.address, 1000n);
      await expect(checkDataSigTransactionWrongMessage).toFailRequireWith('Test.cash:86 Require statement failed at input 0 in contract Test.cash at line 86 with the following message: Data Signatures do not match.');
      await expect(checkDataSigTransactionWrongMessage).toFailRequireWith('Failing statement: require(checkDataSig(s, message, pk), "Data Signatures do not match")');
    });

    // test_fail_checkmultisig
    it('should fail with correct error message when checkMultiSig fails', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const checkmultiSigTransaction = contract.functions
        .test_fail_checkmultisig(
          new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
          bobPub,
          new SignatureTemplate(bobPriv, undefined, SignatureAlgorithm.ECDSA),
          alicePub,
        )
        .to(contract.address, 1000n);
      await expect(checkmultiSigTransaction).toFailRequireWith('Test.cash:90 Require statement failed at input 0 in contract Test.cash at line 90 with the following message: Multi Signatures do not match.');
      await expect(checkmultiSigTransaction).toFailRequireWith('Failing statement: require(checkMultiSig([s1, s2], [pk1, pk2]), "Multi Signatures do not match")');
    });

    // test_fail_large_cleanup
    it('should fail with correct error message when a require statement fails in a function with a large cleanup', async () => {
      const contract = new Contract(artifact3, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_fail_large_cleanup().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:22 Require statement failed at input 0 in contract Test.cash at line 22 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
    });

    // test_fail_multiline_require
    it('should fail with correct error message and statement when a multiline require statement fails', async () => {
      const contract = new Contract(artifact3, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_fail_multiline_require().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:26 Require statement failed at input 0 in contract Test.cash at line 26 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith(`Failing statement: require(
      1 == 2,
      "1 should equal 2"
    );`);
    });

    // test_fail_multiline_final_require
    it('should fail with correct error message and statement when a multiline final require statement fails', async () => {
      const contract = new Contract(artifact3, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_fail_multiline_final_require().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:36 Require statement failed at input 0 in contract Test.cash at line 36 with the following message: 1 should equal 2.');
      await expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
    });

    // test_multiline_require_with_unary_op
    // Note that we add this test, because we changed the LocationHint for all Unary Ops to "END"
    it('should fail with correct error message and statement when a multiline require statement with a unary op fails', async () => {
      const contract = new Contract(artifact3, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_multiline_require_with_unary_op().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:51 Require statement failed at input 0 in contract Test.cash at line 51.');
      await expect(transaction).toFailRequireWith(`Failing statement: require(
      !(
        0x000000
        .reverse()
        .length
        !=
        -(
          30
            +
          15
        )
      )
    );`);
    });

    // test_multiline_require_with_instantiation
    it('should fail with correct error message and statement when a multiline require statement with an instantiation fails', async () => {
      const contract = new Contract(artifact3, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_multiline_require_with_instantiation().to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith('Test.cash:69 Require statement failed at input 0 in contract Test.cash at line 69.');
      await expect(transaction).toFailRequireWith(`Failing statement: require(
      new LockingBytecodeP2PKH(
        hash160(0x000000)
      )
        ==
      new LockingBytecodeNullData([
        0x00,
        bytes(\"hello world\")
      ])
    );`);
    });
  });

  describe('Non-require error messages', () => {
    const artifact = compileString(CONTRACT_CODE);
    const artifact3 = compileString(CONTRACT_CODE3);
    const provider = new MockNetworkProvider();

    // test_invalid_split_range
    it('should fail with correct error message when an invalid OP_SPLIT range is used', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transactionPromise = contract.functions.test_invalid_split_range()
        .to(contract.address, 1000n)
        .debug();

      await expect(transactionPromise).rejects.toThrow('Test.cash:68 Error in transaction at input 0 in contract Test.cash at line 68.');
      await expect(transactionPromise).rejects.toThrow('Failing statement: test.split(4)');
      await expect(transactionPromise).rejects.toThrow(`Reason: ${AuthenticationErrorCommon.invalidSplitIndex}`);
    });

    // test_invalid_input_index
    it('should fail with correct error message when an invalid input index is used', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transactionPromise = contract.functions.test_invalid_input_index()
        .to(contract.address, 1000n)
        .debug();

      await expect(transactionPromise).rejects.toThrow('Test.cash:73 Error in transaction at input 0 in contract Test.cash at line 73.');
      await expect(transactionPromise).rejects.toThrow('Failing statement: tx.inputs[5].value');
      await expect(transactionPromise).rejects.toThrow(`Reason: ${AuthenticationErrorCommon.invalidTransactionUtxoIndex}`);
    });

    // test_multiline_non_require_error
    it('should fail with correct error message and statament when a multiline non-require statement fails', async () => {
      const contract = new Contract(artifact3, [], { provider });

      provider.addUtxo(contract.address, randomUtxo());

      const transactionPromise = contract.functions.test_multiline_non_require_error()
        .to(contract.address, 1000n)
        .debug();

      await expect(transactionPromise).rejects.toThrow('Test.cash:43 Error in transaction at input 0 in contract Test.cash at line 43.');
      await expect(transactionPromise).rejects.toThrow(`Failing statement: tx.outputs[
        5
      ].value`);
      await expect(transactionPromise).rejects.toThrow(`Reason: ${AuthenticationErrorCommon.invalidTransactionOutputIndex}`);
    });
  });

  describe('Template encoding', () => {
    const artifact = compileString(CONTRACT_CODE_ZERO_HANDLING);
    const provider = new MockNetworkProvider();

    // test_zero_handling
    it('should encode a locking and unlocking parameter of value 0 correctly and evaluate the execution', async () => {
      const contract = new Contract(artifact, [0n], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_zero_handling(0n).to(contract.address, 1000n);
      await expect(transaction).not.toFailRequire();
    });
  });

  describe('JestExtensions', () => {
    const artifact = compileString(CONTRACT_CODE);
    const provider = new MockNetworkProvider();

    // Note: happy cases are implicitly tested by the "regular" debugging tests, since the use JestExtensions

    it('should fail the JestExtensions test if an incorrect log is expected', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_logs().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).toLog('^This is definitely not the log$'),
      ).rejects.toThrow(/Expected: .*This is definitely not the log.*\nReceived: (.|\n)*?Test.cash:4 Hello World/);
    });

    it('should fail the JestExtensions test if a log is logged that is NOT expected', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_logs().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).not.toLog('^Test.cash:4 Hello World$'),
      ).rejects.toThrow(/Expected: not .*Test.cash:4 Hello World.*\nReceived: (.|\n)*?Test.cash:4 Hello World/);

      await expect(
        expect(transaction).not.toLog(),
      ).rejects.toThrow(/Expected: not .*undefined.*\nReceived: (.|\n)*?Test.cash:4 Hello World/);
    });

    it('should fail the JestExtensions test if a log is expected where no log is logged', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_no_logs().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).toLog('Hello World'),
      ).rejects.toThrow(/Expected: .*Hello World.*\nReceived: (.|\n)*?undefined/);
    });

    it('should fail the JestExtensions test if an incorrect require error message is expected', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).toFailRequireWith('1 should equal 3'),
      ).rejects.toThrow(/Expected pattern: .*1 should equal 3.*\nReceived string: (.|\n)*?1 should equal 2/);
    });

    it('should fail the JestExtensions test if a require error message is expected where no error is thrown', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require_no_failure().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).toFailRequireWith('1 should equal 3'),
      ).rejects.toThrow(/Contract function did not fail a require statement/);
    });

    it('should fail the JestExtensions test if an error is thrown where it is NOT expected', async () => {
      const contract = new Contract(artifact, [], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.test_require().to(contract.address, 10000n);

      // Note: We're wrapping the expect call in another expect, since we expect the inner expect to throw
      await expect(
        expect(transaction).not.toFailRequireWith('1 should equal 2'),
      ).rejects.toThrow(/Expected pattern: not .*1 should equal 2.*\nReceived string: (.|\n)*?1 should equal 2/);

      await expect(
        expect(transaction).not.toFailRequire(),
      ).rejects.toThrow(/Contract function failed a require statement\.*\nReceived string: (.|\n)*?1 should equal 2/);
    });
  });
});
