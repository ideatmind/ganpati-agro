"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import ScrollReveal from "../shared/ScrollReveal";

const TABS = [
  { id: "pulses", label: "कडधान्ये", items: ["सोयाबीन", "तूर", "हरभरा", "मूग", "मटकी", "चवळी", "कुळीथ", "मसूर", "उडीद", "वाटाणा"] },
  { id: "cereals", label: "तृणधान्ये", items: ["गहू", "ज्वारी", "बाजरी", "मका", "भात", "नाचणी", "सवा"] },
  { id: "cash", label: "नगदी पिके", items: ["ऊस", "कापूस", "तंबाखू", "काजू", "बांबू"] },
  { id: "fruits", label: "फळबाग", items: ["डाळिंब", "द्राक्षे", "आंबा", "पेरू", "लिंबू", "सीताफळ", "ड्रॅगन फ्रूट", "बोर", "खरबूज", "कलिंगड"] },
  { id: "vegs", label: "भाजीपाला", items: ["मिरची", "वांगी", "कोबी", "शिमला मिरची", "भेंडी", "काकडी", "भोपळा", "पालक", "मेथी", "कोथिंबीर", "टोमॅटो", "दोडका"] },
  { id: "allied", label: "शेतीपूरक व्यवसाय", items: ["पशुपालन", "शेळीपालन", "कुक्कुटपालन", "कम्पोस्ट निर्मिती", "रेशीम उद्योग", "गोमूत्र", "मधमक्षिका पालन", "खत निर्मिती", "महिला बचत गट"] },
];

export default function Clusters() {
  const [activeTab, setActiveTab] = useState("pulses");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.id === id);
    const next =
      e.key === "ArrowRight"
        ? (idx + 1) % TABS.length
        : (idx - 1 + TABS.length) % TABS.length;
    const nextId = TABS[next].id;
    setActiveTab(nextId);
    tabRefs.current[nextId]?.focus();
  }

  return (
    <section className="section clusters" id="clusters">
      <div className="container">
        <ScrollReveal className="section-head">
          <p className="eyebrow">समूह प्रकार</p>
          <h2>पीक आणि शेतीपूरक व्यवसाय</h2>
        </ScrollReveal>
        <ScrollReveal className="cluster-tabs" role="tablist" aria-label="समूह प्रकार">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`cluster-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </ScrollReveal>
        {TABS.map((tab) => (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={0}
            hidden={activeTab !== tab.id}
            className={`cluster-panel${activeTab === tab.id ? " active" : ""}`}
          >
            {tab.items.map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
