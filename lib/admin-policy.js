import {appendFile, mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';

const root=new URL('..',import.meta.url).pathname;
export const statePath=process.env.IEUM_MANAGER_ADMIN_STATE||join(root,'data/admin-policy.json');
export const auditPath=process.env.IEUM_MANAGER_AUDIT_LOG||join(root,'logs/admin-audit.jsonl');

const defaults=()=>({version:3,nodes:{},rewardCampaigns:[],rewardPayouts:[],snsClaims:[],waf:{mode:'block',scoreThreshold:10,blockTtlSeconds:3600,rules:{},quarantine:{}}});
export async function loadPolicy(){
  try{const value=JSON.parse(await readFile(statePath,'utf8'));return {...defaults(),...value,waf:{...defaults().waf,...(value.waf||{})}};}catch(error){if(error.code!=='ENOENT')throw error;return defaults();}
}

export async function savePolicy(policy){
  await mkdir(dirname(statePath),{recursive:true});
  const current=await loadPolicy();const next={...current,...policy,version:3,nodes:policy.nodes||current.nodes||{},rewardCampaigns:policy.rewardCampaigns||current.rewardCampaigns||[],rewardPayouts:policy.rewardPayouts||current.rewardPayouts||[],snsClaims:policy.snsClaims||current.snsClaims||[],waf:{...current.waf,...(policy.waf||{})},updatedAt:new Date().toISOString()};
  const temporary=`${statePath}.${process.pid}.tmp`;
  await writeFile(temporary,`${JSON.stringify(next,null,2)}\n`,{mode:0o600});
  await rename(temporary,statePath);
  return next;
}

export function wafDecision(policy,ip,request){
  const waf=policy.waf||defaults().waf,rule=waf.rules?.[ip],now=Date.now();
  if(rule?.active&&rule.type==='allow')return {action:'allow',score:0,reasons:['manual-allow']};
  if(rule?.active&&rule.type==='block')return {action:'block',score:100,reasons:['manual-block']};
  const quarantine=waf.quarantine?.[ip];if(quarantine&&Date.parse(quarantine.expiresAt)>now)return {action:'block',score:quarantine.score,reasons:['quarantine']};
  const target=`${request.path||''} ${request.userAgent||''}`,checks=[[/\.php|wp-admin|wp-login|phpmyadmin/i,8,'scanner-path'],[/\.env|\.git|backup|\.sql|\.tar|\.zip/i,10,'secret-scan'],[/(?:union\s+select|sleep\(|<script|javascript:|\.\.\/|%2e%2e)/i,12,'injection-or-traversal'],[/sqlmap|nikto|masscan|nmap|acunetix|nessus/i,10,'scanner-user-agent']];
  let score=0;const reasons=[];for(const [pattern,points,reason] of checks)if(pattern.test(target)){score+=points;reasons.push(reason);}
  return {action:score>=Number(waf.scoreThreshold||10)&&waf.mode==='block'?'block':score?'monitor':'allow',score,reasons};
}

export function applyPolicy(nodes,policy){
  return nodes.map(node=>{const rule=policy.nodes?.[node.id]||{};return {...node,admin:{blocked:Boolean(rule.blocked),priority:Number.isFinite(Number(rule.priority))?Math.max(0,Math.min(100,Number(rule.priority))):50,note:String(rule.note||'').slice(0,200)}}})
    .sort((a,b)=>b.admin.priority-a.admin.priority);
}

export async function audit(event){
  try {
    await mkdir(dirname(auditPath),{recursive:true});
    await appendFile(auditPath,`${JSON.stringify({at:new Date().toISOString(),...event})}\n`,{mode:0o600});
    return true;
  } catch (error) {
    // 감사 로그 장애가 API 응답과 Manager 프로세스까지 중단시키지 않도록 stderr에 남깁니다.
    console.error(`IEUM Manager audit log write failed: ${error.message}`);
    return false;
  }
}

export async function recentAudit(limit=100){
  try{const lines=(await readFile(auditPath,'utf8')).trim().split('\n').filter(Boolean);return lines.slice(-Math.max(1,Math.min(Number(limit)||100,500))).reverse().map(line=>{try{return JSON.parse(line);}catch{return {at:null,action:'invalid-log-line'};}});}catch(error){if(error.code==='ENOENT')return [];throw error;}
}
