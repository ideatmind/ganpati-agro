"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import ScrollReveal from "../shared/ScrollReveal";
import { TALUKA_OPTIONS } from "@/lib/constants";

const MAX_PLOTS = 10;
const REQUEST_TIMEOUT_MS = 15000;

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface FarmPlot {
  plotNo: string;
  area: string;
  cropName: string;
  irrigationSource: string;
}

const INCOME_OPTIONS = [
  { value: "agriculture", label: "Agriculture", labelMr: "शेती" },
  { value: "business", label: "Business", labelMr: "व्यवसाय" },
  { value: "job", label: "Job", labelMr: "नोकरी" },
  { value: "other", label: "Other", labelMr: "इतर" },
];

const CLUSTER_OPTIONS = [
  { value: "pulses", label: "Pulses", labelMr: "कडधान्ये" },
  { value: "cereals", label: "Cereals", labelMr: "तृणधान्ये" },
  { value: "cash", label: "Cash Crops", labelMr: "नगदी पिके" },
  { value: "fruits", label: "Fruits", labelMr: "फळे" },
  { value: "vegs", label: "Vegetables", labelMr: "भाजीपाला" },
  { value: "allied", label: "Allied Business", labelMr: "संलग्न व्यवसाय" },
];

const IRRIGATION_OPTIONS = [
  { value: "well", label: "Well", labelMr: "विहीर" },
  { value: "borewell", label: "Borewell", labelMr: "कूपनलिका (बोअरवेल)" },
  { value: "canal", label: "Canal", labelMr: "कालवा" },
  { value: "drip", label: "Drip Irrigation", labelMr: "ठिबक सिंचन" },
  { value: "sprinkler", label: "Sprinkler", labelMr: "तुषार सिंचन" },
  { value: "rainfed", label: "Rainfed", labelMr: "कोरडवाहू" },
  { value: "river", label: "River / Stream", labelMr: "नदी / ओढा" },
  { value: "other", label: "Other", labelMr: "इतर" },
];

const EMPTY_PLOT: FarmPlot = { plotNo: "", area: "", cropName: "", irrigationSource: "" };

