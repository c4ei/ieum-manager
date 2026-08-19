const form=document.querySelector('#sns-reward-form');
const message=document.querySelector('#sns-message');
const status=document.querySelector('#sns-status');
const submit=document.querySelector('#sns-submit');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(options.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}
function render(items){status.innerHTML=items.length?items.map(item=>`<article class="panel"><b>${esc(item.platform)} · ${esc(item.account)}</b><p>${esc(item.postUrl)}</p><p>지갑 ${esc(item.address)}</p><p>상태: ${esc(item.status)} · 확인: ${esc(item.verification)}</p>${item.reviewerNote?`<p>${esc(item.reviewerNote)}</p>`:''}</article>`).join(''):'<p class="empty">신청 내역이 없습니다.</p>';}
async function load(){try{const data=await api('/api/rewards/sns-claims/me');render(data.items||[]);message.textContent='AAH 로그인 계정이 확인됐습니다.';}catch(error){status.innerHTML='<p class="empty">AAH 로그인 후 신청 내역을 확인할 수 있습니다.</p>';message.textContent=error.message;}}
form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const data=Object.fromEntries(new FormData(form));const result=await api('/api/rewards/sns-claims',{method:'POST',body:JSON.stringify(data)});message.textContent=result.notice;form.reset();await load();}catch(error){message.textContent=error.message;}finally{submit.disabled=false;}});
document.querySelector('#sns-refresh').addEventListener('click',load);
load();
