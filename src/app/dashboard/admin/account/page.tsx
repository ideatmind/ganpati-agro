import {requireIdentity} from '@/server/session';
import {PasswordChangeForm} from '@/components/PasswordChangeForm';
export const metadata={title:'Account & password'};
export default async function AdminAccountPage(){
 const identity=await requireIdentity(['manager','super_admin']);
 return <><header className="admin-page-heading"><div><span className="admin-kicker">Workspace / My account</span><h1>Account & password</h1><p>{identity.displayName} · {identity.mobile}</p></div></header><PasswordChangeForm expanded/></>;
}
