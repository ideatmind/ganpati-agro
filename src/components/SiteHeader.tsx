import Image from "next/image";
import Link from "next/link";

export function SiteHeader({registration=false}:{registration?:boolean}) {
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="Shri Ganpati Agro home">
      <Image src="/brand/logo-icon.png" alt="" width={52} height={52} />
      <span><strong>श्री गणपती ॲग्रो</strong><small>PRODUCER COMPANY LTD.</small></span>
    </Link>
    <nav aria-label="Primary navigation">
      <Link href="/#about">आमच्याबद्दल</Link>
      <Link href="/#purpose">आमचे कार्य</Link>
      <Link href="/register/focused-value-chain">Exclusive form</Link>
    </nav>
    {registration?<Link href="/login" className="button button-small">लॉग इन</Link>:<Link href="/register" className="button button-small">नोंदणी करा</Link>}
  </header>;
}
