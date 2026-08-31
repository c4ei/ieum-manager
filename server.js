import http from 'node:http';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import sharp from 'sharp';
import opentype from 'opentype.js';
import {JsonRpcProvider,Wallet} from 'ethers';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {query,dbReady,pool} from './lib/db.js';
import {applyPolicy,audit,loadPolicy,recentAudit,savePolicy,wafDecision} from './lib/admin-policy.js';
import {normalizePeer,peerSummary} from './lib/peers.js';
import {assertNoOverlap,assertSnsClaimUnique,holderConfig,normalizeCampaign,sanitizePayout,sanitizeSnsClaim} from './lib/reward-campaigns.js';
import {diagnoseNodes} from './lib/chain-health.js';
import {buildVoucherPayout,createVoucherSecrets,formatVoucherAmount,inspectVoucherPayout,parseVoucherAmount,validVoucherAddress,voucherCodeMatches,voucherDigest} from './lib/vouchers.js';
import {decryptVoucherSecret,encryptVoucherSecret} from './lib/voucher-archive.js';
import {jwtAdmin,jwtUser} from './lib/admin-auth.js';
import {createTrialMailer,createVerificationToken,emailDigest,normalizeEmail,validEmail,verificationDigest} from './lib/trial-email.js';

const root = new URL('.', import.meta.url).pathname;
const trialRegularBuffer=await readFile(join(root,'node_modules/@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf')),trialBoldBuffer=await readFile(join(root,'node_modules/@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf'));
const trialFont=opentype.parse(trialRegularBuffer.buffer.slice(trialRegularBuffer.byteOffset,trialRegularBuffer.byteOffset+trialRegularBuffer.byteLength));
const trialBoldFont=opentype.parse(trialBoldBuffer.buffer.slice(trialBoldBuffer.byteOffset,trialBoldBuffer.byteOffset+trialBoldBuffer.byteLength));
const trialSvgText=(value,x,y,size,fill,weight=400)=>`<path d="${(weight>=600?trialBoldFont:trialFont).getPath(String(value),x,y,size).toPathData(2)}" fill="${fill}"/>`;
const host = process.env.IEUM_MANAGER_HOST || '0.0.0.0';
const port = Number(process.env.IEUM_MANAGER_PORT || 8787);
const configPath = process.env.IEUM_MANAGER_CONFIG || join(root, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const packageInfo = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
export const managerVersion = String(packageInfo.version).replace(/-(\d+)$/, '.$1');
const timeoutMs = Number(process.env.IEUM_RPC_TIMEOUT_MS || 4000);
let rpcId = 0;
let cache = { at: 0, data: null, pending: null };
let healthHistory=new Map();
const adminToken=process.env.IEUM_MANAGER_ADMIN_TOKEN||'';
const jwtSecret=process.env.JWT_SECRET||'';
const snsVerifyUrl=process.env.IEUM_SNS_VERIFY_URL||'';
const snsVerifyToken=process.env.IEUM_SNS_VERIFY_TOKEN||'';
const recoveryControlDir=process.env.IEUM_RECOVERY_CONTROL_DIR||'';
const recoveryControlToken=process.env.IEUM_RECOVERY_CONTROL_TOKEN||'';
const attempts=new Map();
const requestBuckets=new Map();
const FOUNDATION_WALLET='0x356456ff1216b57a6f8891b195b42d296789b67d';
const GUILD_PRICE_WEI=1_000_000_000_000_000_000n;
const GUILD_CAPACITY=[0,20,40,60,80,100];
const IEUM_BANK={bank:'카카오뱅크',account:'3333-27-5746222',holder:'씨포이아이(C4EI)',rate:'1 AAH = 1 IEUM'};
const voucherPepper=process.env.IEUM_VOUCHER_CODE_PEPPER||'';
const voucherPublicUrl=(process.env.IEUM_VOUCHER_PUBLIC_URL||'https://iem.aah.name').replace(/\/$/,'');
const voucherRpcUrl=process.env.IEUM_VOUCHER_RPC_URL||config.nodes?.[0]?.rpcUrl||'';
const voucherExplorerUrl=process.env.IEUM_VOUCHER_EXPLORER_URL||`${voucherPublicUrl}/tx/`;
const voucherPrivateKey=process.env.IEUM_VOUCHER_PRIVATE_KEY||'';
const voucherArchiveKey=process.env.IEUM_VOUCHER_ARCHIVE_KEY||'';
const trialFingerprintKey=process.env.IEUM_TRIAL_FINGERPRINT_KEY||voucherArchiveKey;
const turnstileSecret=process.env.IEUM_TURNSTILE_SECRET||'';
const turnstileSiteKey=process.env.IEUM_TURNSTILE_SITE_KEY||'';
const trialMailer=createTrialMailer();
const trialEmailVerificationMinutes=Math.min(Math.max(Number(process.env.IEUM_TRIAL_EMAIL_VERIFICATION_MINUTES)||1440,15),10080);
let voucherPayout=Promise.resolve();

const trialHash=value=>createHmac('sha256',trialFingerprintKey).update(String(value||'')).digest('hex');
const requestCountry=req=>{if(process.env.IEUM_MANAGER_TRUST_PROXY!=='1')return null;const value=String(req.headers['cf-ipcountry']||'').toUpperCase();return /^[A-Z]{2}$/.test(value)&&value!=='XX'&&value!=='T1'?value:null;};
const cleanDownloadPart=value=>String(value).replace(/[^0-9A-Za-z._-]+/g,'_').slice(0,80);
const escapeMeta=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const trialMetadata=campaign=>{const view=trialView(campaign),url=`${voucherPublicUrl}/trial/${campaign.public_id}`,image=`${voucherPublicUrl}/api/trial/${campaign.public_id}/image.png?lang=ko`,title=`${campaign.name} · ${view.reward} IEUM 첫 체험`,description=`공식 IEUM Mainnet 21004 체험 캠페인입니다. 내 IEUM 지갑으로 ${view.reward} IEUM을 받아 직접 확인해 보세요. 캠페인당 한 지갑 1회이며 예산 소진 시 종료됩니다.`,structured=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:title,description,url,inLanguage:['ko','en'],isAccessibleForFree:true,image:{'@type':'ImageObject',url:image,width:1200,height:630},publisher:{'@type':'Organization',name:'C4EI',url:'https://github.com/c4ei'},about:{'@type':'SoftwareApplication',name:'IEUM Wallet',applicationCategory:'FinanceApplication',operatingSystem:'Windows, macOS, Linux',url:'https://github.com/c4ei/ieum-wallet'},datePublished:new Date(campaign.created_at||campaign.starts_at).toISOString(),expires:new Date(campaign.ends_at).toISOString()}).replaceAll('<','\\u003c');return `<meta name="description" content="${escapeMeta(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><meta name="keywords" content="IEUM, 이음, IEUM Wallet, blockchain, 블록체인, Mainnet 21004"><link rel="canonical" href="${escapeMeta(url)}"><meta property="og:locale" content="ko_KR"><meta property="og:locale:alternate" content="en_US"><meta property="og:type" content="website"><meta property="og:site_name" content="IEUM Manager"><meta property="og:title" content="${escapeMeta(title)}"><meta property="og:description" content="${escapeMeta(description)}"><meta property="og:url" content="${escapeMeta(url)}"><meta property="og:image" content="${escapeMeta(image)}"><meta property="og:image:secure_url" content="${escapeMeta(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escapeMeta(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeMeta(title)}"><meta name="twitter:description" content="${escapeMeta(description)}"><meta name="twitter:image" content="${escapeMeta(image)}"><script type="application/ld+json">${structured}</script>`;};
async function voucherFrontSvg(voucher,publicId,token,code=''){
  const claimUrl=`${voucherPublicUrl}/voucher/${publicId}?token=${encodeURIComponent(token)}`,qr=await QRCode.toString(claimUrl,{type:'svg',margin:2,errorCorrectionLevel:'M'}),qrPlaced=qr.trim().replace(/^<svg\s/,'<svg x="820" y="245" width="300" height="300" '),amount=formatVoucherAmount(voucher.amount_wei);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#081d2b"/><stop offset="1" stop-color="#123b33"/></linearGradient></defs><rect width="1200" height="630" rx="42" fill="url(#g)"/><circle cx="1040" cy="90" r="180" fill="#21d39b" opacity=".12"/><text x="70" y="90" fill="#46e6b5" font-family="sans-serif" font-size="28" font-weight="700">IEUM DIGITAL GIFT</text><text x="70" y="205" fill="white" font-family="sans-serif" font-size="84" font-weight="800">${amount} IEUM</text><text x="70" y="275" fill="#a8c7c0" font-family="sans-serif" font-size="25">QR을 찍고 받을 지갑 주소와 교환번호를 입력하세요.</text><text x="70" y="330" fill="#ffcf70" font-family="sans-serif" font-size="22">먼저 정상 등록한 한 사람에게만 지급됩니다.</text><rect x="70" y="375" width="630" height="150" rx="18" fill="#fff" opacity=".08"/><text x="100" y="417" fill="#9db4b0" font-family="sans-serif" font-size="18">상품권 번호</text><text x="100" y="455" fill="white" font-family="monospace" font-size="29">${publicId}</text>${code?`<text x="100" y="493" fill="#9db4b0" font-family="sans-serif" font-size="18">교환번호</text><text x="270" y="493" fill="#ffcf70" font-family="monospace" font-size="25" font-weight="700">${code}</text>`:''}<rect x="810" y="235" width="320" height="320" rx="18" fill="#fff"/>${qrPlaced}<text x="820" y="590" fill="#a8c7c0" font-family="sans-serif" font-size="17">iem.aah.name · IEUM Mainnet 21004</text></svg>`;
}

