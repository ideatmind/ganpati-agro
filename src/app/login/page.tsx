import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getIdentity } from "@/server/session";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  if (await getIdentity()) redirect("/dashboard");
  return <><SiteHeader /><main className="auth-page"><LoginForm /></main></>;
}
