"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type NominationRow={id:string;reference:string;institution_name:string;institution_type:string;institution_state:string;institution_email:string;submitted_at:string;beneficiary_count:number};
type Person={name:string;desig:string;email:string;wa:string};
type Nomination=NominationRow&{institution_zone:string;focal_person:Person;nominating_officer:Person};
type Beneficiary={position:number;full_name:string;staff_id:string;department:string;designation:string;email:string;whatsapp:string};
type Detail={nomination:Nomination;beneficiaries:Beneficiary[];letter:{original_filename:string;file_size:number;mime_type:string}|null};
export default function AdminPortal(){
  const [authenticated,setAuthenticated]=useState<boolean|null>(null);
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [list,setList]=useState<NominationRow[]>([]);
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [detail,setDetail]=useState<Detail|null>(null);
  const load=useCallback(async(pageNo:number)=>{
    try{
      const response=await fetch(`/api/admin/nominations?page=${pageNo}`,{cache:"no-store"});
      if(response.status===401){setAuthenticated(false);return;}
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"Unable to load nominations");
      setList(json.items);setPage(json.page);setTotal(json.total);setAuthenticated(true);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Unable to connect to the server");setAuthenticated(false);}
  },[]);
  useEffect(()=>{void load(1);},[load]);
  async function logIn(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");
    try{
      const res=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Login failed");
      setPassword("");await load(1);
    }catch(e){setError(e instanceof Error?e.message:"Login failed");}
    finally{setBusy(false);}
  }
  async function logOut(){await fetch("/api/admin/logout",{method:"POST"});setAuthenticated(false);setDetail(null);setList([]);}
  async function openNomination(id:string){
    setBusy(true);setError("");
    try{
      const res=await fetch(`/api/admin/nominations/${id}`,{cache:"no-store"});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to retrieve nomination");
      setDetail(data);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load details");}
    finally{setBusy(false);}
  }
  const date=(v:string)=>new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"});
  return <div className="admin-screen"><header className="admin-header"><div className="wrap admin-header-row"><a href="/" className="logo"><span>GORTON<small>CONSULTS SYSTEMS LTD</small></span></a><span>Nomination Administration</span></div></header>
    <main className="wrap admin-main"><div className="admin-intro"><div><h1>Capacity Building Nominations</h1><p>Private administration area for authorized Gorton staff.</p></div>
      {authenticated&&<button className="btn ghost" onClick={()=>void logOut()}>Sign out</button>}</div>
      {error&&<p className="alert" role="alert">{error}</p>}
      {authenticated===null?<div className="admin-card">Checking your session…</div>:
      !authenticated?<form className="admin-card login" onSubmit={e=>void logIn(e)}><h2>Administrator sign in</h2>
        <p>Access submitted institution nominations and signed letters.</p><label htmlFor="admin-password">Administrator password</label>
        <input autoFocus required minLength={1} id="admin-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
        <button className="btn pri" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>:
      detail?<div className="admin-card"><div className="admin-detail-top"><button className="btn ghost" onClick={()=>setDetail(null)}>← Back to nominations</button>
        <span className="reference">{detail.nomination.reference}</span></div><h2>{detail.nomination.institution_name}</h2>
        <div className="admin-meta"><div><strong>Institution type</strong><span>{detail.nomination.institution_type}</span></div>
          <div><strong>State / zone</strong><span>{detail.nomination.institution_state} / {detail.nomination.institution_zone}</span></div>
          <div><strong>Email</strong><span>{detail.nomination.institution_email}</span></div><div><strong>Submitted</strong><span>{date(detail.nomination.submitted_at)}</span></div></div>
        <div className="admin-people"><section><h3>Focal Person</h3><p>{detail.nomination.focal_person.name} — {detail.nomination.focal_person.desig}</p>
          <p>{detail.nomination.focal_person.email} · {detail.nomination.focal_person.wa}</p></section>
          <section><h3>Nominating Officer</h3><p>{detail.nomination.nominating_officer.name} — {detail.nomination.nominating_officer.desig}</p>
          <p>{detail.nomination.nominating_officer.email} · {detail.nomination.nominating_officer.wa}</p></section></div>
        <h3>Beneficiaries ({detail.beneficiaries.length})</h3><div className="tw"><table><thead><tr><th>#</th><th>Full Name</th><th>Staff Number</th><th>Department</th><th>Designation</th><th>Email</th><th>WhatsApp</th></tr></thead><tbody>
          {detail.beneficiaries.map(b=><tr key={b.position}><td>{b.position}</td><td>{b.full_name}</td><td>{b.staff_id}</td><td>{b.department}</td><td>{b.designation}</td><td>{b.email}</td><td>{b.whatsapp}</td></tr>)}</tbody></table></div>
        <div className="admin-download"><h3>Signed nomination letter</h3>{detail.letter?
          <a className="btn amb linklike" href={`/api/admin/nominations/${detail.nomination.id}/letter`}>Download {detail.letter.original_filename} ({(detail.letter.file_size/1024).toFixed(0)} KB)</a>:<p>No uploaded letter</p>}</div></div>:
      <div className="admin-card"><div className="admin-detail-top"><h2>Submitted nominations ({total})</h2><button className="btn ghost" onClick={()=>void load(page)}>Refresh</button></div>
        {list.length===0?<p>No nominations found.</p>:<div className="tw"><table><thead><tr><th>Reference</th><th>Institution</th><th>State</th><th>Beneficiaries</th><th>Submitted</th><th>Action</th></tr></thead><tbody>
        {list.map(n=><tr key={n.id}><td><strong>{n.reference}</strong></td><td>{n.institution_name}</td><td>{n.institution_state}</td><td>{n.beneficiary_count}</td><td>{date(n.submitted_at)}</td><td><button className="text-button" disabled={busy} onClick={()=>void openNomination(n.id)}>View details</button></td></tr>)}
        </tbody></table></div>}
        <div className="pagination"><button className="btn ghost" onClick={()=>void load(page-1)} disabled={page<=1}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/20))}</span>
          <button className="btn ghost" onClick={()=>void load(page+1)} disabled={page*20>=total}>Next</button></div></div>}
    </main></div>;
}
