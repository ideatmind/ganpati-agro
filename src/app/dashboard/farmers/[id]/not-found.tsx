import {SiteHeader} from "@/components/SiteHeader";
import Link from 'next/link';
export default function NotFound(){return <><SiteHeader/><main className="state-page"><h1>Farmer record unavailable</h1><p>This record may have been removed or is outside your access.</p><Link className="button button-outline" href="/dashboard">Back to dashboard</Link></main></>;}
