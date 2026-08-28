import ScrollReveal from "../shared/ScrollReveal";
import AnimatedCounter from "./AnimatedCounter";

const TALUKAS = ["धाराशिव", "तुळजापूर", "उमरगा", "लोहारा", "कळंब", "वाशी", "भूम", "परांडा"];

const STATS = [
  {
    target: 8, label: "तालुके",
    icon: (<svg viewBox="0 0 48 48" fill="none"><path d="M24 4c-7.7 0-14 6.3-14 14 0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1" /><circle cx="24" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="24" cy="18" r="2.5" fill="currentColor" opacity="0.4" /></svg>),
  },
  {
    target: 741, label: "गावे",
    icon: (<svg viewBox="0 0 48 48" fill="none"><path d="M8 36h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 36V22l8-6 8 6v14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><rect x="18" y="28" width="4" height="8" rx="0.5" stroke="currentColor" strokeWidth="1" /><path d="M32 36V26l6-4v14" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" /><circle cx="16" cy="25" r="1" fill="currentColor" opacity="0.5" /><circle cx="24" cy="25" r="1" fill="currentColor" opacity="0.5" /><circle cx="40" cy="28" r="4" stroke="currentColor" strokeWidth="1" opacity="0.5" /><line x1="40" y1="32" x2="40" y2="36" stroke="currentColor" strokeWidth="1" opacity="0.5" /></svg>),
  },
  {
    target: 100, label: "किमी परिसर",
    icon: (<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" /><circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="1" opacity="0.4" /><circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.3" /><path d="M24 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M24 38v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M6 24h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M38 24h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
  },
  {
    target: 8, label: "शेजारील तालुके",
    icon: (<svg viewBox="0 0 48 48" fill="none"><circle cx="20" cy="24" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.5" /><circle cx="28" cy="24" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.5" /><path d="M20 22l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  },
];

export default function Coverage() {
  return (
    <section className="section coverage" id="coverage">
      <div className="container coverage-grid">
        <ScrollReveal className="coverage-text">
          <p className="eyebrow">कार्यक्षेत्र</p>
          <h2>धाराशिव जिल्हा आणि १०० किमी परिसर</h2>
          <p className="lead">
            धाराशिव जिल्ह्यातील ८ तालुक्यांतील ७४१ गावांमध्ये तसेच १०० किमी
            परिसरातील ८ शेजारील तालुक्यांमध्ये आमचे कार्यक्षेत्र विस्तारले आहे.
          </p>
          <div className="taluka-list">
            {TALUKAS.map((taluka) => (
              <span key={taluka} className="taluka">{taluka}</span>
            ))}
          </div>
        </ScrollReveal>
        <ScrollReveal className="coverage-stats">
          {STATS.map((stat) => (
            <div className="stat" key={stat.label}>
              <span className="stat-icon">{stat.icon}</span>
              <AnimatedCounter target={stat.target} className="stat-number" />
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