const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const limitOf=(url,fallback=25,max=100)=>Math.min(Math.max(Number(url.searchParams.get('limit'))||fallback,1),max);
const offsetOf=url=>Math.max(Number(url.searchParams.get('offset'))||0,0);
const pageOf=url=>Math.max(Number(url.searchParams.get('page'))||1,1);
const paging=(url,total,fallback=25,max=100)=>{const limit=limitOf(url,fallback,max);const page=pageOf(url);const offset=(page-1)*limit;const pages=Math.max(Math.ceil(Number(total)/limit),1);return {limit,page,offset,total:Number(total),pages,previous:page>1?page-1:null,next:page<pages?page+1:null};};
export const normalizeExplorerTerm=value=>{const term=String(value||'').trim();return /^[0-9a-f]{64}$/i.test(term)?`0x${term}`:term;};
const validHash=value=>/^0x[0-9a-f]{64}$/i.test(value||'');
const validAddress=value=>/^0x[0-9a-f]{40}$/i.test(value||'');
export const explorerTermType=value=>{const term=normalizeExplorerTerm(value);if(/^\d+$/.test(term))return 'block-height';if(validHash(term))return 'hash';if(validAddress(term))return 'address';return 'invalid';};
const requestIp=req=>String(process.env.IEUM_MANAGER_TRUST_PROXY==='1'?(req.headers['cf-connecting-ip']||req.headers['x-real-ip']||req.socket.remoteAddress):(req.socket.remoteAddress||'unknown')).split(',')[0].trim();
function rateAllowed(req,limit){const key=`${requestIp(req)}:${req.url.startsWith('/api/admin/')?'admin':'public'}`,now=Date.now(),entry=requestBuckets.get(key)||{started:now,count:0};if(now-entry.started>=60_000){entry.started=now;entry.count=0;}entry.count++;requestBuckets.set(key,entry);return entry.count<=limit;}
const secureEqual=(left,right)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
function aahAdmin(req){return jwtAdmin(req,jwtSecret);}
function aahUser(req){return jwtUser(req,jwtSecret);}
function adminAuthorized(req){if(aahAdmin(req))return true;const ip=requestIp(req),now=Date.now(),entry=attempts.get(ip)||{count:0,blockedUntil:0};if(entry.blockedUntil>now)return false;const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const ok=adminToken.length>=32&&secureEqual(supplied,adminToken);if(ok){attempts.delete(ip);return true;}entry.count++;if(entry.count>=5){entry.blockedUntil=now+15*60_000;entry.count=0;}attempts.set(ip,entry);return false;}
async function readJson(req,max=16_384){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('요청 본문이 너무 큽니다.');body+=chunk;}return body?JSON.parse(body):{};}
export async function verifySnsClaim(claim,{verifyUrl=snsVerifyUrl,verifyToken=snsVerifyToken,fetchImpl=fetch}={}){
  if(!verifyUrl)return claim;
  if(!verifyUrl.startsWith('https://'))return {...claim,verification:'configuration-error',reviewerNote:'SNS 자동 확인 URL이 HTTPS가 아니어서 관리자 검토로 전환했습니다.'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetchImpl(verifyUrl,{method:'POST',headers:{'content-type':'application/json',...(verifyToken?{authorization:`Bearer ${verifyToken}`}:{})},body:JSON.stringify({platform:claim.platform,account:claim.account,postUrl:claim.postUrl}),signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const result=await response.json();
    if(result.verified!==true)return {...claim,verification:'platform-api-rejected',reviewerNote:String(result.reason||'자동 확인 실패').slice(0,300)};
    return {...claim,status:'approved',verification:'platform-api',platformAccountId:String(result.platformAccountId||'').slice(0,120)||null,postId:String(result.postId||'').slice(0,160)||null,reviewedAt:new Date().toISOString()};
  }catch(error){
    const reason=error?.name==='AbortError'?'자동 확인 시간 초과':`자동 확인 장애: ${error?.message||'알 수 없는 오류'}`;
    return {...claim,status:'pending',verification:'platform-api-unavailable',reviewerNote:reason.slice(0,300)};
  }finally{clearTimeout(timer);}
}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;return origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;}

async function normalizeStoredVoucherPayout(voucher){
  if(!/^0x[0-9a-f]+$/i.test(voucher.payout_raw_tx||''))throw new Error('저장된 raw 거래가 없어 안전하게 자동 복구할 수 없습니다.');
  const signed=inspectVoucherPayout(voucher.payout_raw_tx);
  const payoutWallet=new Wallet(voucherPrivateKey).address.toLowerCase();
  if(signed.from!==payoutWallet||signed.to!==String(voucher.claimed_address||'').toLowerCase()||signed.value!==BigInt(voucher.amount_wei)||signed.nonce!==Number(voucher.payout_nonce))throw new Error('저장된 raw 거래가 상품권 지급 정보와 일치하지 않아 자동 복구를 중단했습니다.');
  if(String(voucher.payout_expected_hash||'').toLowerCase()!==signed.expectedHash.toLowerCase()){
    await query('UPDATE ieum_vouchers SET payout_expected_hash=$2,updated_at=now() WHERE id=$1',[voucher.id,signed.expectedHash]);
  }
  return {...voucher,payout_expected_hash:signed.expectedHash};
}

async function verifyTurnstile(token,ip){
  if(!turnstileSecret)return false;const body=new URLSearchParams({secret:turnstileSecret,response:String(token||''),remoteip:ip});
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(5000)});if(!response.ok)return false;return (await response.json()).success===true;
}
const trialPublicId=()=>randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
const trialView=row=>({publicId:row.public_id,name:row.name,status:row.status,reward:formatVoucherAmount(row.reward_wei),budget:formatVoucherAmount(row.budget_wei),spent:formatVoucherAmount(row.spent_wei),remaining:formatVoucherAmount(BigInt(row.budget_wei)-BigInt(row.spent_wei)),startsAt:row.starts_at,endsAt:row.ends_at,ipDailyLimit:row.ip_daily_limit,deviceDailyLimit:row.device_daily_limit,burstLimit:row.burst_limit,minimumWaitSeconds:row.minimum_wait_seconds,captchaRequired:row.captcha_required});