function toMarathiNum(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x0966 + parseInt(d)));
}

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function submitRegistration(payload: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = "Request failed";
      try {
        const data = (await res.json()) as { error?: unknown };
        if (data && typeof data.error === "string" && data.error) message = data.error;
      } catch {
        // Non-JSON error body; keep the generic message.
      }
      throw new Error(message);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export default function RegistrationForm() {
  const [plots, setPlots] = useState<FarmPlot[]>([{ ...EMPTY_PLOT }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [plotWarning, setPlotWarning] = useState("");
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSuccess && successRef.current) {
      successRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isSuccess]);

  function updatePlot(index: number, field: keyof FarmPlot, value: string) {
    setPlots((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPlot() {
    if (plots.length >= MAX_PLOTS) {
      setPlotWarning(`कमाल ${MAX_PLOTS} प्लॉट जोडता येतील. / Maximum ${MAX_PLOTS} plots allowed.`);
      return;
    }
    setPlotWarning("");
    setPlots((prev) => [...prev, { ...EMPTY_PLOT }]);
  }

  function removePlot(index: number) {
    if (plots.length <= 1) {
      setPlotWarning("किमान एक प्लॉट आवश्यक आहे. / At least one plot is required.");
      return;
    }
    setPlotWarning("");
    setPlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = new FormData(form);
    const payload = {
      request_id: makeRequestId(),
      name: String(data.get("name") || "").trim(),
      mobile: String(data.get("mobile") || "").trim(),
      date_of_birth: String(data.get("dob") || ""),
      aadhar_no: String(data.get("aadhar") || "").trim(),
      village: String(data.get("village") || "").trim(),
      taluka: String(data.get("taluka") || ""),
      district: String(data.get("district") || "").trim(),
      income_source: String(data.get("income") || ""),
      cluster_type: String(data.get("clusterType") || ""),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || ""),
      plots: plots.map((p) => ({
        plot_no: p.plotNo.trim(),
        area_acres: parseFloat(p.area),
        crop_name: p.cropName.trim(),
        irrigation_source: p.irrigationSource,
      })),
    };

    setIsSubmitting(true);
    try {
      await submitRegistration(payload);
      setIsSuccess(true);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const serverMessage = err instanceof Error && err.message && err.message !== "Request failed" ? err.message : "";
      setError(
        isTimeout
          ? "वेळ संपली. कृपया पुन्हा प्रयत्न करा. / Request timed out. Please try again."
          : serverMessage
            ? `${serverMessage} / कृपया माहिती तपासून पुन्हा प्रयत्न करा.`
            : "नोंदणी अयशस्वी. कृपया पुन्हा प्रयत्न करा. / Registration failed. Please try again."
      );
      console.error("Registration error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section register" id="register">
      <div className="container">
        <ScrollReveal className="section-head">
          <p className="eyebrow">नोंदणी / Registration</p>
          <h2>शेतकरी नोंदणी फॉर्म <span className="label-en">Farmer Registration Form</span></h2>
        </ScrollReveal>
        <ScrollReveal className="form-wrap">
          {isSuccess ? (
            <div className="form-success" role="status" aria-live="polite" ref={successRef}>
              <span className="success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <h3>तुमचा अर्ज प्राप्त झाला! <span className="label-en">Application Received!</span></h3>
              <p>तुमच्या अर्जाची पडताळणी करून आम्ही लवकरच तुमच्याशी संपर्क साधू. / We will review your application and contact you soon.</p>
            </div>
          ) : (
            <form id="registrationForm" onSubmit={handleSubmit} noValidate>
              <fieldset className="form-section">
                <legend className="form-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  वैयक्तिक माहिती <span className="label-en">Personal Details</span>
                </legend>

                <div className="field">
                  <label htmlFor="farmerName">पूर्ण नाव <span className="label-en">Full Name</span> <span className="required">*</span></label>
                  <input type="text" id="farmerName" name="name" required placeholder="Enter full name" autoComplete="name" />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="mobile">मोबाईल नंबर <span className="label-en">Mobile Number</span> <span className="required">*</span></label>
                    <input type="tel" id="mobile" name="mobile" required pattern="[0-9]{10}" maxLength={10} placeholder="10-digit mobile number" inputMode="numeric" autoComplete="tel" />
                  </div>
                  <div className="field">
                    <label htmlFor="dob">जन्मतारीख <span className="label-en">Date of Birth</span> <span className="required">*</span></label>
                    <input type="date" id="dob" name="dob" required max={todayIso()} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="aadhar">आधार क्रमांक <span className="label-en">Aadhar Number</span> <span className="required">*</span></label>
                  <input type="text" id="aadhar" name="aadhar" required pattern="[0-9]{12}" maxLength={12} placeholder="12-digit Aadhar number" inputMode="numeric" autoComplete="off" />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="village">गाव <span className="label-en">Village</span> <span className="required">*</span></label>
                    <input type="text" id="village" name="village" required placeholder="Enter village name" />
                  </div>
                  <div className="field">
                    <label htmlFor="taluka">तालुका <span className="label-en">Taluka</span> <span className="required">*</span></label>
                    <select id="taluka" name="taluka" required defaultValue="">
                      <option value="">तालुका निवडा / Select Taluka</option>
                      {TALUKA_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.labelMr} / {o.label}</option>))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="district">जिल्हा <span className="label-en">District</span> <span className="required">*</span></label>
                  <input type="text" id="district" name="district" required placeholder="Enter district name" defaultValue="Dharashiv" />
                </div>

                <div className="field">
                  <label>उत्पन्नाचे साधन <span className="label-en">Income Source</span> <span className="required">*</span></label>
                  <div className="radio-group">
                    {INCOME_OPTIONS.map((o) => (
                      <label key={o.value}><input type="radio" name="income" value={o.value} required /> {o.labelMr} / {o.label}</label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="clusterType">समूह प्रकार <span className="label-en">Cluster Type</span> <span className="required">*</span></label>
                  <select id="clusterType" name="clusterType" required defaultValue="">
                    <option value="">समूह प्रकार निवडा / Select Cluster Type</option>
                    {CLUSTER_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.labelMr} / {o.label}</option>))}
                  </select>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  शेत माहिती <span className="label-en">Farm Details</span>
                </legend>

                {plots.map((plot, i) => (
                  <div className="farm-entry" key={i}>
                    <div className="farm-entry-header">
                      <span className="farm-entry-label">प्लॉट {toMarathiNum(i + 1)} / Plot {i + 1}</span>
                      {plots.length > 1 && (
                        <button type="button" className="btn-remove-plot" title="Remove" onClick={() => removePlot(i)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`plotNo_${i}`}>गट / सर्वे नंबर <span className="label-en">Plot / Survey No.</span> <span className="required">*</span></label>
                        <input type="text" id={`plotNo_${i}`} required placeholder="e.g. 123/A" value={plot.plotNo} onChange={(e) => updatePlot(i, "plotNo", e.target.value)} />
                      </div>
                      <div className="field">
                        <label htmlFor={`area_${i}`}>क्षेत्रफळ (एकर) <span className="label-en">Area (Acres)</span> <span className="required">*</span></label>
                        <input type="number" id={`area_${i}`} required placeholder="e.g. 2.5" step="0.01" min="0.01" value={plot.area} onChange={(e) => updatePlot(i, "area", e.target.value)} />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`cropName_${i}`}>पिकाचे नाव <span className="label-en">Crop Name</span> <span className="required">*</span></label>
                        <input type="text" id={`cropName_${i}`} required placeholder="e.g. Soybean" value={plot.cropName} onChange={(e) => updatePlot(i, "cropName", e.target.value)} />
                      </div>
                      <div className="field">
                        <label htmlFor={`irrigationSource_${i}`}>सिंचन स्रोत <span className="label-en">Irrigation Source</span> <span className="required">*</span></label>
                        <select id={`irrigationSource_${i}`} required value={plot.irrigationSource} onChange={(e) => updatePlot(i, "irrigationSource", e.target.value)}>
                          <option value="">स्रोत निवडा / Select Source</option>
                          {IRRIGATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.labelMr} / {o.label}</option>))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn-add-plot" onClick={addPlot}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  आणखी प्लॉट जोडा / Add Another Plot
                </button>
                {plotWarning && <p className="form-hint form-hint-error" role="status">{plotWarning}</p>}
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  संमती व गोपनीयता <span className="label-en">Consent &amp; Privacy</span>
                </legend>
                <p className="consent-note">
                  तुमची माहिती केवळ सभासदत्वाच्या अर्जाच्या पडताळणीसाठी वापरली जाईल आणि ती तिसऱ्यांशी सामायिक केली जाणार नाही. / Your information will be used only to review your membership application and will not be shared with third parties.
                </p>
                <div className="field consent-field">
                  <label className="checkbox-label">
                    <input type="checkbox" id="consent" name="consent" required />
                    <span>मी वरील माहिती खरी असून तिच्या वापरास माझी संमती आहे. <span className="label-en">I consent to the use of the information above.</span></span>
                  </label>
                </div>
              </fieldset>

              <div className="hp-field" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              {error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}

              <button type="submit" className="btn btn-submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="btn-loading">
                    <svg className="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                    सबमिट होत आहे... / Submitting...
                  </span>
                ) : (
                  <>नोंदणी सबमिट करा / Submit Registration</>
                )}
              </button>
            </form>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
