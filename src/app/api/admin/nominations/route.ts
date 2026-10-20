import { getPool } from "@/lib/db";
import { authorized, json } from "@/lib/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!await authorized())return json({error:"Unauthorized"},401);
  const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get("page"))||1));
  try{
    const pool=getPool();
    const list=await pool.query(`SELECT n.id,n.reference,n.institution_name,n.institution_type,
      n.institution_state,n.institution_email,n.submitted_at,
      (SELECT count(*)::int FROM beneficiaries b WHERE b.nomination_id=n.id) AS beneficiary_count
      FROM nominations n ORDER BY n.submitted_at DESC LIMIT 20 OFFSET $1`,[(page-1)*20]);
    const count=await pool.query<{count:string}>("SELECT count(*)::text AS count FROM nominations");
    return json({items:list.rows,page,total:Number(count.rows[0].count)});
  }catch(e){console.error("Admin nominations list failed",e);return json({error:"Unable to retrieve submissions"},500);}
}
