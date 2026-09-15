import Link from 'next/link';
export default function NotFound(){return <main className="dashboard-shell"><h1>Farmer record unavailable</h1><p>This record may have been removed or is outside your access.</p><Link className="button button-outline" href="/dashboard">Back to dashboard</Link></main>;}
