import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { callRpc } from "@/lib/supabase";
import { DASHBOARD_STATS_TAG } from "@/lib/admin-cache";
import { TALUKA_VALUES } from "@/lib/constants";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const ALLOWED = {
  taluka: TALUKA_VALUES,
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
const registrationRateLimiter = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

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

function validate(payload: unknown): ValidatedPayload | string {
  if (!payload || typeof payload !== "object") return "Invalid request body";
  const p = payload as Record<string, unknown>;

  if (typeof p.website === "string" && p.website.trim() !== "") return "Invalid request";
  if (typeof p.request_id !== "string" || p.request_id.trim() === "") return "Request id is required";
  if (p.consent !== true) return "Consent is required";

  const name = cleanText(p.name, MAX_FIELD_LENGTH);
  const village = cleanText(p.village, MAX_FIELD_LENGTH);
  const district = cleanText(p.district, MAX_FIELD_LENGTH);
  if (!name) return "Name is required (max 200 characters)";
  if (!village) return "Village is required (max 200 characters)";
  if (!district) return "District is required (max 200 characters)";
  if (!isValidMobile(p.mobile)) return "Mobile number must be exactly 10 digits";
  if (!isValidAadhar(p.aadhar_no)) return "Aadhar number must be exactly 12 digits";
  if (!isValidDob(p.date_of_birth)) return "Date of birth must be a valid past date";
  if (typeof p.taluka !== "string" || !ALLOWED.taluka.includes(p.taluka)) return "Please select a valid taluka";
  if (typeof p.income_source !== "string" || !ALLOWED.income_source.includes(p.income_source)) return "Please select an income source";
  if (typeof p.cluster_type !== "string" || !ALLOWED.cluster_type.includes(p.cluster_type)) return "Please select a cluster type";

  const plots = p.plots;
  if (!Array.isArray(plots) || plots.length < 1 || plots.length > MAX_PLOTS) return "At least one plot is required (max 10)";

  const validPlots: ValidatedPlot[] = [];
  for (const plot of plots) {
    if (!plot || typeof plot !== "object") return "Invalid plot data";
    const pl = plot as Record<string, unknown>;
    const plotNo = cleanText(pl.plot_no, MAX_PLOT_FIELD_LENGTH);
    const cropName = cleanText(pl.crop_name, MAX_PLOT_FIELD_LENGTH);
    if (!plotNo) return "Plot / survey number is required";
    if (!cropName) return "Crop name is required";
    if (typeof pl.irrigation_source !== "string" || !ALLOWED.irrigation_source.includes(pl.irrigation_source)) return "Please select an irrigation source";
    const area =
      typeof pl.area_acres === "number" ? pl.area_acres : parseFloat(String(pl.area_acres));
    if (!isFinite(area) || area <= 0) return "Plot area must be a positive number";
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
  const ip = clientIp(request.headers);
  if (registrationRateLimiter.isLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = validate(payload);
  if (typeof valid === "string") {
    console.error("[registration] validation failed", { ip, error: valid });
    return NextResponse.json({ error: valid }, { status: 400 });
  }

  try {
    const result = await callRpc<{ status?: string }>("submit_registration", {
      p_payload: valid,
    });
    revalidateTag(DASHBOARD_STATS_TAG, "max");
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
