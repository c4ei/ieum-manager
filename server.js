import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {query,dbReady,pool} from './lib/db.js';
import {applyPolicy,audit,loadPolicy,recentAudit,savePolicy,wafDecision} from './lib/admin-policy.js';

const root = new URL('.', import.meta.url).pathname;
const host = process.env.IEUM_MANAGER_HOST || '0.0.0.0';
const port = Number(process.env.IEUM_MANAGER_PORT || 8787);
const configPath = process.env.IEUM_MANAGER_CONFIG || join(root, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const timeoutMs = Number(process.env.IEUM_RPC_TIMEOUT_MS || 4000);
let rpcId = 0;
let cache = { at: 0, data: null, pending: null };
const adminToken=process.env.IEUM_MANAGER_ADMIN_TOKEN||'';
const jwtSecret=process.env.JWT_SECRET||'';
const attempts=new Map();
const requestBuckets=new Map();
const FOUNDATION_WALLET='0x356456fF1216B57a6f8891b195b42d296789B67D';
const GUILD_PRICE_WEI=1_000_000_000_000_000_000n;
const GUILD_CAPACITY=[0,20,40,60,80,100];

const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const limitOf=(url,fallback=25,max=100)=>Math.min(Math.max(Number(url.searchParams.get('limit'))||fallback,1),max);
const offsetOf=url=>Math.max(Number(url.searchParams.get('offset'))||0,0);
const pageOf=url=>Math.max(Number(url.searchParams.get('page'))||1,1);
const paging=(url,total,fallback=25,max=100)=>{const limit=limitOf(url,fallback,max);const page=pageOf(url);const offset=(page-1)*limit;const pages=Math.max(Math.ceil(Number(total)/limit),1);return {limit,page,offset,total:Number(total),pages,previous:page>1?page-1:null,next:page<pages?page+1:null};};
export const normalizeExplorerTerm=value=>{const term=String(value||'').trim();return /^[0-9a-f]{64}$/i.test(term)?`0x${term}`:term;};
const validHash=value=>/^0x[0-9a-f]{64}$/i.test(value||'');
const validAddress=value=>/^0x[0-9a-f]{40}$/i.test(value||'');
const requestIp=req=>String(process.env.IEUM_MANAGER_TRUST_PROXY==='1'?(req.headers['cf-connecting-ip']||req.headers['x-real-ip']||req.socket.remoteAddress):(req.socket.remoteAddress||'unknown')).split(',')[0].trim();
function rateAllowed(req,limit){const key=`${requestIp(req)}:${req.url.startsWith('/api/admin/')?'admin':'public'}`,now=Date.now(),entry=requestBuckets.get(key)||{started:now,count:0};if(now-entry.started>=60_000){entry.started=now;entry.count=0;}entry.count++;requestBuckets.set(key,entry);return entry.count<=limit;}
const secureEqual=(left,right)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
function cookie(req,name){return String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)||'';}
function aahAdmin(req){try{const decoded=jwt.verify(decodeURIComponent(cookie(req,'token')),jwtSecret);return decoded?.userType==='A'?decoded:null;}catch{return null;}}
function aahUser(req){try{return jwt.verify(decodeURIComponent(cookie(req,'token')),jwtSecret)||null;}catch{return null;}}
function adminAuthorized(req){if(aahAdmin(req))return true;const ip=requestIp(req),now=Date.now(),entry=attempts.get(ip)||{count:0,blockedUntil:0};if(entry.blockedUntil>now)return false;const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const ok=adminToken.length>=32&&secureEqual(supplied,adminToken);if(ok){attempts.delete(ip);return true;}entry.count++;if(entry.count>=5){entry.blockedUntil=now+15*60_000;entry.count=0;}attempts.set(ip,entry);return false;}
async function readJson(req,max=16_384){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('요청 본문이 너무 큽니다.');body+=chunk;}return body?JSON.parse(body):{};}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;return origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;}

