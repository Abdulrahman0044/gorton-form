import { getPool } from "@/lib/db";
import { json } from "@/lib/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{await getPool().query("SELECT 1");return json({status:"ok",database:"connected"});}
  catch{return json({status:"unavailable"},503);}
}
