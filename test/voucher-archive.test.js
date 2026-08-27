import test from 'node:test';
import assert from 'node:assert/strict';
import {decryptVoucherSecret,encryptVoucherSecret} from '../lib/voucher-archive.js';

const key='test-only-archive-key-at-least-32-characters';

test('voucher secrets are encrypted with authenticated AES-GCM and round-trip',()=>{
  const value={code:'7KMA-3R9Q-P2TX-ABCD',token:'private-token'};
  const encrypted=encryptVoucherSecret(value,key);
  assert.match(encrypted,/^v1:/);
  assert.doesNotMatch(encrypted,/7KMA|private-token/);
  assert.deepEqual(decryptVoucherSecret(encrypted,key),value);
});

test('voucher archive rejects short keys, wrong keys and modified ciphertext',()=>{
  assert.throws(()=>encryptVoucherSecret({code:'A',token:'B'},'short'),/32자/);
  const encrypted=encryptVoucherSecret({code:'A',token:'B'},key);
  assert.throws(()=>decryptVoucherSecret(encrypted,'another-test-key-at-least-32-characters'));
  const parts=encrypted.split(':'),ciphertext=parts[3];parts[3]=`${ciphertext[0]==='A'?'B':'A'}${ciphertext.slice(1)}`;
  assert.throws(()=>decryptVoucherSecret(parts.join(':'),key));
});
