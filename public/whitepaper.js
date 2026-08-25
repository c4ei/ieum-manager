const key='ieum-whitepaper-language';
const buttons=[...document.querySelectorAll('[data-language]')];
const documents=[...document.querySelectorAll('[data-document]')];
function select(language){
  const next=language==='en'?'en':'ko';
  document.documentElement.lang=next;
  documents.forEach(document=>{document.hidden=document.dataset.document!==next});
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===next)));
  localStorage.setItem(key,next);
}
buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.language)));
select(localStorage.getItem(key)||((navigator.language||'').toLowerCase().startsWith('ko')?'ko':'en'));
