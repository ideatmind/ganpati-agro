"use client";

import { useState, type FormEvent } from "react";
import { DISTRICTS, TALUKAS, INCOME_OPTIONS, CLUSTER_OPTIONS } from "@/shared/constants";

interface FarmerDetail { id:string;name:string;mobileMasked:string;dateOfBirth:string;village:string;district:string;taluka:string;incomeSource:string;clusterType:string;membershipNumber:string;editableFields:string[];plots:{plotNo:string;areaAcres:number;cropName:string;irrigationSource:string}[] }

export function FarmerProfileForm({ farmer }:{ farmer:FarmerDetail }) {
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [district,setDistrict]=useState(farmer.district);const editable=new Set(farmer.editableFields);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");const form=new FormData(event.currentTarget);const changes=Object.fromEntries([...form.entries()].filter(([key])=>editable.has(key)));const response=await fetch(`/api/farmers/${farmer.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(changes)});const result=await response.json() as {error?:string};setBusy(false);setMessage(response.ok?"Farmer profile saved":result.error||"Update failed");}
  return <form className="panel operation-form" onSubmit={submit}><div className="panel-head"><h2>Farmer profile</h2><span>{farmer.editableFields.length?`${farmer.editableFields.length} editable fields`:"Read only"}</span></div><div className="field-grid">
    <label>Name<input name="name" defaultValue={farmer.name} disabled={!editable.has("name")} /></label><label>Mobile<input value={farmer.mobileMasked} disabled /></label>
    <label>Date of birth<input name="date_of_birth" type="date" defaultValue={farmer.dateOfBirth} disabled={!editable.has("date_of_birth")} /></label><label>Membership<input value={farmer.membershipNumber} disabled /></label>
    <label>Village<input name="village" defaultValue={farmer.village} disabled={!editable.has("village")} /></label><label>District<select name="district" value={district} onChange={(e)=>setDistrict(e.target.value)} disabled={!editable.has("district")} >{DISTRICTS.map((d)=><option value={d.value} key={d.value}>{d.en}</option>)}</select></label>
    <label>Taluka<select name="taluka" defaultValue={farmer.taluka} disabled={!editable.has("taluka")} >{TALUKAS.filter((t)=>t[1]===district).map((t)=><option value={t[0]} key={t[0]}>{t[2]}</option>)}</select></label>
    <label>Income source<select name="income_source" defaultValue={farmer.incomeSource} disabled={!editable.has("income_source")} >{INCOME_OPTIONS.map((v)=><option key={v}>{v}</option>)}</select></label>
    <label>Cluster type<select name="cluster_type" defaultValue={farmer.clusterType} disabled={!editable.has("cluster_type")} >{CLUSTER_OPTIONS.map((v)=><option key={v}>{v}</option>)}</select></label>
  </div>{message&&<p className="status-message" role="status">{message}</p>}{farmer.editableFields.length>0&&<button className="button" disabled={busy}>{busy?"Saving…":"Save authorized fields"}</button>}</form>;
}
