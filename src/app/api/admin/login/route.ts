import { NextResponse } from "next/server";
import { adminConfigured, checkOrigin, json, matchAdminPassword, setSession, sessionToken, throttled, noStore } from "@/lib/server";
export const runtime="nodejs";
export async function POST(request:Request){
  if(!checkOrigin(request))return json({error:"Invalid origin"},403);
  if(!adminConfigured())return json({error:"Admin access has not been configured"},503);
  if(throttled(request,"admin-login",8,15*60*1000))return json({error:"Too many login attempts. Retry later."},429);
  let input:unknown;
  try{input=await request.json();}catch{return json({error:"Invalid request"},400);}
  const pass=typeof input==="object"&&input!==null&&"password" in input?(input as {password:unknown}).password:null;
  if(typeof pass!=="string"||pass.length>200||!matchAdminPassword(pass))return json({error:"Incorrect password"},401);
  const response=NextResponse.json({ok:true},{headers:noStore});
  setSession(response,sessionToken());return response;
}
