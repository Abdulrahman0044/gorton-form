import { getPool } from "@/lib/db";
import { csvResponse } from "@/lib/csv";
import { authorized, json } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  if(!await authorized())return json({error:"Unauthorized"},401);
  try{
    const result=await getPool().query<{
      reference:string;institution_name:string;institution_type:string;
      institution_state:string;institution_zone:string;submitted_at:Date;
      position:number;full_name:string;staff_id:string;department:string;
      designation:string;email:string;whatsapp:string;
    }>(`
      SELECT n.reference,n.institution_name,n.institution_type,n.institution_state,
        n.institution_zone,n.submitted_at,b.position,b.full_name,b.staff_id,
        b.department,b.designation,b.email,b.whatsapp
      FROM nominations n
      JOIN beneficiaries b ON b.nomination_id=n.id
      ORDER BY n.submitted_at DESC,n.reference,b.position
    `);
    const headers=["Reference","Institution","Institution Type","State","Zone","Submitted At",
      "Position","Full Name","Staff ID","Department","Designation","Email","WhatsApp"];
    const rows=result.rows.map(row=>[
      row.reference,row.institution_name,row.institution_type,row.institution_state,
      row.institution_zone,row.submitted_at.toISOString(),String(row.position),row.full_name,
      row.staff_id,row.department,row.designation,row.email,row.whatsapp
    ]);
    return csvResponse([headers,...rows],`beneficiaries-all-${new Date().toISOString().slice(0,10)}.csv`);
  }catch(error){
    console.error("Admin beneficiary export failed",error);
    return json({error:"Unable to export beneficiaries"},500);
  }
}
