import Link from "next/link";
import { DISTRICTS, DIRECTORY_COUNTS } from "@/features/geography/directory";
import districtPaths from "@/features/geography/maharashtra-paths.json";
import { AnimatedCounter } from "./AnimatedCounter";
import { ScrollReveal } from "./ScrollReveal";
import "./coverage-map.css";

// Source geometry uses Osmanabad / Bid; IDs are mapped to Dharashiv / Beed.
// See public/data/maharashtra-map-LICENSE.txt for source and permission notice.
const callouts = [
  { id: "beed", color: "var(--gold)", point: [375, 324], line: "375,324 530,304 622,385 700,385", label: [712, 386] },
  { id: "latur", color: "var(--sky)", point: [465, 387], line: "465,387 575,455 700,455", label: [712, 456] },
  { id: "dharashiv", color: "var(--green)", point: [400, 406], line: "400,406 550,525 700,525", label: [712, 526] },
  { id: "solapur", color: "var(--earth)", point: [340, 447], line: "340,447 486,595 590,595", label: [602, 596] },
  { id: "sangli", color: "var(--leaf)", point: [287, 502], line: "287,502 382,660 440,660", label: [452, 661] },
];

export function CoverageMap() {
  const totals = [
    { count: DISTRICTS.length, mr: "जिल्हे", en: "Districts" },
    { count: DIRECTORY_COUNTS.reduce((sum, d) => sum + d.talukas, 0), mr: "तालुके", en: "Talukas" },
    { count: DIRECTORY_COUNTS.reduce((sum, d) => sum + d.villages, 0), mr: "गावे", en: "Villages" },
  ];

  return <section className="legacy-section coverage-map-section" id="coverage" aria-labelledby="coverage-heading">
    <div className="legacy-container">
      <ScrollReveal className="legacy-heading coverage-map-heading">
        <p className="legacy-eyebrow">कार्यक्षेत्र / Our presence</p>
        <h2 id="coverage-heading">महाराष्ट्रातील ५ जिल्ह्यांत, तुमच्या सोबत.</h2>
        <p>तुमचा जिल्हा, तुमचा तालुका, तुमचे गाव — जोडूया प्रगतीची नवी वाट.</p>
      </ScrollReveal>
      <ScrollReveal>
        <figure className="coverage-map-figure">
          <svg className="coverage-map" viewBox="75 10 810 710" role="img" aria-labelledby="coverage-map-title coverage-map-description">
            <title id="coverage-map-title">महाराष्ट्र कार्यक्षेत्र / Maharashtra coverage</title>
            <desc id="coverage-map-description">Five districts are highlighted: Dharashiv, Solapur, Beed, Sangli and Latur. Other Maharashtra districts are shown without labels. The directory includes {totals[1].count} talukas and {totals[2].count.toLocaleString("en-IN")} villages.</desc>
            <g className="coverage-map-districts" strokeLinejoin="round">
              {districtPaths.map(district => <path key={district.id} d={district.d} fill={callouts.find(c => c.id === district.id)?.color ?? "var(--map-neutral)"} />)}
            </g>
            {callouts.map(callout => {
              const district = DISTRICTS.find(d => d.value === callout.id)!;
              return <g key={callout.id} className="coverage-map-callout" style={{ color: callout.color }}>
                <polyline points={callout.line} />
                <circle cx={callout.point[0]} cy={callout.point[1]} r="4.5" />
                <text x={callout.label[0]} y={callout.label[1]}>
                  <tspan className="coverage-map-name">{district.mr}</tspan>
                  <tspan className="coverage-map-english" x={callout.label[0]} dy="24">{district.en}</tspan>
                </text>
              </g>;
            })}
          </svg>
          <figcaption className="coverage-map-caption">रंगीत जिल्ह्यांतील गावांसाठी नोंदणी उपलब्ध / Registration across the highlighted districts</figcaption>
        </figure>
      </ScrollReveal>
      <ScrollReveal className="coverage-map-totals">
        {totals.map(total => <article key={total.en}>
          <strong><AnimatedCounter target={total.count} /></strong>
          <span>{total.mr}<small>{total.en}</small></span>
        </article>)}
      </ScrollReveal>
      <ScrollReveal className="coverage-map-action">
        <Link className="legacy-btn primary" href="/register">तुमचे गाव शोधा / Find your village <span aria-hidden="true">↗</span></Link>
      </ScrollReveal>
    </div>
  </section>;
}
