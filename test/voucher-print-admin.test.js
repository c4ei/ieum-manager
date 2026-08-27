import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import QRCode from 'qrcode';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('voucher QR preserves its viewBox and is embedded at a camera-readable size',async()=>{
  const qr=await QRCode.toString('https://iem.aah.name/voucher/TEST',{type:'svg'});
  const placed=qr.trim().replace(/^<svg\s/,'<svg x="820" y="245" width="300" height="300" ');
  assert.match(placed,/viewBox=/);
  assert.match(placed,/width="300" height="300"/);
  assert.match(placed,/<path\b/);
  assert.match(placed,/<\/svg>$/);
});

test('voucher image separates inline print rendering from explicit download',async()=>{
  const [server,print]=await Promise.all([read('../server.js'),read('../public/voucher-print.js')]);
  assert.match(server,/download=url\.searchParams\.get\('download'\)==='1'/);
  assert.match(server,/download\?'attachment':'inline'/);
  assert.match(server,/image\.svg\?token=.*&download=1/);
  assert.match(server,/margin:2/);
  assert.match(server,/width="300" height="300"/);
  assert.match(server,/width="320" height="320"/);
  assert.doesNotMatch(print,/download=1/);
  assert.match(print,/front\.onload/);
  assert.match(print,/front\.onerror/);
  assert.match(print,/front\.complete&&front\.naturalWidth/);
  assert.match(print,/front\.decode/);
});

test('voucher admin provides status filters, paging, safe session reprint and human amounts',async()=>{
  const [html,script,server]=await Promise.all([read('../public/vouchers-admin.html'),read('../public/vouchers-admin.js'),read('../server.js')]);
  assert.match(html,/id="status-filter"/);
  assert.match(html,/id="pages"/);
  assert.match(server,/limit=10/);
  assert.match(server,/pagination:\{page:/);
  assert.match(script,/api\/admin\/vouchers\?\$\{params\}/);
  assert.match(script,/ieum-voucher-print-session/);
  assert.doesNotMatch(script,/localStorage/);
  assert.match(server,/amount:formatVoucherAmount\(item\.amount_wei\)/);
});

test('future voucher reprint is encrypted, authenticated, audited and never listed as ciphertext',async()=>{
  const [server,script]=await Promise.all([read('../server.js'),read('../public/vouchers-admin.js')]);
  assert.match(server,/encryptVoucherSecret/);
  assert.match(server,/voucher-secret-viewed/);
  assert.match(server,/secret_ciphertext IS NOT NULL/);
  assert.doesNotMatch(server,/items:items\.rows\.map\(item=>\(\{\.\.\.item,secret_ciphertext/);
  assert.match(script,/보기·재출력/);
  assert.match(script,/data-hide-secret/);
  assert.match(script,/폐기 사유/);
});

test('voucher summary separates historical, valid, cancelled and expired totals',async()=>{
  const [server,script]=await Promise.all([read('../server.js'),read('../public/vouchers-admin.js')]);
  for(const field of ['valid_wei','cancelled_wei','expired_wei','valid_count','cancelled_count','expired_count'])assert.match(server,new RegExp(field));
  for(const label of ['누적 발행','유효 발행','폐기','만료'])assert.match(script,new RegExp(label));
  assert.match(server,/status NOT IN \('cancelled','expired'\)/);
});

test('public Admin navigation is added only after a verified JWT session',async()=>{
  const app=await read('../public/app.js');
  assert.match(app,/fetch\('\/api\/session'\)/);
  assert.match(app,/if\(session\?\.admin\)/);
  assert.match(app,/href="\/admin\/vouchers"/);
  assert.doesNotMatch(app,/insertAdjacentHTML\('beforeend','<a href="\/admin\.html">Admin<\/a>'\)/);
});
