'use strict';

// Serverless registration endpoint (Vercel Node runtime).
// Receives the public form payload, validates it, applies basic
// anti-abuse controls, then inserts the request + plots atomically
// via a SECURITY DEFINER RPC using the service_role key.
//
// Required environment variables:
//   SUPABASE_URL               e.g. https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  (never exposed to the browser)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = {
  taluka: ['dharashiv', 'tuljapur', 'umarga', 'lohara', 'kalamb', 'washi', 'bhum', 'paranda', 'other'],
  income_source: ['agriculture', 'business', 'job', 'other'],
  cluster_type: ['pulses', 'cereals', 'cash', 'fruits', 'vegs', 'allied'],
  irrigation_source: ['well', 'borewell', 'canal', 'drip', 'sprinkler', 'rainfed', 'river', 'other']
};

const MAX_PLOTS = 10;
const MAX_FIELD_LENGTH = 200;
const MAX_PLOT_FIELD_LENGTH = 100;

// Best-effort in-memory rate limiter (per warm instance).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(ip) {
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

function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length < 1 || v.length > max) return null;
  return v;
}

function isValidMobile(value) {
  return typeof value === 'string' && /^[0-9]{10}$/.test(value.trim());
}

function isValidAadhar(value) {
  return typeof value === 'string' && /^[0-9]{12}$/.test(value.trim());
}

function isValidDob(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  if (isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return date.getTime() <= Date.now();
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') return false;

  if (typeof payload.website === 'string' && payload.website.trim() !== '') return false;

  if (typeof payload.request_id !== 'string' || payload.request_id.trim() === '') return false;
  if (payload.consent !== true) return false;

  const name = cleanText(payload.name, MAX_FIELD_LENGTH);
  const village = cleanText(payload.village, MAX_FIELD_LENGTH);
  const district = cleanText(payload.district, MAX_FIELD_LENGTH);
  if (!name || !village || !district) return false;
  if (!isValidMobile(payload.mobile)) return false;
  if (!isValidAadhar(payload.aadhar_no)) return false;
  if (!isValidDob(payload.date_of_birth)) return false;
  if (!ALLOWED.taluka.includes(payload.taluka)) return false;
  if (!ALLOWED.income_source.includes(payload.income_source)) return false;
  if (!ALLOWED.cluster_type.includes(payload.cluster_type)) return false;

  const plots = payload.plots;
  if (!Array.isArray(plots) || plots.length < 1 || plots.length > MAX_PLOTS) return false;

  for (let i = 0; i < plots.length; i++) {
    const p = plots[i];
    if (!p || typeof p !== 'object') return false;
    if (!cleanText(p.plot_no, MAX_PLOT_FIELD_LENGTH)) return false;
    if (!cleanText(p.crop_name, MAX_PLOT_FIELD_LENGTH)) return false;
    if (!ALLOWED.irrigation_source.includes(p.irrigation_source)) return false;
    const area = typeof p.area_acres === 'number' ? p.area_acres : parseFloat(p.area_acres);
    if (!isFinite(area) || area <= 0) return false;
  }

  return {
    request_id: payload.request_id.trim(),
    name,
    mobile: payload.mobile.trim(),
    date_of_birth: payload.date_of_birth,
    aadhar_no: payload.aadhar_no.trim(),
    village,
    taluka: payload.taluka,
    district,
    income_source: payload.income_source,
    cluster_type: payload.cluster_type,
    consent: true,
    plots: plots.map((p) => ({
      plot_no: String(p.plot_no).trim(),
      area_acres: parseFloat(p.area_acres),
      crop_name: String(p.crop_name).trim(),
      irrigation_source: p.irrigation_source
    }))
  };
}

async function parseBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(new Error('body too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  let payload;
  try {
    payload = await parseBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const valid = validate(payload);
  if (!valid) {
    console.error('[registration] validation failed', { ip });
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[registration] missing server environment configuration');
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_registration`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_payload: valid })
    });

    if (!rpcResponse.ok) {
      const text = await rpcResponse.text().catch(() => '');
      console.error('[registration] RPC failed', { status: rpcResponse.status, text });
      return res.status(500).json({ error: 'Server error' });
    }

    const result = await rpcResponse.json().catch(() => null);
    return res.status(200).json({ ok: true, request_id: valid.request_id, status: result && result.status });
  } catch (err) {
    console.error('[registration] unexpected error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
