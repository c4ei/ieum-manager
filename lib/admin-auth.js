import jwt from 'jsonwebtoken';

export function cookieValue(req,name){return String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)||'';}
export function jwtUser(req,secret){try{return jwt.verify(decodeURIComponent(cookieValue(req,'token')),secret)||null;}catch{return null;}}
export function jwtAdmin(req,secret){const user=jwtUser(req,secret);return user?.userType==='A'?user:null;}
