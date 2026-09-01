-- ============================================================
-- Ganpati Agro — Admin performance migration
-- Run after supabase-schema.sql and admin-schema.sql.
-- This migration is additive and preserves the current RPC contracts.
-- ============================================================

-- Substring search (`ILIKE '%term%'`) cannot use a normal B-tree index.
-- These trigram indexes also accelerate partial mobile-number searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_registration_requests_status_created_at
  ON registration_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_requests_taluka_created_at
  ON registration_requests (taluka, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_requests_name_trgm
  ON registration_requests USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_registration_requests_mobile_trgm
  ON registration_requests USING gin (mobile gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_farmers_created_at
  ON farmers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmers_name_trgm
  ON farmers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_farmers_mobile_trgm
  ON farmers USING gin (mobile gin_trgm_ops);

-- List pages return the same JSON shape as before, but calculate the exact
-- total with a window function instead of making a separate table scan.
CREATE OR REPLACE FUNCTION admin_list_registrations(
  p_status TEXT DEFAULT NULL,
  p_taluka TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 20,
  p_offset INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows  jsonb;
  v_total bigint;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb),
         COALESCE(MAX(total), 0)
    INTO v_rows, v_total
    FROM (
      SELECT rr.created_at,
             count(*) OVER () AS total,
             jsonb_build_object(
               'id', rr.id, 'request_id', rr.request_id,
               'name', rr.name, 'mobile', rr.mobile,
               'date_of_birth', rr.date_of_birth,
               'village', rr.village, 'taluka', rr.taluka,
               'district', rr.district, 'income_source', rr.income_source,
               'cluster_type', rr.cluster_type, 'status', rr.status,
               'created_at', rr.created_at, 'reviewed_at', rr.reviewed_at,
               'reviewer_notes', rr.reviewer_notes
             ) AS row_data
        FROM registration_requests rr
       WHERE (p_status IS NULL OR rr.status = p_status)
         AND (p_taluka IS NULL OR rr.taluka = p_taluka)
         AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%'
                               OR rr.mobile ILIKE '%' || p_search || '%')
       ORDER BY rr.created_at DESC
       LIMIT LEAST(GREATEST(p_limit, 1), 100)
       OFFSET GREATEST(p_offset, 0)
    ) page;

  -- Preserve the total when a now-invalid final page is requested.
  IF v_total = 0 AND p_offset > 0 THEN
    SELECT count(*) INTO v_total
      FROM registration_requests rr
     WHERE (p_status IS NULL OR rr.status = p_status)
       AND (p_taluka IS NULL OR rr.taluka = p_taluka)
       AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%'
                             OR rr.mobile ILIKE '%' || p_search || '%');
  END IF;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_farmers(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 20,
  p_offset INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows  jsonb;
  v_total bigint;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb),
         COALESCE(MAX(total), 0)
    INTO v_rows, v_total
    FROM (
      SELECT f.created_at,
             count(*) OVER () AS total,
             jsonb_build_object(
               'id', f.id, 'name', f.name, 'mobile', f.mobile,
               'date_of_birth', f.date_of_birth,
               'village', f.village, 'taluka', f.taluka,
               'district', f.district, 'income_source', f.income_source,
               'cluster_type', f.cluster_type,
               'created_at', f.created_at
             ) AS row_data
        FROM farmers f
       WHERE (p_search IS NULL OR f.name ILIKE '%' || p_search || '%'
                               OR f.mobile ILIKE '%' || p_search || '%')
       ORDER BY f.created_at DESC
       LIMIT LEAST(GREATEST(p_limit, 1), 100)
       OFFSET GREATEST(p_offset, 0)
    ) page;

  IF v_total = 0 AND p_offset > 0 THEN
    SELECT count(*) INTO v_total
      FROM farmers f
     WHERE (p_search IS NULL OR f.name ILIKE '%' || p_search || '%'
                             OR f.mobile ILIKE '%' || p_search || '%');
  END IF;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

-- Combine the two registration aggregates into one scan. Farmers remain a
-- separate table scan, so the dashboard falls from three scans to two.
CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_counts jsonb;
  v_taluka_counts jsonb;
  v_farmer_count  bigint;
BEGIN
  WITH counts AS (
    SELECT status,
           taluka,
           count(*) AS count,
           GROUPING(status) AS status_grouped,
           GROUPING(taluka) AS taluka_grouped
      FROM registration_requests
     GROUP BY GROUPING SETS ((status), (taluka))
  )
  SELECT COALESCE(jsonb_object_agg(status, count) FILTER (WHERE taluka_grouped = 1), '{}'::jsonb),
         COALESCE(jsonb_object_agg(taluka, count) FILTER (WHERE status_grouped = 1), '{}'::jsonb)
    INTO v_status_counts, v_taluka_counts
    FROM counts;

  SELECT count(*) INTO v_farmer_count FROM farmers;

  RETURN jsonb_build_object(
    'registrations', v_status_counts,
    'by_taluka', v_taluka_counts,
    'total_farmers', v_farmer_count
  );
