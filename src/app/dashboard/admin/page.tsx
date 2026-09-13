import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/AdminConsole";
import { callRpc } from "@/server/database";
import { getIdentity } from "@/server/session";

interface ConsoleData { employees:Parameters<typeof AdminConsole>[0]["employees"];referrers:Parameters<typeof AdminConsole>[0]["referrers"];farmers:Parameters<typeof AdminConsole>[0]["farmers"] }

export const metadata={title:"Admin operations"};
export default async function AdminPage(){const identity=await getIdentity();if(!identity)redirect("/login");if(!identity.roles.some((r)=>r==="manager"||r==="super_admin"))redirect("/dashboard");const data=await callRpc<ConsoleData>("get_operations_console",{p_actor_id:identity.id});return <main className="dashboard-shell"><div className="page-back"><Link href="/dashboard">← Dashboard</Link></div><header className="dashboard-header"><div><span className="eyebrow">Operations</span><h1>Admin console</h1><p>Staff, payouts and time-limited farmer edit permissions.</p></div></header><AdminConsole {...data} canCreateStaff={identity.roles.includes("super_admin")} /></main>}
