import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('.', import.meta.url).pathname;
const host = process.env.IEUM_MANAGER_HOST || '127.0.0.1';
const port = Number(process.env.IEUM_MANAGER_PORT || 8787);
const configPath = process.env.IEUM_MANAGER_CONFIG || join(root, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const timeoutMs = Number(process.env.IEUM_RPC_TIMEOUT_MS || 4000);
let rpcId = 0;
let cache = { at: 0, data: null, pending: null };

export function hexToBigInt(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('invalid hex quantity');
  return BigInt(value);
}

export function formatUnits(value, decimals = 18) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const fraction = (n % base).toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function rpc(url, method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST', headers: {'content-type':'application/json'}, signal: controller.signal,
      body: JSON.stringify({jsonrpc:'2.0', id: ++rpcId, method, params})
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || `RPC ${body.error.code}`);
    return { result: body.result, latencyMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer); }
}

async function inspectNode(node) {
  const started = Date.now();
  try {
    const [status, identity, protocol, finalized, storage, pool] = await Promise.all([
      rpc(node.rpcUrl, 'ieum_nodeStatus'), rpc(node.rpcUrl, 'ieum_networkIdentity'),
      rpc(node.rpcUrl, 'ieum_protocolVersion'), rpc(node.rpcUrl, 'ieum_finalizedBlock'),
      rpc(node.rpcUrl, 'ieum_getStorageStatus'), rpc(node.rpcUrl, 'txpool_status')
    ]);
    return {...node, online:true, checkedAt:new Date().toISOString(), latencyMs:status.latencyMs,
      status:status.result, identity:identity.result, protocol:protocol.result,
      finalized:finalized.result, storage:storage.result,
      txpool:{pending:Number(hexToBigInt(pool.result.pending)),bytes:Number(hexToBigInt(pool.result.bytes))}};
  } catch (error) {
    return {...node, online:false, checkedAt:new Date().toISOString(), latencyMs:Date.now()-started,
      error:error.name === 'AbortError' ? 'RPC timeout' : error.message};
  }
}

async function inspectWallets(primary) {
  if (!primary) return [];
  return Promise.all((config.wallets || []).filter(w => /^0x[0-9a-f]{40}$/i.test(w.address)).map(async wallet => {
    try {
      const [balance, nonce] = await Promise.all([
        rpc(primary.rpcUrl,'eth_getBalance',[wallet.address,'latest']),
        rpc(primary.rpcUrl,'eth_getTransactionCount',[wallet.address,'latest'])
      ]);
      return {...wallet, online:true,balanceRaw:hexToBigInt(balance.result).toString(),
        balance:formatUnits(hexToBigInt(balance.result),config.unitDecimals),nonce:Number(hexToBigInt(nonce.result))};
    } catch (error) { return {...wallet,online:false,error:error.message}; }
  }));
}

async function inspectChain(primary) {
  if (!primary) return {available:false};
  try {
    const [supply, validators, production, balances] = await Promise.all([
      rpc(primary.rpcUrl, 'ieum_supplyStatus'),
      rpc(primary.rpcUrl, 'ieum_validatorStatus', [Number(config.validatorWindow) || 1000]),
      rpc(primary.rpcUrl, 'ieum_blockProductionStatus', [Number(config.productionWindow) || 100]),
      rpc(primary.rpcUrl, 'ieum_addressBalances', [0, Math.min(Number(config.accountLimit) || 100, 1000)])
    ]);
    const decimals = supply.result.decimals ?? config.unitDecimals ?? 18;
    return {
      available:true,
      supply:{...supply.result,totalIssuedFormatted:formatUnits(supply.result.totalIssued,decimals),
        circulatingFormatted:formatUnits(supply.result.circulating,decimals),lockedFormatted:formatUnits(supply.result.locked,decimals)},
      validators:validators.result,
      production:production.result,
      accounts:{...balances.result,accounts:(balances.result.accounts || []).map(account=>({...account,
        balanceFormatted:formatUnits(account.balance,decimals)}))}
    };
  } catch (error) {
    return {available:false,error:error.message};
  }
}