END;
$$;

-- Approval copies all plots in one INSERT ... SELECT instead of issuing one
-- INSERT statement for each plot.
CREATE OR REPLACE FUNCTION admin_approve_registration(
  p_id    UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg         RECORD;
  v_farmer_id   UUID;
  v_reviewed_at TIMESTAMPTZ := now();
BEGIN
  PERFORM set_config('app.admin_bypass', 'true', true);

  SELECT * INTO v_reg FROM registration_requests WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  IF v_reg.status != 'pending' THEN
    RAISE EXCEPTION 'Registration is already %', v_reg.status;
  END IF;

  -- Matches the current admin migration's mobile-based update behavior.
  SELECT id INTO v_farmer_id FROM farmers WHERE mobile = v_reg.mobile;
  IF v_farmer_id IS NOT NULL THEN
    UPDATE farmers SET
      name = v_reg.name,
      date_of_birth = v_reg.date_of_birth,
      aadhar_no = v_reg.aadhar_no,
      village = v_reg.village,
      taluka = v_reg.taluka,
      district = v_reg.district,
      income_source = v_reg.income_source,
      cluster_type = v_reg.cluster_type
    WHERE id = v_farmer_id;
  ELSE
    INSERT INTO farmers (name, mobile, date_of_birth, aadhar_no, village, taluka, district, income_source, cluster_type)
    VALUES (v_reg.name, v_reg.mobile, v_reg.date_of_birth, v_reg.aadhar_no,
            v_reg.village, v_reg.taluka, v_reg.district,
            v_reg.income_source, v_reg.cluster_type)
    RETURNING id INTO v_farmer_id;
  END IF;

  INSERT INTO farm_plots (farmer_id, plot_no, area_acres, crop_name, irrigation_source)
  SELECT v_farmer_id, plot_no, area_acres, crop_name, irrigation_source
    FROM registration_request_plots
   WHERE request_id = p_id;

  UPDATE registration_requests
     SET status = 'approved', reviewed_at = v_reviewed_at, reviewer_notes = p_notes
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'status', 'approved',
    'farmer_id', v_farmer_id,
    'reviewed_at', v_reviewed_at,
    'reviewer_notes', p_notes
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_registration(
  p_id    UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewed_at TIMESTAMPTZ := now();
BEGIN
  PERFORM set_config('app.admin_bypass', 'true', true);

  IF NOT EXISTS (SELECT 1 FROM registration_requests WHERE id = p_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;

  UPDATE registration_requests
     SET status = 'rejected', reviewed_at = v_reviewed_at, reviewer_notes = p_notes
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'status', 'rejected',
    'reviewed_at', v_reviewed_at,
    'reviewer_notes', p_notes
  );
END;
$$;

-- Exports do not need a total, so use dedicated paginated RPCs that avoid a
-- full COUNT/window calculation for every streamed batch.
CREATE OR REPLACE FUNCTION admin_export_registrations(
  p_status TEXT DEFAULT NULL,
  p_taluka TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 100,
  p_offset INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
    FROM (
      SELECT rr.created_at,
             jsonb_build_object(
               'name', rr.name, 'mobile', rr.mobile,
               'date_of_birth', rr.date_of_birth,
               'village', rr.village, 'taluka', rr.taluka,
               'district', rr.district, 'income_source', rr.income_source,
               'cluster_type', rr.cluster_type, 'status', rr.status,
               'created_at', rr.created_at
             ) AS row_data
        FROM registration_requests rr
       WHERE (p_status IS NULL OR rr.status = p_status)
         AND (p_taluka IS NULL OR rr.taluka = p_taluka)
         AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%'
                               OR rr.mobile ILIKE '%' || p_search || '%')
       ORDER BY rr.created_at DESC
       LIMIT LEAST(GREATEST(p_limit, 1), 100)
       OFFSET GREATEST(p_offset, 0)
    ) page;
$$;

CREATE OR REPLACE FUNCTION admin_export_farmers(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 100,
  p_offset INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
    FROM (
      SELECT f.created_at,
             jsonb_build_object(
               'name', f.name, 'mobile', f.mobile,
               'date_of_birth', f.date_of_birth,
               'village', f.village, 'taluka', f.taluka,
               'district', f.district, 'income_source', f.income_source,
               'cluster_type', f.cluster_type,
               'created_at', f.created_at
             ) AS row_data
        FROM farmers f
       WHERE (p_search IS NULL OR f.name ILIKE '%' || p_search || '%'
                               OR f.mobile ILIKE '%' || p_search || '%')
       ORDER BY f.created_at DESC
       LIMIT LEAST(GREATEST(p_limit, 1), 100)
       OFFSET GREATEST(p_offset, 0)
    ) page;
$$;

REVOKE EXECUTE ON FUNCTION admin_export_registrations FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_export_registrations TO service_role;
REVOKE EXECUTE ON FUNCTION admin_export_farmers FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_export_farmers TO service_role;
