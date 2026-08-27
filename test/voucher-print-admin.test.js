import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import QRCode from 'qrcode';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('voucher QR body removes the trailing outer SVG tag and remains embeddable',async()=>{
  const qr=await QRCode.toString('https://iem.aah.name/voucher/TEST',{type:'svg'});
  const body=qr.replace(/^\s*<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  assert.doesNotMatch(body,/<\/?svg\b/);
  assert.match(body,/<path\b/);
});

test('voucher image separates inline print rendering from explicit download',async()=>{
  const [server,print]=await Promise.all([read('../server.js'),read('../public/voucher-print.js')]);
  assert.match(server,/download=url\.searchParams\.get\('download'\)==='1'/);
  assert.match(server,/download\?'attachment':'inline'/);
  assert.match(server,/image\.svg\?token=.*&download=1/);
  assert.doesNotMatch(print,/download=1/);
  assert.match(print,/front\.onload/);
  assert.match(print,/front\.onerror/);
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

test('public Admin navigation is added only after a verified JWT session',async()=>{
  const app=await read('../public/app.js');
  assert.match(app,/fetch\('\/api\/session'\)/);
  assert.match(app,/if\(session\?\.admin\)/);
  assert.match(app,/href="\/admin\/vouchers"/);
  assert.doesNotMatch(app,/insertAdjacentHTML\('beforeend','<a href="\/admin\.html">Admin<\/a>'\)/);
});