async function adminApi(req,res,url){
  const ip=requestIp(req);if(!adminAuthorized(req)){await audit({action:'auth-failed',ip});return json(res,401,{error:'관리자 인증이 필요합니다.'});}
  if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});
  if(req.method==='GET'&&url.pathname==='/api/admin/session'){const user=aahAdmin(req);return json(res,200,{authenticated:true,source:user?'aah-jwt':'emergency-token',user:user?{email:user.email,username:user.username}:null});}
  if(req.method==='GET'&&url.pathname==='/api/admin/status'){const policy=await loadPolicy();return json(res,200,{policy,nodes:applyPolicy(config.nodes,policy),security:{activeAuthBlocks:[...attempts.values()].filter(entry=>entry.blockedUntil>Date.now()).length,trackedRateBuckets:requestBuckets.size},capabilities:{managerRpcPolicy:true,alertRefresh:true,wafAudit:true,p2pPeerBan:false,validatorPowerChange:false},notice:'우선순위는 Manager 조회 소스 선택에만 적용되며 채굴·합의 투표권을 변경하지 않습니다.'});}
  if(req.method==='GET'&&url.pathname==='/api/admin/events')return json(res,200,{items:await recentAudit(url.searchParams.get('limit'))});
  if(req.method==='GET'&&url.pathname==='/api/admin/waf'){const policy=await loadPolicy();return json(res,200,{settings:policy.waf,rules:Object.entries(policy.waf.rules||{}).map(([ip,rule])=>({ip,...rule})),quarantine:Object.entries(policy.waf.quarantine||{}).map(([ip,item])=>({ip,...item})),events:await recentAudit(url.searchParams.get('limit')||200)});}
  if(req.method==='PUT'&&url.pathname==='/api/admin/waf'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});const input=await readJson(req),policy=await loadPolicy();
    if(input.settings)policy.waf={...policy.waf,mode:input.settings.mode==='monitor'?'monitor':'block',scoreThreshold:Math.max(1,Math.min(100,Number(input.settings.scoreThreshold)||10)),blockTtlSeconds:Math.max(60,Math.min(604800,Number(input.settings.blockTtlSeconds)||3600))};
    if(input.rule){const ip=String(input.rule.ip||'').trim();if(!/^[0-9a-f:.]{2,64}$/i.test(ip))return json(res,400,{error:'올바른 IP를 입력하세요.'});policy.waf.rules[ip]={type:input.rule.type==='allow'?'allow':'block',active:input.rule.active!==false,memo:String(input.rule.memo||'').slice(0,200),updatedAt:new Date().toISOString()};}
    if(input.releaseIp){delete policy.waf.quarantine[String(input.releaseIp)];if(input.allowReleased)policy.waf.rules[String(input.releaseIp)]={type:'allow',active:true,memo:'관리자 차단 해제',updatedAt:new Date().toISOString()};}
    await savePolicy(policy);await audit({action:'waf-policy-updated',ip,change:Object.keys(input)});return json(res,200,{ok:true});
  }
  if(req.method==='PUT'&&url.pathname==='/api/admin/policy'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});
    const input=await readJson(req);const ids=new Set(config.nodes.map(n=>n.id));const nodes={};
    for(const [id,rule] of Object.entries(input.nodes||{})){if(!ids.has(id))return json(res,400,{error:`알 수 없는 노드: ${id}`});nodes[id]={blocked:Boolean(rule.blocked),priority:Math.max(0,Math.min(100,Number(rule.priority)||0)),note:String(rule.note||'').slice(0,200)};}
    if(config.nodes.every(node=>nodes[node.id]?.blocked))return json(res,400,{error:'모든 RPC 노드를 동시에 차단할 수 없습니다.'});
    const policy=await savePolicy({nodes});cache={at:0,data:null,pending:null};await audit({action:'policy-updated',ip,nodes});return json(res,200,{ok:true,policy});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/refresh'){cache={at:0,data:null,pending:null};await audit({action:'snapshot-refresh',ip});return json(res,200,{ok:true});}
  return json(res,404,{error:'관리 API를 찾을 수 없습니다.'});
}

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
    const term=normalizeExplorerTerm(url.searchParams.get('q'));
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

