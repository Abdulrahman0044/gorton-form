import { getPool } from "@/lib/db";
import { authorized, json } from "@/lib/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return json({error:"Unauthorized"},401);
  const {id}=await params;
  if(!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(id))return json({error:"Invalid nomination ID"},400);
  try{
    const pool=getPool();
    const n=await pool.query(`SELECT id,reference,institution_name,institution_type,institution_state,
      institution_zone,institution_email,focal_person,nominating_officer,submitted_at
      FROM nominations WHERE id=$1`,[id]);
    if(!n.rows.length)return json({error:"Nomination not found"},404);
    const b=await pool.query(`SELECT position,full_name,staff_id,department,designation,email,whatsapp
      FROM beneficiaries WHERE nomination_id=$1 ORDER BY position`,[id]);
    const f=await pool.query(`SELECT original_filename,mime_type,file_size FROM nomination_letters WHERE nomination_id=$1`,[id]);
    return json({nomination:n.rows[0],beneficiaries:b.rows,letter:f.rows[0]||null});
  }catch(e){console.error("Admin nomination detail failed",e);return json({error:"Unable to retrieve nomination"},500);}
}
