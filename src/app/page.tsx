import { CoverageMap } from "@/features/marketing/CoverageMap";
import Image from "next/image";
import { HeroVideo } from "@/features/marketing/HeroVideo";
import Link from "next/link";
import { BackToTop } from "@/features/marketing/BackToTop";
import { ClusterExplorer } from "@/features/marketing/ClusterExplorer";
import { MarketingNav } from "@/features/marketing/MarketingNav";
import { ScrollReveal } from "@/features/marketing/ScrollReveal";

const values=["शेतकरी केंद्रित","अखंडता","उत्कृष्टता","संघटित कार्य","उत्तरदायित्व","प्रामाणिक हेतू"];
const purpose=[
  {kind:"vision",icon:"◉",title:"व्हिजन",text:"देशातील शेतकऱ्यांचे एकात्मिक साखळी समूह एकमेकांना जोडून शेतीचा विकास व मूल्यवर्धन करणे."},
  {kind:"mission",icon:"⌖",title:"मिशन",text:"शेतकऱ्यांचा उत्पादन खर्च कमी करणे, फायदेशीर बाजारपेठ उपलब्ध करून देणे आणि मूल्यवर्धन साखळीचा विकास व व्यवस्थापन करणे."},
  {kind:"values",icon:"♡",title:"मूल्ये",text:"शेतकरी केंद्रित विचार, अखंडता, उत्कृष्टता, संघटित कार्य, उत्तरदायित्व आणि प्रामाणिक हेतू या मूल्यांवर आमचा पाया आहे."},
];
const participationBenefits = [
  "तज्ञ मार्गदर्शन व तंत्रज्ञान सहाय्य",
  "बाजार जोडणी व मूल्यवर्धन",
  "बियाणे, खते, यंत्रसामग्री सहाय्य",
  "उत्पादन खर्चात बचत",
] as const;