async function guildApi(req,res,url){
  if(!await dbReady())return json(res,503,{error:'길드 데이터베이스 연결 대기 중'});
  if(req.method==='GET'&&url.pathname==='/api/guilds'){
    const rows=await query(`SELECT g.*,count(DISTINCT m.wallet)::int member_count,count(DISTINCT e.id)::int event_count,
      (count(DISTINCT m.wallet)*10+count(DISTINCT e.id)*5)::int popularity
      FROM guilds g LEFT JOIN guild_members m ON m.guild_id=g.id LEFT JOIN guild_events e ON e.guild_id=g.id
      GROUP BY g.id ORDER BY popularity DESC,g.created_at ASC LIMIT 100`);
    return json(res,200,{items:rows.rows.map(g=>({...g,capacity:GUILD_CAPACITY[g.level]})),rankNames:['','새싹','길드원','운영진','부길드장','길드장']});
  }
  if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});
  const user=aahUser(req);if(!user)return json(res,401,{error:'AAH 로그인이 필요합니다.'});
  if(req.method==='POST'&&url.pathname==='/api/guilds'){
    const input=await readJson(req),name=String(input.name||'').trim(),wallet=String(input.ownerWallet||'').trim(),txHash=String(input.paymentTxHash||'').trim();
    if(name.length<2||name.length>30)return json(res,400,{error:'길드명은 2~30자로 입력하세요.'});
    if(!validAddress(wallet)||!validHash(txHash))return json(res,400,{error:'지갑 주소 또는 결제 거래 해시를 확인하세요.'});
    const found=await query('SELECT hash,block_height,sender,recipient,value FROM transactions WHERE lower(hash)=lower($1)',[txHash]);const paid=found.rows[0];
    if(!paid||paid.sender.toLowerCase()!==wallet.toLowerCase()||paid.recipient.toLowerCase()!==FOUNDATION_WALLET.toLowerCase()||BigInt(paid.value)<GUILD_PRICE_WEI)return json(res,400,{error:'재단지갑으로 확정된 1 IEUM 결제를 찾지 못했습니다.'});
    const used=await query('SELECT 1 FROM guild_payment_receipts WHERE lower(tx_hash)=lower($1)',[txHash]);if(used.rows[0])return json(res,409,{error:'이미 사용한 결제 거래입니다.'});
    const identity=String(user.email||user.username||user.sub);
    const client=await pool.connect();try{await client.query('BEGIN');const made=await client.query('INSERT INTO guilds(name,description,region,owner_wallet,owner_aah_user) VALUES($1,$2,$3,$4,$5) RETURNING *',[name,String(input.description||'').slice(0,300),String(input.region||'').slice(0,50),wallet,identity]);await client.query('INSERT INTO guild_members(guild_id,wallet,aah_user,rank) VALUES($1,$2,$3,5)',[made.rows[0].id,wallet,identity]);await client.query('INSERT INTO guild_payment_receipts(tx_hash,guild_id,sender,recipient,amount,block_height) VALUES($1,$2,$3,$4,$5,$6)',[txHash,made.rows[0].id,paid.sender,paid.recipient,paid.value,paid.block_height]);await client.query('COMMIT');return json(res,201,{guild:{...made.rows[0],capacity:20},payment:{recipient:FOUNDATION_WALLET,amount:'1 IEUM',finalized:true}});}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  if(req.method==='POST'&&url.pathname==='/api/guilds/reports'){
    const input=await readJson(req),type=String(input.targetType||'');if(!['guild','member','event'].includes(type)||!String(input.reason||'').trim())return json(res,400,{error:'신고 대상과 사유를 입력하세요.'});
    const made=await query('INSERT INTO community_reports(reporter_user,reporter_wallet,target_type,target_id,reason,evidence) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,reward_status',[String(user.email||user.username||user.sub),validAddress(input.reporterWallet)?input.reporterWallet:null,type,String(input.targetId||'').slice(0,100),String(input.reason).slice(0,500),String(input.evidence||'').slice(0,1000)]);return json(res,201,{report:made.rows[0],notice:'포상은 운영자 심사 후 별도 승인되며 자동 지급되지 않습니다.'});
  }
  return json(res,404,{error:'길드 API를 찾을 수 없습니다.'});
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
    const [supply, validators, production, balances, holderReward] = await Promise.all([
      rpc(primary.rpcUrl, 'ieum_supplyStatus'),
      rpc(primary.rpcUrl, 'ieum_validatorStatus', [Number(config.validatorWindow) || 1000]),
      inspectProduction(primary),
      rpc(primary.rpcUrl, 'ieum_addressBalances', [0, Math.min(Number(config.accountLimit) || 100, 1000)]),
      rpc(primary.rpcUrl, 'ieum_holderRewardStatus').catch(()=>({result:null}))
    ]);
    const decimals = supply.result.decimals ?? config.unitDecimals ?? 18;
    return {
      available:true,
      supply:{...supply.result,totalIssuedFormatted:formatUnits(supply.result.Bal_All??supply.result.totalIssued,decimals),
        circulatingFormatted:formatUnits(supply.result.Bal_Utong_All??supply.result.circulating,decimals),lockedFormatted:formatUnits(supply.result.Bal_Lock_All??supply.result.locked,decimals)},
      holderReward:holderReward.result,
      validators:validators.result,
      validatorMinimumSamples:Math.max(1,Number(config.validatorMinimumSamples)||20),
      production,
      accounts:{...balances.result,accounts:(balances.result.accounts || []).map(account=>({...account,
        balanceFormatted:formatUnits(account.balance,decimals)}))}
    };
  } catch (error) {
    return {available:false,error:error.message};
  }
}

