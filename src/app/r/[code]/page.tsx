import {notFound,redirect} from 'next/navigation';
export default async function ReferralPage({params}:{params:Promise<{code:string}>}){
 const code=(await params).code.toUpperCase();
 if(!/^[A-Z0-9]{6,16}$/.test(code))notFound();
 redirect('/register?ref='+encodeURIComponent(code));
}
