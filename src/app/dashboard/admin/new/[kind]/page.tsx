import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireIdentity} from '@/server/session';
import {AdminConsole} from '@/components/AdminConsole';
export default async function AdminNewPage({params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;if(kind!=='staff'&&kind!=='payout'&&kind!=='grant')notFound();
 await requireIdentity(kind==='staff'?['super_admin']:['super_admin','manager']);
 const task={staff:{title:'Add team member',section:'staff',description:'Create a staff account with the right level of access.'},payout:{title:'Record offline payout',section:'payouts',description:'Save a completed disbursement against a referrer’s balance.'},grant:{title:'Grant temporary edit access',section:'grants',description:'Give an employee specific, time-limited access to a farmer.'}}[kind];
 return <><Link className="admin-back" href={'/dashboard/admin?section='+task.section}>← Back to {task.section==='grants'?'edit permissions':task.section}</Link><header className="admin-page-heading"><div><span className="admin-kicker">Workspace / New record</span><h1>{task.title}</h1><p>{task.description}</p></div></header><AdminConsole kind={kind}/></>;
}