async function adminApi(req,res,url){
  const ip=requestIp(req);if(!adminAuthorized(req)){await audit({action:'auth-failed',ip});return json(res,401,{error:'관리자 인증이 필요합니다.'});}
  if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});
  if(req.method==='GET'&&url.pathname==='/api/admin/session'){const user=aahAdmin(req);return json(res,200,{authenticated:true,source:user?'aah-jwt':'emergency-token',user:user?{email:user.email,username:user.username}:null});}
  if(req.method==='GET'&&url.pathname==='/api/admin/status'){const policy=await loadPolicy(),jwtAdmin=aahAdmin(req);return json(res,200,{auth:jwtAdmin?{type:'aah-jwt',label:'AAH 관리자 JWT 인증됨',user:{email:jwtAdmin.email,username:jwtAdmin.username}}:{type:'emergency-token',label:'비상 관리자 토큰 인증'},policy,nodes:applyPolicy(config.nodes,policy),security:{activeAuthBlocks:[...attempts.values()].filter(entry=>entry.blockedUntil>Date.now()).length,trackedRateBuckets:requestBuckets.size},capabilities:{managerRpcPolicy:true,alertRefresh:true,wafAudit:true,chainDiagnostics:true,limitedRecovery:Boolean(recoveryControlDir&&recoveryControlToken),p2pPeerBan:false,validatorPowerChange:false},notice:'우선순위는 Manager 조회 소스 선택에만 적용되며 채굴·합의 투표권을 변경하지 않습니다.'});}
  if(req.method==='GET'&&url.pathname==='/api/admin/trial-audience'){
    const country=String(url.searchParams.get('country')||'').toUpperCase(),marketing=url.searchParams.get('marketing'),verified=url.searchParams.get('verified'),search=String(url.searchParams.get('q')||'').trim().slice(0,120),limit=limitOf(url,50,200),offset=offsetOf(url),values=[];let where='WHERE 1=1';
    if(country){values.push(country);where+=` AND x.country_code=$${values.length}`;}if(marketing==='1'){where+=' AND x.marketing_consent=true';}if(verified==='1'){where+=' AND x.email_verified_at IS NOT NULL';}if(search){values.push(`%${search}%`);where+=` AND (x.email ILIKE $${values.length} OR x.address ILIKE $${values.length})`;}
    const count=(await query(`SELECT count(*)::int total FROM ieum_trial_claims x ${where}`,values)).rows[0].total;values.push(limit,offset);const rows=await query(`SELECT x.id,x.address,x.email,x.email_verified_at,x.privacy_consent_at,x.marketing_consent,x.marketing_consent_at,x.ip_address::text,x.country_code,x.target_tags,x.status,x.created_at,x.paid_at,x.payout_tx_hash,c.public_id campaign_public_id,c.name campaign_name FROM ieum_trial_claims x JOIN ieum_trial_campaigns c ON c.id=x.campaign_id ${where} ORDER BY x.created_at DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    return json(res,200,{items:rows.rows,paging:{limit,offset,total:Number(count)},notice:'이메일·IP는 개인정보입니다. 동의 목적과 보존기간 안에서만 사용하세요.'});
  }
  const audienceMatch=url.pathname.match(/^\/api\/admin\/trial-audience\/([0-9a-f-]{36})\/tags$/i);
  if(req.method==='POST'&&audienceMatch){const input=await readJson(req),tags=[...new Set((Array.isArray(input.tags)?input.tags:[]).map(x=>String(x).trim().slice(0,40)).filter(Boolean))].slice(0,20),row=(await query('UPDATE ieum_trial_claims SET target_tags=$2,updated_at=now() WHERE id=$1 RETURNING id,target_tags',[audienceMatch[1],tags])).rows[0];if(!row)return json(res,404,{error:'대상을 찾을 수 없습니다.'});await audit({action:'trial-audience-tags-updated',ip,claimId:row.id,tags});return json(res,200,{item:row});}
  if(req.method==='GET'&&url.pathname==='/api/admin/trial-polls'){const rows=await query(`SELECT p.*,coalesce((SELECT jsonb_object_agg(option_index,votes) FROM (SELECT option_index,count(*)::int votes FROM ieum_trial_poll_votes WHERE poll_id=p.id GROUP BY option_index) v),'{}'::jsonb) results FROM ieum_trial_polls p ORDER BY created_at DESC`);return json(res,200,{polls:rows.rows});}
  if(req.method==='POST'&&url.pathname==='/api/admin/trial-polls'){const input=await readJson(req),question=String(input.question||'').trim().slice(0,300),options=(Array.isArray(input.options)?input.options:[]).map(x=>String(x).trim().slice(0,120)).filter(Boolean).slice(0,10);if(question.length<3||options.length<2)return json(res,400,{error:'질문과 2개 이상의 선택지를 입력하세요.'});const targetFilter={marketingConsent:true,...(input.country?{country:String(input.country).toUpperCase()}:{}),...(input.tag?{tag:String(input.tag).slice(0,40)}:{})},actor=aahAdmin(req)?.email||'emergency-token',row=(await query('INSERT INTO ieum_trial_polls(id,question,options,target_filter,status,created_by,closes_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),question,JSON.stringify(options),JSON.stringify(targetFilter),'draft',actor,input.closesAt||null])).rows[0];await audit({action:'trial-poll-created',ip,pollId:row.id,actor});return json(res,201,{poll:row});}
  if(req.method==='GET'&&url.pathname==='/api/admin/trial-campaigns'){
    const campaigns=await query("SELECT c.*,(SELECT count(*)::int FROM ieum_trial_claims x WHERE x.campaign_id=c.id) AS claim_count,(SELECT count(*)::int FROM ieum_trial_claims x WHERE x.campaign_id=c.id AND x.status='paid') AS paid_count FROM ieum_trial_campaigns c ORDER BY c.created_at DESC");
    return json(res,200,{campaigns:campaigns.rows.map(row=>({...trialView(row),claimCount:row.claim_count,paidCount:row.paid_count,claimUrl:`${voucherPublicUrl}/trial/${row.public_id}`,cardPngKoUrl:`/api/trial/${row.public_id}/image.png?download=1&lang=ko`,cardPngEnUrl:`/api/trial/${row.public_id}/image.png?download=1&lang=en`})),configured:Boolean(voucherPrivateKey&&voucherRpcUrl&&trialFingerprintKey.length>=32),turnstileConfigured:Boolean(turnstileSecret&&turnstileSiteKey)});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/trial-campaigns'){
    const input=await readJson(req),name=String(input.name||'').trim().slice(0,80),reward=parseVoucherAmount(input.reward||'0.001'),budget=parseVoucherAmount(input.budget||'10'),startsAt=new Date(input.startsAt),endsAt=new Date(input.endsAt),actor=aahAdmin(req)?.email||'emergency-token';
    if(name.length<2)return json(res,400,{error:'캠페인 이름을 2자 이상 입력하세요.'});if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return json(res,400,{error:'시작일과 종료일을 올바르게 입력하세요.'});if(reward>budget)return json(res,400,{error:'1회 지급액은 캠페인 예산보다 클 수 없습니다.'});
    const id=randomUUID(),publicId=trialPublicId(),row=(await query('INSERT INTO ieum_trial_campaigns(id,public_id,name,status,reward_wei,budget_wei,starts_at,ends_at,ip_daily_limit,device_daily_limit,burst_limit,minimum_wait_seconds,captcha_required,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[id,publicId,name,input.status==='active'?'active':'paused',reward.toString(),budget.toString(),startsAt.toISOString(),endsAt.toISOString(),Math.min(Math.max(Number(input.ipDailyLimit)||1,1),100),Math.min(Math.max(Number(input.deviceDailyLimit)||1,1),100),Math.min(Math.max(Number(input.burstLimit)||3,1),100),Math.min(Math.max(Number(input.minimumWaitSeconds)||15,0),3600),input.captchaRequired!==false,actor])).rows[0];
    await query('INSERT INTO ieum_trial_budget_events(campaign_id,amount_wei,reason,actor) VALUES($1,$2,$3,$4)',[id,budget.toString(),'최초 캠페인 예산',actor]);await audit({action:'trial-campaign-created',ip,actor,publicId,name,budgetWei:budget.toString()});return json(res,201,{campaign:{...trialView(row),claimUrl:`${voucherPublicUrl}/trial/${publicId}`,cardPngUrl:`/api/trial/${publicId}/image.png?download=1`}});
  }
  const trialAdminMatch=url.pathname.match(/^\/api\/admin\/trial-campaigns\/([A-F0-9]{12})\/(budget|status)$/);
  if(req.method==='POST'&&trialAdminMatch){const input=await readJson(req),actor=aahAdmin(req)?.email||'emergency-token',publicId=trialAdminMatch[1];if(trialAdminMatch[2]==='budget'){const amount=parseVoucherAmount(input.amount),reason=String(input.reason||'').trim().slice(0,300);if(reason.length<2)return json(res,400,{error:'예산 추가 사유를 입력하세요.'});const row=(await query('UPDATE ieum_trial_campaigns SET budget_wei=budget_wei+$2,updated_at=now() WHERE public_id=$1 RETURNING *',[publicId,amount.toString()])).rows[0];if(!row)return json(res,404,{error:'캠페인을 찾을 수 없습니다.'});await query('INSERT INTO ieum_trial_budget_events(campaign_id,amount_wei,reason,actor) VALUES($1,$2,$3,$4)',[row.id,amount.toString(),reason,actor]);await audit({action:'trial-budget-added',ip,actor,publicId,amountWei:amount.toString(),reason});return json(res,200,{campaign:trialView(row)});}const status=['active','paused','ended'].includes(input.status)?input.status:'';if(!status)return json(res,400,{error:'허용되지 않은 상태입니다.'});const row=(await query('UPDATE ieum_trial_campaigns SET status=$2,updated_at=now() WHERE public_id=$1 RETURNING *',[publicId,status])).rows[0];if(!row)return json(res,404,{error:'캠페인을 찾을 수 없습니다.'});await audit({action:'trial-status-changed',ip,actor,publicId,status});return json(res,200,{campaign:trialView(row)});}
  if(req.method==='GET'&&url.pathname==='/api/admin/vouchers'){
    if(!await dbReady())return json(res,503,{error:'데이터베이스 연결 대기 중'});
    const page=Math.max(Number.parseInt(url.searchParams.get('page')||'1',10)||1,1),limit=10,status=['issued','claiming','claimed','failed','cancelled','expired'].includes(url.searchParams.get('status'))?url.searchParams.get('status'):'',search=String(url.searchParams.get('search')||'').trim().toUpperCase().slice(0,10),where=[],values=[];
    if(status){values.push(status);where.push(`status=$${values.length}`);}if(search){values.push(`${search}%`);where.push(`public_id LIKE $${values.length}`);}const clause=where.length?` WHERE ${where.join(' AND ')}`:'';
    const [items,count,summary]=await Promise.all([query(`SELECT id,public_id,amount_wei,status,expires_at,claimed_address,payout_tx_hash,payout_nonce,payout_expected_hash,claim_attempts,last_error,created_at,claimed_at,updated_at,cancelled_at,cancelled_by,cancellation_reason,print_access_count,print_accessed_at,(secret_ciphertext IS NOT NULL) AS can_reprint FROM ieum_vouchers${clause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`,values),query(`SELECT count(*)::int AS count FROM ieum_vouchers${clause}`,values),query("SELECT count(*)::int AS count,count(*) FILTER(WHERE status NOT IN ('cancelled','expired'))::int AS valid_count,count(*) FILTER(WHERE status='cancelled')::int AS cancelled_count,count(*) FILTER(WHERE status='expired')::int AS expired_count,coalesce(sum(amount_wei),0)::text AS issued_wei,coalesce(sum(amount_wei) FILTER(WHERE status NOT IN ('cancelled','expired')),0)::text AS valid_wei,coalesce(sum(amount_wei) FILTER(WHERE status='claimed'),0)::text AS claimed_wei,coalesce(sum(amount_wei) FILTER(WHERE status IN ('issued','claiming')),0)::text AS outstanding_wei,coalesce(sum(amount_wei) FILTER(WHERE status='cancelled'),0)::text AS cancelled_wei,coalesce(sum(amount_wei) FILTER(WHERE status='expired'),0)::text AS expired_wei FROM ieum_vouchers")]);
    const s=summary.rows[0],total=count.rows[0].count,pages=Math.max(Math.ceil(total/limit),1);return json(res,200,{items:items.rows.map(item=>({...item,amount:formatVoucherAmount(item.amount_wei)})),summary:{count:s.count,validCount:s.valid_count,cancelledCount:s.cancelled_count,expiredCount:s.expired_count,issued:formatVoucherAmount(s.issued_wei),valid:formatVoucherAmount(s.valid_wei),claimed:formatVoucherAmount(s.claimed_wei),outstanding:formatVoucherAmount(s.outstanding_wei),cancelled:formatVoucherAmount(s.cancelled_wei),expired:formatVoucherAmount(s.expired_wei)},pagination:{page:Math.min(page,pages),pages,total,limit},configured:Boolean(voucherPrivateKey&&voucherRpcUrl&&voucherPepper.length>=32&&voucherArchiveKey.length>=32)});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/vouchers'){
    if(!await dbReady())return json(res,503,{error:'데이터베이스 연결 대기 중'});const input=await readJson(req),amountWei=parseVoucherAmount(input.amount),quantity=Math.min(Math.max(Number(input.quantity)||1,1),100),expiresAt=input.expiresAt?new Date(input.expiresAt):null;if(expiresAt&&(!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date()))return json(res,400,{error:'만료일은 현재 이후여야 합니다.'});
    if(!voucherPrivateKey||!voucherRpcUrl)return json(res,503,{error:'상품권 지급 지갑을 먼저 설정하세요.'});if(voucherArchiveKey.length<32)return json(res,503,{error:'안전한 보기·재출력을 위해 IEUM_VOUCHER_ARCHIVE_KEY를 32자 이상으로 설정하세요.'});const provider=new JsonRpcProvider(voucherRpcUrl,21004,{staticNetwork:true}),wallet=new Wallet(voucherPrivateKey,provider),[balance,reservedRows]=await Promise.all([provider.getBalance(wallet.address),query("SELECT coalesce(sum(amount_wei),0)::text AS reserved FROM ieum_vouchers WHERE status IN ('issued','claiming')")]),required=amountWei*BigInt(quantity)+BigInt(reservedRows.rows[0].reserved);if(balance<required)return json(res,409,{error:`상품권 준비금이 부족합니다. 지급 지갑 ${formatVoucherAmount(balance)} IEUM, 발행 후 필요 ${formatVoucherAmount(required)} IEUM`});
    const created=[];for(let i=0;i<quantity;i++){let inserted=false;for(let attempt=0;attempt<5&&!inserted;attempt++){const secret=createVoucherSecrets(voucherPepper),claimUrl=`${voucherPublicUrl}/voucher/${secret.publicId}?token=${encodeURIComponent(secret.token)}`,imageUrl=`/api/vouchers/${secret.publicId}/image.svg?token=${encodeURIComponent(secret.token)}&download=1`,imagePngUrl=`/api/vouchers/${secret.publicId}/image.png?token=${encodeURIComponent(secret.token)}&download=1`,secretCiphertext=encryptVoucherSecret({code:secret.code,token:secret.token},voucherArchiveKey);try{await query('INSERT INTO ieum_vouchers(id,public_id,code_hash,token_hash,amount_wei,expires_at,secret_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7)',[secret.id,secret.publicId,secret.codeHash,secret.tokenHash,amountWei.toString(),expiresAt?.toISOString()||null,secretCiphertext]);created.push({publicId:secret.publicId,amount:formatVoucherAmount(amountWei),code:secret.code,claimUrl,imageUrl,imagePngUrl,printUrl:`/voucher-print.html?id=${secret.publicId}&token=${encodeURIComponent(secret.token)}#code=${secret.code}`});inserted=true;}catch(error){if(error.code!=='23505')throw error;}}if(!inserted)throw new Error('중복되지 않는 상품권 번호 생성에 실패했습니다. 다시 시도하세요.');}
    await audit({action:'vouchers-issued',ip,count:quantity,amountWei:amountWei.toString()});return json(res,201,{items:created,warning:'교환번호와 URL은 지금만 표시됩니다. 안전하게 저장하거나 인쇄하세요.'});
  }
  const voucherSecret=url.pathname.match(/^\/api\/admin\/vouchers\/([2-9A-HJ-NP-Z]{10})\/secret$/);
  if(req.method==='POST'&&voucherSecret){if(voucherArchiveKey.length<32)return json(res,503,{error:'IEUM_VOUCHER_ARCHIVE_KEY가 설정되지 않았습니다.'});const rows=await query('SELECT public_id,status,secret_ciphertext FROM ieum_vouchers WHERE public_id=$1',[voucherSecret[1]]),voucher=rows.rows[0];if(!voucher)return json(res,404,{error:'상품권을 찾을 수 없습니다.'});if(!voucher.secret_ciphertext)return json(res,409,{error:'이 상품권은 암호화 보관 기능 도입 전에 발행되어 재출력할 수 없습니다.'});const secret=decryptVoucherSecret(voucher.secret_ciphertext,voucherArchiveKey),claimUrl=`${voucherPublicUrl}/voucher/${voucher.public_id}?token=${encodeURIComponent(secret.token)}`,imageUrl=`/api/vouchers/${voucher.public_id}/image.svg?token=${encodeURIComponent(secret.token)}&download=1`,imagePngUrl=`/api/vouchers/${voucher.public_id}/image.png?token=${encodeURIComponent(secret.token)}&download=1`,printUrl=`/voucher-print.html?id=${voucher.public_id}&token=${encodeURIComponent(secret.token)}#code=${secret.code}`,actor=aahAdmin(req)?.email||'emergency-token';await query('UPDATE ieum_vouchers SET print_access_count=print_access_count+1,print_accessed_at=now(),updated_at=now() WHERE public_id=$1',[voucher.public_id]);await audit({action:'voucher-secret-viewed',ip,actor,publicId:voucher.public_id,status:voucher.status});res.setHeader('cache-control','no-store');return json(res,200,{voucher:{publicId:voucher.public_id,status:voucher.status,code:secret.code,claimUrl,imageUrl,imagePngUrl,printUrl}});}
  const voucherCancel=url.pathname.match(/^\/api\/admin\/vouchers\/([2-9A-HJ-NP-Z]{10})\/cancel$/);
  if(req.method==='POST'&&voucherCancel){const input=await readJson(req),reason=String(input.reason||'').trim().slice(0,300);if(reason.length<2)return json(res,400,{error:'폐기 사유를 2자 이상 입력하세요.'});const actor=aahAdmin(req)?.email||'emergency-token',rows=await query("UPDATE ieum_vouchers SET status='cancelled',cancelled_at=now(),cancelled_by=$2,cancellation_reason=$3,updated_at=now() WHERE public_id=$1 AND status='issued' RETURNING public_id,status,cancelled_at,cancelled_by,cancellation_reason",[voucherCancel[1],actor,reason]);if(!rows.rows[0])return json(res,409,{error:'미사용 상품권만 폐기할 수 있습니다.'});await audit({action:'voucher-cancelled',ip,actor,publicId:voucherCancel[1],reason});return json(res,200,{voucher:rows.rows[0]});}
  const voucherRecovery=url.pathname.match(/^\/api\/admin\/vouchers\/([2-9A-HJ-NP-Z]{10})\/(reconcile|rebroadcast)$/);
  if(req.method==='POST'&&voucherRecovery){
    const publicId=voucherRecovery[1],action=voucherRecovery[2],rows=await query('SELECT * FROM ieum_vouchers WHERE public_id=$1',[publicId]);let voucher=rows.rows[0];if(!voucher)return json(res,404,{error:'상품권을 찾을 수 없습니다.'});if(voucher.status==='claimed')return json(res,200,{voucher:{publicId,status:'claimed',txHash:voucher.payout_tx_hash},already:true});if(!['claiming','failed'].includes(voucher.status))return json(res,409,{error:'처리 중이거나 실패한 상품권만 복구할 수 있습니다.'});
    voucher=await normalizeStoredVoucherPayout(voucher);
    const existing=(await rpc(voucherRpcUrl,'eth_getTransactionByHash',[voucher.payout_expected_hash])).result;if(existing){await query("UPDATE ieum_vouchers SET status='claimed',payout_tx_hash=payout_expected_hash,claimed_at=coalesce(claimed_at,now()),last_error=null,updated_at=now() WHERE id=$1",[voucher.id]);await audit({action:'voucher-reconciled',ip,publicId,txHash:voucher.payout_expected_hash});return json(res,200,{voucher:{publicId,status:'claimed',txHash:voucher.payout_expected_hash},foundOnchain:true});}
    if(action==='reconcile')return json(res,409,{error:'저장된 IEUM 원장 해시의 거래가 현재 RPC에서 발견되지 않았습니다. 다른 운영 노드에서도 확인한 뒤 동일 raw 거래 재전파를 선택하세요.',expectedHash:voucher.payout_expected_hash});
    let returnedHash;try{returnedHash=(await rpc(voucherRpcUrl,'eth_sendRawTransaction',[voucher.payout_raw_tx])).result;}catch(error){const after=(await rpc(voucherRpcUrl,'eth_getTransactionByHash',[voucher.payout_expected_hash]).catch(()=>({result:null}))).result;if(!after)throw error;returnedHash=voucher.payout_expected_hash;}if(String(returnedHash).toLowerCase()!==voucher.payout_expected_hash.toLowerCase())throw new Error('재전파 결과 해시가 저장된 예상 해시와 다릅니다.');await query("UPDATE ieum_vouchers SET status='claimed',payout_tx_hash=payout_expected_hash,claimed_at=coalesce(claimed_at,now()),last_error=null,updated_at=now() WHERE id=$1",[voucher.id]);await audit({action:'voucher-rebroadcast',ip,publicId,txHash:voucher.payout_expected_hash});return json(res,200,{voucher:{publicId,status:'claimed',txHash:voucher.payout_expected_hash},rebroadcast:true});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/purchases'){
    if(!await dbReady())return json(res,503,{error:'데이터베이스 연결 대기 중'});
    const rows=await query('SELECT id,user_id,wallet_address,amount_aah,amount_ieum,deposit_code,status,deposit_confirmed_at,payout_tx_hash,created_at,updated_at FROM ieum_purchase_orders ORDER BY created_at DESC LIMIT 500');
    return json(res,200,{items:rows.rows,bank:IEUM_BANK,automaticBankVerification:false});
  }
  const purchaseReview=url.pathname.match(/^\/api\/admin\/purchases\/(\d+)$/);
  if(req.method==='PUT'&&purchaseReview){
    const input=await readJson(req),status=['deposit-confirmed','paid','rejected'].includes(input.status)?input.status:null;if(!status)return json(res,400,{error:'허용되지 않은 주문 상태입니다.'});
    const txHash=String(input.payoutTxHash||'').trim();if(status==='paid'&&!validHash(txHash))return json(res,400,{error:'지급 거래 해시를 입력하세요.'});
    const rows=await query("UPDATE ieum_purchase_orders SET status=$1,deposit_confirmed_at=CASE WHEN $1 IN ('deposit-confirmed','paid') THEN coalesce(deposit_confirmed_at,now()) ELSE deposit_confirmed_at END,payout_tx_hash=CASE WHEN $1='paid' THEN $2 ELSE payout_tx_hash END,updated_at=now() WHERE id=$3 RETURNING *",[status,txHash||null,Number(purchaseReview[1])]);
    return rows.rows[0]?json(res,200,{order:rows.rows[0]}):json(res,404,{error:'주문을 찾을 수 없습니다.'});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/chain-diagnostics'){
    cache={at:0,data:null,pending:null};const data=await snapshot();return json(res,200,{diagnostics:data.diagnostics,recovery:{enabled:Boolean(recoveryControlDir&&recoveryControlToken),pendingLossWarning:'노드 재시작 시 확정되지 않은 mempool 거래가 사라질 수 있습니다.'}});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/chain-recovery'){
    if(!recoveryControlDir||recoveryControlToken.length<32)return json(res,503,{error:'제한된 호스트 복구 에이전트가 설정되지 않았습니다.'});
    const input=await readJson(req);if(input.confirmation!=='RESTART IEUM NODES')return json(res,400,{error:'확인 문구가 일치하지 않습니다.'});
    cache={at:0,data:null,pending:null};const data=await snapshot();
    if(data.diagnostics.status!=='critical')return json(res,409,{error:'현재 자동 진단이 위험 상태가 아니므로 재시작을 요청하지 않습니다.'});
    if(data.diagnostics.pendingTotal>0&&input.acceptPendingLoss!==true)return json(res,409,{error:'대기 거래가 있습니다. 손실 가능성을 명시적으로 확인해야 합니다.',pending:data.diagnostics.pendingTotal});
    await mkdir(recoveryControlDir,{recursive:true});const id=randomUUID(),request={id,action:'restart-ieum-nodes',requestedAt:new Date().toISOString(),requestedBy:aahAdmin(req)?.email||requestIp(req),token:recoveryControlToken,diagnostics:data.diagnostics};const temp=join(recoveryControlDir,`.${id}.tmp`),target=join(recoveryControlDir,`${id}.json`);await writeFile(temp,JSON.stringify(request,null,2),{mode:0o600});await rename(temp,target);await audit({action:'chain-recovery-requested',ip,id,pending:data.diagnostics.pendingTotal});return json(res,202,{queued:true,id,warning:data.diagnostics.pendingTotal>0?'대기 거래가 재시작으로 사라질 수 있습니다.':null});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/events')return json(res,200,{items:await recentAudit(url.searchParams.get('limit'))});
  if(req.method==='GET'&&url.pathname==='/api/admin/reward-campaigns'){
    const policy=await loadPolicy();const primary=applyPolicy(config.nodes,policy).find(node=>!node.admin.blocked);let onchain=[];
    if(primary)try{onchain=(await rpc(primary.rpcUrl,'ieum_holderRewardHistory',[Math.min(Number(url.searchParams.get('limit'))||500,10000)])).result?.items||[];}catch{}
    return json(res,200,{campaigns:policy.rewardCampaigns||[],manualPayouts:policy.rewardPayouts||[],snsClaims:policy.snsClaims||[],onchainPayouts:onchain,limitations:{ipCountry:'보유 보상은 온체인 주소에 지급되므로 Chain은 IP·국가를 수집하지 않습니다.',activation:'활성 보유 이벤트의 config를 모든 검증자에 동일 배포하고 재시작해야 실제 합의 지급이 시작됩니다.',snsMint:'SNS 신청은 승인 대기열까지만 생성하며 최대공급량 제한이 있는 합의 발행 기능 전에는 자동 발행하지 않습니다.'}});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/reward-campaigns'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});
    const input=await readJson(req),policy=await loadPolicy(),campaign=normalizeCampaign(input);assertNoOverlap(campaign,policy.rewardCampaigns||[]);policy.rewardCampaigns=[...(policy.rewardCampaigns||[]),campaign];await savePolicy(policy);await audit({action:'reward-campaign-created',ip,campaignId:campaign.id,type:campaign.type});return json(res,201,{campaign,holderConfig:campaign.type==='holder'?holderConfig(campaign):null});
  }
  const campaignMatch=url.pathname.match(/^\/api\/admin\/reward-campaigns\/([^/]+)$/);
  if(req.method==='PUT'&&campaignMatch){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});
    const input=await readJson(req),policy=await loadPolicy(),id=decodeURIComponent(campaignMatch[1]),existing=(policy.rewardCampaigns||[]).find(item=>item.id===id);if(!existing)return json(res,404,{error:'이벤트를 찾을 수 없습니다.'});
    const campaign=normalizeCampaign({...existing,...input},existing);assertNoOverlap(campaign,policy.rewardCampaigns||[]);if(campaign.status==='active'&&campaign.type==='holder'&&(policy.rewardCampaigns||[]).some(item=>item.id!==id&&item.type==='holder'&&item.status==='active'))return json(res,409,{error:'활성 보유 보상 이벤트는 하나만 허용됩니다.'});
    policy.rewardCampaigns=(policy.rewardCampaigns||[]).map(item=>item.id===id?campaign:item);await savePolicy(policy);await audit({action:'reward-campaign-updated',ip,campaignId:id,status:campaign.status});return json(res,200,{campaign,holderConfig:campaign.type==='holder'?holderConfig(campaign):null,deploymentRequired:campaign.type==='holder'});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/reward-payouts'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});const input=await readJson(req),policy=await loadPolicy();if(!(policy.rewardCampaigns||[]).some(item=>item.id===input.campaignId))return json(res,404,{error:'이벤트를 찾을 수 없습니다.'});const payout=sanitizePayout(input);policy.rewardPayouts=[...(policy.rewardPayouts||[]),payout].slice(-10000);await savePolicy(policy);await audit({action:'reward-payout-recorded',ip,campaignId:payout.campaignId,address:payout.address,txHash:payout.txHash});return json(res,201,{payout});
  }
  const snsReview=url.pathname.match(/^\/api\/admin\/sns-claims\/([^/]+)$/);
  if(req.method==='PUT'&&snsReview){
    const input=await readJson(req),policy=await loadPolicy(),id=decodeURIComponent(snsReview[1]),status=input.status==='approved'?'approved':input.status==='rejected'?'rejected':null;if(!status)return json(res,400,{error:'approved 또는 rejected만 허용합니다.'});
    const found=(policy.snsClaims||[]).find(item=>item.id===id);if(!found)return json(res,404,{error:'SNS 신청을 찾을 수 없습니다.'});
    policy.snsClaims=(policy.snsClaims||[]).map(item=>item.id===id?{...item,status,reviewedAt:new Date().toISOString(),reviewerNote:String(input.note||'').slice(0,300)}:item);await savePolicy(policy);await audit({action:'sns-claim-reviewed',ip,claimId:id,status});return json(res,200,{claim:policy.snsClaims.find(item=>item.id===id),mintEnabled:false});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/peers'){
    if(!await dbReady())return json(res,503,{error:'피어 데이터베이스 연결 대기 중'});
    const rows=await query('SELECT node_id,name,p2p_address,version,height,peer_count,online,source_node_id,last_seen_at,raw FROM discovered_nodes ORDER BY online DESC,last_seen_at DESC,name');
    const configured=new Set(config.nodes.map(node=>node.id));const items=rows.rows.filter(row=>!configured.has(row.node_id)).map(row=>normalizePeer(row));
    return json(res,200,{generatedAt:new Date().toISOString(),summary:peerSummary(items),items,limitations:{country:'GeoIP 또는 Chain 제공 값이 있을 때만 표시',wallet:'노드가 서명해 제공한 주소만 신뢰 가능',topology:'상대 노드가 제공한 경우에만 표시'}});
  }
  const peerMatch=url.pathname.match(/^\/api\/admin\/peers\/([^/]+)$/);
  if(req.method==='GET'&&peerMatch){
    if(!await dbReady())return json(res,503,{error:'피어 데이터베이스 연결 대기 중'});const nodeId=decodeURIComponent(peerMatch[1]);
    const rows=await query('SELECT node_id,name,p2p_address,version,height,peer_count,online,source_node_id,last_seen_at,raw FROM discovered_nodes WHERE node_id=$1',[nodeId]);
    return rows.rows[0]?json(res,200,{peer:normalizePeer(rows.rows[0])}):json(res,404,{error:'피어를 찾을 수 없습니다.'});
  }
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

async function purchaseApi(req,res,url){
  const user=aahUser(req);if(!user)return json(res,401,{error:'AAH 로그인이 필요합니다.'});
  if(!await dbReady())return json(res,503,{error:'데이터베이스 연결 대기 중'});
  const userId=String(user.id||user.userId||user.email||user.username||'').slice(0,200);if(!userId)return json(res,401,{error:'AAH 사용자 식별값을 확인할 수 없습니다.'});
  if(req.method==='GET'){
    const rows=await query('SELECT id,wallet_address,amount_aah,amount_ieum,deposit_code,status,deposit_confirmed_at,payout_tx_hash,created_at,updated_at FROM ieum_purchase_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[userId]);
    return json(res,200,{items:rows.rows,bank:IEUM_BANK,automaticBankVerification:false});
  }
  if(req.method==='POST'){
    if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});
    const input=await readJson(req),wallet=String(input.walletAddress||'').trim().toLowerCase(),amount=Number(input.amount);
    if(!validAddress(wallet))return json(res,400,{error:'올바른 IEUM 받기 주소를 입력하세요.'});
    if(!Number.isSafeInteger(amount)||amount<1||amount>1_000_000)return json(res,400,{error:'구매 수량은 1~1,000,000 AAH의 정수로 입력하세요.'});
    let code,created;for(let attempt=0;attempt<10&&!created;attempt++){code=String(randomInt(10_000_000,100_000_000));try{created=(await query("INSERT INTO ieum_purchase_orders(user_id,wallet_address,amount_aah,amount_ieum,deposit_code) VALUES($1,$2,$3,$3,$4) RETURNING id,wallet_address,amount_aah,amount_ieum,deposit_code,status,created_at",[userId,wallet,amount,code])).rows[0];}catch(error){if(error?.code!=='23505')throw error;}}
    if(!created)return json(res,503,{error:'입금 확인코드를 만들지 못했습니다. 다시 시도하세요.'});
    return json(res,201,{order:created,bank:IEUM_BANK,instruction:`입금자명에 ${code} 숫자만 입력하세요.`,automaticBankVerification:false});
  }
  return json(res,405,{error:'허용되지 않은 HTTP 메서드입니다.'});
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
    const type=explorerTermType(term);
    if(type==='block-height') return json(res,200,{type:'block',target:`/api/explorer/block/${term}`});
    if(type==='hash'){const block=await query('SELECT 1 FROM blocks WHERE lower(hash)=lower($1)',[term]);return json(res,200,block.rows[0]?{type:'block',target:`/api/explorer/block/hash/${term}`}:{type:'transaction',target:`/api/explorer/transaction/${term}`});}
    if(type==='address') return json(res,200,{type:'address',target:`/api/explorer/address/${term}`});
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
  if(path.startsWith('/api/explorer/address/'))return json(res,400,{error:'IEUM 주소는 0x로 시작하는 40자리 계정 주소여야 합니다. 64자리 값은 거래·블록 해시 또는 검증자 식별자일 수 있습니다.'});
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
    const found=await query('SELECT hash,block_height,sender,recipient,value FROM transactions WHERE lower(hash)=lower($1)',[txHash]);let paid=found.rows[0];
    if(paid&&(paid.sender.toLowerCase()!==wallet.toLowerCase()||paid.recipient.toLowerCase()!==FOUNDATION_WALLET||BigInt(paid.value)<GUILD_PRICE_WEI))return json(res,400,{error:'입력한 거래가 해당 지갑의 길드 생성 결제가 아닙니다.'});
    if(!paid){
      const compatible=await query(`SELECT t.hash,t.block_height,t.sender,t.recipient,t.value FROM transactions t
        LEFT JOIN guild_payment_receipts r ON lower(r.tx_hash)=lower(t.hash)
        WHERE lower(t.sender)=lower($1) AND lower(t.recipient)=lower($2)
          AND t.value::numeric >= $3::numeric AND r.tx_hash IS NULL
        ORDER BY t.block_height DESC,t.tx_index DESC LIMIT 2`,[wallet,FOUNDATION_WALLET,GUILD_PRICE_WEI.toString()]);
      if(compatible.rows.length===1)paid=compatible.rows[0];
      else if(compatible.rows.length>1)return json(res,409,{error:'사용하지 않은 1 IEUM 결제가 여러 건입니다. Explorer에 표시된 확정 거래 해시를 입력하세요.'});
    }
    if(!paid)return json(res,400,{error:'재단지갑으로 확정된 1 IEUM 결제를 찾지 못했습니다. 인덱서 동기화 상태를 확인하세요.'});
    const used=await query('SELECT 1 FROM guild_payment_receipts WHERE lower(tx_hash)=lower($1)',[paid.hash]);if(used.rows[0])return json(res,409,{error:'이미 사용한 결제 거래입니다.'});
    const identity=String(user.email||user.username||user.sub);
    const client=await pool.connect();try{await client.query('BEGIN');const made=await client.query('INSERT INTO guilds(name,description,region,owner_wallet,owner_aah_user) VALUES($1,$2,$3,$4,$5) RETURNING *',[name,String(input.description||'').slice(0,300),String(input.region||'').slice(0,50),wallet,identity]);await client.query('INSERT INTO guild_members(guild_id,wallet,aah_user,rank) VALUES($1,$2,$3,5)',[made.rows[0].id,wallet,identity]);await client.query('INSERT INTO guild_payment_receipts(tx_hash,guild_id,sender,recipient,amount,block_height) VALUES($1,$2,$3,$4,$5,$6)',[paid.hash,made.rows[0].id,paid.sender,paid.recipient,paid.value,paid.block_height]);await client.query('COMMIT');return json(res,201,{guild:{...made.rows[0],capacity:20},payment:{recipient:FOUNDATION_WALLET,amount:'1 IEUM',finalized:true,transactionHash:paid.hash,submittedHash:txHash}});}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  if(req.method==='POST'&&url.pathname==='/api/guilds/reports'){
    const input=await readJson(req),type=String(input.targetType||'');if(!['guild','member','event'].includes(type)||!String(input.reason||'').trim())return json(res,400,{error:'신고 대상과 사유를 입력하세요.'});
    const made=await query('INSERT INTO community_reports(reporter_user,reporter_wallet,target_type,target_id,reason,evidence) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,reward_status',[String(user.email||user.username||user.sub),validAddress(input.reporterWallet)?input.reporterWallet:null,type,String(input.targetId||'').slice(0,100),String(input.reason).slice(0,500),String(input.evidence||'').slice(0,1000)]);return json(res,201,{report:made.rows[0],notice:'포상은 운영자 심사 후 별도 승인되며 자동 지급되지 않습니다.'});
  }
  return json(res,404,{error:'길드 API를 찾을 수 없습니다.'});
}

