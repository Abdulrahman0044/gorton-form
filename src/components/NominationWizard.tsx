"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BENEFICIARY_FIELDS, MAX_BENEFICIARIES, MAX_FILE_BYTES, PERSON_FIELDS, STATES, STEPS, TYPES, ZONES } from "@/lib/constants";
import { backupDraftText, clearDraft, clearReceipt, readDraft, readReceipt, saveDraft, saveLetter, saveReceipt } from "@/lib/draft";
import { Draft, emptyBeneficiary, emptyDraft, LocalReceipt } from "@/lib/types";
type FieldType="text"|"email"|"tel";
type FieldErrors=Record<string,string>;
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern=/^\+?[0-9 ()-]{10,18}$/;

function isDraft(value:unknown):value is Draft {
  if(!value||typeof value!=="object")return false;
  const d=value as Partial<Draft>;
  return !!(d.inst&&d.focal&&d.officer&&Array.isArray(d.bene)&&d.bene.length<=MAX_BENEFICIARIES&&typeof d.step==="number");
}
function normalizeStoredDraft(data:Draft):Draft {
  const base=emptyDraft();
  const step=Math.max(0,Math.min(5,Number.isFinite(data.step)?data.step:0));
  return {
    ...base,
    clientSubmissionId:typeof data.clientSubmissionId==="string"&&/^[0-9a-f-]{36}$/i.test(data.clientSubmissionId)?data.clientSubmissionId:crypto.randomUUID(),
    step:data.stepOrderVersion===2?step:step===1?2:step===2?1:step,
    stepOrderVersion:2,
    inst:{...base.inst,...(data.inst||{})},
    focal:{...base.focal,...(data.focal||{})},
    officer:{...base.officer,...(data.officer||{})},
    bene:data.bene.length?data.bene.map(b=>({...emptyBeneficiary(),...b})).slice(0,MAX_BENEFICIARIES):[emptyBeneficiary()],
    confirm:Boolean(data.confirm)
  };
}
function checkStep(d:Draft,step:number,file:File|null):FieldErrors {
  const e:FieldErrors={};
  const required=(path:string,v:string,type:FieldType|"radio"|"select"="text")=>{
    if(!v?.trim())e[path]=type==="radio"||type==="select"?"Please select an option.":"This field is required.";
    else if(type==="email"&&!emailPattern.test(v.trim()))e[path]="Enter a valid email address.";
    else if(type==="tel"&&!phonePattern.test(v.trim()))e[path]="Enter a valid WhatsApp number.";
  };
  if(step===0){required("inst.name",d.inst.name);required("inst.type",d.inst.type,"radio");required("inst.state",d.inst.state,"select");required("inst.email",d.inst.email,"email");required("inst.zone",d.inst.zone,"radio");}
  if(step===1||step===2){const key=step===1?"officer":"focal";const p=d[key];for(const [k,,t] of PERSON_FIELDS)required(`${key}.${k}`,p[k],t);}
  if(step===3){
    if(d.bene.length!==MAX_BENEFICIARIES)e.beneCount=`Add ${MAX_BENEFICIARIES-d.bene.length} more beneficiaries to reach ${MAX_BENEFICIARIES}.`;
    const seen=new Set<string>();
    d.bene.forEach((b,i)=>{
      for(const [k,,t] of BENEFICIARY_FIELDS)required(`bene.${i}.${k}`,b[k],t);
      const id=b.staffId.trim().toLowerCase();
      if(id&&seen.has(id))e[`bene.${i}.staffId`]="This staff number is already listed.";
      seen.add(id);
    });
  }
  if(step===4&&!file)e.file="Please upload the signed and stamped nomination letter.";
  if(step===5&&!d.confirm)e.confirm="Please tick the confirmation box.";
  return e;
}
function downloadCsv(d:Draft,ref:string){
  const rows:(string|number)[][]=[
    ["Nomination reference",ref],["Institution",d.inst.name],["Type",d.inst.type],
    ["State",d.inst.state],["Geo-political zone",d.inst.zone],["Contact email",d.inst.email],[],
    ["Focal person",d.focal.name,d.focal.desig,d.focal.email,d.focal.wa],
    ["Nominating officer",d.officer.name,d.officer.desig,d.officer.email,d.officer.wa],[],
    ["#",...BENEFICIARY_FIELDS.map(f=>f[1])],
    ...d.bene.map((b,i)=>[i+1,...BENEFICIARY_FIELDS.map(f=>b[f[0]])])
  ];
  // Escape leading spreadsheet formula characters in user-provided values.
  const safeCell=(v:string|number)=>{
    const raw=String(v??"");
    const escaped=/^[=+@\-\t\r]/.test(raw)?"'"+raw:raw;
    return '"'+escaped.replace(/"/g,'""')+'"';
  };
  const csv="\uFEFF"+rows.map(row=>row.map(safeCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=`gorton-nomination-${ref}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function NominationWizard(){
  const [draft,setDraft]=useState<Draft>(emptyDraft);
  const [file,setFile]=useState<File|null>(null);
  const [ready,setReady]=useState(false);
  const [receipt,setReceipt]=useState<LocalReceipt|null>(null);
  const [errors,setErrors]=useState<FieldErrors>({});
  const [saveState,setSaveState]=useState<"saving"|"saved"|"unavailable">("saved");
  const [submitting,setSubmitting]=useState(false);
  const [notice,setNotice]=useState("");
  const [online,setOnline]=useState(true);
  const [install,setInstall]=useState<InstallEvent|null>(null);
  const shellRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      const stored=await readDraft();
      if(!mounted)return;
      if(stored&&isDraft(stored.draft)){
        setDraft(normalizeStoredDraft(stored.draft));
        setFile(stored.file);
      }else{
        const last=readReceipt();if(last)setReceipt(last);
        setDraft({...emptyDraft(),clientSubmissionId:crypto.randomUUID()});
      }
      setReady(true);
    })();
    setOnline(navigator.onLine);
    const onlineListener=()=>setOnline(navigator.onLine);
    const installListener=(e:Event)=>{e.preventDefault();setInstall(e as InstallEvent);};
    window.addEventListener("online",onlineListener);
    window.addEventListener("offline",onlineListener);
    window.addEventListener("beforeinstallprompt",installListener);
    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(reg=>{
      // Make first-visit JS/CSS available offline after the worker installs.
      const assets=[...document.querySelectorAll<HTMLScriptElement>("script[src]"),...document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet][href]")]
        .map(el=>(el as HTMLScriptElement).src||(el as HTMLLinkElement).href)
        .filter(url=>url&&url.startsWith(location.origin));
      reg.active?.postMessage({type:"CACHE_ASSETS",assets});
    }).catch(()=>{});
    return()=>{mounted=false;window.removeEventListener("online",onlineListener);window.removeEventListener("offline",onlineListener);window.removeEventListener("beforeinstallprompt",installListener);};
  },[]);

  useEffect(()=>{
    if(!ready||receipt)return;
    const updatedAt=backupDraftText(draft);
    setSaveState("saving");
    const t=window.setTimeout(()=>{
      saveDraft(draft,updatedAt).then(()=>setSaveState("saved")).catch(()=>setSaveState("unavailable"));
    },250);
    return()=>clearTimeout(t);
  },[draft,ready,receipt]);

  const update=useCallback((path:string,value:string)=>{
    const [section,indexOrKey,lastKey]=path.split(".");
    setDraft(d=>{
      if(section==="bene"){
        const bene=d.bene.map((b,i)=>i===Number(indexOrKey)?{...b,[lastKey]:value}:b);
        return {...d,bene};
      }
      if(section==="inst"||section==="focal"||section==="officer")return {...d,[section]:{...d[section],[indexOrKey]:value}};
      return d;
    });
    setErrors(e=>{if(!e[path])return e;const next={...e};delete next[path];return next;});
  },[]);
  const field=(path:string,label:string,type:FieldType,value:string,full=false)=>
    <div className={`f ${full?"full":""} ${errors[path]?"bad":""}`} key={path}>
      <label htmlFor={path}>{label} <em>*</em></label>
      <input id={path} type={type} value={value} onChange={e=>update(path,e.target.value)}
        placeholder={type==="tel"?"+234 801 234 5678":undefined}
        inputMode={type==="tel"?"tel":undefined} autoComplete="off" aria-invalid={!!errors[path]}/>
      {errors[path]&&<span className="err" role="alert">{errors[path]}</span>}
    </div>;
  const choices=(path:string,label:string,items:readonly string[],value:string)=>
    <div className={`f full ${errors[path]?"bad":""}`} key={path}>
      <div className="lbl" id={`${path}-label`}>{label} <em>*</em></div>
      <div className="opts" role="radiogroup" aria-labelledby={`${path}-label`}>
        {items.map(item=><label className="opt" key={item}><input type="radio" name={path} value={item} checked={value===item} onChange={()=>update(path,item)}/><span>{item}</span></label>)}
      </div>
      {errors[path]&&<span className="err" role="alert">{errors[path]}</span>}
    </div>;
  const scrollTop=()=>shellRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
  const go=(step:number)=>{setDraft(d=>({...d,step}));setErrors({});setNotice("");scrollTop();};
  const next=async()=>{
    setNotice("");
    const e=checkStep(draft,draft.step,file);setErrors(e);
    if(Object.keys(e).length){setTimeout(()=>document.querySelector(".bad")?.scrollIntoView({behavior:"smooth",block:"center"}),30);return;}
    if(draft.step===5){
      // Review edits may have invalidated earlier sections; check all sections again.
      for(let i=0;i<5;i++){
        const earlier=checkStep(draft,i,file);
        if(Object.keys(earlier).length){go(i);setErrors(earlier);setNotice(`Please correct ${STEPS[i]} before submitting.`);return;}
      }
    }
    if(draft.step<5){go(draft.step+1);return;}
    if(!online){setNotice("You are offline. Your saved draft is available; reconnect to submit.");return;}
    if(!file){setNotice("The nomination letter is missing. Please return to step 5.");return;}
    setSubmitting(true);
    try{
      // Use the same UUID on retry so a lost response cannot create duplicates.
      const body=new FormData();
      const {step,stepOrderVersion,...rest}=draft;
      body.append("payload",JSON.stringify(rest));body.append("letter",file);body.append("website","");
      const response=await fetch("/api/nominations",{method:"POST",body,cache:"no-store"});
      const result=await response.json();
      if(!response.ok){
        const first=Array.isArray(result.issues)?result.issues[0]:null;
        throw new Error(first?`${first.path}: ${first.message}`:(result.error||"Unable to submit. Please try again."));
      }
      const r:LocalReceipt={reference:result.reference,count:draft.bene.length,submittedAt:result.submittedAt||new Date().toISOString()};
      saveReceipt(r);setReceipt(r);
      await clearDraft().catch(()=>{});
      scrollTop();
    }catch(err){setNotice(err instanceof Error?err.message:"Submission failed. Your draft is retained.");}
    finally{setSubmitting(false);}
  };
  const selectFile=async(f?:File)=>{
    if(!f)return;
    if(f.size===0||f.size>MAX_FILE_BYTES){setErrors(e=>({...e,file:"File size must be between 1 byte and 10 MB."}));return;}
    const name=f.name.toLowerCase();
    if(!/\.(pdf|jpe?g|png|webp)$/.test(name)){setErrors(e=>({...e,file:"Only PDF, JPG, PNG or WebP files are accepted."}));return;}
    try{await saveLetter(f);setFile(f);setErrors(e=>({...e,file:""}));setNotice("");}
    catch{setErrors(e=>({...e,file:"Your browser could not save the letter. Free device storage and retry."}));setSaveState("unavailable");}
  };
  const removeFile=async()=>{try{await saveLetter(null);}catch{}setFile(null);};
  const newNomination=async()=>{
    await clearDraft().catch(()=>{});clearReceipt();
    setFile(null);setReceipt(null);setErrors({});setNotice("");
    setDraft({...emptyDraft(),clientSubmissionId:crypto.randomUUID()});scrollTop();
  };
  const clearUnsubmitted=async()=>{
    if(!window.confirm("Delete this unfinished nomination and its locally saved letter from this device?"))return;
    await newNomination();
  };
  const details=(section:"focal"|"officer")=>
    <><h2>{section==="focal"?"Focal person details":"Details of nominating officer"}</h2>
    <p className="lead">{section==="focal"?"Provide the details of the Director of Academic Planning, who will be the LMS focal person.":"Provide the details of the officer submitting this nomination on behalf of the institution."}</p>
    <div className="grid">{PERSON_FIELDS.map(([key,label,type])=>field(`${section}.${key}`,label,type,draft[section][key]))}</div></>;
  const row=(key:string,label:string,v:unknown)=><><dt key={key+"dt"}>{label}</dt><dd key={key+"dd"}>{String(v??"")||"—"}</dd></>;
  const reviewSection=(label:string,step:number,rows:[string,string][])=>
    <section className="rv" key={label}><h3>{label}<button type="button" onClick={()=>go(step)}>Edit</button></h3>
      <dl>{rows.map(([a,b],i)=>row(label+i,a,b))}</dl></section>;
  const renderStep=()=>{
    switch(draft.step){
      case 0:return <><h2>Institution details</h2><p className="lead">Tell us about the institution making the nomination.</p>
        <div className="grid">{field("inst.name","Name of Institution","text",draft.inst.name,true)}
        {choices("inst.type","Type of Institution",TYPES,draft.inst.type)}
        <div className={`f ${errors["inst.state"]?"bad":""}`}><label htmlFor="inst.state">State <em>*</em></label>
          <select id="inst.state" value={draft.inst.state} onChange={e=>update("inst.state",e.target.value)}>
            <option value="">Select state</option>{STATES.map(s=><option value={s} key={s}>{s}</option>)}</select>
          {errors["inst.state"]&&<span className="err">{errors["inst.state"]}</span>}</div>
        {field("inst.email","Contact Email Address","email",draft.inst.email)}
        {choices("inst.zone","Geo-political Zone",ZONES,draft.inst.zone)}</div></>;
      case 1:return details("officer");
      case 2:return details("focal");
      case 3:return <><h2>Beneficiary details</h2>
        <p className="lead">Enter the information of all {MAX_BENEFICIARIES} nominated staff. Your progress is saved automatically.</p>
        <div className="counter"><div className="bar"><i style={{width:`${100*draft.bene.length/MAX_BENEFICIARIES}%`}}/></div><b>{draft.bene.length} of {MAX_BENEFICIARIES} beneficiaries</b></div>
        {draft.bene.map((b,i)=><section className="bene" key={i}><div className="bhead"><h3>Beneficiary <span>{i+1}</span></h3>
          {draft.bene.length>1&&<button className="rm" type="button" onClick={()=>setDraft(d=>({...d,bene:d.bene.filter((_,j)=>j!==i)}))}>Remove</button>}</div>
          <div className="grid">{BENEFICIARY_FIELDS.map(([k,label,type])=>field(`bene.${i}.${k}`,label,type,b[k]))}</div></section>)}
        <button className="btn add" type="button" disabled={draft.bene.length>=MAX_BENEFICIARIES}
          onClick={()=>setDraft(d=>({...d,bene:[...d.bene,emptyBeneficiary()]}))}>
          {draft.bene.length===MAX_BENEFICIARIES?"All 16 beneficiaries added":`+ Add beneficiary (${MAX_BENEFICIARIES-draft.bene.length} remaining)`}</button>
        {errors.beneCount&&<p className="err show" role="alert">{errors.beneCount}</p>}</>;
      case 4:return <><h2>Letter of nomination</h2><p className="lead">Upload the letter of nomination of the <strong>16 beneficiaries</strong>, duly <strong>signed and stamped by the Head of the Institution</strong>.</p>
        <div className={`f ${errors.file?"bad":""}`}><div className="lbl">Institutional letter of nomination <em>*</em></div>
          <label className="drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void selectFile(e.dataTransfer.files[0]);}}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{void selectFile(e.target.files?.[0]);e.target.value="";}}/>
            <strong>Choose a file or drop it here</strong><small>PDF, JPG, PNG or WebP. Maximum 10 MB.</small></label>
          {file&&<div className="file"><span>{file.name} · {(file.size/1024).toFixed(0)} KB <small>(saved on this device)</small></span><button className="rm" type="button" onClick={()=>void removeFile()}>Remove</button></div>}
          {errors.file&&<span className="err show" role="alert">{errors.file}</span>}</div>
        <p className="note">The letter is stored locally with your draft and sent to the server only when you submit.</p></>;
      default:return <><h2>Review and submission</h2><p className="lead">Check your details before final submission. Select Edit to make corrections.</p>
        {reviewSection("Institution details",0,[["Institution",draft.inst.name],["Type",draft.inst.type],["State",draft.inst.state],["Geo-political zone",draft.inst.zone],["Contact email",draft.inst.email]])}
        {reviewSection("Nominating officer",1,PERSON_FIELDS.map(([k,l])=>[l,draft.officer[k]]))}
        {reviewSection("Focal person (Director of Academic Planning)",2,PERSON_FIELDS.map(([k,l])=>[l,draft.focal[k]]))}
        <section className="rv"><h3>Beneficiaries ({draft.bene.length} of 16)<button type="button" onClick={()=>go(3)}>Edit</button></h3><div className="tw"><table><thead><tr><th>#</th>{BENEFICIARY_FIELDS.map(([,l])=><th key={l}>{l}</th>)}</tr></thead><tbody>
          {draft.bene.map((b,i)=><tr key={i}><td>{i+1}</td>{BENEFICIARY_FIELDS.map(([k])=><td key={k}>{b[k]}</td>)}</tr>)}</tbody></table></div></section>
        {reviewSection("Letter of nomination",4,[["File",file?`${file.name} (${(file.size/1024).toFixed(0)} KB)`:"Not uploaded"]])}
        <div className={`f ${errors.confirm?"bad":""}`}><label className="chk"><input type="checkbox" checked={draft.confirm} onChange={e=>setDraft(d=>({...d,confirm:e.target.checked}))}/>
          <span>I confirm that the 16 individuals listed in this form have been nominated by our institution for the LMS Capacity Building Programme. <em>*</em></span></label>
          {errors.confirm&&<span className="err show" role="alert">{errors.confirm}</span>}</div></>;
    }
  };
  if(!ready)return <div className="shell loading" aria-live="polite">Opening your saved nomination…</div>;
  return <div className="shell" id="shell" ref={shellRef}>
    {receipt?<div className="ok"><div className="tick">✓</div><h2>Nomination submitted</h2>
      <p className="lead">Your nomination of {receipt.count} staff has been recorded successfully. Keep this reference for your records.</p>
      <div className="ref">{receipt.reference}</div><p className="note">Submitted {new Date(receipt.submittedAt).toLocaleString("en-NG")}</p>
      <div className="finish-actions"><button className="btn amb" onClick={()=>downloadCsv(draft,receipt.reference)} disabled={!draft.inst.name}>Download summary (CSV)</button>
      <button className="btn ghost" onClick={()=>void newNomination()}>Start a new nomination</button></div></div>
    :<><ol className="steps" aria-label="Nomination progress">{STEPS.map((name,i)=><li key={name} className={i===draft.step?"on":i<draft.step?"done":""} aria-current={i===draft.step?"step":undefined}><b>{i<draft.step?"✓":i+1}</b>{name}</li>)}</ol>
      <div className="draft-status" aria-live="polite"><span className={online?"online":"offline"}>{online?"● Online":"● Offline — draft editing available"}</span>
      <span>{saveState==="saved"?"✓ Draft saved on this device":saveState==="saving"?"Saving draft…":"⚠ Device storage unavailable; do not close this page"}</span>
      <div className="status-actions">{install&&<button className="link-btn" onClick={async()=>{await install.prompt();setInstall(null);}}>Install app</button>}
      <button className="link-btn danger" onClick={()=>void clearUnsubmitted()}>Clear saved draft</button></div></div>
      <div className="body">{renderStep()}{notice&&<p className="alert" role="alert">{notice}</p>}
        <p className="privacy-note">Your unfinished nomination stays in this browser on this device. Use the same browser to continue later. On a phone, you can install the app using your browser’s “Add to Home Screen” option. Avoid shared devices for confidential staff data.</p></div>
      <div className="foot"><button className="btn ghost" disabled={draft.step===0||submitting} onClick={()=>go(draft.step-1)}>Back</button>
        <button className={`btn ${draft.step===5?"pri":"amb"}`} disabled={submitting} onClick={()=>void next()}>
          {submitting?"Submitting…":draft.step===5?"Submit nomination":"Next"}</button></div></>}
  </div>;
}
