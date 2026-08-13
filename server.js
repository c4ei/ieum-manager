import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {query,dbReady} from './lib/db.js';

const root = new URL('.', import.meta.url).pathname;
const host = process.env.IEUM_MANAGER_HOST || '0.0.0.0';
const port = Number(process.env.IEUM_MANAGER_PORT || 8787);
const configPath = process.env.IEUM_MANAGER_CONFIG || join(root, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const timeoutMs = Number(process.env.IEUM_RPC_TIMEOUT_MS || 4000);
let rpcId = 0;
let cache = { at: 0, data: null, pending: null };

const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const limitOf=(url,fallback=25,max=100)=>Math.min(Math.max(Number(url.searchParams.get('limit'))||fallback,1),max);
const offsetOf=url=>Math.max(Number(url.searchParams.get('offset'))||0,0);
const pageOf=url=>Math.max(Number(url.searchParams.get('page'))||1,1);
const paging=(url,total,fallback=25,max=100)=>{const limit=limitOf(url,fallback,max);const page=pageOf(url);const offset=(page-1)*limit;const pages=Math.max(Math.ceil(Number(total)/limit),1);return {limit,page,offset,total:Number(total),pages,previous:page>1?page-1:null,next:page<pages?page+1:null};};
const validHash=value=>/^0x[0-9a-f]{64}$/i.test(value||'');
const validAddress=value=>/^0x[0-9a-f]{40}$/i.test(value||'');

async function explorerApi(req,res,url){
  if(!await dbReady()) return json(res,503,{error:'익스플로러 데이터베이스 연결 대기 중'});
  const path=url.pathname;
  if(path==='/api/explorer/status'){
    const [blocks,txs,addresses,state]=await Promise.all([query('SELECT count(*) count,max(height) height FROM blocks'),query('SELECT count(*) count FROM transactions'),query('SELECT count(*) count FROM address_balances'),query("SELECT value,updated_at FROM explorer_state WHERE key='last_height'")]);
    return json(res,200,{blocks:blocks.rows[0],transactions:txs.rows[0].count,addresses:addresses.rows[0].count,indexer:state.rows[0]||null});
  }
  if(path==='/api/explorer/blocks'){
    const count=await query('SELECT count(*) count FROM blocks');const page=paging(url,count.rows[0].count);const rows=await query('SELECT height,hash,parent_hash,producer,timestamp,tx_count,size_bytes FROM blocks ORDER BY height DESC LIMIT $1 OFFSET $2',[page.limit,page.offset]);return json(res,200,{items:rows.rows,pagination:page});
  }
  if(path==='/api/explorer/transactions'){
    const count=await query('SELECT count(*) count FROM transactions');const page=paging(url,count.rows[0].count);const rows=await query(`SELECT t.hash,t.block_height,t.tx_index,t.sender,t.recipient,t.value,t.fee,t.nonce,b.timestamp FROM transactions t JOIN blocks b ON b.height=t.block_height ORDER BY t.block_height DESC,t.tx_index DESC LIMIT $1 OFFSET $2`,[page.limit,page.offset]);return json(res,200,{items:rows.rows,pagination:page});
  }
  if(path==='/api/explorer/top-addresses'){
    const rows=await query('SELECT address,balance,locked,tx_count,last_seen_height FROM address_balances ORDER BY balance DESC LIMIT $1',[limitOf(url,100,100)]);return json(res,200,{items:rows.rows});
  }
  if(path==='/api/explorer/search'){
    const term=(url.searchParams.get('q')||'').trim();
    if(/^\d+$/.test(term)) return json(res,200,{type:'block',target:`/api/explorer/block/${term}`});
    if(validHash(term)){const block=await query('SELECT 1 FROM blocks WHERE lower(hash)=lower($1)',[term]);return json(res,200,block.rows[0]?{type:'block',target:`/api/explorer/block/hash/${term}`}:{type:'transaction',target:`/api/explorer/transaction/${term}`});}
    if(validAddress(term)) return json(res,200,{type:'address',target:`/api/explorer/address/${term}`});
    return json(res,400,{error:'블록 높이, 트랜잭션 해시 또는 주소를 입력하세요.'});
  }
  let match=path.match(/^\/api\/explorer\/block\/(\d+)$/);
  if(match){const block=await query('SELECT * FROM blocks WHERE height=$1',[match[1]]);if(!block.rows[0])return json(res,404,{error:'블록을 찾을 수 없습니다.'});const txs=await query('SELECT * FROM transactions WHERE block_height=$1 ORDER BY tx_index',[match[1]]);return json(res,200,{...block.rows[0],transactions:txs.rows});}
  match=path.match(/^\/api\/explorer\/block\/hash\/(0x[0-9a-f]{64})$/i);
  if(match){const block=await query('SELECT * FROM blocks WHERE lower(hash)=lower($1)',[match[1]]);if(!block.rows[0])return json(res,404,{error:'블록을 찾을 수 없습니다.'});const txs=await query('SELECT * FROM transactions WHERE block_height=$1 ORDER BY tx_index',[block.rows[0].height]);return json(res,200,{...block.rows[0],transactions:txs.rows});}
  match=path.match(/^\/api\/explorer\/transaction\/(0x[0-9a-f]{64})$/i);
  if(match){const row=await query(`SELECT t.*,b.timestamp,b.hash block_hash FROM transactions t JOIN blocks b ON b.height=t.block_height WHERE lower(t.hash)=lower($1)`,[match[1]]);return row.rows[0]?json(res,200,row.rows[0]):json(res,404,{error:'트랜잭션을 찾을 수 없습니다.'});}
  match=path.match(/^\/api\/explorer\/address\/(0x[0-9a-f]{40})$/i);
  if(match){const [account,txs]=await Promise.all([query('SELECT * FROM address_balances WHERE lower(address)=lower($1)',[match[1]]),query(`SELECT t.*,b.timestamp FROM transactions t JOIN blocks b ON b.height=t.block_height WHERE lower(sender)=lower($1) OR lower(recipient)=lower($1) ORDER BY block_height DESC,tx_index DESC LIMIT $2 OFFSET $3`,[match[1],limitOf(url),offsetOf(url)])]);return account.rows[0]?json(res,200,{account:account.rows[0],transactions:txs.rows}):json(res,404,{error:'주소를 찾을 수 없습니다.'});}
  if(path==='/api/explorer/tokens'){const rows=await query("SELECT * FROM tokens WHERE standard='IEUM-20' ORDER BY verified DESC,name LIMIT $1 OFFSET $2",[limitOf(url),offsetOf(url)]);return json(res,200,{supported:false,reason:'IEUM Chain 토큰 이벤트 RPC 추가 후 자동 인덱싱됩니다.',items:rows.rows});}
  if(path==='/api/explorer/nfts'){const rows=await query("SELECT * FROM tokens WHERE standard IN ('IEUM-721','IEUM-1155') ORDER BY verified DESC,name LIMIT $1 OFFSET $2",[limitOf(url),offsetOf(url)]);return json(res,200,{supported:false,reason:'IEUM Chain NFT 표준 및 이벤트 RPC 추가 후 자동 인덱싱됩니다.',items:rows.rows});}
  if(path==='/api/explorer/nodes'){const rows=await query('SELECT * FROM discovered_nodes ORDER BY online DESC,name');return json(res,200,{discoveryMode:'configured+peer-rpc-ready',items:rows.rows});}
  return json(res,404,{error:'API not found'});
}

export function hexToBigInt(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('invalid hex quantity');
  return BigInt(value);
}

export function formatUnits(value, decimals = 18, maxFractionDigits = 8) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('decimals must be a non-negative integer');
  if (!Number.isInteger(maxFractionDigits) || maxFractionDigits < 0) throw new Error('maxFractionDigits must be a non-negative integer');
  const negative=n<0n;const absolute=negative?-n:n;
  const shownDecimals=Math.min(decimals,maxFractionDigits);const discardedDecimals=decimals-shownDecimals;
  const roundingUnit=10n**BigInt(discardedDecimals);
  const rounded=discardedDecimals>0?(absolute+roundingUnit/2n)/roundingUnit:absolute;
  const displayScale=10n**BigInt(shownDecimals);const whole=rounded/displayScale;
  const fraction=shownDecimals>0?(rounded%displayScale).toString().padStart(shownDecimals,'0').replace(/0+$/,''):'';
  return `${negative?'-':''}${whole}${fraction?`.${fraction}`:''}`;
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
    online.forEach(n=>{
      const storage=n.storage||{};
      if (storage.latest_checkpoint_height != null && storage.latest_certified_snapshot_height !== storage.latest_checkpoint_height) alerts.push({level:'critical',message:`${n.name} 최신 체크포인트 ${storage.latest_checkpoint_height}가 아직 2/3 인증되지 않음`});
      if (storage.certified_snapshot_count === 0 && storage.latest_checkpoint_height != null) alerts.push({level:'critical',message:`${n.name} 인증 snapshot 없음`});
    });
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
      managerVersion:'0.3.7',chainVersion:'0.22.5',nodes,wallets,transactions,chain,alerts:buildAlerts(nodes,chain),summary:{onlineNodes:nodes.filter(n=>n.online).length,totalNodes:nodes.length,
      height:tip??null,chainId:primary?.identity?.chainId??null,peers:nodes.reduce((s,n)=>s+(n.status?.peers||0),0),
      pending:nodes.reduce((s,n)=>s+(n.txpool?.pending||0),0)}};
    cache={at:Date.now(),data,pending:null}; return data;
  })().catch(error=>{cache.pending=null;throw error});
  return cache.pending;
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','no-referrer');
  res.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(req.url.startsWith('/api/explorer/')){try{return await explorerApi(req,res,new URL(req.url,'http://localhost'));}catch(error){return json(res,500,{error:error.message});}}
  if(req.url==='/api/snapshot'){
    try{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(await snapshot()));}
    catch(error){res.writeHead(503,{'content-type':'application/json'});return res.end(JSON.stringify({error:error.message}));}
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,''); const path=join(root,'public',safe);
  try{const body=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'public, max-age=300'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  server.listen(port,host,()=>console.log(`IEUM Manager listening on http://${host}:${port}`));
}