async function rewardApi(req,res,url){
  if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});
  const user=aahUser(req);if(!user)return json(res,401,{error:'AAH 로그인이 필요합니다.'});
  if(req.method==='POST'&&url.pathname==='/api/rewards/sns-claims'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'application/json만 허용합니다.'});
    const policy=await loadPolicy(),identity=String(user.email||user.username||user.sub);let claim=sanitizeSnsClaim(await readJson(req),{userId:identity,ip:requestIp(req)});assertSnsClaimUnique(claim,policy.snsClaims||[]);claim=await verifySnsClaim(claim);
    policy.snsClaims=[...(policy.snsClaims||[]),claim].slice(-10000);await savePolicy(policy);await audit({action:'sns-claim-submitted',ip:requestIp(req),claimId:claim.id,userId:identity,address:claim.address,platform:claim.platform});return json(res,201,{claim,notice:'계정당 1회 신청되었습니다. SNS API 자동 확인 또는 관리자 검토 후 승인되며 현재 합의 신규 발행은 비활성입니다.'});
  }
  if(req.method==='GET'&&url.pathname==='/api/rewards/sns-claims/me'){
    const identity=String(user.email||user.username||user.sub),policy=await loadPolicy();return json(res,200,{items:(policy.snsClaims||[]).filter(item=>item.userId===identity)});
  }
  return json(res,404,{error:'보상 API를 찾을 수 없습니다.'});
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

