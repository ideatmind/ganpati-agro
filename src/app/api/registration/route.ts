import { NextRequest, NextResponse } from "next/server";
import { callRpc } from "@/lib/supabase";

const ALLOWED = {
  taluka: ["dharashiv", "tuljapur", "umarga", "lohara", "kalamb", "washi", "bhum", "paranda", "other"],
  income_source: ["agriculture", "business", "job", "other"],
  cluster_type: ["pulses", "cereals", "cash", "fruits", "vegs", "allied"],
  irrigation_source: ["well", "borewell", "canal", "drip", "sprinkler", "rainfed", "river", "other"],
};

const MAX_PLOTS = 10;
const MAX_FIELD_LENGTH = 200;
const MAX_PLOT_FIELD_LENGTH = 100;

// Best-effort in-memory rate limiter (per warm instance).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_LIMIT) {
    hits.set(ip, times);
    return true;
  }
  times.push(now);
  hits.set(ip, times);
  return false;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v.length < 1 || v.length > max) return null;
  return v;
}

function isValidMobile(value: unknown): boolean {
  return typeof value === "string" && /^[0-9]{10}$/.test(value.trim());
}

function isValidAadhar(value: unknown): boolean {
  return typeof value === "string" && /^[0-9]{12}$/.test(value.trim());
}

function isValidDob(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  if (isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return date.getTime() <= Date.now();
}

interface ValidatedPlot {
  plot_no: string;
  area_acres: number;
  crop_name: string;
  irrigation_source: string;
}

interface ValidatedPayload {
  request_id: string;
  name: string;
  mobile: string;
  date_of_birth: string;
  aadhar_no: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
  consent: true;
  plots: ValidatedPlot[];
}

function validate(payload: unknown): ValidatedPayload | false {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;

  if (typeof p.website === "string" && p.website.trim() !== "") return false;

  if (typeof p.request_id !== "string" || p.request_id.trim() === "") return false;
  if (p.consent !== true) return false;

  const name = cleanText(p.name, MAX_FIELD_LENGTH);
  const village = cleanText(p.village, MAX_FIELD_LENGTH);
  const district = cleanText(p.district, MAX_FIELD_LENGTH);
  if (!name || !village || !district) return false;
  if (!isValidMobile(p.mobile)) return false;
  if (!isValidAadhar(p.aadhar_no)) return false;
  if (!isValidDob(p.date_of_birth)) return false;
  if (typeof p.taluka !== "string" || !ALLOWED.taluka.includes(p.taluka)) return false;
  if (typeof p.income_source !== "string" || !ALLOWED.income_source.includes(p.income_source)) return false;
  if (typeof p.cluster_type !== "string" || !ALLOWED.cluster_type.includes(p.cluster_type)) return false;

  const plots = p.plots;
  if (!Array.isArray(plots) || plots.length < 1 || plots.length > MAX_PLOTS) return false;

  const validPlots: ValidatedPlot[] = [];
  for (const plot of plots) {
    if (!plot || typeof plot !== "object") return false;
    const pl = plot as Record<string, unknown>;
    const plotNo = cleanText(pl.plot_no, MAX_PLOT_FIELD_LENGTH);
    const cropName = cleanText(pl.crop_name, MAX_PLOT_FIELD_LENGTH);
    if (!plotNo || !cropName) return false;
    if (typeof pl.irrigation_source !== "string" || !ALLOWED.irrigation_source.includes(pl.irrigation_source)) return false;
    const area =
      typeof pl.area_acres === "number" ? pl.area_acres : parseFloat(String(pl.area_acres));
    if (!isFinite(area) || area <= 0) return false;
    validPlots.push({
      plot_no: plotNo,
      area_acres: area,
      crop_name: cropName,
      irrigation_source: pl.irrigation_source,
    });
  }

  return {
    request_id: p.request_id.trim(),
    name,
    mobile: (p.mobile as string).trim(),
    date_of_birth: p.date_of_birth as string,
    aadhar_no: (p.aadhar_no as string).trim(),
    village,
    taluka: p.taluka as string,
    district,
    income_source: p.income_source as string,
    cluster_type: p.cluster_type as string,
    consent: true,
    plots: validPlots,
  };
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = validate(payload);
  if (!valid) {
    console.error("[registration] validation failed", { ip });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await callRpc<{ status?: string }>("submit_registration", {
      p_payload: valid,
    });
    return NextResponse.json({
      ok: true,
      request_id: valid.request_id,
      status: result && result.status,
    });
  } catch (err) {
    console.error("[registration] unexpected error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