const quantity=value=>typeof value==='string'&&value.startsWith('0x')?Number(BigInt(value)):Number(value);
export async function inspectProduction(primary){
  const tip=Number(primary?.status?.height);if(!Number.isFinite(tip)||tip<1)return {sampleBlocks:0,averageBlockTimeSeconds:null,estimatedMissedSlots:0,producerBlocks:{},genesisExcluded:true};
  const count=Math.min(Math.max(Number(config.productionWindow)||100,2),tip);
  const heights=Array.from({length:count},(_,index)=>tip-index).filter(height=>height>0);
  const blocks=(await Promise.all(heights.map(async height=>{try{return (await rpc(primary.rpcUrl,'eth_getBlockByNumber',[`0x${height.toString(16)}`,false])).result;}catch{return null;}}))).filter(Boolean)
    .map(block=>({height:quantity(block.number),timestamp:quantity(block.timestamp),producer:block.miner||block.producer||'unknown'})).sort((a,b)=>a.height-b.height);
  return summarizeProduction(blocks);
}
export function summarizeProduction(blocks){
  const intervals=blocks.slice(1).map((block,index)=>Math.max(0,block.timestamp-blocks[index].timestamp));const target=3;
  const producerBlocks={};for(const block of blocks)producerBlocks[block.producer]=(producerBlocks[block.producer]||0)+1;
  return {sampleBlocks:blocks.length,intervalSamples:intervals.length,averageBlockTimeSeconds:intervals.length?intervals.reduce((sum,value)=>sum+value,0)/intervals.length:null,estimatedMissedSlots:intervals.reduce((sum,value)=>sum+Math.max(0,Math.floor(value/target)-1),0),producerBlocks,genesisExcluded:true};
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
    const minimum=Math.max(1,Number(config.validatorMinimumSamples)||20);
    (chain.validators?.validators || []).filter(v=>v.eligibleBlocks>0 && v.eligibleBlocks<minimum)
      .forEach(v=>alerts.push({level:'info',message:`검증자 ${v.id} 서명률 표본 부족 (${v.eligibleBlocks}/${minimum} 블록)`}));
    (chain.validators?.validators || []).filter(v=>v.eligibleBlocks>=minimum && v.signingRatePercent<95)
      .forEach(v=>alerts.push({level:v.signingRatePercent<80?'critical':'warning',message:`검증자 ${v.id} 서명률 ${v.signingRatePercent.toFixed(2)}%`}));
    if (chain.production?.intervalSamples>0 && chain.production.averageBlockTimeSeconds>6) alerts.push({level:'warning',message:`평균 블록 생성 시간이 ${chain.production.averageBlockTimeSeconds.toFixed(2)}초입니다.`});
  }
  return alerts;
}

