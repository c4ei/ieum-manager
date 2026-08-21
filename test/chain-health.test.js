import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseNodes} from '../lib/chain-health.js';

const node=(id,height,pending=0)=>({id,name:id,online:true,identity:{chainId:21004,genesisHash:'0xmainnet'},status:{height,peers:3,version:'0.23.11',syncing:false},txpool:{pending}});

test('healthy nodes with the same height stay green',()=>{
  const {diagnostics}=diagnoseNodes([node('n1',10),node('n2',10)],new Map(),1_000,20_000);
  assert.equal(diagnostics.status,'ok');
  assert.equal(diagnostics.sameHeight,true);
});

test('pending transaction and unchanged height becomes critical',()=>{
  const first=diagnoseNodes([node('n1',2,1)],new Map(),1_000,20_000);
  const second=diagnoseNodes([node('n1',2,1)],first.next,22_000,20_000);
  assert.equal(second.diagnostics.status,'critical');
  assert.match(second.diagnostics.nodes[0].reason,/높이 2 고정/);
});

test('an offline validator is critical',()=>{
  const {diagnostics}=diagnoseNodes([{id:'n1',name:'n1',online:false}],new Map(),1_000,20_000);
  assert.equal(diagnostics.status,'critical');
});