async function voucherPublicApi(req,res,url){
  if(!await dbReady())return json(res,503,{error:'잠시 후 다시 시도해 주세요.'});
  if(req.method==='GET'&&url.pathname==='/api/vouchers/summary'){const rows=await query("SELECT count(*)::int AS count,coalesce(sum(amount_wei),0)::text AS issued_wei,coalesce(sum(amount_wei) FILTER(WHERE status='claimed'),0)::text AS claimed_wei,coalesce(sum(amount_wei) FILTER(WHERE status IN ('issued','claiming')),0)::text AS outstanding_wei,count(*) FILTER(WHERE status='claimed')::int AS claimed_count FROM ieum_vouchers"),s=rows.rows[0];return json(res,200,{count:s.count,claimedCount:s.claimed_count,issued:formatVoucherAmount(s.issued_wei),claimed:formatVoucherAmount(s.claimed_wei),outstanding:formatVoucherAmount(s.outstanding_wei),notice:'상품권 누적 발행액이며 IEUM 체인 총발행량과는 별개입니다.'});}
  const match=url.pathname.match(/^\/api\/vouchers\/([2-9A-HJ-NP-Z]{10})(?:\/(claim|image\.(?:svg|png)))?$/);if(!match)return json(res,404,{error:'상품권을 찾을 수 없습니다.'});
  const publicId=match[1],action=match[2]||'status',token=String(url.searchParams.get('token')||'');if(!token||voucherPepper.length<32)return json(res,404,{error:'올바르지 않은 상품권 링크입니다.'});
  const found=await query('SELECT * FROM ieum_vouchers WHERE public_id=$1 AND token_hash=$2',[publicId,voucherDigest(token,voucherPepper)]),voucher=found.rows[0];if(!voucher)return json(res,404,{error:'올바르지 않은 상품권 링크입니다.'});
  const expired=voucher.expires_at&&new Date(voucher.expires_at)<=new Date();if(expired&&voucher.status==='issued')await query("UPDATE ieum_vouchers SET status='expired',updated_at=now() WHERE id=$1",[voucher.id]);const status=expired&&voucher.status==='issued'?'expired':voucher.status;
  if((action==='image.svg'||action==='image.png')&&req.method==='GET'){
    let code='';if(action==='image.png'){if(!voucher.secret_ciphertext||voucherArchiveKey.length<32)return json(res,409,{error:'이 상품권은 교환번호 포함 이미지로 복원할 수 없습니다.'});code=decryptVoucherSecret(voucher.secret_ciphertext,voucherArchiveKey).code;}
    const svg=await voucherFrontSvg(voucher,publicId,token,code),download=url.searchParams.get('download')==='1',date=new Date(voucher.created_at).toISOString().slice(2,10).replaceAll('-',''),base=`IEUM_${cleanDownloadPart(formatVoucherAmount(voucher.amount_wei))}_${date}_A_${publicId}`;
    if(action==='image.png'){const png=await sharp(Buffer.from(svg)).png({compressionLevel:9,palette:true}).toBuffer();res.writeHead(200,{'content-type':'image/png','content-disposition':`attachment; filename="${base}.png"`,'cache-control':'no-store','x-content-type-options':'nosniff'});return res.end(png);}
    res.writeHead(200,{'content-type':'image/svg+xml; charset=utf-8','content-disposition':`${download?'attachment':'inline'}; filename="${base}.svg"`,'cache-control':'no-store','x-content-type-options':'nosniff'});return res.end(svg);
  }
  if(action==='status'&&req.method==='GET')return json(res,200,{publicId,amount:formatVoucherAmount(voucher.amount_wei),status,expiresAt:voucher.expires_at,claimedAt:voucher.claimed_at,txHash:voucher.payout_tx_hash,explorerUrl:voucher.payout_tx_hash?`${voucherExplorerUrl}${voucher.payout_tx_hash}`:null});
  if(action==='claim'&&req.method==='POST'){
    const input=await readJson(req),address=String(input.address||'').trim(),code=String(input.code||'');if(!validVoucherAddress(address))return json(res,400,{error:'0x로 시작하는 올바른 IEUM 주소를 입력하세요.'});if(!voucherCodeMatches(code,voucher.code_hash,voucherPepper)){await query('UPDATE ieum_vouchers SET claim_attempts=claim_attempts+1,updated_at=now() WHERE id=$1',[voucher.id]);return json(res,400,{error:'교환번호가 올바르지 않습니다.'});}
    const run=async()=>{if(!voucherPrivateKey||!voucherRpcUrl)throw new Error('상품권 지급 지갑이 아직 설정되지 않았습니다.');const provider=new JsonRpcProvider(voucherRpcUrl,21004,{staticNetwork:true}),wallet=new Wallet(voucherPrivateKey),client=await pool.connect();let raw='',expectedHash='',nonce=0;try{await client.query('SELECT pg_advisory_lock($1)',[210040006]);await client.query('BEGIN');const locked=(await client.query('SELECT * FROM ieum_vouchers WHERE id=$1 FOR UPDATE',[voucher.id])).rows[0];if(locked.status==='claimed'){await client.query('ROLLBACK');return{already:true,txHash:locked.payout_tx_hash};}if(locked.status!=='issued'||(locked.expires_at&&new Date(locked.expires_at)<=new Date())){await client.query('ROLLBACK');throw new Error('이미 사용·취소·만료되었거나 처리 중인 상품권입니다.');}const chainNonce=await provider.getTransactionCount(wallet.address,'pending'),reserved=(await client.query('SELECT max(payout_nonce)::text AS nonce FROM ieum_vouchers WHERE payout_nonce IS NOT NULL')).rows[0].nonce;nonce=Math.max(chainNonce,reserved===null?chainNonce:Number(reserved)+1);const signed=await buildVoucherPayout(voucherPrivateKey,{nonce,to:address,value:locked.amount_wei});raw=signed.raw;expectedHash=signed.expectedHash;await client.query("UPDATE ieum_vouchers SET status='claiming',claimed_address=$2,payout_nonce=$3,payout_raw_tx=$4,payout_expected_hash=$5,last_error=null,updated_at=now() WHERE id=$1",[voucher.id,address,nonce,raw,expectedHash]);await client.query('COMMIT');let returnedHash;try{returnedHash=(await rpc(voucherRpcUrl,'eth_sendRawTransaction',[raw])).result;}catch(error){await query('UPDATE ieum_vouchers SET last_error=$2,updated_at=now() WHERE id=$1',[voucher.id,String(error.message||error).slice(0,500)]);throw new Error(`지급 거래 상태가 불확실합니다. 예상 거래 ${expectedHash}를 관리자가 확인해야 합니다.`);}if(String(returnedHash).toLowerCase()!==expectedHash.toLowerCase())throw new Error('노드가 반환한 거래 해시가 로컬 서명 해시와 다릅니다.');await query("UPDATE ieum_vouchers SET status='claimed',payout_tx_hash=$2,claimed_at=now(),updated_at=now(),last_error=null WHERE id=$1",[voucher.id,expectedHash]);await audit({action:'voucher-claimed',ip:requestIp(req),publicId,address,txHash:expectedHash,nonce});return{txHash:expectedHash};}catch(error){await client.query('ROLLBACK').catch(()=>{});if(expectedHash)await query('UPDATE ieum_vouchers SET last_error=$2,updated_at=now() WHERE id=$1',[voucher.id,String(error.message||error).slice(0,500)]).catch(()=>{});throw error;}finally{await client.query('SELECT pg_advisory_unlock($1)',[210040006]).catch(()=>{});client.release();}};
    const payout=voucherPayout.then(run,run);voucherPayout=payout.catch(()=>{});const result=await payout;return json(res,200,{ok:true,already:Boolean(result.already),txHash:result.txHash,explorerUrl:`${voucherExplorerUrl}${result.txHash}`});
  }
  return json(res,405,{error:'허용되지 않은 요청입니다.'});
}

