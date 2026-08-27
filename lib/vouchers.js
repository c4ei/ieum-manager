import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {Transaction,Wallet,keccak256} from 'ethers';
const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const WEI=10n**18n;
const randomText=n=>Array.from(randomBytes(n),b=>ALPHABET[b%ALPHABET.length]).join('');
export const formatCode=value=>String(value).replace(/[^0-9A-Z]/gi,'').toUpperCase().match(/.{1,4}/g)?.join('-')||'';
export const validVoucherAddress=value=>/^0x[0-9a-f]{40}$/i.test(String(value||''));
export function parseVoucherAmount(value){const text=String(value??'').trim();if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text))throw new Error('상품권 금액은 소수점 18자리 이하의 양수여야 합니다.');const [whole,fraction='']=text.split('.');const wei=BigInt(whole)*WEI+BigInt((fraction+'0'.repeat(18)).slice(0,18));if(wei<=0n)throw new Error('상품권 금액은 0보다 커야 합니다.');return wei;}
export const formatVoucherAmount=wei=>{const value=BigInt(wei),whole=value/WEI,fraction=String(value%WEI).padStart(18,'0').replace(/0+$/,'');return fraction?`${whole}.${fraction}`:String(whole);};
export const voucherDigest=(value,pepper)=>createHash('sha256').update(`${pepper}:${value}`).digest('hex');
export function createVoucherSecrets(pepper){if(String(pepper).length<32)throw new Error('IEUM_VOUCHER_CODE_PEPPER를 32자 이상으로 설정하세요.');const code=formatCode(randomText(16)),token=randomBytes(24).toString('base64url');return{id:randomUUID(),publicId:randomText(10),code,token,codeHash:voucherDigest(code.replaceAll('-',''),pepper),tokenHash:voucherDigest(token,pepper)};}
export function voucherCodeMatches(code,expected,pepper){const actual=Buffer.from(voucherDigest(formatCode(code).replaceAll('-',''),pepper),'hex'),wanted=Buffer.from(expected,'hex');return actual.length===wanted.length&&timingSafeEqual(actual,wanted);}

function unsignedBytes(value,width,name){const number=BigInt(value);if(number<0n||number>=(1n<<BigInt(width*8)))throw new Error(`${name}이 ${width}바이트 범위를 벗어났습니다.`);const bytes=Buffer.alloc(width);let remaining=number;for(let index=width-1;index>=0;index--){bytes[index]=Number(remaining&255n);remaining>>=8n;}return bytes;}
function textBytes(value){const body=Buffer.from(String(value),'utf8');return Buffer.concat([unsignedBytes(body.length,8,'문자열 길이'),body]);}

// IEUM Chain은 Ethereum keccak(raw)이 아니라 Transaction::id()를 RPC 거래 해시로 반환합니다.
// src/model.rs의 signing_bytes + "ethraw:<hex>" SHA-256 규칙을 그대로 구현합니다.
export function inspectVoucherPayout(raw){const normalized=String(raw||'');if(!/^0x[0-9a-f]+$/i.test(normalized))throw new Error('저장된 raw 거래가 올바르지 않습니다.');const transaction=Transaction.from(normalized);if(transaction.type!==0||transaction.chainId!==21004n||!transaction.from||!transaction.to||transaction.gasPrice===null)throw new Error('IEUM 메인넷 legacy 지급 거래가 아닙니다.');const from=transaction.from.toLowerCase(),to=transaction.to.toLowerCase(),value=transaction.value,fee=transaction.gasPrice*transaction.gasLimit,nonce=transaction.nonce,signature=`ethraw:${normalized.slice(2).toLowerCase()}`;const signing=Buffer.concat([textBytes(from),textBytes(to),unsignedBytes(value,16,'금액'),unsignedBytes(fee,16,'수수료'),unsignedBytes(nonce,8,'nonce')]);const expectedHash=`0x${createHash('sha256').update(signing).update(signature,'utf8').digest('hex')}`;return{from,to,value,fee,nonce,raw:normalized,rawHash:keccak256(normalized),expectedHash};}
export async function buildVoucherPayout(privateKey,{nonce,to,value}){if(!validVoucherAddress(to))throw new Error('올바르지 않은 IEUM 수령 주소입니다.');const wallet=new Wallet(privateKey),raw=await wallet.signTransaction({type:0,chainId:21004,nonce:Number(nonce),to,value:BigInt(value),gasLimit:21_000n,gasPrice:1n});return inspectVoucherPayout(raw);}
