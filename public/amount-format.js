export const IEUM_DECIMALS=18;
export const IEUM_DISPLAY_DECIMALS=8;

export function formatIeum(value,{decimals=IEUM_DECIMALS,maxFractionDigits=IEUM_DISPLAY_DECIMALS,locale='ko-KR'}={}){
  const n=typeof value==='bigint'?value:BigInt(value);
  if(!Number.isInteger(decimals)||decimals<0)throw new Error('decimals must be a non-negative integer');
  if(!Number.isInteger(maxFractionDigits)||maxFractionDigits<0)throw new Error('maxFractionDigits must be a non-negative integer');
  const negative=n<0n,absolute=negative?-n:n,shown=Math.min(decimals,maxFractionDigits),discarded=decimals-shown;
  const roundingUnit=10n**BigInt(discarded),rounded=discarded>0?(absolute+roundingUnit/2n)/roundingUnit:absolute;
  const displayScale=10n**BigInt(shown),whole=(rounded/displayScale).toLocaleString(locale);
  const fraction=shown>0?(rounded%displayScale).toString().padStart(shown,'0').replace(/0+$/,''):'';
  return `${negative?'-':''}${whole}${fraction?`.${fraction}`:''}`;
}

export function formatWei(value,{symbol='IEUM',...options}={}){
  const n=typeof value==='bigint'?value:BigInt(value),scale=10n**BigInt(options.decimals??IEUM_DECIMALS);
  return {primary:`${formatIeum(n,options)} ${symbol}`,wei:n%scale===0n?null:`${n.toLocaleString(options.locale??'ko-KR')} wei`};
}

export function amountHtml(value,{escape=value=>String(value),...options}={}){
  try{const amount=formatWei(value,options);return `<span class="ieum-amount">${escape(amount.primary)}${amount.wei?`<small>${escape(amount.wei)}</small>`:''}</span>`;}catch{return '—';}
}
