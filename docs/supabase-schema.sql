-- ============================================================
-- Ganpati Agro — Registration & Membership Schema (v3)
-- ============================================================
-- Security model:
--   * The public website NEVER writes to tables directly.
--   * Anonymous/authenticated roles have NO access to these tables.
--   * A serverless API (see api/registration.js) calls the
--     SECURITY DEFINER RPC `submit_registration` using the
--     service_role key, which bypasses RLS.
--   * Intake (`registration_requests`) is APPEND-ONLY: the public
--     can only add a record. UPDATE and DELETE are blocked by a
--     trigger for every role, not just the public.
--   * Aadhaar and date-of-birth are collected for information only
--     and are never used for authentication or shared publicly.
-- ============================================================

-- ============================================================
-- 1. Public intake: what the website form submits (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_requests (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id        UUID NOT NULL UNIQUE,           -- client idempotency key
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  mobile            VARCHAR(10) NOT NULL CHECK (mobile ~ '^[0-9]{10}$'),
  date_of_birth     DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
  aadhar_no         VARCHAR(12) NOT NULL CHECK (aadhar_no ~ '^[0-9]{12}$'),
  village           TEXT NOT NULL CHECK (char_length(village) BETWEEN 1 AND 200),
  taluka            TEXT NOT NULL CHECK (taluka IN ('dharashiv','tuljapur','umarga','lohara','kalamb','washi','bhum','paranda','other')),
  district          TEXT NOT NULL DEFAULT 'Dharashiv',
  income_source     TEXT NOT NULL CHECK (income_source IN ('agriculture','business','job','other')),
  cluster_type      TEXT NOT NULL CHECK (cluster_type IN ('pulses','cereals','cash','fruits','vegs','allied')),
  consent_given     BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  source            TEXT NOT NULL DEFAULT 'website',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registration_request_plots (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id        UUID NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  plot_no           TEXT NOT NULL CHECK (char_length(plot_no) BETWEEN 1 AND 100),
  area_acres        NUMERIC(10,2) NOT NULL CHECK (area_acres > 0),
  crop_name         TEXT NOT NULL CHECK (char_length(crop_name) BETWEEN 1 AND 100),
  irrigation_source TEXT NOT NULL CHECK (irrigation_source IN ('well','borewell','canal','drip','sprinkler','rainfed','river','other')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Verified membership: staff-managed after approval
--    (no public/anonymous access)
-- ============================================================
CREATE TABLE IF NOT EXISTS farmers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  mobile        VARCHAR(10) NOT NULL UNIQUE CHECK (mobile ~ '^[0-9]{10}$'),
  date_of_birth DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
  aadhar_no     VARCHAR(12) NOT NULL UNIQUE CHECK (aadhar_no ~ '^[0-9]{12}$'),
  village       TEXT NOT NULL,
  taluka        TEXT NOT NULL,
  district      TEXT NOT NULL DEFAULT 'Dharashiv',
  income_source TEXT NOT NULL CHECK (income_source IN ('agriculture','business','job','other')),
  cluster_type  TEXT NOT NULL CHECK (cluster_type IN ('pulses','cereals','cash','fruits','vegs','allied')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_plots (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id         UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  plot_no           TEXT NOT NULL,
  area_acres        NUMERIC(10,2) NOT NULL CHECK (area_acres > 0),
  crop_name         TEXT NOT NULL,
  irrigation_source TEXT NOT NULL CHECK (irrigation_source IN ('well','borewell','canal','drip','sprinkler','rainfed','river','other')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Indexes for measured admin queries only
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_registration_requests_created
  ON registration_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_registration_requests_taluka
  ON registration_requests (taluka);
CREATE INDEX IF NOT EXISTS idx_registration_request_plots_request
  ON registration_request_plots (request_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_farmer
  ON farm_plots (farmer_id);

-- ============================================================
-- 4. Auto-update updated_at (farmers only; intake is append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_farmers ON farmers;
CREATE TRIGGER set_updated_at_farmers
  BEFORE UPDATE ON farmers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. Enforce append-only intake (no UPDATE / DELETE for anyone)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_registration_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'registration intake is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_requests_append_only ON registration_requests;
CREATE TRIGGER trg_registration_requests_append_only
  BEFORE UPDATE OR DELETE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_registration_mutation();

DROP TRIGGER IF EXISTS trg_registration_request_plots_append_only ON registration_request_plots;
CREATE TRIGGER trg_registration_request_plots_append_only
  BEFORE UPDATE OR DELETE ON registration_request_plots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_registration_mutation();

-- ============================================================
-- 6. Atomic, idempotent submission (called by the API only)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_registration(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id  uuid;
  v_req_pk      uuid;
  v_existing    uuid;
  v_plot        jsonb;
  v_plot_count  int;
BEGIN
  v_request_id := (p_payload->>'request_id')::uuid;
  v_plot_count := COALESCE(jsonb_array_length(p_payload->'plots'), 0);

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required';
  END IF;

  IF v_plot_count < 1 OR v_plot_count > 10 THEN
    RAISE EXCEPTION 'plots must contain between 1 and 10 entries';
  END IF;

  -- Idempotency: a retry with the same request_id returns the existing record.
  SELECT id INTO v_existing
    FROM registration_requests
   WHERE request_id = v_request_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'status', 'duplicate');
  END IF;

  INSERT INTO registration_requests (
    request_id, name, mobile, date_of_birth, aadhar_no, village, taluka,
    district, income_source, cluster_type, consent_given, consent_timestamp
  ) VALUES (
    v_request_id,
    p_payload->>'name',
    p_payload->>'mobile',
    (p_payload->>'date_of_birth')::date,
    p_payload->>'aadhar_no',
    p_payload->>'village',
    p_payload->>'taluka',
    p_payload->>'district',
    p_payload->>'income_source',
    p_payload->>'cluster_type',
    (p_payload->>'consent')::boolean,
    now()
  ) RETURNING id INTO v_req_pk;

  FOR v_plot IN SELECT * FROM jsonb_array_elements(p_payload->'plots')
  LOOP
    INSERT INTO registration_request_plots (
      request_id, plot_no, area_acres, crop_name, irrigation_source
    ) VALUES (
      v_req_pk,
      v_plot->>'plot_no',
      (v_plot->>'area_acres')::numeric,
      v_plot->>'crop_name',
      v_plot->>'irrigation_source'
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_req_pk, 'status', 'created');
END;
$$;

-- ============================================================
-- 7. Row Level Security: deny all client access
-- ============================================================
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_request_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_plots ENABLE ROW LEVEL SECURITY;

-- No permissive policies. The public (anon/authenticated) can neither
-- read, update, nor delete any of these tables. Staff use the Supabase
-- dashboard or an authenticated admin role with explicit policies.

-- ============================================================
-- 8. Privileges
-- ============================================================
-- No grants to anon/authenticated. Only service_role (and table owners)
-- can reach these tables. The RPC is executable by service_role only.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION submit_registration(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_registration(jsonb) TO service_role;
