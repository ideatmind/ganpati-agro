'use client';
import Link from 'next/link';
export default function AdminError({reset}:{reset:()=>void}){return <section className="admin-empty"><h1>Could not load this workspace</h1><p>Please try again. Your saved records have not changed.</p><div className="admin-dialog-actions"><Link className="admin-button admin-button-secondary" href="/dashboard">My account</Link><button className="admin-button" onClick={reset}>Try again</button></div></section>;}
