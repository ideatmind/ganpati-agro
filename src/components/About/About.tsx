import Image from "next/image";
import ScrollReveal from "../shared/ScrollReveal";

export default function About() {
  return (
    <section className="section about" id="about">
      <div className="container about-grid">
        <ScrollReveal className="about-media">
          <Image
            src="/about-farm.jpg"
            alt="शेतातील शेतकरी"
            fill
            sizes="(max-width: 1023px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
          <div className="about-badge">
            <strong>२०१६</strong>
            <span>पासून सेवेत</span>
          </div>
        </ScrollReveal>
        <ScrollReveal className="about-body">
          <p className="eyebrow">आमच्याबद्दल</p>
          <h2>शेतकऱ्यांसाठी, शेतकऱ्यांच्या सोबत</h2>
          <p className="lead">
            गणपती ॲग्रो प्रोड्युसर कंपनी लि. ही २०१६ पासून बळीराजाच्या सेवेत
            असलेली शेतकरी केंद्रित कंपनी आहे. आम्ही धाराशिव जिल्ह्यातील
            शेतकऱ्यांना समूहांमध्ये जोडून उत्पादन खर्च कमी करणे, बाजारपेठेशी
            जोडणे आणि मूल्यवर्धन करणे यासाठी कार्यरत आहोत.
          </p>
          <ul className="about-points">
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span><strong>उत्पादन खर्च कमी</strong> — बियाणे, खते व तंत्रज्ञान सहाय्य</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span><strong>बाजार जोडणी</strong> — फायदेशीर बाजारपेठ उपलब्ध करून देणे</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span><strong>मूल्यवर्धन</strong> — शेतमालाला अधिक मूल्य मिळवून देणे</span>
            </li>
          </ul>
          <div className="about-meta">
            <span>CIN: U01403MH2016PTC272505</span>
            <span>कंपनी अधिनियम २०१३ अंतर्गत नोंदणीकृत</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
