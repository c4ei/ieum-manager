import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
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
