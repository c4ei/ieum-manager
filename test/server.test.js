import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
process.env.IEUM_MANAGER_CONFIG=new URL('../config.example.json',import.meta.url).pathname;
process.env.IEUM_MANAGER_PORT='0';
const {hexToBigInt,formatUnits,summarizeProduction,normalizeExplorerTerm,verifySnsClaim}=await import('../server.js');
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
test('example config pins the IEUM mainnet genesis hash',async()=>{
  const config=JSON.parse(await readFile(new URL('../config.example.json',import.meta.url),'utf8'));
  assert.equal(config.expectedChainId,21004);
  assert.equal(config.expectedGenesisHash,'0x82cfc3615112766f3eb151a8677890c1b74ce6bce8463a1a3590991c383650f6');
});
test('production summary excludes genesis and separates producers',()=>{
  const result=summarizeProduction([{height:1,timestamp:100,producer:'a'},{height:2,timestamp:103,producer:'b'}]);
  assert.equal(result.averageBlockTimeSeconds,3);assert.equal(result.intervalSamples,1);assert.deepEqual(result.producerBlocks,{a:1,b:1});assert.equal(result.genesisExcluded,true);
});
test('guild payment compatibility stores the canonical indexed transaction hash',async()=>{
  const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
  assert.match(source,/LEFT JOIN guild_payment_receipts/);
  assert.match(source,/\[paid\.hash,made\.rows\[0\]\.id/);
  assert.match(source,/0x356456ff1216b57a6f8891b195b42d296789b67d/);
});
const {selectIndexingQuorum}=await import('../lib/quorum.js');
const {normalizePeer,peerAddressParts,peerSummary}=await import('../lib/peers.js');
test('peer endpoint parser supports IPv4 and bracketed IPv6',()=>{
  assert.deepEqual(peerAddressParts('203.0.113.7:7001'),{address:'203.0.113.7:7001',ip:'203.0.113.7',port:7001});
  assert.deepEqual(peerAddressParts('[2001:db8::1]:7001'),{address:'[2001:db8::1]:7001',ip:'2001:db8::1',port:7001});
});
test('peer normalization never invents wallet, country, or version data',()=>{
  const peer=normalizePeer({node_id:'peer-a',p2p_address:'203.0.113.7:7001',online:true,peer_count:4,raw:{direction:'outbound'}});
  assert.equal(peer.nodeId,'peer-a');assert.equal(peer.ip,'203.0.113.7');assert.equal(peer.country,null);assert.equal(peer.walletAddress,null);assert.equal(peer.version,null);
});
test('peer summary counts unique node IDs separately from connections',()=>{
  assert.deepEqual(peerSummary([{nodeId:'a',online:true,peerCount:4,version:'1'},{nodeId:'a',online:true,peerCount:4,version:'1'},{nodeId:'b',online:false,peerCount:2,version:null}]),{uniquePeers:2,onlinePeers:2,totalConnections:10,versions:['1']});
});
test('sns verifier outage keeps the claim pending for manual review',async()=>{
  const claim={status:'pending',verification:'manual-review',reviewerNote:''};
  const result=await verifySnsClaim(claim,{verifyUrl:'https://verify.example.test',fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal(result.status,'pending');assert.equal(result.verification,'platform-api-unavailable');assert.match(result.reviewerNote,/장애/);
});
test('sns verifier can approve a verified claim',async()=>{
  const claim={status:'pending',verification:'manual-review',reviewerNote:''};
  const result=await verifySnsClaim(claim,{verifyUrl:'https://verify.example.test',fetchImpl:async()=>({ok:true,json:async()=>({verified:true,platformAccountId:'account-1',postId:'post-1'})})});
  assert.equal(result.status,'approved');assert.equal(result.verification,'platform-api');assert.equal(result.postId,'post-1');
});
test('indexer requires two identical finalized tips',()=>{
  const base={online:true,identity:{chainId:21004,genesisHash:'0xgenesis'},finalized:{height:9,hash:'0xblock'}};
  assert.equal(selectIndexingQuorum([{...base,node:{id:'a'}},{...base,node:{id:'b'}}],2).length,2);
  assert.throws(()=>selectIndexingQuorum([{...base,node:{id:'a'}}],2),/독립 RPC 2개/);
});
