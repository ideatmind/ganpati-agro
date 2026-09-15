import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {AdminPageHeading} from '@/components/AdminPageHeading';
import {requireIdentity} from '@/server/session';
import {AdminConsole} from '@/components/AdminConsole';
export default async function AdminNewPage({params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;if(kind!=='staff'&&kind!=='payout'&&kind!=='grant')notFound();
 const actor=await requireIdentity(['super_admin','manager']);
 if(kind==='staff'&&!actor.roles.includes('super_admin'))redirect('/dashboard/admin?section=staff');
 const task={staff:{title:'Add team member',section:'staff',description:'Create a staff account with the right level of access.'},payout:{title:'Record offline payout',section:'payouts',description:'Save a completed disbursement against a referrer’s balance.'},grant:{title:'Grant temporary edit access',section:'grants',description:'Give an employee specific, time-limited access to a farmer.'}}[kind];
 return <><Link className="admin-back" href={'/dashboard/admin?section='+task.section}>← Back to {task.section==='grants'?'edit permissions':task.section}</Link><AdminPageHeading title={task.title} description={task.description} context="Workspace / New record"/><AdminConsole kind={kind} accountId={actor.id}/></>;
}
