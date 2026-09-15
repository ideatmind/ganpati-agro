'use client';
import Link from 'next/link';
export default function AdminError({reset}:{reset:()=>void}){return <section className="admin-empty"><h1>Could not load this workspace</h1><p>Please try again. This page could not retrieve your records.</p><div className="admin-dialog-actions"><Link className="admin-button admin-button-secondary" href="/dashboard?personal=1">My account</Link><button className="admin-button" onClick={reset}>Try again</button></div></section>;}
