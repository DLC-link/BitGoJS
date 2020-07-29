import * as should from 'should';
import { coroutine as co } from 'bluebird';
import * as sinon from 'sinon';
import { Wallet } from '../../../../src/v2/wallet';
const recoveryNocks = require('../../lib/recovery-nocks');
const fixtures = require('../../fixtures/coins/abstractUtxoCoin');
import { TestBitGo } from '../../../lib/test_bitgo';
import * as nock from 'nock';
const utxoLib = require('@bitgo/utxo-lib');
import * as errors from '../../../../src/errors';

describe('Abstract UTXO Coin:', () => {
  describe('Parse Transaction:', () => {
    let coin;
    let bitgo;

    /*
     * mock objects which get passed into parse transaction.
     * These objects are structured to force parse transaction into a
     * particular execution path for these tests.
     */
    const verification = {
      disableNetworking: true,
      keychains: {}
    };

    const wallet = sinon.createStubInstance(Wallet, {
      migratedFrom: 'v1_wallet_base_address'
    });

    const outputAmount = 0.01 * 1e8;

    before(() => {
      bitgo = new TestBitGo({ env: 'mock' });
      coin = bitgo.coin('btc');
    });

    it('should classify outputs which spend change back to a v1 wallet base address as internal', co(function *() {
      sinon.stub(coin, 'explainTransaction').resolves({
        outputs: [],
        changeOutputs: [{
          address: wallet.migratedFrom(),
          amount: outputAmount
        }]
      });

      sinon.stub(coin, 'verifyAddress').throws(new errors.UnexpectedAddressError('test error'));


      const parsedTransaction = yield coin.parseTransaction({ txParams: {}, txPrebuild: { txHex: '' }, wallet, verification });

      should.exist(parsedTransaction.outputs[0]);
      parsedTransaction.outputs[0].should.deepEqual({
        address: wallet.migratedFrom(),
        amount: outputAmount,
        external: false
      });

      coin.explainTransaction.restore();
      coin.verifyAddress.restore();
    }));

    it('should classify outputs which spend to addresses not on the wallet as external', co(function *() {
      const externalAddress = 'external_address';
      sinon.stub(coin, 'explainTransaction').resolves({
        outputs: [{
          address: externalAddress,
          amount: outputAmount
        }],
        changeOutputs: []
      });

      sinon.stub(coin, 'verifyAddress').throws(new errors.UnexpectedAddressError('test error'));

      const parsedTransaction = yield coin.parseTransaction({ txParams: {}, txPrebuild: { txHex: '' }, wallet, verification });

      should.exist(parsedTransaction.outputs[0]);
      parsedTransaction.outputs[0].should.deepEqual({
        address: externalAddress,
        amount: outputAmount,
        external: true
      });

      coin.explainTransaction.restore();
      coin.verifyAddress.restore();
    }));

    it('should accept a custom change address', co(function *() {

      const changeAddress = '33a9a4TTT47i2VSpNZA3YT7v3sKYaZFAYz';
      const outputAmount = 10000;
      const recipients = [];

      sinon.stub(coin, 'explainTransaction').resolves({
        outputs: [],
        changeOutputs: [
          {
            address: changeAddress,
            amount: outputAmount,
          },
        ],
      });

      const parsedTransaction = yield coin.parseTransaction({ txParams: { changeAddress, recipients }, txPrebuild: { txHex: '' }, wallet, verification });

      should.exist(parsedTransaction.outputs[0]);
      parsedTransaction.outputs[0].should.deepEqual({
        address: changeAddress,
        amount: outputAmount,
        external: false
      });

      coin.explainTransaction.restore();
    }));
  });

  // TODO: BG-23161 - replace smartbit block explorer which is now permanently down
  xdescribe('Recover Wallet:', () => {

    let coin, bitgo;

    before(() => {
      bitgo = new TestBitGo({ env: 'mock' });
      coin = bitgo.coin('tbtc');
      sinon.stub(coin, 'verifyRecoveryTransaction').resolvesArg(0);
    });

    it('should construct a recovery transaction with segwit unspents', co(function *() {
      const { params, expectedTxHex } = fixtures.recoverBtcSegwitFixtures();
      recoveryNocks.nockBtcSegwitRecovery(bitgo);
      const tx = yield coin.recover(params);
      const transaction = utxoLib.Transaction.fromHex(tx.transactionHex);
      transaction.ins.length.should.equal(2);
      transaction.outs.length.should.equal(1);
      transaction.outs[0].value.should.equal(57112);
      tx.transactionHex.should.equal(expectedTxHex);
    }));

    it('should construct an unsigned recovery transaction for the offline vault', co(function *() {
      const { params, expectedTxHex } = fixtures.recoverBtcUnsignedFixtures();
      recoveryNocks.nockBtcUnsignedRecovery(bitgo);
      const txPrebuild = yield coin.recover(params);
      txPrebuild.txHex.should.equal(expectedTxHex);
      txPrebuild.should.have.property('feeInfo');
      txPrebuild.coin.should.equal('tbtc');
      txPrebuild.txInfo.unspents.length.should.equal(2);
    }));

    after(function() {
      nock.cleanAll();
      coin.verifyRecoveryTransaction.restore();
    });

  });
});
