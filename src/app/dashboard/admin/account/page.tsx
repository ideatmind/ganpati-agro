import {AdminPageHeading} from '@/components/AdminPageHeading';
import {requireIdentity} from '@/server/session';
import {PasswordChangeForm} from '@/components/PasswordChangeForm';
export const metadata={title:'Account & password'};
export default async function AdminAccountPage(){
 const identity=await requireIdentity(['manager','super_admin']);
 return <><AdminPageHeading title="Account & password" description={`${identity.displayName} · ${identity.mobile}`} context="Workspace / My account"/><PasswordChangeForm expanded/></>;
}
