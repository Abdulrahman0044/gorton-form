import { getPool } from "@/lib/db";
import { getStorageClient, NOMINATION_BUCKET } from "@/lib/storage";
import { authorized, json } from "@/lib/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return json({error:"Unauthorized"},401);
  const {id}=await params;
  if(!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(id))return json({error:"Invalid nomination ID"},400);
  try{
    const res=await getPool().query<{original_filename:string,mime_type:string,file_size:number,storage_path:string}>(
      "SELECT original_filename,mime_type,file_size,storage_path FROM nomination_letters WHERE nomination_id=$1",[id]);
    if(!res.rows.length)return json({error:"File not found"},404);
    const f=res.rows[0];
    const safe=f.original_filename.replace(/[\r\n"\\]/g,"_");
    // The bucket is private. This download is performed only after admin authorization.
    const {data:file,error}=await getStorageClient().storage.from(NOMINATION_BUCKET).download(f.storage_path);
    if(error||!file)throw new Error("Private Storage download failed");
    const body=await file.arrayBuffer();
    if(body.byteLength!==f.file_size)throw new Error("Stored file size mismatch");
    return new Response(body,{headers:{
      "Content-Type":f.mime_type,
      "Content-Disposition":`attachment; filename="${safe}"`,
      "Content-Length":String(f.file_size),
      "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"
    }});
  }catch(e){console.error("Admin nomination download failed",e);return json({error:"Unable to download file"},500);}
}
