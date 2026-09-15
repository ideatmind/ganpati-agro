import Link from 'next/link';
export default function NotFound(){return <section className="admin-empty"><h1>Record unavailable</h1><p>This record may have been removed or is outside your access.</p><Link className="admin-button admin-button-secondary" href="/dashboard/admin?section=registrations">Back to registrations</Link></section>;}
