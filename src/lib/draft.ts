import type { Draft, LocalReceipt } from "./types";
const DB_NAME = "gorton-capacity-building-local";
const TEXT_KEY = "gorton-nomination-draft-v2";
const RECEIPT_KEY = "gorton-nomination-last-receipt-v2";
let pending: Promise<void> = Promise.resolve();
function queue(operation:()=>Promise<void>):Promise<void> {
  pending = pending.catch(()=>undefined).then(operation);
  return pending;
}
function openDB():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined") {reject(new Error("Browser storage is unavailable"));return;}
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("drafts"))req.result.createObjectStore("drafts");
      if(!req.result.objectStoreNames.contains("files"))req.result.createObjectStore("files");};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("Could not open local storage"));
  });
}
async function idbGet():Promise<{draft:Draft|undefined, updatedAt:number, file:Blob|null, fileName?:string, fileType?:string}|undefined> {
  const db=await openDB();
  try {return await new Promise((resolve,reject)=>{
    const tx=db.transaction(["drafts","files"],"readonly");
    const dq=tx.objectStore("drafts").get("current");
    const fq=tx.objectStore("files").get("letter");
    tx.oncomplete=()=>resolve({draft:dq.result?.draft??dq.result,updatedAt:dq.result?.updatedAt??0,file:fq.result?.file||null,fileName:fq.result?.fileName,fileType:fq.result?.fileType});
    tx.onerror=()=>reject(tx.error);
  });} finally{db.close();}
}
export async function readDraft():Promise<{draft:Draft,file:File|null}|null> {
  let stored: Awaited<ReturnType<typeof idbGet>>;
  try {stored=await idbGet();} catch {stored=undefined;}
  let local:{draft:Draft,updatedAt:number}|null=null;
  try {
    const raw=localStorage.getItem(TEXT_KEY);
    if(raw){const data=JSON.parse(raw);local=data.draft?data:{draft:data,updatedAt:0};}
  }catch{}
  const latest=local&&(!stored?.draft||local.updatedAt>stored.updatedAt)?local.draft:stored?.draft;
  if(!latest)return null;
  const f=stored?.file ? new File([stored.file],stored.fileName||"nomination-letter",{type:stored.fileType||stored.file.type}) : null;
  return {draft:latest,file:f};
}
export function backupDraftText(draft:Draft):number {
  const updatedAt=Date.now();
  try{localStorage.setItem(TEXT_KEY,JSON.stringify({draft,updatedAt}));}catch{}
  return updatedAt;
}
export function saveDraft(draft:Draft,updatedAt:number):Promise<void> {
  return queue(async()=>{
    const db=await openDB();
    try {await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction("drafts","readwrite");
      tx.objectStore("drafts").put({draft,updatedAt},"current");
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });} finally{db.close();}
  });
}
export function saveLetter(file:File|null):Promise<void> {
  return queue(async()=>{
    const db=await openDB();
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction("files","readwrite");
      if(file)tx.objectStore("files").put({file,fileName:file.name,fileType:file.type},"letter");
      else tx.objectStore("files").delete("letter");
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  });
}
export function clearDraft():Promise<void> {
  try{localStorage.removeItem(TEXT_KEY);}catch{}
  return queue(async()=>{
    const db=await openDB();
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(["drafts","files"],"readwrite");
      tx.objectStore("drafts").delete("current");tx.objectStore("files").delete("letter");
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  });
}
export function saveReceipt(receipt:LocalReceipt){try{localStorage.setItem(RECEIPT_KEY,JSON.stringify(receipt));}catch{}}
export function readReceipt():LocalReceipt|null {try{const s=localStorage.getItem(RECEIPT_KEY);return s?JSON.parse(s):null;}catch{return null;}}
export function clearReceipt(){try{localStorage.removeItem(RECEIPT_KEY);}catch{}}
