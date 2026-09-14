import Link from 'next/link';
import Image from 'next/image';
import {redirect} from 'next/navigation';
import {Suspense,type ReactNode} from 'react';
import {getIdentity} from '@/server/session';
import {AdminNavigation} from '@/components/AdminNavigation';
import {DashboardActions} from '@/components/DashboardActions';
import './workspace.css';
export const metadata={title:'Admin workspace'};
export default async function AdminLayout({children}:{children:ReactNode}){
 const identity=await getIdentity();if(!identity)redirect('/login');if(!identity.roles.some(role=>['manager','super_admin'].includes(role)))redirect('/dashboard');
 const superAdmin=identity.roles.includes('super_admin');
 return <div className="admin-workspace"><a className="admin-skip" href="#admin-content">Skip to content</a><aside className="admin-sidebar"><Link className="admin-brand" href="/dashboard/admin"><Image src="/brand/logo-icon.png" alt="" width={38} height={38}/><span>Ganpati Agro<small>ADMIN WORKSPACE</small></span></Link><Suspense><AdminNavigation superAdmin={superAdmin}/></Suspense><div className="admin-sidebar-footer"><Link href="/dashboard/admin/account">My account ↗</Link><Link href="/">View website ↗</Link></div></aside><div className="admin-body"><header className="admin-topbar"><span>Admin console</span><div className="admin-account"><span><strong>{identity.displayName}</strong><small>{superAdmin?'Super administrator':'Manager'}</small></span><DashboardActions/></div></header><main id="admin-content" className="admin-content">{children}</main><footer className="admin-footer">Ganpati Agro · Operations workspace</footer></div></div>;
}
