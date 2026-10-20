import { NextResponse } from "next/server";
import { checkOrigin, removeSession, noStore } from "@/lib/server";
export const runtime="nodejs";
export async function POST(request:Request){
  if(!checkOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
  const response=NextResponse.json({ok:true},{headers:noStore});removeSession(response);return response;
}
