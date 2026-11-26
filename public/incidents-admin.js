const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=sessionStorage.getItem('ieum-admin-token')||'',kind='freeze';
const kindName={freeze:'동결',recover:'복구',unfreeze:'해제'},statusName={queued:'대기',applied:'반영됨',rejected:'거절됨'};
const time=s=>s?new Date(s*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'-';
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
const lines=v=>v.split(/\n+/).map(x=>x.trim()).filter(Boolean);
function phrase(){const id=$('case').value.trim()||'<사건ID>';$('phrase').textContent=`${kind.toUpperCase()} ${id}`;}
function setKind(next){kind=next;document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));document.querySelectorAll('[data-for]').forEach(el=>el.hidden=!el.dataset.for.split(' ').includes(kind));phrase();}
async function load(){try{const d=await api('/api/admin/incidents');$('agent').innerHTML=d.enabled?'<span class="ok">호스트 에이전트 연결됨</span>':'<span class="frozen">호스트 에이전트 미설정: 요청을 보낼 수 없습니다(README 참고)</span>';
  $('requests').innerHTML=d.requests.length?`<table><tr><th>요청 시각</th><th>종류</th><th>사건</th><th>대상</th><th>상태</th><th>요청자</th></tr>${d.requests.map(r=>{const a=r.event.action,target=a.from||(a.addresses||[]).join(', ');const extra=a.payments?` → ${a.payments.length}명`:'';return `<tr><td>${new Date(r.created_at).toLocaleString('ko-KR')}</td><td>${esc(kindName[r.kind])}</td><td>${esc(r.case_id)}</td><td>${esc(target)}${esc(extra)}</td><td><span class="badge ${esc(r.status)}">${esc(statusName[r.status]||r.status)}</span><br><span class="muted">${esc(r.result||'')}</span></td><td>${esc(r.requested_by)}</td></tr>`;}).join('')}</table>`:'<p class="muted">요청 기록이 없습니다.</p>';}
  catch(e){$('requests').innerHTML=`<p class="frozen">${esc(e.message)}</p>`;}}
$('connect').onclick=()=>{token=$('admin-token').value.trim();sessionStorage.setItem('ieum-admin-token',token);load();};
$('lookup-btn').onclick=async()=>{const address=$('lookup').value.trim();try{const d=await api(`/api/admin/incidents/address?address=${encodeURIComponent(address)}`),f=d.freeze;
  $('lookup-result').innerHTML=`<div class="stat-row" style="margin-top:12px"><span>잔액<b>${esc(d.balance??'-')} IEUM</b></span><span>잠긴 적립<b>${esc(d.accrual?.locked??'-')} IEUM</b></span><span>동결<b class="${f?.frozen?'frozen':'ok'}">${f?.frozen?`예 · ${esc(f.caseId)}`:'아니오'}</b></span><span>복구 가능<b>${f?.frozen?time(f.recoverableAfter):'-'}</b></span></div>${f?.frozen?`<p class="muted">동결 ${time(f.frozenAt)} · 자동 해제 ${time(f.expiresAt)}</p>`:''}`;
  if(f?.frozen){$('case').value=f.caseId;$('from').value=d.address;}else{$('addresses').value=d.address;}phrase();}catch(e){$('lookup-result').innerHTML=`<p class="frozen">${esc(e.message)}</p>`;}};
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>setKind(b.dataset.kind));$('case').oninput=phrase;
$('form').onsubmit=async e=>{e.preventDefault();const body={kind,caseId:$('case').value.trim(),confirmation:$('confirmation').value.trim()};
  if(kind==='freeze')Object.assign(body,{reason:$('reason').value.trim(),addresses:lines($('addresses').value)});
  if(kind==='unfreeze')body.addresses=lines($('addresses').value);
  if(kind==='recover')Object.assign(body,{from:$('from').value.trim(),release:$('release').checked,payments:lines($('payments').value).map(l=>{const [address,amount]=l.split(/[,\s]+/);return{address,amount};})});
  $('form-message').textContent='요청 중…';try{const d=await api('/api/admin/incidents',{method:'POST',body:JSON.stringify(body)});$('form-message').textContent=d.message;$('confirmation').value='';setTimeout(load,20000);await load();}catch(err){$('form-message').textContent=err.message;}};
$('refresh').onclick=load;setKind('freeze');load();
