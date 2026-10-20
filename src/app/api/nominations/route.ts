import { randomBytes, randomUUID } from "node:crypto";
import { scanUpload } from "@/lib/antivirus";
import { getPool } from "@/lib/db";
import { getStorageClient, NOMINATION_BUCKET } from "@/lib/storage";
import { checkOrigin, json, throttled } from "@/lib/server";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { submissionSchema } from "@/lib/validation";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const MAX_REQUEST_BYTES=12*1024*1024;
/** Bound request size even when Content-Length is absent or falsified. */
async function readBoundedForm(request:Request):Promise<FormData> {
  if (!request.body) throw new Error("Missing request body");
  const reader=request.body.getReader();
  const chunks:Buffer[]=[];
  let total=0;
  while (true) {
    const {done,value}=await reader.read();
    if (done) break;
    total+=value.byteLength;
    if (total>MAX_REQUEST_BYTES) {
      await reader.cancel().catch(()=>{});
      throw new RangeError("Request exceeds the upload limit");
    }
    chunks.push(Buffer.from(value));
  }
  const headers=new Headers({"Content-Type":request.headers.get("content-type")||""});
  return new Request("http://localhost/upload",{method:"POST",headers,body:Buffer.concat(chunks,total)}).formData();
}
function detectType(b:Buffer):string|null {
  if(b.length>=5&&b.subarray(0,5).toString("ascii")==="%PDF-")return "application/pdf";
  if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";
  if(b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP")return "image/webp";
  return null;
}
export async function POST(request:Request){
  if(!checkOrigin(request))return json({error:"Untrusted form origin"},403);
  if(throttled(request,"submit",12,60*60*1000))return json({error:"Too many submissions. Try again later."},429);
  const size=Number(request.headers.get("content-length")||0);
  if(size>MAX_REQUEST_BYTES)return json({error:"Request exceeds the upload limit"},413);
  if(!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data"))return json({error:"Expected multipart form submission"},415);
  let form:FormData;
  try{form=await readBoundedForm(request);}catch(e){return e instanceof RangeError?json({error:"Request exceeds the upload limit"},413):json({error:"Unable to read form submission"},400);}
  const hidden=form.get("website");
  if(typeof hidden==="string"&&hidden.trim())return json({error:"Unable to process submission"},400);
  const payload=form.get("payload");
  if(typeof payload!=="string"||payload.length>100_000)return json({error:"Missing or invalid form details"},400);
  let parsed:unknown;
  try{parsed=JSON.parse(payload);}catch{return json({error:"Invalid form data"},400);}
  const result=submissionSchema.safeParse(parsed);
  if(!result.success)return json({error:"Please correct the nomination details",issues:result.error.issues.map(x=>({path:x.path.join("."),message:x.message}))},422);
  const file=form.get("letter");
  if(!(file instanceof File)||file.size===0||file.size>MAX_FILE_BYTES)return json({error:"Upload one nomination letter (maximum 10 MB)"},422);
  const bytes=Buffer.from(await file.arrayBuffer());
  const type=detectType(bytes);
  if(!type)return json({error:"Only valid PDF, JPG, PNG or WebP files are accepted"},422);
  const validExtension:Record<string,RegExp>={
    "application/pdf":/\.pdf$/i,"image/png":/\.png$/i,
    "image/jpeg":/\.jpe?g$/i,"image/webp":/\.webp$/i
  };
  if(!validExtension[type].test(file.name))return json({error:"File extension does not match the file content"},422);
  // File signatures and extensions are not antivirus scanning.
  // In production the included Docker deployment requires a successful clamd scan.
  try { await scanUpload(bytes); }
  catch (e) {
    console.error("Nomination upload scan rejected:", e instanceof Error ? e.message : "scanner failure");
    return json({error: e instanceof Error && e.message.includes("Malware detected")
      ? "The uploaded letter failed the antivirus check. Use a different, clean file."
      : "The antivirus scanner is unavailable or rejected this file. Please retry later."},422);
  }
  const filename=(file.name||"nomination-letter").split(/[\\/]/).pop()!.replace(/[\r\n\x00-\x1f]/g,"").slice(0,255)||"nomination-letter";
  const data=result.data;
  const reference=`GCS-${randomBytes(6).toString("hex").toUpperCase()}`;
  let client;
  let uploadedPath:string|null=null;
  let commitAttempted=false;
  try {
    // A resubmitted draft should return its original reference without duplicating a letter.
    const previous=await getPool().query<{reference:string}>(
      "SELECT reference FROM nominations WHERE client_submission_id=$1",[data.clientSubmissionId]);
    if(previous.rows.length)return json({reference:previous.rows[0].reference,alreadySubmitted:true});

    // Only use random server-generated object keys, never the original filename or email.
    // PRIVATE bucket: uploads and downloads use a server-only Supabase secret key.
    const extension:Record<string,string>={"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
    uploadedPath=`${randomUUID()}/${randomUUID()}.${extension[type]}`;
    const storage=getStorageClient().storage.from(NOMINATION_BUCKET);
    const uploaded=await storage.upload(uploadedPath,bytes,{
      contentType:type,cacheControl:"0",upsert:false
    });
    if(uploaded.error) {
      console.error("Supabase private upload failed",uploaded.error.message);
      return json({error:"Unable to save the letter to private storage. Your draft is still on this device."},503);
    }

    client=await getPool().connect();
    await client.query("BEGIN");
    const inserted=await client.query<{id:string,reference:string}>(`
      INSERT INTO nominations
        (client_submission_id,reference,institution_name,institution_type,institution_state,
         institution_zone,institution_email,focal_person,nominating_officer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
      ON CONFLICT (client_submission_id) DO NOTHING RETURNING id,reference`,[
        data.clientSubmissionId,reference,data.inst.name,data.inst.type,data.inst.state,
        data.inst.zone,data.inst.email,JSON.stringify(data.focal),JSON.stringify(data.officer)
      ]);
    if(!inserted.rows.length){
      const existing=await client.query<{reference:string}>("SELECT reference FROM nominations WHERE client_submission_id=$1",[data.clientSubmissionId]);
      await client.query("ROLLBACK");
      // The other request already won; delete the unused object from this request.
      const discarded=await storage.remove([uploadedPath]);
      if(discarded.error) console.error("Unused duplicate letter cleanup failed",discarded.error.message);
      uploadedPath=null;
      return json({reference:existing.rows[0]?.reference,alreadySubmitted:true});
    }
    const nominationId=inserted.rows[0].id;
    for(const [i,b] of data.bene.entries()){
      await client.query(`INSERT INTO beneficiaries
        (nomination_id,position,full_name,staff_id,department,designation,email,whatsapp)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[
          nominationId,i+1,b.name,b.staffId,b.dept,b.desig,b.email,b.wa
        ]);
    }
    await client.query(`INSERT INTO nomination_letters
      (nomination_id,original_filename,mime_type,file_size,storage_path)
      VALUES ($1,$2,$3,$4,$5)`,[nominationId,filename,type,bytes.length,uploadedPath]);
    // An uncertain COMMIT result cannot safely trigger deletion of the object.
    commitAttempted=true;
    await client.query("COMMIT");
    uploadedPath=null;
    return json({reference,submittedAt:new Date().toISOString()},201);
  }catch(e){
    if(client)try{await client.query("ROLLBACK");}catch{}
    console.error("Nomination submission failed:",e);
    if(uploadedPath && !commitAttempted){
      try{
        const result=await getStorageClient().storage.from(NOMINATION_BUCKET).remove([uploadedPath]);
        if(result.error)console.error("Orphan letter cleanup failed",result.error.message);
      }catch(cleanupError){console.error("Orphan letter cleanup failed",cleanupError);}
    }
    return json({error:"Unable to store the nomination right now. Your local draft is still saved; please retry."},500);
  }finally{client?.release();}
}