async function payTrialClaim(claim,campaign,ip){
  const run=async()=>{if(!voucherPrivateKey||!voucherRpcUrl)throw new Error('체험 지급 지갑이 설정되지 않았습니다.');const provider=new JsonRpcProvider(voucherRpcUrl,21004,{staticNetwork:true}),wallet=new Wallet(voucherPrivateKey),client=await pool.connect();let signed;try{await client.query('SELECT pg_advisory_lock($1)',[210040006]);const locked=(await client.query('SELECT * FROM ieum_trial_claims WHERE id=$1',[claim.id])).rows[0];if(locked.status==='paid')return locked.payout_tx_hash;if(locked.status!=='queued')throw new Error('이메일 확인 상태가 지급 가능한 상태가 아닙니다.');const chainNonce=await provider.getTransactionCount(wallet.address,'pending'),nonceRows=await client.query('SELECT greatest(coalesce((SELECT max(payout_nonce) FROM ieum_vouchers),-1),coalesce((SELECT max(payout_nonce) FROM ieum_trial_claims),-1))::text AS nonce'),nonce=Math.max(chainNonce,Number(nonceRows.rows[0].nonce)+1);signed=await buildVoucherPayout(voucherPrivateKey,{nonce,to:locked.address,value:campaign.reward_wei});await client.query("UPDATE ieum_trial_claims SET status='paying',payout_nonce=$2,payout_raw_tx=$3,payout_expected_hash=$4,email_verification_token_hash=null,updated_at=now() WHERE id=$1",[claim.id,nonce,signed.raw,signed.expectedHash]);const returned=(await rpc(voucherRpcUrl,'eth_sendRawTransaction',[signed.raw])).result;if(String(returned).toLowerCase()!==signed.expectedHash.toLowerCase())throw new Error('노드가 반환한 거래 해시가 예상값과 다릅니다.');await client.query("UPDATE ieum_trial_claims SET status='paid',payout_tx_hash=$2,paid_at=now(),updated_at=now() WHERE id=$1",[claim.id,signed.expectedHash]);await audit({action:'trial-paid',ip,publicId:campaign.public_id,address:locked.address,txHash:signed.expectedHash});return signed.expectedHash;}catch(error){await query("UPDATE ieum_trial_claims SET status='failed',last_error=$2,updated_at=now() WHERE id=$1 AND status='paying'",[claim.id,String(error.message||error).slice(0,500)]).catch(()=>{});throw new Error(`지급 상태 확인이 필요합니다. 관리자에게 신청번호 ${claim.id}를 알려주세요.`);}finally{await client.query('SELECT pg_advisory_unlock($1)',[210040006]).catch(()=>{});client.release();}};
  const payout=voucherPayout.then(run,run);voucherPayout=payout.catch(()=>{});return payout;
}

