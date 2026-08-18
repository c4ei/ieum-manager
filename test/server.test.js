import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
process.env.IEUM_MANAGER_CONFIG=new URL('../config.example.json',import.meta.url).pathname;
process.env.IEUM_MANAGER_PORT='0';
const {hexToBigInt,formatUnits,summarizeProduction,normalizeExplorerTerm}=await import('../server.js');
test('explorer accepts hashes with or without 0x',()=>{const hash='cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574';assert.equal(normalizeExplorerTerm(hash),`0x${hash}`);assert.equal(normalizeExplorerTerm(`0x${hash}`),`0x${hash}`);});
test('hex quantity parser',()=>assert.equal(hexToBigInt('0x2a'),42n));
test('unit formatter',()=>assert.equal(formatUnits(1234500000000000000n,18),'1.2345'));
test('unit formatter rounds at 8 decimals without losing integer precision',()=>{
  assert.equal(formatUnits(99999900000000000000n,18),'99.9999');
  assert.equal(formatUnits(99231000000000000000n,18),'99.231');
  assert.equal(formatUnits(99999999996000000000n,18),'100');
  assert.equal(formatUnits(4000000000n,18),'0');
  assert.equal(formatUnits(5000000000n,18),'0.00000001');
});
test('example config pins the Chain v0.22.5 genesis hash',async()=>{
  const config=JSON.parse(await readFile(new URL('../config.example.json',import.meta.url),'utf8'));
  assert.equal(config.expectedChainId,21004);
  assert.equal(config.expectedGenesisHash,'0x497e04ac4faec01b78b57d3caef7951fca98b1928a1af558ea03a663aa622418');
});
test('production summary excludes genesis and separates producers',()=>{
  const result=summarizeProduction([{height:1,timestamp:100,producer:'a'},{height:2,timestamp:103,producer:'b'}]);
  assert.equal(result.averageBlockTimeSeconds,3);assert.equal(result.intervalSamples,1);assert.deepEqual(result.producerBlocks,{a:1,b:1});assert.equal(result.genesisExcluded,true);
});
const {selectIndexingQuorum}=await import('../lib/quorum.js');
test('indexer requires two identical finalized tips',()=>{
  const base={online:true,identity:{chainId:21004,genesisHash:'0xgenesis'},finalized:{height:9,hash:'0xblock'}};
  assert.equal(selectIndexingQuorum([{...base,node:{id:'a'}},{...base,node:{id:'b'}}],2).length,2);
  assert.throws(()=>selectIndexingQuorum([{...base,node:{id:'a'}}],2),/독립 RPC 2개/);
});
