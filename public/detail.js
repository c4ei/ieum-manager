import {amountHtml} from './amount-format.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num=value=>Number(value??0).toLocaleString('ko-KR');
const short=value=>value?`${value.slice(0,10)}…${value.slice(-8)}`:'—';
const addressLink=value=>value?`<a href="/address/${esc(value)}" title="${esc(value)}">${short(value)}</a>`:'—';
const amount=value=>amountHtml(value,{escape:esc});
let page=1;const size=25;
const tick=()=>$('#updated').textContent=new Date().toLocaleString('ko-KR');tick();setInterval(tick,1000);

function paginate(items){const pages=Math.max(1,Math.ceil(items.length/size));page=Math.min(page,pages);$('#detail-pages').innerHTML=`<button ${page<=1?'disabled':''} data-page="${page-1}">이전</button><span>${page} / ${pages}</span><button ${page>=pages?'disabled':''} data-page="${page+1}">다음</button>`;return items.slice((page-1)*size,page*size)}
function table(headers,rows){return `<div class="panel table-wrap"><table><thead><tr>${headers.map(header=>`<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}

async function entity(){
  const [kind,raw]=location.pathname.slice(1).split('/');if(!raw)return false;
  const value=decodeURIComponent(raw),hash=value.startsWith('0x')?value:`0x${value}`;let endpoint;
  if(kind==='tx')endpoint=`/api/explorer/transaction/${encodeURIComponent(hash)}`;
  else if(kind==='address')endpoint=`/api/explorer/address/${encodeURIComponent(value)}`;
  else if(kind==='block')endpoint=/^\d+$/.test(value)?`/api/explorer/block/${value}`:`/api/explorer/block/hash/${encodeURIComponent(hash)}`;
  else return false;
  const response=await fetch(endpoint),data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  if(kind==='tx'){
    $('#detail-title').innerHTML='트랜잭션 <span>상세</span>';
    $('#detail-content').innerHTML=`<article class="panel search-card"><p><b>Hash</b> <code>${esc(data.hash)}</code></p><p><b>Block</b> <a href="/block/${data.block_height}">${num(data.block_height)}</a></p><p><b>From</b> ${addressLink(data.sender)}</p><p><b>To</b> ${addressLink(data.recipient)}</p><p><b>Value</b> ${amount(data.value)}</p><p><b>Fee</b> ${amount(data.fee)}</p></article>`;
  }else if(kind==='address'){
    $('#detail-title').innerHTML='주소 <span>상세</span>';
    const rows=(data.transactions||[]).map(tx=>`<tr><td><a href="/tx/${esc(tx.hash)}">${short(tx.hash)}</a></td><td><a href="/block/${tx.block_height}">${num(tx.block_height)}</a></td><td>${addressLink(tx.sender)} → ${addressLink(tx.recipient)}</td><td class="amount">${amount(tx.value)}</td></tr>`);
    $('#detail-content').innerHTML=`<article class="panel search-card"><p><b>Address</b> <code>${esc(data.account.address)}</code></p><p class="big-balance">${amount(data.account.balance)}</p><p>거래 ${num(data.account.tx_count)}건 · 최근 블록 ${num(data.account.last_seen_height)}</p></article>${table(['해시','블록','From → To','Value'],rows)}`;
  }else{
    $('#detail-title').innerHTML=`블록 #${num(data.height)} <span>상세</span>`;
    const rows=(data.transactions||[]).map(tx=>`<tr><td><a href="/tx/${esc(tx.hash)}">${short(tx.hash)}</a></td><td>${addressLink(tx.sender)}</td><td>${addressLink(tx.recipient)}</td><td class="amount">${amount(tx.value)}</td></tr>`);
    $('#detail-content').innerHTML=`<article class="panel search-card"><p><b>Hash</b> <code>${esc(data.hash)}</code></p><p><b>Producer</b> ${esc(data.producer)}</p><p><b>Transactions</b> ${num(data.tx_count)}</p></article>${table(['해시','From','To','Value'],rows)}`;
  }
  return true;
}

async function render(){try{if(await entity())return;const data=await fetch('/api/snapshot').then(response=>response.json()),kind=location.pathname.slice(1),chain=data.chain||{};let rows=[];if(kind==='nodes'){rows=data.nodes.map(node=>`<tr><td>${esc(node.name)}</td><td>${node.online?'ONLINE':'OFFLINE'}</td><td>${num(node.status?.height)}</td><td>${num(node.status?.peers)}</td><td>${num(node.latencyMs)} ms</td><td>${short(node.status?.blockHash)}</td></tr>`);$('#detail-content').innerHTML=table(['노드','상태','높이','피어','RPC','블록 해시'],paginate(rows));}else if(kind==='validators'){rows=(chain.validators?.validators||[]).map(v=>`<tr><td>${short(v.id)}</td><td>${Number(v.signingRatePercent).toFixed(2)}%</td><td>${num(v.signedBlocks)} / ${num(v.eligibleBlocks)}</td><td>${num(chain.production?.producerBlocks?.[v.id]||0)}</td><td>${num(v.votingPower)}</td></tr>`);$('#detail-content').innerHTML=table(['검증자','서명률','서명','생성','Power'],paginate(rows));}else if(kind==='accounts'){rows=(chain.accounts?.accounts||[]).map(account=>`<tr><td>${addressLink(account.address)}</td><td class="amount">${amount(account.balance)}</td><td>${account.locked?'잠금':'유통'}</td></tr>`);$('#detail-content').innerHTML=table(['주소','잔액','상태'],paginate(rows));}else{location.href=`/#${kind==='transactions'?'flow':'explorer'}`;}}catch(error){$('#detail-title').innerHTML='조회 <span>실패</span>';$('#detail-content').innerHTML=`<div class="alerts"><p class="critical"><b>SEARCH</b>${esc(error.message)}</p></div>`;}}
document.addEventListener('click',event=>{if(event.target.dataset?.page){page=Number(event.target.dataset.page);render()}});
render();
