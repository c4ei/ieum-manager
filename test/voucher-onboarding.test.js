import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('voucher recipient can choose existing wallet or guided installation',async()=>{
  const [html,script]=await Promise.all([read('../public/voucher.html'),read('../public/voucher.js')]);
  for(const id of ['has-wallet','needs-wallet','install-guide','detected-device','wallet-download','copy-voucher-link'])assert.match(html,new RegExp(`id="${id}"`));
  for(const os of ['windows','mac','linux','mobile'])assert.match(html,new RegExp(`data-wallet-os="${os}"`));
  assert.match(script,/detectedDevice/);
  assert.match(script,/navigator\.userAgentData/);
  assert.match(script,/navigator\.clipboard\.writeText\(location\.href\)/);
});

test('wallet guidance uses only official repositories and no unconfirmed mobile download',async()=>{
  const [html,script]=await Promise.all([read('../public/voucher.html'),read('../public/voucher.js')]);
  assert.match(html,/github\.com\/c4ei\/ieum-wallet\/releases\/tag\/wallet-light-latest/);
  assert.match(html,/github\.com\/c4ei\/ieum-wallet\/releases\/tag\/wallet-normal-latest/);
  assert.match(html,/현재 안내 버전 1\.0\.2\.1/);
  assert.match(script,/현재 일반 사용자용 모바일 Wallet 설치는 안내하지 않습니다/);
  assert.doesNotMatch(html,/\.apk|\.ipa|play\.google|apps\.apple/);
});

test('voucher guidance separates normal installs from Ubuntu developer mode',async()=>{
  const [html,script]=await Promise.all([read('../public/voucher.html'),read('../public/voucher.js')]),source=`${html}\n${script}`;
  for(const value of ['NSIS .exe','MSI','DMG','DEB','AppImage','npm run tauri dev'])assert.match(source,new RegExp(value.replaceAll('.','\\.')));
  assert.match(html,/운영자는 지갑 비밀번호·복구 문구·개인키를 요구하지 않습니다/);
  assert.match(html,/voucher\.js\?v=10012/);
});
