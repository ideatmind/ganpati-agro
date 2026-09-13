import Image from "next/image";

export function SiteFooter() {
  return <footer className="site-footer"><div>
    <Image src="/brand/logo-icon.png" alt="Shri Ganpati Agro" width={64} height={64} />
    <p><strong>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लि.</strong><br />Growing Farmers. Building Futures.</p>
  </div><div><p>बार्शी नाका, बार्शी रोड, धाराशिव — 413501</p><p><a href="tel:+917030039005">+91 70300 39005</a> · <a href="mailto:sganpatiagropcl@gmail.com">sganpatiagropcl@gmail.com</a></p></div></footer>;
}
