import {AppError} from "@/shared/errors";
import Link from "next/link";
import {adminReturnPath} from "@/features/admin/return-path";
import { notFound,redirect } from "next/navigation";
import { z } from "zod";
import { FarmerProfileForm } from "@/components/FarmerProfileForm";
import { callRpc } from "@/server/database";
import { getIdentity } from "@/server/session";

interface FarmerDetail { id:string;name:string;mobileMasked:string;dateOfBirth:string;village:string;district:string;taluka:string;incomeSource:string;clusterType:string;membershipNumber:string;editableFields:string[];plots:{plotNo:string;areaAcres:number;cropName:string;irrigationSource:string}[] }

export default async function FarmerPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){const identity=await getIdentity();if(!identity)redirect("/login");if(!identity.roles.some((r)=>["employee","manager","super_admin"].includes(r)))redirect("/dashboard");const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();let farmer:FarmerDetail|null=null;try{farmer=await callRpc("get_farmer_detail",{p_actor_id:identity.id,p_farmer_id:id});}catch(error){if(error instanceof AppError&&[403,404].includes(error.status))notFound();throw error;}if(!farmer)notFound();const isOps=identity.roles.some(role=>["manager","super_admin"].includes(role));const back=isOps?adminReturnPath((await searchParams).returnTo,"registrations",identity.roles.includes("super_admin")):"/dashboard#my-farmers";return <main className="dashboard-shell"><div className="page-back"><Link href={back}>← {isOps?"Back to registrations":"Back to my farmers"}</Link></div><header className="dashboard-header"><div><span className="eyebrow">Farmer record</span><h1>{farmer.name}</h1><p>Membership {farmer.membershipNumber}</p></div></header><FarmerProfileForm farmer={farmer} returnTo={back}/><section className="panel"><div className="panel-head"><h2>Plots</h2><span>Read only in this release</span></div><div className="table-wrap"><table><thead><tr><th>Survey</th><th>Acres</th><th>Crop</th><th>Irrigation</th></tr></thead><tbody>{farmer.plots.map((plot)=><tr key={plot.plotNo}><td>{plot.plotNo}</td><td>{plot.areaAcres}</td><td>{plot.cropName}</td><td>{plot.irrigationSource}</td></tr>)}</tbody></table></div></section></main>}
