import {appendFile, mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';

const root=new URL('..',import.meta.url).pathname;
export const statePath=process.env.IEUM_MANAGER_ADMIN_STATE||join(root,'data/admin-policy.json');
const auditPath=process.env.IEUM_MANAGER_AUDIT_LOG||join(root,'logs/admin-audit.jsonl');

export async function loadPolicy(){
  try{return JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {version:1,nodes:{}};}
}

export async function savePolicy(policy){
  await mkdir(dirname(statePath),{recursive:true});
  const next={version:1,nodes:policy.nodes||{},updatedAt:new Date().toISOString()};
  const temporary=`${statePath}.${process.pid}.tmp`;
  await writeFile(temporary,`${JSON.stringify(next,null,2)}\n`,{mode:0o600});
  await rename(temporary,statePath);
  return next;
}

export function applyPolicy(nodes,policy){
  return nodes.map(node=>{const rule=policy.nodes?.[node.id]||{};return {...node,admin:{blocked:Boolean(rule.blocked),priority:Number.isFinite(Number(rule.priority))?Math.max(0,Math.min(100,Number(rule.priority))):50,note:String(rule.note||'').slice(0,200)}}})
    .sort((a,b)=>b.admin.priority-a.admin.priority);
}

export async function audit(event){
  await mkdir(dirname(auditPath),{recursive:true});
  await appendFile(auditPath,`${JSON.stringify({at:new Date().toISOString(),...event})}\n`,{mode:0o600});
}
