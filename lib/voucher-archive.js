import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

const archiveKey=value=>{
  const secret=String(value||'');
  if(secret.length<32)throw new Error('IEUM_VOUCHER_ARCHIVE_KEY를 32자 이상으로 설정하세요.');
  return createHash('sha256').update(secret).digest();
};

export function encryptVoucherSecret(value,secret){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',archiveKey(secret),iv),plain=Buffer.from(JSON.stringify(value),'utf8'),encrypted=Buffer.concat([cipher.update(plain),cipher.final()]),tag=cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptVoucherSecret(value,secret){
  const [version,iv,tag,encrypted]=String(value||'').split(':');
  if(version!=='v1'||!iv||!tag||!encrypted)throw new Error('지원하지 않는 상품권 보관 형식입니다.');
  const decipher=createDecipheriv('aes-256-gcm',archiveKey(secret),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  const plain=Buffer.concat([decipher.update(Buffer.from(encrypted,'base64url')),decipher.final()]);
  const result=JSON.parse(plain.toString('utf8'));
  if(!result?.token||!result?.code)throw new Error('보관된 상품권 비밀정보가 올바르지 않습니다.');
  return result;
}