async function snapshot() {
  const ttl=(Number(config.refreshSeconds)||10)*1000;
  if (cache.data && Date.now()-cache.at<ttl) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending=(async()=>{
    const policy=await loadPolicy();const configured=applyPolicy(config.nodes,policy);const nodes=await Promise.all(configured.map(inspectNode));
    const primary=nodes.find(n=>n.online&&!n.admin.blocked); const tip=primary?.status?.height;
    const [wallets,transactions,chain]=await Promise.all([inspectWallets(primary),recentFlow(primary,tip),inspectChain(primary)]);
    const data={generatedAt:new Date().toISOString(),symbol:config.unitSymbol||'IEUM',decimals:config.unitDecimals??18,
      managerVersion:'0.3.15',chainVersion:primary?.status?.version??null,nodes,wallets,transactions,chain,alerts:buildAlerts(nodes,chain),summary:{onlineNodes:nodes.filter(n=>n.online).length,totalNodes:nodes.length,
      height:tip??null,chainId:primary?.identity?.chainId??null,peers:nodes.reduce((s,n)=>s+(n.status?.peers||0),0),
      pending:nodes.reduce((s,n)=>s+(n.txpool?.pending||0),0)}};
    cache={at:Date.now(),data,pending:null}; return data;
  })().catch(error=>{cache.pending=null;throw error});
  return cache.pending;
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','no-referrer');
  res.setHeader('x-frame-options','DENY');res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('cross-origin-resource-policy','same-origin');
  res.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  const url=new URL(req.url,'http://localhost');
  const policy=await loadPolicy(),clientIp=requestIp(req),decision=wafDecision(policy,clientIp,{path:url.pathname,userAgent:req.headers['user-agent']});
  if(decision.action!=='allow'){await audit({action:`waf-${decision.action}`,ip:clientIp,method:req.method,path:url.pathname.slice(0,512),score:decision.score,reasons:decision.reasons,userAgent:String(req.headers['user-agent']||'').slice(0,300)});if(decision.action==='block'){policy.waf.quarantine[clientIp]={score:decision.score,reasons:decision.reasons,expiresAt:new Date(Date.now()+Number(policy.waf.blockTtlSeconds||3600)*1000).toISOString()};await savePolicy(policy);return json(res,403,{error:'WAF에서 요청을 차단했습니다.'});}}
  if(!rateAllowed(req,url.pathname.startsWith('/api/admin/')?30:180)){await audit({action:'waf-rate-limit',ip:requestIp(req),method:req.method,path:url.pathname});return json(res,429,{error:'요청이 너무 많습니다. 잠시 후 다시 시도하세요.'});}
  if(url.pathname.length>512||/[\\\0]/.test(url.pathname)||/(?:\.\.|%2e%2e|wp-admin|wp-login|\.env|\.git)/i.test(req.url)){await audit({action:'waf-path-block',ip:requestIp(req),method:req.method,path:url.pathname.slice(0,512)});return json(res,403,{error:'WAF에서 요청을 차단했습니다.'});}
  if(url.pathname.startsWith('/api/admin/')){try{return await adminApi(req,res,url);}catch(error){await audit({action:'admin-error',ip:requestIp(req),error:error.message});return json(res,400,{error:error.message});}}
  if(url.pathname.startsWith('/api/guilds')){try{return await guildApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'허용되지 않은 HTTP 메서드입니다.'});
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(req.url.startsWith('/api/explorer/')){try{return await explorerApi(req,res,new URL(req.url,'http://localhost'));}catch(error){return json(res,500,{error:error.message});}}
  if(req.url==='/api/snapshot'){
    try{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(await snapshot()));}
    catch(error){res.writeHead(503,{'content-type':'application/json'});return res.end(JSON.stringify({error:error.message}));}
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const detailRoutes=new Set(['/nodes','/validators','/accounts','/transactions','/explorer']);const entityRoute=/^\/(?:tx|address|block)\/[^/]+$/;const adminRoutes=/^\/admin(?:\/dashboard|\/rpc|\/waf|\/blocked|\/audit)?$/;
  const requested = pathname === '/' ? 'index.html' : detailRoutes.has(pathname)||entityRoute.test(pathname)?'detail.html':adminRoutes.test(pathname)?'admin.html':pathname.replace(/^\//, '');
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,''); const path=join(root,'public',safe);
  try{const body=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'public, max-age=300'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  server.listen(port,host,()=>console.log(`IEUM Manager listening on http://${host}:${port}`));
}
