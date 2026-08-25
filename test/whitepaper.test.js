import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('whitepaper exposes both languages, risk notice, sources, and repositories',async()=>{
  const html=await read('public/whitepaper.html');
  for(const expected of ['data-document="ko"','data-document="en"','not investment advice','투자 권유','100 ms–5 s','ieum-chain','ieum-wallet','ieum-cold-wallet','ieum-manager','application/ld+json']) assert.ok(html.includes(expected),`missing ${expected}`);
});

test('whitepaper is discoverable from home and sitemap',async()=>{
  const [home,sitemap]=await Promise.all([read('public/index.html'),read('public/sitemap.xml')]);
  assert.match(home,/href="\/whitepaper\.html"/);
  assert.match(sitemap,/https:\/\/iem\.aah\.name\/whitepaper\.html/);
});
