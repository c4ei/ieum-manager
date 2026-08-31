import {createHash,randomBytes} from 'node:crypto';
import nodemailer from 'nodemailer';

export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export const validEmail=value=>/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/.test(normalizeEmail(value));
export const emailDigest=value=>createHash('sha256').update(normalizeEmail(value)).digest('hex');
export const verificationDigest=value=>createHash('sha256').update(String(value||'')).digest('hex');
export const createVerificationToken=()=>randomBytes(32).toString('base64url');
const htmlEscape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createTrialMailer(env=process.env){
  const user=env.NODEMAILER_USER||'',pass=env.NODEMAILER_PASS||'',adminEmail=env.ADMIN_NOTIFY_EMAIL||'';
  if(!user||!pass)return null;
  const transport=nodemailer.createTransport({service:'gmail',auth:{user,pass}});
  return {send:({to,verifyUrl,campaignName,expiresAt})=>transport.sendMail({from:`IEUM <${user}>`,replyTo:adminEmail||user,to,subject:`[IEUM] ${campaignName.replace(/[\r\n]/g,' ')} 이메일 확인`,text:`IEUM 체험 지급을 계속하려면 아래 주소를 열고 확인 버튼을 눌러 주세요.\n\n${verifyUrl}\n\n확인 기한: ${new Date(expiresAt).toISOString()}\n본인이 신청하지 않았다면 이 메일을 무시하세요.`,html:`<p>IEUM 체험 지급을 계속하려면 아래 버튼을 눌러 주세요.</p><p><a href="${htmlEscape(verifyUrl)}">이메일 확인 화면 열기</a></p><p>확인 기한: ${new Date(expiresAt).toISOString()}</p><p>본인이 신청하지 않았다면 이 메일을 무시하세요.</p>`})};
}
