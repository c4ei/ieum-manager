import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {Transaction,toUtf8String,Wallet} from 'ethers';
import {ACCRUAL_DAILY_CAP_WEI,STAKING_SYSTEM_ADDRESS,buildAccrualGrant,buildIncidentEvent,incidentConfirmation,kstDate} from '../lib/accrual.js';
// 테스트 전용 무작위 키(자금 없음)
const key=Wallet.createRandom().privateKey,victim=`0x${'b'.repeat(40)}`,hacker=`0x${'c'.repeat(40)}`;
test('accrual grant sends accrue calldata to the staking system address',async()=>{
  const signed=await buildAccrualGrant(key,{nonce:3,recipient:victim.toUpperCase().replace('0X','0x'),value:10n**17n});
  const tx=Transaction.from(signed.raw);
  assert.equal(tx.to.toLowerCase(),STAKING_SYSTEM_ADDRESS);assert.equal(toUtf8String(tx.data),`accrue:${victim}`);assert.equal(tx.chainId,21004n);assert.equal(signed.nonce,3);
  await assert.rejects(buildAccrualGrant(key,{nonce:0,recipient:victim,value:ACCRUAL_DAILY_CAP_WEI+1n}));
  await assert.rejects(buildAccrualGrant(key,{nonce:0,recipient:'0x12',value:1n}));
});
test('check-in day follows Korean time',()=>{assert.equal(kstDate(new Date('2026-11-25T15:30:00Z')),'2026-11-26');assert.equal(kstDate(new Date('2026-11-25T14:59:00Z')),'2026-11-25');});
test('incident events match the chain event format',()=>{
  const freeze=buildIncidentEvent({kind:'freeze',caseId:'case-1',reason:'키 유출',addresses:[hacker]},1_800_000_000_000);
  assert.deepEqual(freeze,{id:'freeze-case-1-1800000000',execute_at:1_800_000_000,action:{type:'account_freeze',case_id:'case-1',addresses:[hacker],reason:'키 유출'}});
  const recover=buildIncidentEvent({kind:'recover',caseId:'case-1',from:hacker,payments:[{address:victim,amount:'12.5'}],release:true});
  assert.deepEqual(recover.action.payments,[{address:victim,amount:'12500000000000000000'}]);assert.equal(recover.action.release,true);
  assert.equal(incidentConfirmation('recover','case-1'),'RECOVER case-1');
});
test('incident events reject unsafe input',()=>{
  assert.throws(()=>buildIncidentEvent({kind:'freeze',caseId:'bad id',reason:'x',addresses:[hacker]}));
  assert.throws(()=>buildIncidentEvent({kind:'freeze',caseId:'c',reason:'',addresses:[hacker]}));
  assert.throws(()=>buildIncidentEvent({kind:'freeze',caseId:'c',reason:'x',addresses:[hacker,hacker]}));
  assert.throws(()=>buildIncidentEvent({kind:'recover',caseId:'c',from:hacker,payments:[{address:hacker,amount:'1'}]}));
  assert.throws(()=>buildIncidentEvent({kind:'delete',caseId:'c'}));
});
test('payout nonce reservation covers vouchers, trials and check-ins',async()=>{
  const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
  assert.match(source,/PAYOUT_NONCE_SQL='SELECT greatest\(.*ieum_vouchers.*ieum_trial_claims.*ieum_accrual_checkins/);
  assert.doesNotMatch(source,/max\(payout_nonce\)::text AS nonce FROM ieum_vouchers WHERE/);
});
test('host agent only accepts known actions and keeps events in every node',async()=>{
  const agent=await readFile(new URL('../deploy/ieum-recovery-agent.sh',import.meta.url),'utf8');
  assert.match(agent,/\('restart-ieum-nodes','chain-event'\)/);assert.match(agent,/적용 실패, 되돌림/);
});
test('web rewards are capped per address per day below the chain cap',async()=>{
  const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
  assert.match(source,/IEUM_WEB_ACCRUAL_DAILY_CAP_WEI\?\?'10000000000000000'/);
  assert.match(source,/todayWeb>webAccrualDailyCapWei/);
});
test('admin incident page shows the chain accrual overview',async()=>{
  const [source,page]=await Promise.all([readFile(new URL('../server.js',import.meta.url),'utf8'),readFile(new URL('../public/incidents-admin.js',import.meta.url),'utf8')]);
  assert.match(source,/'\/api\/admin\/accrual-overview'.*ieum_accrualOverview/);assert.match(page,/노드 적립 현황|accrual-overview/);
});
