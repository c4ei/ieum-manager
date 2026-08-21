import test from 'node:test';
import assert from 'node:assert/strict';
import {actualTransactionFee} from '../lib/transaction-fee.js';

test('stores actual fee as gas used times effective gas price',()=>{
  assert.equal(actualTransactionFee({gasPrice:'0x1'},{gasUsed:'0x5208'}),21000n);
  assert.equal(actualTransactionFee({gasPrice:'0x2'},{gasUsed:'0x5208',effectiveGasPrice:'0x3'}),63000n);
});

test('rejects missing or malformed fee quantities',()=>{
  assert.throws(()=>actualTransactionFee({gasPrice:'0x1'},{}));
  assert.throws(()=>actualTransactionFee({gasPrice:'nope'},{gasUsed:'0x5208'}));
});
