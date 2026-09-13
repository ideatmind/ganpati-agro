import Link from "next/link";

export default function NotFound() { return <main className="state-page"><span className="eyebrow">404</span><h1>हे पृष्ठ उपलब्ध नाही.</h1><p>The requested page or receipt could not be found.</p><Link className="button" href="/">मुख्यपृष्ठावर जा</Link></main>; }
