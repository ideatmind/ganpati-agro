"use client";

import Link from "next/link";
import {PersonNameInput} from "./PersonNameInput";
import { useRef,useState, type FormEvent } from "react";
import { DISTRICTS, TALUKAS, INCOME_OPTIONS } from "@/shared/constants";
import { CROP_CATEGORIES } from "@/shared/crop-catalog";
import {VillageSearch} from './VillageSearch';
import { requestJson } from "@/shared/request";

interface FarmerDetail { id:string;name:string;mobileMasked:string;dateOfBirth:string;village:string;district:string;taluka:string;incomeSource:string;clusterType:string;membershipNumber:string;editableFields:string[];plots:{plotNo:string;areaAcres:number;cropName:string;irrigationSource:string}[] }

export function FarmerProfileForm({ farmer,returnTo="/dashboard" }:{ farmer:FarmerDetail;returnTo?:string }) {
  const running=useRef(false);const [failed,setFailed]=useState(false);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [district,setDistrict]=useState(farmer.district);const [taluka,setTaluka]=useState(farmer.taluka);const [village,setVillage]=useState(farmer.village);const editable=new Set(farmer.editableFields);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(running.current)return;running.current=true;setBusy(true);setMessage("");setFailed(false);const form=new FormData(event.currentTarget);const changes=Object.fromEntries([...form.entries()].filter(([key])=>editable.has(key)));try{await requestJson(`/api/farmers/${farmer.id}`,changes,"PATCH");setMessage("Farmer profile saved");}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:"We could not update the farmer profile. Your entries are retained; please try again.");}finally{running.current=false;setBusy(false);}}
  return <form className="panel operation-form" onSubmit={submit}><div className="panel-head"><h2>Farmer profile</h2><span>{farmer.editableFields.length?`${farmer.editableFields.length} editable fields`:"Read only"}</span></div>{!farmer.editableFields.length&&<p>This profile is read only. Ask a manager for temporary access if a correction is needed.</p>}<div className="field-grid">
    <label>Name<PersonNameInput name="name" required defaultValue={farmer.name} disabled={!editable.has("name")} /></label><label>Mobile<input value={farmer.mobileMasked} disabled /></label>
    <label>Date of birth<input name="date_of_birth" type="date" required max={new Date().toISOString().slice(0,10)} defaultValue={farmer.dateOfBirth} disabled={!editable.has("date_of_birth")} /></label><label>Membership<input value={farmer.membershipNumber} disabled /></label>
    <label>District<select name="district" value={district} onChange={(e)=>{setDistrict(e.target.value);setTaluka("");if(editable.has("village"))setVillage("");}} disabled={!editable.has("district")} >{DISTRICTS.map((d)=><option value={d.value} key={d.value}>{d.mr} / {d.en}</option>)}</select></label>
    <label>Taluka<select name="taluka" required value={taluka} onChange={e=>{setTaluka(e.target.value);if(editable.has("village"))setVillage("");}} disabled={!editable.has("taluka")} ><option value="">Select taluka / तालुका निवडा</option>{TALUKAS.filter((t)=>t[1]===district).map((t)=><option value={t[0]} key={t[0]}>{t[3]} / {t[2]}</option>)}</select></label>
    <VillageSearch key={taluka} id="profile-village" taluka={taluka} value={village} onChange={setVillage} disabled={!editable.has("village")} required={editable.has("village")}/>
    <label>Income source<select name="income_source" defaultValue={farmer.incomeSource} disabled={!editable.has("income_source")} >{INCOME_OPTIONS.map((v)=><option key={v}>{v}</option>)}</select></label>
    <label>Cluster type<select name="cluster_type" defaultValue={farmer.clusterType} disabled={!editable.has("cluster_type")} >{CROP_CATEGORIES.map((category)=><option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
  </div>{message&&<p className={failed?"form-error":"status-message"} role={failed?"alert":"status"}>{message}</p>}{farmer.editableFields.length>0&&<div className="profile-form-actions"><Link className="button button-outline" href={returnTo}>Cancel</Link><button className="button" disabled={busy}>{busy?"Saving…":"Save changes"}</button></div>}</form>;
}
