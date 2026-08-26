import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('long dashboard lists use 15-row pagination controls',async()=>{
  const [html,app]=await Promise.all([read('../public/index.html'),read('../public/app.js')]);
  for(const id of ['top-pages','account-pages','flow-pages'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/listPageSize=15/);
  for(const kind of ['top','account','flow'])assert.ok(app.includes(`pageItems('${kind}'`));
});

test('dark theme keeps visited links readable',async()=>{
  const css=await read('../public/styles.css');
  assert.match(css,/a,a:visited\{color:#7debc1/);
  assert.match(css,/a:hover,a:focus-visible\{color:#b8ffdc/);
});

test('address details explain genesis allocations and reject non-address identifiers',async()=>{
  const detail=await read('../public/detail.js');
  assert.match(detail,/제네시스 배정 · 일반 거래 없음/);
  assert.match(detail,/IEUM 주소는 0x로 시작하는 40자리 계정 주소/);
});