export default function Home(){return <><a className="skip-link" href="#main">मुख्य सामग्रीकडे जा / Skip to content</a><MarketingNav/><main id="main">
  <section className="legacy-hero" id="home"><HeroVideo/><div className="legacy-hero-overlay"/><div className="legacy-container hero-inner"><Image src="/brand/logo-icon.png" width={200} height={200} priority alt="Ganpati Agro Producer Company logo" className="hero-logo"/><h1>गणपती ॲग्रो प्रोड्युसर कंपनी लि.</h1><p>२०१६ पासून बळीराजाच्या सेवेत....</p><div className="hero-actions"><Link className="legacy-btn primary" href="/register">नोंदणी करा</Link><a className="legacy-btn outline" href="#contact">संपर्क करा</a></div><a href="#about" className="scroll-down" aria-label="Scroll to about">⌄</a></div></section>
  <section className="legacy-section about" id="about"><div className="legacy-container about-grid"><ScrollReveal className="about-media"><Image src="/images/about-farm.jpg" fill sizes="(max-width:1023px) 100vw, 50vw" alt="Farmers working in a field"/><div className="about-badge"><strong>२०१६</strong><span>पासून सेवेत</span></div></ScrollReveal><ScrollReveal className="about-body"><p className="legacy-eyebrow">आमच्याबद्दल</p><h2>शेतकऱ्यांसाठी, शेतकऱ्यांच्या सोबत</h2><p className="lead">गणपती ॲग्रो प्रोड्युसर कंपनी लि. ही २०१६ पासून बळीराजाच्या सेवेत असलेली शेतकरी केंद्रित कंपनी आहे. आम्ही शेतकऱ्यांना समूहांमध्ये जोडून उत्पादन खर्च कमी करणे, बाजारपेठेशी जोडणे आणि मूल्यवर्धन करणे यासाठी कार्यरत आहोत.</p><ul className="about-points"><li><b>✓</b><span><strong>उत्पादन खर्च कमी</strong> — बियाणे, खते व तंत्रज्ञान सहाय्य</span></li><li><b>✓</b><span><strong>बाजार जोडणी</strong> — फायदेशीर बाजारपेठ उपलब्ध करून देणे</span></li><li><b>✓</b><span><strong>मूल्यवर्धन</strong> — शेतमालाला अधिक मूल्य मिळवून देणे</span></li></ul><div className="about-meta"><span>CIN: U01403MH2016PTC272505</span><span>कंपनी अधिनियम २०१३ अंतर्गत नोंदणीकृत</span></div></ScrollReveal></div></section>
  <section className="legacy-section purpose" id="purpose"><div className="legacy-container"><ScrollReveal className="legacy-heading"><p className="legacy-eyebrow">आमचा उद्देश</p><h2>उद्देश, दृष्टी आणि मूल्ये</h2></ScrollReveal><div className="purpose-grid">{purpose.map((item)=><ScrollReveal className={`purpose-card ${item.kind}`} key={item.title}><span className="purpose-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></ScrollReveal>)}</div><ScrollReveal className="values-strip">{values.map((value)=><span key={value}>{value}</span>)}</ScrollReveal><ScrollReveal className="quote"><p>&quot;शेतकऱ्यांसोबत योग्य व प्रामाणिक हेतूने काम करा, यश हमखास मिळेल!&quot;</p></ScrollReveal></div></section>
  <section className="legacy-section clusters" id="clusters"><div className="legacy-container"><ScrollReveal className="legacy-heading"><p className="legacy-eyebrow">समूह प्रकार</p><h2>पीक आणि शेतीपूरक व्यवसाय</h2></ScrollReveal><ScrollReveal><ClusterExplorer/></ScrollReveal></div></section>
  <CoverageMap/>
  <section className="legacy-section membership" id="membership" aria-labelledby="participation-heading">
    <div className="legacy-container participation-layout">
      <ScrollReveal className="participation-intro">
        <span className="participation-symbol" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="14" r="5"/><path d="M14 36v-4a10 10 0 0 1 20 0v4"/>
            <path d="M10 22a4 4 0 1 1 4-7M38 22a4 4 0 1 0-4-7M5 35v-3a7 7 0 0 1 5-7M43 35v-3a7 7 0 0 0-5-7"/>
          </svg>
        </span>
        <p className="legacy-eyebrow">सभासद होण्याचे फायदे</p>
        <h2 id="participation-heading">समूह सहभाग</h2>
        <p className="participation-description">एकत्र येऊया, शेतीची प्रगती साधूया.</p>
        <Link href="/register" className="legacy-btn gold">नोंदणी करा · ₹500 <span aria-hidden="true">→</span></Link>
      </ScrollReveal>
      <ScrollReveal className="participation-panel">
        <ul className="participation-benefits">
          {participationBenefits.map((benefit) => <li key={benefit}><span className="participation-check" aria-hidden="true">✓</span><span>{benefit}</span></li>)}
        </ul>
      </ScrollReveal>
    </div>
  </section>
  <section className="legacy-section final-register"><div className="legacy-container"><ScrollReveal><p className="legacy-eyebrow">सुरक्षित डिजिटल नोंदणी</p><h2>फॉर्म भरा आणि लगेच सभासद व्हा.</h2><p>शेतकरी स्वतः नोंदणी करू शकतो किंवा अधिकृत कर्मचाऱ्याची मदत घेऊ शकतो.</p><Link href="/register" className="legacy-btn primary">नोंदणी सुरू करा</Link></ScrollReveal></div></section>
  </main><footer className="legacy-footer" id="contact"><div className="legacy-container footer-grid"><div><Image src="/brand/logo-icon.png" width={72} height={72} alt=""/><h3>गणपती ॲग्रो प्रोड्युसर कंपनी लि.</h3></div><div><h4>पत्ता</h4><p>बार्शी नाका, बार्शी रोड,<br/>धाराशिव (MH) — ४१३५०१</p></div><div><h4>संपर्क</h4><a href="tel:+917030039005">+91 70300 39005</a><a href="tel:+918390335722">+91 83903 35722</a><a href="mailto:sganpatiagropcl@gmail.com">sganpatiagropcl@gmail.com</a></div></div><div className="legacy-container copyright">© २०१६–{new Date().getFullYear()} गणपती ॲग्रो प्रोड्युसर कंपनी लि. · CIN: U01403MH2016PTC272505</div></footer><BackToTop/></>}