async function trialPublicApi(req,res,url){
  if(!await dbReady())return json(res,503,{error:'잠시 후 다시 시도해 주세요.'});await query(`WITH expired AS (UPDATE ieum_trial_claims SET status='expired',email_verification_token_hash=null,updated_at=now() WHERE status='pending_email' AND email_verification_expires_at<=now() RETURNING campaign_id), totals AS (SELECT campaign_id,count(*)::numeric count FROM expired GROUP BY campaign_id) UPDATE ieum_trial_campaigns c SET spent_wei=greatest(c.spent_wei-c.reward_wei*t.count,0),updated_at=now() FROM totals t WHERE c.id=t.campaign_id`);const match=url.pathname.match(/^\/api\/trial\/([A-F0-9]{12})(?:\/(claim|image\.png))?$/);if(!match)return json(res,404,{error:'체험 캠페인을 찾을 수 없습니다.'});
  const campaign=(await query('SELECT * FROM ieum_trial_campaigns WHERE public_id=$1',[match[1]])).rows[0];if(!campaign)return json(res,404,{error:'체험 캠페인을 찾을 수 없습니다.'});
  if(req.method==='GET'&&match[2]==='image.png'){const lang=url.searchParams.get('lang')==='en'?'en':'ko',copy=lang==='en'?{intro:'Claim your first IEUM to your own wallet.',steps:'1. Scan QR  2. Prepare Wallet  3. Enter Address',limit:'One claim per wallet · Ends when budget is exhausted',end:'Ends'}:{intro:'처음 만나는 IEUM을 내 지갑으로 받아보세요.',steps:'1. QR 촬영  2. 지갑 준비  3. 주소 입력',limit:'캠페인당 한 지갑 1회 · 예산 소진 시 종료',end:'종료 예정'},claimUrl=`${voucherPublicUrl}/trial/${campaign.public_id}?lang=${lang}`,qr=await QRCode.toString(claimUrl,{type:'svg',margin:3,errorCorrectionLevel:'H'}),placed=qr.trim().replace(/^<svg\s/,'<svg x="760" y="150" width="360" height="360" '),name=String(campaign.name).replace(/[<>&]/g,''),reward=formatVoucherAmount(campaign.reward_wei),end=new Date(campaign.ends_at).toLocaleDateString(lang==='en'?'en-US':'ko-KR',{timeZone:'Asia/Seoul'}),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="tg" x2="1" y2="1"><stop stop-color="#071820"/><stop offset="1" stop-color="#16483d"/></linearGradient></defs><rect width="1200" height="630" rx="42" fill="url(#tg)"/><circle cx="120" cy="90" r="180" fill="#45e5b4" opacity=".1"/>${trialSvgText('IEUM FIRST EXPERIENCE',70,85,25,'#46e6b5',700)}${trialSvgText(name,70,165,46,'#ffffff',700)}${trialSvgText(`${reward} IEUM`,70,265,72,'#ffcf70',700)}${trialSvgText(copy.intro,70,320,24,'#b6d2cb')}${trialSvgText(copy.steps,70,385,27,'#ffffff',700)}${trialSvgText(copy.limit,70,445,20,'#9fbab4')}${trialSvgText(`${copy.end} ${end}`,70,485,20,'#9fbab4')}<rect x="745" y="135" width="390" height="390" rx="24" fill="white"/>${placed}${trialSvgText('iem.aah.name · Mainnet 21004',805,570,18,'#b6d2cb')}</svg>`,png=await sharp(Buffer.from(svg)).png({compressionLevel:9,palette:true}).toBuffer(),filename=`IEUM_TRIAL_${lang.toUpperCase()}_${cleanDownloadPart(name)}_${campaign.public_id}.png`;res.writeHead(200,{'content-type':'image/png','content-disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="${filename}"`,'cache-control':'public, max-age=300','x-content-type-options':'nosniff'});return res.end(png);}
  if(req.method==='GET'&&!match[2])return json(res,200,{campaign:trialView(campaign),turnstileSiteKey:campaign.captcha_required?turnstileSiteKey:'',cardPngUrl:`/api/trial/${campaign.public_id}/image.png?download=1`});
  if(req.method!=='POST'||!url.pathname.endsWith('/claim'))return json(res,405,{error:'허용되지 않은 요청입니다.'});if(trialFingerprintKey.length<32)return json(res,503,{error:'체험 지급 보안키가 설정되지 않았습니다.'});if(!trialMailer)return json(res,503,{error:'이메일 확인 발송 설정이 완료되지 않았습니다.'});
  const input=await readJson(req),address=String(input.address||'').trim(),email=normalizeEmail(input.email),deviceId=String(input.deviceId||'').trim().slice(0,160),ip=requestIp(req),country=requestCountry(req),ipHash=trialHash(ip),deviceHash=trialHash(deviceId),marketingConsent=input.marketingConsent===true;if(!validVoucherAddress(address))return json(res,400,{error:'올바른 IEUM 지갑 주소를 입력하세요.'});if(!validEmail(email))return json(res,400,{error:'이메일 주소를 올바르게 입력하세요.'});if(input.privacyConsent!==true)return json(res,400,{error:'체험 지급에 필요한 개인정보 수집·이용에 동의해 주세요.'});if(deviceId.length<16)return json(res,400,{error:'기기 확인 정보가 없습니다. 브라우저 저장 기능을 허용한 뒤 다시 시도하세요.'});if(campaign.captcha_required&&!await verifyTurnstile(input.captchaToken,ip))return json(res,400,{error:'사람 확인(CAPTCHA)을 완료하세요.'});
  const client=await pool.connect(),claimId=randomUUID(),token=createVerificationToken(),tokenHash=verificationDigest(token),expiresAt=new Date(Date.now()+trialEmailVerificationMinutes*60_000);try{await client.query('BEGIN');const locked=(await client.query('SELECT * FROM ieum_trial_campaigns WHERE id=$1 FOR UPDATE',[campaign.id])).rows[0],now=Date.now();if(locked.status!=='active'||new Date(locked.starts_at)>now||new Date(locked.ends_at)<=now)throw new Error('현재 진행 중인 체험 캠페인이 아닙니다.');if(BigInt(locked.spent_wei)+BigInt(locked.reward_wei)>BigInt(locked.budget_wei))throw new Error('캠페인 예산이 소진되었습니다.');const checks=(await client.query("SELECT count(*) FILTER(WHERE ip_hash=$2 AND created_at>=date_trunc('day',now()))::int AS ip_day,count(*) FILTER(WHERE device_hash=$3 AND created_at>=date_trunc('day',now()))::int AS device_day,count(*) FILTER(WHERE ip_hash=$2 AND created_at>now()-interval '5 minutes')::int AS burst,max(created_at) FILTER(WHERE ip_hash=$2 OR device_hash=$3) AS last_at FROM ieum_trial_claims WHERE campaign_id=$1 AND status NOT IN ('rejected','expired')",[locked.id,ipHash,deviceHash])).rows[0];if(checks.ip_day>=locked.ip_daily_limit)throw new Error('이 네트워크의 오늘 체험 지급 횟수를 초과했습니다.');if(checks.device_day>=locked.device_daily_limit)throw new Error('이 기기의 오늘 체험 지급 횟수를 초과했습니다.');if(checks.burst>=locked.burst_limit)throw new Error('짧은 시간에 요청이 많습니다. 잠시 후 다시 시도하세요.');if(checks.last_at&&now-new Date(checks.last_at).getTime()<locked.minimum_wait_seconds*1000)throw new Error(`${locked.minimum_wait_seconds}초 후 다시 시도하세요.`);await client.query(`INSERT INTO ieum_trial_claims(id,campaign_id,address,ip_hash,device_hash,status,email,email_hash,email_verification_token_hash,email_verification_expires_at,privacy_consent_at,marketing_consent,marketing_consent_at,ip_address,country_code) VALUES($1,$2,$3,$4,$5,'pending_email',$6,$7,$8,$9,now(),$10,CASE WHEN $10 THEN now() ELSE null END,$11,$12)`,[claimId,locked.id,address.toLowerCase(),ipHash,deviceHash,email,emailDigest(email),tokenHash,expiresAt.toISOString(),marketingConsent,ip==='unknown'?null:ip,country]);await client.query('UPDATE ieum_trial_campaigns SET spent_wei=spent_wei+reward_wei,updated_at=now() WHERE id=$1',[locked.id]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK').catch(()=>{});if(error.code==='23505')return json(res,409,{error:'이 지갑 또는 이메일은 이 캠페인에 이미 신청했습니다.'});return json(res,409,{error:error.message});}finally{client.release();}
  const verifyUrl=`${voucherPublicUrl}/trial/verify?token=${encodeURIComponent(token)}`;try{await trialMailer.send({to:email,verifyUrl,campaignName:campaign.name,expiresAt});}catch(error){await query('DELETE FROM ieum_trial_claims WHERE id=$1',[claimId]);await query('UPDATE ieum_trial_campaigns SET spent_wei=greatest(spent_wei-reward_wei,0),updated_at=now() WHERE id=$1',[campaign.id]);await audit({action:'trial-email-send-failed',ip,claimId,error:String(error.message||error).slice(0,160)});return json(res,503,{error:'확인 메일을 보내지 못했습니다. 잠시 후 다시 신청해 주세요.'});}await audit({action:'trial-email-sent',ip,country,publicId:campaign.public_id,claimId,marketingConsent});return json(res,202,{ok:true,pendingEmail:true,message:'확인 메일을 보냈습니다. 메일의 링크에서 확인을 완료하면 IEUM이 지급됩니다.',expiresAt});
}

async function trialEmailVerifyApi(req,res){
  if(req.method!=='POST')return json(res,405,{error:'확인 버튼을 눌러 진행해 주세요.'});if(!sameOrigin(req))return json(res,403,{error:'허용되지 않은 Origin입니다.'});if(!await dbReady())return json(res,503,{error:'잠시 후 다시 시도해 주세요.'});const input=await readJson(req),tokenHash=verificationDigest(input.token),ip=requestIp(req),client=await pool.connect();let claim,campaign;try{await client.query('BEGIN');claim=(await client.query('SELECT * FROM ieum_trial_claims WHERE email_verification_token_hash=$1 FOR UPDATE',[tokenHash])).rows[0];if(!claim)throw new Error('확인 링크가 올바르지 않거나 이미 사용되었습니다.');if(claim.status!=='pending_email')throw new Error('이미 처리된 신청입니다.');if(new Date(claim.email_verification_expires_at)<=new Date()){await client.query("UPDATE ieum_trial_claims SET status='expired',email_verification_token_hash=null,updated_at=now() WHERE id=$1",[claim.id]);await client.query('UPDATE ieum_trial_campaigns SET spent_wei=greatest(spent_wei-reward_wei,0),updated_at=now() WHERE id=$1',[claim.campaign_id]);await client.query('COMMIT');return json(res,410,{error:'이메일 확인 기한이 지났습니다. 체험 페이지에서 다시 신청해 주세요.'});}campaign=(await client.query('SELECT * FROM ieum_trial_campaigns WHERE id=$1',[claim.campaign_id])).rows[0];await client.query("UPDATE ieum_trial_claims SET status='queued',email_verified_at=now(),updated_at=now() WHERE id=$1",[claim.id]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK').catch(()=>{});return json(res,409,{error:error.message});}finally{client.release();}await audit({action:'trial-email-verified',ip,claimId:claim.id,publicId:campaign.public_id});const txHash=await payTrialClaim(claim,campaign,ip);return json(res,200,{ok:true,txHash,explorerUrl:`${voucherExplorerUrl}${txHash}`});
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
  return summarizeProduction(blocks,{eventDriven:config.eventDrivenBlocks!==false,targetSeconds:Number(config.targetBlockSeconds)||3});
}
export function summarizeProduction(blocks,{eventDriven=true,targetSeconds=3}={}){
  const intervals=blocks.slice(1).map((block,index)=>Math.max(0,block.timestamp-blocks[index].timestamp));
  const producerBlocks={};for(const block of blocks)producerBlocks[block.producer]=(producerBlocks[block.producer]||0)+1;
  return {sampleBlocks:blocks.length,intervalSamples:intervals.length,averageBlockTimeSeconds:intervals.length?intervals.reduce((sum,value)=>sum+value,0)/intervals.length:null,estimatedMissedSlots:eventDriven?null:intervals.reduce((sum,value)=>sum+Math.max(0,Math.floor(value/Math.max(1,targetSeconds))-1),0),producerBlocks,genesisExcluded:true,eventDriven};
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
    const versions=new Set(online.map(n=>n.status?.version).filter(Boolean));
    if (versions.size>1) alerts.push({level:'critical',message:`노드 간 Chain 버전 불일치: ${[...versions].join(' / ')}`});
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
    if (!chain.production?.eventDriven && chain.production?.intervalSamples>0 && chain.production.averageBlockTimeSeconds>6) alerts.push({level:'warning',message:`평균 블록 생성 시간이 ${chain.production.averageBlockTimeSeconds.toFixed(2)}초입니다.`});
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
    const health=diagnoseNodes(nodes,healthHistory,Date.now(),Math.max(10,Number(config.stuckDetectionSeconds)||20)*1000);healthHistory=health.next;
    const chainVersions=[...new Set(nodes.filter(n=>n.online).map(n=>n.status?.version).filter(Boolean))];
    const data={generatedAt:new Date().toISOString(),symbol:config.unitSymbol||'IEUM',decimals:config.unitDecimals??18,
      managerVersion,chainVersion:chainVersions.length===1?chainVersions[0]:null,chainVersions,nodes,wallets,transactions,chain,diagnostics:health.diagnostics,alerts:buildAlerts(nodes,chain),summary:{onlineNodes:nodes.filter(n=>n.online).length,totalNodes:nodes.length,
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
  res.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:");
  const url=new URL(req.url,'http://localhost');
  const policy=await loadPolicy(),clientIp=requestIp(req),decision=wafDecision(policy,clientIp,{path:url.pathname,userAgent:req.headers['user-agent']});
  if(decision.action!=='allow'){await audit({action:`waf-${decision.action}`,ip:clientIp,method:req.method,path:url.pathname.slice(0,512),score:decision.score,reasons:decision.reasons,userAgent:String(req.headers['user-agent']||'').slice(0,300)});if(decision.action==='block'){policy.waf.quarantine[clientIp]={score:decision.score,reasons:decision.reasons,expiresAt:new Date(Date.now()+Number(policy.waf.blockTtlSeconds||3600)*1000).toISOString()};await savePolicy(policy);return json(res,403,{error:'WAF에서 요청을 차단했습니다.'});}}
  if(!rateAllowed(req,url.pathname.startsWith('/api/admin/')?30:180)){await audit({action:'waf-rate-limit',ip:requestIp(req),method:req.method,path:url.pathname});return json(res,429,{error:'요청이 너무 많습니다. 잠시 후 다시 시도하세요.'});}
  if(url.pathname.length>512||/[\\\0]/.test(url.pathname)||/(?:\.\.|%2e%2e|wp-admin|wp-login|\.env|\.git)/i.test(req.url)){await audit({action:'waf-path-block',ip:requestIp(req),method:req.method,path:url.pathname.slice(0,512)});return json(res,403,{error:'WAF에서 요청을 차단했습니다.'});}
  if(url.pathname.startsWith('/api/admin/')){try{return await adminApi(req,res,url);}catch(error){await audit({action:'admin-error',ip:requestIp(req),error:error.message});return json(res,400,{error:error.message});}}
  if(url.pathname==='/api/session')return json(res,200,{admin:Boolean(aahAdmin(req))});
  if(url.pathname.startsWith('/api/guilds')){try{return await guildApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(url.pathname.startsWith('/api/rewards/')){try{return await rewardApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(url.pathname==='/api/purchases'){try{return await purchaseApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(url.pathname.startsWith('/api/vouchers/')){try{return await voucherPublicApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(url.pathname==='/api/trial-email/verify'){try{return await trialEmailVerifyApi(req,res);}catch(error){return json(res,400,{error:error.message});}}
  if(url.pathname.startsWith('/api/trial/')){try{return await trialPublicApi(req,res,url);}catch(error){return json(res,400,{error:error.message});}}
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'허용되지 않은 HTTP 메서드입니다.'});
  if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(req.url.startsWith('/api/explorer/')){try{return await explorerApi(req,res,new URL(req.url,'http://localhost'));}catch(error){return json(res,500,{error:error.message});}}
  if(req.url==='/api/snapshot'){
    try{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(await snapshot()));}
    catch(error){res.writeHead(503,{'content-type':'application/json'});return res.end(JSON.stringify({error:error.message}));}
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const detailRoutes=new Set(['/nodes','/validators','/accounts','/transactions','/explorer']);const entityRoute=/^\/(?:tx|address|block)\/[^/]+$/;const adminRoutes=/^\/admin(?:\/dashboard|\/rpc|\/waf|\/blocked|\/audit|\/peers|\/rewards)?$/;
  const requested = pathname === '/' ? 'index.html' : pathname==='/admin/peers'?'peers.html':pathname==='/admin/vouchers'?'vouchers-admin.html':pathname==='/admin/trial-campaigns'?'trial-campaigns-admin.html':pathname==='/admin/trial-audience'?'trial-audience-admin.html':pathname==='/trial/verify'?'trial-verify.html':/^\/voucher\/[2-9A-HJ-NP-Z]{10}$/.test(pathname)?'voucher.html':/^\/trial\/[A-F0-9]{12}$/.test(pathname)?'trial.html':detailRoutes.has(pathname)||entityRoute.test(pathname)?'detail.html':adminRoutes.test(pathname)?'admin.html':pathname.replace(/^\//, '');
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,''); const path=join(root,'public',safe);
  try{let body=await readFile(path);const contentType=mime[extname(path)]||'application/octet-stream';if(contentType.startsWith('text/html')&&/^\/trial\/[A-F0-9]{12}$/.test(pathname)){const campaign=(await query('SELECT * FROM ieum_trial_campaigns WHERE public_id=$1',[pathname.slice(-12)])).rows[0];let html=body.toString('utf8'),metadata=campaign?trialMetadata(campaign):'<meta name="robots" content="noindex,nofollow">';html=html.replace('</head>',`${metadata}</head>`);if(campaign)html=html.replace('<title>IEUM 첫 체험</title>',`<title>${escapeMeta(campaign.name)} · ${escapeMeta(formatVoucherAmount(campaign.reward_wei))} IEUM 첫 체험</title>`);body=Buffer.from(html);}if(contentType.startsWith('text/html')&&pathname.startsWith('/admin/')){let html=body.toString('utf8');if(!html.includes('/admin-nav.css'))html=html.replace('</head>','<link rel="stylesheet" href="/admin-nav.css?v=10014"></head>');if(!html.includes('/admin-nav.js'))html=html.replace('</body>','<script src="/admin-nav.js?v=10014"></script></body>');body=Buffer.from(html);}res.writeHead(200,{'content-type':contentType,'cache-control':'public, max-age=300'});res.end(body);}
  catch{res.writeHead(404);res.end('Not found');}
});
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  server.listen(port,host,()=>console.log(`IEUM Manager listening on http://${host}:${port}`));
}
