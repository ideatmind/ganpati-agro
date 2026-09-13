import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { z } from "zod";
import { FarmerProfileForm } from "@/components/FarmerProfileForm";
import { callRpc } from "@/server/database";
import { getIdentity } from "@/server/session";

interface FarmerDetail { id:string;name:string;mobileMasked:string;dateOfBirth:string;village:string;district:string;taluka:string;incomeSource:string;clusterType:string;membershipNumber:string;editableFields:string[];plots:{plotNo:string;areaAcres:number;cropName:string;irrigationSource:string}[] }

export default async function FarmerPage({params}:{params:Promise<{id:string}>}){const identity=await getIdentity();if(!identity)redirect("/login");if(!identity.roles.some((r)=>["employee","manager","super_admin"].includes(r)))redirect("/dashboard");const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();let farmer:FarmerDetail|null=null;try{farmer=await callRpc("get_farmer_detail",{p_actor_id:identity.id,p_farmer_id:id});}catch{notFound();}if(!farmer)notFound();return <main className="dashboard-shell"><div className="page-back"><Link href="/dashboard">← Dashboard</Link></div><header className="dashboard-header"><div><span className="eyebrow">Farmer record</span><h1>{farmer.name}</h1><p>Membership {farmer.membershipNumber}</p></div></header><FarmerProfileForm farmer={farmer}/><section className="panel"><div className="panel-head"><h2>Plots</h2><span>Read only in this release</span></div><div className="table-wrap"><table><thead><tr><th>Survey</th><th>Acres</th><th>Crop</th><th>Irrigation</th></tr></thead><tbody>{farmer.plots.map((plot)=><tr key={plot.plotNo}><td>{plot.plotNo}</td><td>{plot.areaAcres}</td><td>{plot.cropName}</td><td>{plot.irrigationSource}</td></tr>)}</tbody></table></div></section></main>}
