import {randomUUID} from 'node:crypto';

export const DEFAULT_ONBOARDING_TASKS=[
  {code:'wallet-created',label:'지갑 설치·주소 생성',amount:'10000000000000000',mode:'verified'},
  {code:'first-transfer',label:'첫 온체인 송금 완료',amount:'10000000000000000',mode:'onchain'},
  {code:'node-24h',label:'실제 노드 24시간 운영',amount:'10000000000000000',mode:'node-uptime'},
  {code:'verified-bug',label:'검증된 오류 신고',amount:null,mode:'manual-by-severity'},
  {code:'sns-review',label:'SNS 체험 후기',amount:'10000000000000000',mode:'platform-api-or-review'}
];

const time=value=>{const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw new Error('시작·종료 날짜가 올바르지 않습니다.');return parsed;};
const integer=(value,name,min,max)=>{const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`${name} 범위가 올바르지 않습니다.`);return number;};
const wei=value=>{if(!/^\d+$/.test(String(value))||BigInt(value)<=0n)throw new Error('금액은 0보다 큰 wei 정수 문자열이어야 합니다.');return String(value);};
export function normalizeCampaign(input,existing={}){
  const type=input.type==='onboarding'?'onboarding':'holder';
  const startsAt=new Date(time(input.startsAt)).toISOString(),endsAt=new Date(time(input.endsAt)).toISOString();
  if(Date.parse(endsAt)<=Date.parse(startsAt))throw new Error('종료 날짜는 시작 날짜보다 늦어야 합니다.');
  const campaign={id:existing.id||randomUUID(),name:String(input.name||'').trim().slice(0,80),type,startsAt,endsAt,status:input.status||existing.status||'draft',createdAt:existing.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(!campaign.name)throw new Error('이벤트 이름을 입력하세요.');
  if(!['draft','approved','active','ended','cancelled'].includes(campaign.status))throw new Error('이벤트 상태가 올바르지 않습니다.');
  if(type==='holder')Object.assign(campaign,{annualRateBps:integer(input.annualRateBps,'APR',0,5000),minimumBalance:wei(input.minimumBalance),maximumDailyTotal:wei(input.maximumDailyTotal)});
  else campaign.tasks=(Array.isArray(input.tasks)&&input.tasks.length?input.tasks:DEFAULT_ONBOARDING_TASKS).map(task=>({code:String(task.code||'').slice(0,40),label:String(task.label||'').slice(0,80),amount:task.amount==null?null:wei(task.amount),mode:String(task.mode||'manual').slice(0,40)}));
  return campaign;
}
export function assertNoOverlap(campaign,campaigns){
  const start=Date.parse(campaign.startsAt),end=Date.parse(campaign.endsAt);
  const conflict=campaigns.find(item=>item.id!==campaign.id&&item.status!=='cancelled'&&start<Date.parse(item.endsAt)&&Date.parse(item.startsAt)<end);
  if(conflict)throw new Error(`기간이 '${conflict.name}' 이벤트와 중복됩니다.`);
}
export function holderConfig(campaign){
  if(campaign.type!=='holder')throw new Error('보유 보상 이벤트만 Chain 설정으로 내보낼 수 있습니다.');
  return {enabled:campaign.status==='active',campaign_name:campaign.name,starts_at:Math.floor(Date.parse(campaign.startsAt)/1000),ends_at:Math.floor(Date.parse(campaign.endsAt)/1000),annual_rate_bps:campaign.annualRateBps,minimum_balance:campaign.minimumBalance,maximum_daily_total:campaign.maximumDailyTotal};
}
export function sanitizePayout(input){
  const address=String(input.address||'').toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(address))throw new Error('지갑 주소가 올바르지 않습니다.');
  const txHash=String(input.txHash||'').toLowerCase();if(txHash&&!/^0x[0-9a-f]{64}$/.test(txHash))throw new Error('거래 해시가 올바르지 않습니다.');
  return {id:randomUUID(),campaignId:String(input.campaignId||''),taskCode:String(input.taskCode||'holder-daily').slice(0,40),address,amount:wei(input.amount),txHash:txHash||null,paidAt:new Date(input.paidAt||Date.now()).toISOString(),ip:String(input.ip||'').slice(0,64)||null,country:String(input.country||'').slice(0,80)||null,note:String(input.note||'').slice(0,300),recordedAt:new Date().toISOString()};
}

export function sanitizeSnsClaim(input,{userId,ip}={}){
  const address=String(input.address||'').toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(address))throw new Error('지갑 주소가 올바르지 않습니다.');
  const postUrl=String(input.postUrl||'').trim();let parsed;try{parsed=new URL(postUrl);}catch{throw new Error('SNS 게시물 URL이 올바르지 않습니다.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)throw new Error('SNS 게시물은 표준 HTTPS URL이어야 합니다.');
  const platform=String(input.platform||'').trim().toLowerCase();if(!/^[a-z0-9_-]{1,30}$/.test(platform))throw new Error('SNS 플랫폼 값이 올바르지 않습니다.');
  const account=String(input.account||'').trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9._-]{2,80}$/.test(account))throw new Error('SNS 계정명이 올바르지 않습니다.');
  const user=String(userId||'').trim();if(!user)throw new Error('로그인 계정을 확인할 수 없습니다.');
  return {id:randomUUID(),userId:user,address,platform,account,postUrl:parsed.href,status:'pending',amount:'10000000000000000',verification:'manual-review',ip:String(ip||'').slice(0,64)||null,submittedAt:new Date().toISOString(),reviewedAt:null,reviewerNote:'',txHash:null};
}

export function assertSnsClaimUnique(claim,claims){
  const duplicate=claims.find(item=>item.userId===claim.userId||item.address===claim.address||item.postUrl===claim.postUrl||`${item.platform}:${item.account}`===`${claim.platform}:${claim.account}`);
  if(duplicate)throw new Error('AAH 계정·지갑 주소·SNS 계정·게시물 중 하나가 이미 참여했습니다. SNS 보상은 계정당 1회입니다.');
}