async function recentFlow(primary, tip) {
  if (!primary || !Number.isFinite(tip)) return [];
  const count = Math.min(Math.max(Number(config.historyBlocks)||20,1),100);
  const heights = Array.from({length:Math.min(count,tip+1)},(_,i)=>tip-i);
  const blocks = await Promise.all(heights.map(async h => {
    try { return (await rpc(primary.rpcUrl,'eth_getBlockByNumber',[`0x${h.toString(16)}`,true])).result; }
    catch { return null; }
  }));
  return blocks.filter(Boolean).flatMap(block => (block.transactions || []).map(tx => ({
    hash:tx.hash,from:tx.from,to:tx.to,valueRaw:hexToBigInt(tx.value || '0x0').toString(),
    value:formatUnits(hexToBigInt(tx.value || '0x0'),config.unitDecimals),blockNumber:Number(hexToBigInt(block.number)),timestamp:block.timestamp || null
  }))).slice(0,200);
}

function buildAlerts(nodes, chain) {
  const alerts=[]; const online=nodes.filter(n=>n.online);
  nodes.filter(n=>!n.online).forEach(n=>alerts.push({level:'critical',message:`${n.name} RPC 응답 없음: ${n.error}`}));
  if (online.length) {
    const heights=online.map(n=>n.status.height); const max=Math.max(...heights);
    online.filter(n=>max-n.status.height>2).forEach(n=>alerts.push({level:'warning',message:`${n.name} 블록 높이가 ${max-n.status.height} 뒤처짐`}));
    const identities=new Set(online.map(n=>`${n.identity.chainId}:${n.identity.genesisHash}`));
    if (identities.size>1) alerts.push({level:'critical',message:'노드 간 chainId 또는 genesisHash 불일치'});
    online.filter(n=>n.status.syncing).forEach(n=>alerts.push({level:'warning',message:`${n.name} 동기화 진행 중`}));
    online.filter(n=>n.status.peers<1).forEach(n=>alerts.push({level:'warning',message:`${n.name} 연결 피어 없음`}));
  }
  if (chain?.available) {
    (chain.validators?.validators || []).filter(v=>v.eligibleBlocks>0 && v.signingRatePercent<95)
      .forEach(v=>alerts.push({level:v.signingRatePercent<80?'critical':'warning',message:`검증자 ${v.id} 서명률 ${v.signingRatePercent.toFixed(2)}%`}));
    if ((chain.production?.averageBlockTimeSeconds || 0)>6) alerts.push({level:'warning',message:`평균 블록 생성 시간이 ${chain.production.averageBlockTimeSeconds.toFixed(2)}초입니다.`});
  }
  return alerts;
}

async function snapshot() {
  const ttl=(Number(config.refreshSeconds)||10)*1000;
  if (cache.data && Date.now()-cache.at<ttl) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending=(async()=>{
    const nodes=await Promise.all(config.nodes.map(inspectNode));
    const primary=nodes.find(n=>n.online); const tip=primary?.status?.height;
    const [wallets,transactions,chain]=await Promise.all([inspectWallets(primary),recentFlow(primary,tip),inspectChain(primary)]);
    const data={generatedAt:new Date().toISOString(),symbol:config.unitSymbol||'IEUM',decimals:config.unitDecimals??18,
      managerVersion:'0.2.0',chainVersion:'0.22.1',nodes,wallets,transactions,chain,alerts:buildAlerts(nodes,chain),summary:{onlineNodes:nodes.filter(n=>n.online).length,totalNodes:nodes.length,
      height:tip??null,chainId:primary?.identity?.chainId??null,peers:nodes.reduce((s,n)=>s+(n.status?.peers||0),0),
      pending:nodes.reduce((s,n)=>s+(n.txpool?.pending||0),0)}};
    cache={at:Date.now(),data,pending:null}; return data;
  })().catch(error=>{cache.pending=null;throw error});
  return cache.pending;
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','no-referrer');
  res.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(req.url==='/api/snapshot'){
    try{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(await snapshot()));}
    catch(error){res.writeHead(503,{'content-type':'application/json'});return res.end(JSON.stringify({error:error.message}));}
  }
  const requested=req.url==='/'?'index.html':req.url.split('?')[0].replace(/^\//,'');
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,''); const path=join(root,'public',safe);
  try{const body=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'public, max-age=300'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  server.listen(port,host,()=>console.log(`IEUM Manager listening on http://${host}:${port}`));
}
