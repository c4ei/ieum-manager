import test from 'node:test';
import assert from 'node:assert/strict';
import {amountHtml,formatIeum,formatWei} from '../public/amount-format.js';

test('IEUM formatter trims trailing zeroes and rounds to eight decimals',()=>{
  assert.equal(formatIeum('1120000000000000000'),'1.12');
  assert.equal(formatIeum('1234567895000000000'),'1.2345679');
  assert.equal(formatIeum('99999999996000000000'),'100');
  assert.equal(formatIeum('21070100000000000000000000'),'21,070,100');
});

test('whole IEUM hides wei while fractional IEUM preserves exact wei',()=>{
  assert.deepEqual(formatWei('1000000000000000000'),{primary:'1 IEUM',wei:null});
  assert.deepEqual(formatWei('1120000000000000000'),{primary:'1.12 IEUM',wei:'1,120,000,000,000,000,000 wei'});
  assert.deepEqual(formatWei('1'),{primary:'0 IEUM',wei:'1 wei'});
});

test('amount HTML uses the common primary and secondary presentation',()=>{
  assert.equal(amountHtml('1000000000000000000'),'<span class="ieum-amount">1 IEUM</span>');
  assert.match(amountHtml('1'),/<small>1 wei<\/small>/);
});
