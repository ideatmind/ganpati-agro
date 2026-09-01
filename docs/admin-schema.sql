-- ============================================================
-- Ganpati Agro — Admin Dashboard Schema Migration
-- Run AFTER the base schema (supabase-schema.sql)
-- ============================================================

-- ============================================================
-- 1. Add status tracking to registration_requests
-- ============================================================

-- First, replace the rigid append-only trigger with a smarter one
-- that allows status updates via admin RPCs while blocking data mutation.
CREATE OR REPLACE FUNCTION prevent_registration_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if called from an admin RPC (sets this session var)
  IF current_setting('app.admin_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'registration intake is append-only';
END;
$$ LANGUAGE plpgsql;

-- Add status and review columns
ALTER TABLE registration_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE registration_requests
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE registration_requests
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_registration_requests_status
  ON registration_requests (status);

-- ============================================================
-- 2. RPC: List registrations (paginated, filterable)
-- ============================================================
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
  -- Count
  SELECT count(*) INTO v_total
    FROM registration_requests rr
   WHERE (p_status IS NULL OR rr.status = p_status)
     AND (p_taluka IS NULL OR rr.taluka = p_taluka)
     AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%'
                           OR rr.mobile ILIKE '%' || p_search || '%');

  -- Rows with plots as nested array
  SELECT COALESCE(jsonb_agg(row_data ORDER BY rr_created DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT rr.id, rr.request_id, rr.name, rr.mobile, rr.date_of_birth,
             rr.village, rr.taluka, rr.district, rr.income_source,
             rr.cluster_type, rr.status, rr.created_at AS rr_created,
             rr.reviewed_at, rr.reviewer_notes,
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
       LIMIT p_limit OFFSET p_offset
    ) sub;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

-- ============================================================
-- 3. RPC: Get single registration with plots
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_registration(p_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg  jsonb;
  v_plots jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', rr.id, 'request_id', rr.request_id,
    'name', rr.name, 'mobile', rr.mobile,
    'date_of_birth', rr.date_of_birth,
    'aadhar_no', rr.aadhar_no,
    'village', rr.village, 'taluka', rr.taluka,
    'district', rr.district, 'income_source', rr.income_source,
    'cluster_type', rr.cluster_type, 'consent_given', rr.consent_given,
    'status', rr.status, 'source', rr.source,
    'created_at', rr.created_at, 'reviewed_at', rr.reviewed_at,
    'reviewer_notes', rr.reviewer_notes
  ) INTO v_reg
  FROM registration_requests rr
  WHERE rr.id = p_id;

  IF v_reg IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'plot_no', p.plot_no,
    'area_acres', p.area_acres, 'crop_name', p.crop_name,
    'irrigation_source', p.irrigation_source
  )), '[]'::jsonb) INTO v_plots
  FROM registration_request_plots p
  WHERE p.request_id = p_id;

  RETURN v_reg || jsonb_build_object('plots', v_plots);
END;
$$;

-- ============================================================
-- 4. RPC: Approve registration → copy to farmers + farm_plots
-- ============================================================
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
  v_reg       RECORD;
  v_farmer_id UUID;
  v_plot      RECORD;
BEGIN
  -- Enable bypass for the append-only trigger
  PERFORM set_config('app.admin_bypass', 'true', true);

  SELECT * INTO v_reg FROM registration_requests WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  IF v_reg.status != 'pending' THEN
    RAISE EXCEPTION 'Registration is already %', v_reg.status;
  END IF;

  -- Check if farmer already exists (by mobile)
  SELECT id INTO v_farmer_id FROM farmers WHERE mobile = v_reg.mobile;

  IF v_farmer_id IS NOT NULL THEN
    -- Update existing farmer
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
    -- Insert new farmer
    INSERT INTO farmers (name, mobile, date_of_birth, aadhar_no, village, taluka, district, income_source, cluster_type)
    VALUES (v_reg.name, v_reg.mobile, v_reg.date_of_birth, v_reg.aadhar_no,
            v_reg.village, v_reg.taluka, v_reg.district,
            v_reg.income_source, v_reg.cluster_type)
    RETURNING id INTO v_farmer_id;
  END IF;

  -- Copy plots
  FOR v_plot IN
    SELECT * FROM registration_request_plots WHERE request_id = p_id
  LOOP
    INSERT INTO farm_plots (farmer_id, plot_no, area_acres, crop_name, irrigation_source)
    VALUES (v_farmer_id, v_plot.plot_no, v_plot.area_acres, v_plot.crop_name, v_plot.irrigation_source);
  END LOOP;

  -- Update status
  UPDATE registration_requests
     SET status = 'approved', reviewed_at = now(), reviewer_notes = p_notes
   WHERE id = p_id;

  RETURN jsonb_build_object('status', 'approved', 'farmer_id', v_farmer_id);
END;
$$;

-- ============================================================
-- 5. RPC: Reject registration
-- ============================================================
CREATE OR REPLACE FUNCTION admin_reject_registration(
  p_id    UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.admin_bypass', 'true', true);

  IF NOT EXISTS (SELECT 1 FROM registration_requests WHERE id = p_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;

  UPDATE registration_requests
     SET status = 'rejected', reviewed_at = now(), reviewer_notes = p_notes
   WHERE id = p_id;

  RETURN jsonb_build_object('status', 'rejected');
END;
$$;

-- ============================================================
-- 6. RPC: Dashboard stats
-- ============================================================
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
  SELECT jsonb_object_agg(status, cnt) INTO v_status_counts
    FROM (SELECT status, count(*) AS cnt FROM registration_requests GROUP BY status) sub;

  SELECT jsonb_object_agg(taluka, cnt) INTO v_taluka_counts
    FROM (SELECT taluka, count(*) AS cnt FROM registration_requests GROUP BY taluka) sub;

  SELECT count(*) INTO v_farmer_count FROM farmers;

  RETURN jsonb_build_object(
    'registrations', COALESCE(v_status_counts, '{}'::jsonb),
    'by_taluka', COALESCE(v_taluka_counts, '{}'::jsonb),
    'total_farmers', v_farmer_count
  );
END;
$$;

-- ============================================================
-- 7. RPC: List approved farmers
-- ============================================================
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
  SELECT count(*) INTO v_total
    FROM farmers f
   WHERE (p_search IS NULL OR f.name ILIKE '%' || p_search || '%'
                           OR f.mobile ILIKE '%' || p_search || '%');

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT f.created_at AS created,
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
       LIMIT p_limit OFFSET p_offset
    ) sub;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

-- ============================================================
-- 8. Privileges: grant execute to service_role only
-- ============================================================
REVOKE EXECUTE ON FUNCTION admin_list_registrations FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_registrations TO service_role;

REVOKE EXECUTE ON FUNCTION admin_get_registration FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_registration TO service_role;

REVOKE EXECUTE ON FUNCTION admin_approve_registration FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_approve_registration TO service_role;

REVOKE EXECUTE ON FUNCTION admin_reject_registration FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_registration TO service_role;

REVOKE EXECUTE ON FUNCTION admin_dashboard_stats FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_dashboard_stats TO service_role;

REVOKE EXECUTE ON FUNCTION admin_list_farmers FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_farmers TO service_role;
