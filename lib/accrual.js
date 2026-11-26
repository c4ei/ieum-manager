import {Transaction,Wallet,hexlify,keccak256,toUtf8Bytes} from 'ethers';
import {parseVoucherAmount} from './vouchers.js';

// IEUM Chain 1.0.17.0(프로토콜 v6) 스테이킹 시스템 주소. calldata `accrue:0x받는주소`면 잠긴 적립 거래입니다.
export const STAKING_SYSTEM_ADDRESS='0x0000000000000000000000000000000000021004';
export const ACCRUAL_DAILY_CAP_WEI=300000000000000000n;
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const CASE_ID=/^[A-Za-z0-9_-]{1,64}$/;

export const kstDate=(now=new Date())=>new Date(now.getTime()+9*3600_000).toISOString().slice(0,10);

export function accrualCalldata(recipient){
  if(!ADDRESS.test(String(recipient||'')))throw new Error('적립 받을 주소가 올바르지 않습니다.');
  return hexlify(toUtf8Bytes(`accrue:${String(recipient).toLowerCase()}`));
}

// 운영 지갑 잔액을 받는 주소의 잠긴 적립으로 넣는 거래. 체인 해시 조회는 keccak256(raw)로 합니다.
export async function buildAccrualGrant(privateKey,{nonce,recipient,value}){
  const amount=BigInt(value);
  if(amount<=0n||amount>ACCRUAL_DAILY_CAP_WEI)throw new Error('적립액은 0보다 크고 하루 한도(0.3 IEUM) 이하여야 합니다.');
  const wallet=new Wallet(privateKey);
  const raw=await wallet.signTransaction({type:0,chainId:21004,nonce:Number(nonce),to:STAKING_SYSTEM_ADDRESS,value:amount,data:accrualCalldata(recipient),gasLimit:21_000n,gasPrice:1n});
  const parsed=Transaction.from(raw);
  return {raw,hash:keccak256(raw),from:parsed.from.toLowerCase(),nonce:parsed.nonce,value:amount,recipient:String(recipient).toLowerCase()};
}

export const incidentConfirmation=(kind,caseId)=>`${String(kind).toUpperCase()} ${caseId}`;

const uniqueAddresses=list=>{
  const values=(Array.isArray(list)?list:[]).map(value=>String(value||'').trim().toLowerCase()).filter(Boolean);
  if(!values.length||values.length>32)throw new Error('주소는 1~32개여야 합니다.');
  if(values.some(value=>!ADDRESS.test(value)))throw new Error('0x로 시작하는 42자리 주소만 넣을 수 있습니다.');
  if(new Set(values).size!==values.length)throw new Error('같은 주소가 두 번 들어 있습니다.');
  return values;
};

// 관리자 화면 입력을 체인 이벤트(config/events.json 항목)로 바꿉니다. 호스트 에이전트도 같은 형식만 받습니다.
export function buildIncidentEvent(input,now=Date.now()){
  const kind=String(input?.kind||'');
  const caseId=String(input?.caseId||'').trim();
  if(!CASE_ID.test(caseId))throw new Error('사건 ID는 영문·숫자·-·_ 1~64자입니다.');
  const executeAt=Math.floor(now/1000);
  let action;
  if(kind==='freeze'){
    const reason=String(input.reason||'').trim();
    if(!reason||[...reason].length>200)throw new Error('공개 사유는 1~200자로 적어 주세요.');
    action={type:'account_freeze',case_id:caseId,addresses:uniqueAddresses(input.addresses),reason};
  }else if(kind==='unfreeze'){
    action={type:'account_unfreeze',case_id:caseId,addresses:uniqueAddresses(input.addresses)};
  }else if(kind==='recover'){
    const from=String(input.from||'').trim().toLowerCase();
    if(!ADDRESS.test(from))throw new Error('동결된 주소가 올바르지 않습니다.');
    const payments=(Array.isArray(input.payments)?input.payments:[]).map(item=>({address:String(item?.address||'').trim().toLowerCase(),amount:parseVoucherAmount(item?.amount).toString()}));
    if(!payments.length||payments.length>32)throw new Error('피해자는 1~32명이어야 합니다.');
    if(payments.some(item=>!ADDRESS.test(item.address)||item.address===from))throw new Error('피해자 주소가 올바르지 않거나 동결 주소와 같습니다.');
    action={type:'account_recovery',case_id:caseId,from,payments,release:input.release===true};
  }else throw new Error('freeze, recover, unfreeze 중 하나를 고르세요.');
  return {id:`${kind}-${caseId}-${executeAt}`,execute_at:executeAt,action};
}
