import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const COOKIE="gorton_admin_session";
const LIFETIME_SECONDS=8*60*60;
export function checkOrigin(request:Request):boolean {
  const origin=request.headers.get("origin");
  const allowed=(process.env.APP_ORIGIN||new URL(request.url).origin).replace(/\/$/,"");
  // All first-party browser POST requests carry Origin; reject missing/mismatched ones.
  return !!origin && origin===allowed;
}
export const noStore = { "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" };
export function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:noStore});}
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)return null;return s;}
export function adminConfigured(){return !!(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length>=16 && secret());}
export function matchAdminPassword(p:string):boolean {
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected||!adminConfigured())return false;
  const a=createHash("sha256").update(p).digest();
  const b=createHash("sha256").update(expected).digest();
  return timingSafeEqual(a,b);
}
function signature(content:string):string {return createHmac("sha256",secret()!).update(content).digest("hex");}
export function sessionToken():string {
  const payload=`${Math.floor(Date.now()/1000)}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}
export async function authorized():Promise<boolean>{
  if(!adminConfigured())return false;
  const token=(await cookies()).get(COOKIE)?.value||"";
  const parts=token.split(".");if(parts.length!==3)return false;
  const [t,nonce,sig]=parts;
  if(!/^\d{10}$/.test(t)||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return false;
  const age=Math.floor(Date.now()/1000)-Number(t);
  if(age<0||age>LIFETIME_SECONDS)return false;
  const expected=Buffer.from(signature(`${t}.${nonce}`),"hex");
  return timingSafeEqual(Buffer.from(sig,"hex"),expected);
}
export function setSession(response:NextResponse,token:string){
  response.cookies.set(COOKIE,token,{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:LIFETIME_SECONDS
  });
}
export function removeSession(response:NextResponse){response.cookies.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});}
// Lightweight per-process protection; use proxy/WAF rate limits on production VPS too.
const hitLog=new Map<string,number[]>();
export function throttled(request:Request,kind:string,max:number,windowMs:number):boolean {
  // IP headers can be spoofed unless an exclusively trusted reverse proxy overwrites them.
  // The Docker deployment binds Next.js to localhost and uses Nginx to set X-Real-IP.
  const ip=process.env.TRUST_PROXY_IP_HEADER==="true"
    ? (request.headers.get("x-real-ip")||"unknown") : "unknown";
  const key=kind+":"+ip;
  const now=Date.now();
  const hits=(hitLog.get(key)||[]).filter(t=>now-t<windowMs);
  if(hitLog.size>20000)hitLog.clear();
  hitLog.set(key,hits);
  if(hits.length>=max)return true;
  hits.push(now);return false;
}
