const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>/^0x[0-9a-fA-F]{40}$/.test(v),statusName={sent:'처리 중',confirmed:'적립 완료',uncertain:'확인 필요',paying:'처리 중'};
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
const remember=v=>{try{localStorage.setItem('ieum-checkin-address',v);}catch{}};
try{$('address').value=localStorage.getItem('ieum-checkin-address')||'';}catch{}
async function showStatus(){const address=$('address').value.trim();if(!valid(address)){$('message').textContent='0x로 시작하는 42자리 주소를 넣어 주세요.';return;}remember(address);
  const d=await api(`/api/rewards/accrual?address=${address}`);$('amount').textContent=d.checkin.amount;$('web-cap').textContent=d.checkin.webDailyCap;$('checkin').disabled=!d.checkin.enabled;$('status').hidden=false;
  if(!d.accrual){$('freeze').textContent='체인 적립 정보를 불러오지 못했어요.';return;}const a=d.accrual;
  const pct=a.percent>0&&a.percent<0.01?'0.01% 미만':`${a.percent}%`;$('bar').style.width=a.percent>0?`max(4px, ${Math.min(a.percent,100)}%)`:'0';$('bond').textContent=`${a.bond} / ${a.required} IEUM (${pct})`;$('remaining').textContent=`${a.remaining} IEUM`;$('today').textContent=`${a.todayUsed} / ${a.dailyCap}`;$('days').textContent=a.bonded?'완료':`${a.minimumDays}일`;
  $('freeze').innerHTML=d.freeze?.frozen?'<span class="frozen">이 주소는 보안 사고로 동결되어 있어요.</span>':a.bonded?'<span class="ok">담보를 모두 채웠어요. 노드를 이 주소로 연결하면 보상을 받아요.</span>':`잠긴 적립 ${esc(a.locked)} IEUM 포함`;}
async function history(){try{const d=await api('/api/rewards/checkin/me');$('history').innerHTML=d.items.length?`<table><tr><th>날짜</th><th>금액</th><th>상태</th><th>주소</th></tr>${d.items.map(i=>`<tr><td>${esc(i.date)}</td><td>${esc(i.amount)}</td><td>${esc(statusName[i.status]||i.status)}</td><td>${esc(i.address.slice(0,10))}…</td></tr>`).join('')}</table>`:'<p class="muted">아직 출석 기록이 없어요.</p>';}catch(e){$('history').innerHTML=`<p class="muted">${esc(e.message)}</p>`;}}
$('check').onclick=()=>showStatus().catch(e=>$('message').textContent=e.message);
$('checkin').onclick=async()=>{const address=$('address').value.trim();if(!valid(address)){$('message').textContent='0x로 시작하는 42자리 주소를 넣어 주세요.';return;}$('checkin').disabled=true;$('message').textContent='출석 처리 중…';
  try{const d=await api('/api/rewards/checkin',{method:'POST',body:JSON.stringify({address})});remember(address);$('message').textContent=d.message;setTimeout(()=>{showStatus().catch(()=>{});history();},8000);await history();}catch(e){$('message').textContent=e.message;}finally{$('checkin').disabled=false;}};
$('refresh').onclick=history;
if(valid($('address').value))showStatus().catch(()=>{});history();
