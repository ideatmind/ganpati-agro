'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {useRef,useState} from 'react';
import {navigationFor,activeAdminSection,adminHref} from '@/features/admin/navigation';
function Icon({name}:{name:string}){
 const paths:Record<string,string>={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',team:'M3 8h18v13H3z M8 8V3h8v5 M3 13h18 M10 12v3h4v-3',wallet:'M3 6h16v15H3z M3 6V3h14v3 M15 11h6v5h-6z',receipt:'M5 3h14v19l-3-2-4 2-4-2-3 2z M9 7h6 M9 11h6 M9 15h3',key:'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M10 11v10 M10 17h4 M10 21h3',alert:'m12 3 10 18H2L12 3z M12 9v5 M12 17v1',activity:'M3 12h4l3-8 4 16 3-8h4',trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7'};
 return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
export function AdminNavigation({superAdmin}:{superAdmin:boolean}){
 const params=useSearchParams();const pathname=usePathname();const [open,setOpen]=useState(false);const toggle=useRef<HTMLButtonElement>(null);
 const current=activeAdminSection(pathname,params.get('section'));const items=navigationFor([superAdmin?'super_admin':'manager']);
 function close(){setOpen(false);if(open)toggle.current?.focus();}
 return <><button ref={toggle} className="admin-menu-toggle" aria-expanded={open} aria-controls="admin-navigation" onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='Escape')close();}}>Workspace menu <span aria-hidden="true">{open?'−':'+'}</span></button><nav id="admin-navigation" className={open?'is-open':''} aria-label="Admin navigation" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>{['Operations','Referrals','Team','Administration'].map(group=><div className="admin-nav-group" key={group}><span>{group}</span>{items.filter(item=>item.group===group).map(item=><Link key={item.id} href={adminHref(item.id)} aria-current={current===item.id?'page':undefined} onClick={close}><Icon name={item.icon}/>{item.label}</Link>)}</div>)}<div className="admin-nav-group"><span>My account</span><Link href="/dashboard?personal=1" onClick={close}><Icon name="wallet"/>My referrals &amp; work</Link><Link href="/dashboard/admin/account" aria-current={current==='account'?'page':undefined} onClick={close}><Icon name="key"/>Account &amp; password</Link></div></nav></>;
}
