import {registrationReturnPath} from '@/features/registration/membership';
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getIdentity } from "@/server/session";

export const metadata = { title: "Login" };

export default async function LoginPage({searchParams}:{searchParams:Promise<{passwordChanged?:string;next?:string}>}) {
  const query=await searchParams;
  const next=registrationReturnPath(query.next);
  if (await getIdentity()) redirect(next);
  const changed=query.passwordChanged==='1';
  return <><SiteHeader /><main className="auth-page"><div className="auth-content">{changed&&<p className="auth-notice" role="status">Password changed successfully. Sign in with your new password.</p>}<LoginForm next={next}/></div></main></>;
}
