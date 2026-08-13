import test from 'node:test';import assert from 'node:assert/strict';
process.env.IEUM_MANAGER_CONFIG=new URL('../config.example.json',import.meta.url).pathname;
process.env.IEUM_MANAGER_PORT='0';
const {hexToBigInt,formatUnits}=await import('../server.js');
test('hex quantity parser',()=>assert.equal(hexToBigInt('0x2a'),42n));
test('unit formatter',()=>assert.equal(formatUnits(1234500000000000000n,18),'1.2345'));
const {selectIndexingQuorum}=await import('../lib/quorum.js');
test('indexer requires two identical finalized tips',()=>{
  const base={online:true,identity:{chainId:21004,genesisHash:'0xgenesis'},finalized:{height:9,hash:'0xblock'}};
  assert.equal(selectIndexingQuorum([{...base,node:{id:'a'}},{...base,node:{id:'b'}}],2).length,2);
  assert.throws(()=>selectIndexingQuorum([{...base,node:{id:'a'}}],2),/독립 RPC 2개/);
});
