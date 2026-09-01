-- Ganpati Agro multi-admin, roles and audit trail migration.
-- Run after supabase-schema.sql, admin-schema.sql and admin-performance-migration.sql.
-- Uses the existing SECURITY DEFINER + service_role access pattern.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,64}$'),
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT NULL,
  target_id TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id_created_at ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at ON admin_audit_log (action, created_at DESC);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies: all access remains through service_role-called RPCs.

CREATE OR REPLACE FUNCTION prevent_registration_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.admin_bypass', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'registration intake is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION admin_require(p_admin_id UUID, p_super_admin BOOLEAN DEFAULT false)
RETURNS admin_users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users;
BEGIN
  SELECT * INTO v_admin FROM admin_users WHERE id = p_admin_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active admin session required'; END IF;
  IF p_super_admin AND v_admin.role <> 'super_admin' THEN RAISE EXCEPTION 'Super-admin role required'; END IF;
  RETURN v_admin;
END;
$$;

CREATE OR REPLACE FUNCTION admin_write_audit(
  p_admin admin_users, p_action TEXT, p_target_table TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL, p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO admin_audit_log (admin_id, admin_username, action, target_table, target_id, details)
  VALUES (p_admin.id, p_admin.username, p_action, p_target_table, p_target_id, COALESCE(p_details, '{}'::jsonb));
$$;

-- Authentication is deliberately in the database: pgcrypto bcrypt verifies
-- and stores password hashes without ever persisting plaintext credentials.
CREATE OR REPLACE FUNCTION admin_authenticate(p_username TEXT, p_password TEXT, p_ip TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin admin_users; v_clean_username TEXT;
BEGIN
  v_clean_username := lower(trim(p_username));
  SELECT * INTO v_admin FROM admin_users WHERE username = v_clean_username;
  IF NOT FOUND THEN
    INSERT INTO admin_audit_log (admin_username, action, details)
    VALUES (v_clean_username, 'login_failed',
            jsonb_build_object('outcome', 'failed', 'reason', 'unknown_user', 'ip', p_ip));
    RETURN NULL;
  END IF;
  IF NOT v_admin.is_active THEN
    INSERT INTO admin_audit_log (admin_id, admin_username, action, details)
    VALUES (v_admin.id, v_admin.username, 'login_failed',
            jsonb_build_object('outcome', 'failed', 'reason', 'inactive', 'ip', p_ip));
    RETURN NULL;
  END IF;
  -- pgcrypto's crypt() derives the salt from the stored hash, so only the
  -- hash is compared here. Plaintext credentials are never persisted.
  IF crypt(p_password, v_admin.password_hash) <> v_admin.password_hash THEN
    INSERT INTO admin_audit_log (admin_id, admin_username, action, details)
    VALUES (v_admin.id, v_admin.username, 'login_failed',
            jsonb_build_object('outcome', 'failed', 'reason', 'bad_password', 'ip', p_ip));
    RETURN NULL;
  END IF;
  INSERT INTO admin_audit_log (admin_id, admin_username, action, details)
  VALUES (v_admin.id, v_admin.username, 'login', jsonb_build_object('outcome', 'success', 'ip', p_ip));
  RETURN jsonb_build_object('id', v_admin.id, 'username', v_admin.username,
                            'display_name', v_admin.display_name, 'role', v_admin.role);
END;
$$;

-- Re-checks an existing session against the accounts table so a deactivated
-- admin cannot keep using a still-unexpired signed cookie.
CREATE OR REPLACE FUNCTION admin_verify_session(p_admin_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', id, 'username', username, 'display_name', display_name, 'role', role)
  FROM admin_users
  WHERE id = p_admin_id AND is_active = true;
$$;

DROP FUNCTION IF EXISTS admin_list_registrations(TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS admin_get_registration(UUID);
DROP FUNCTION IF EXISTS admin_approve_registration(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_reject_registration(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_dashboard_stats();
DROP FUNCTION IF EXISTS admin_list_farmers(TEXT, INT, INT);
DROP FUNCTION IF EXISTS admin_export_registrations(TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS admin_export_farmers(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION admin_list_registrations(p_admin_id UUID, p_status TEXT DEFAULT NULL, p_taluka TEXT DEFAULT NULL, p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSONB; v_total BIGINT;
BEGIN
  PERFORM admin_require(p_admin_id);
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb), COALESCE(MAX(total), 0)
  INTO v_rows, v_total FROM (
    SELECT rr.created_at, count(*) OVER () total, jsonb_build_object(
      'id', rr.id, 'request_id', rr.request_id, 'name', rr.name, 'mobile', rr.mobile,
      'date_of_birth', rr.date_of_birth, 'village', rr.village, 'taluka', rr.taluka,
      'district', rr.district, 'income_source', rr.income_source, 'cluster_type', rr.cluster_type,
      'status', rr.status, 'created_at', rr.created_at, 'reviewed_at', rr.reviewed_at,
      'reviewer_notes', rr.reviewer_notes) row_data
    FROM registration_requests rr WHERE (p_status IS NULL OR rr.status = p_status)
      AND (p_taluka IS NULL OR rr.taluka = p_taluka)
      AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%' OR rr.mobile ILIKE '%' || p_search || '%')
    ORDER BY rr.created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0)
  ) page;
  IF v_total = 0 AND p_offset > 0 THEN
    SELECT count(*) INTO v_total FROM registration_requests rr WHERE (p_status IS NULL OR rr.status = p_status)
      AND (p_taluka IS NULL OR rr.taluka = p_taluka)
      AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%' OR rr.mobile ILIKE '%' || p_search || '%');
  END IF;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_registration(p_admin_id UUID, p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg JSONB; v_plots JSONB;
BEGIN
  PERFORM admin_require(p_admin_id);
  SELECT jsonb_build_object('id', rr.id, 'request_id', rr.request_id, 'name', rr.name, 'mobile', rr.mobile,
    'date_of_birth', rr.date_of_birth, 'aadhar_no', rr.aadhar_no, 'village', rr.village, 'taluka', rr.taluka,
    'district', rr.district, 'income_source', rr.income_source, 'cluster_type', rr.cluster_type,
    'consent_given', rr.consent_given, 'status', rr.status, 'source', rr.source, 'created_at', rr.created_at,
    'reviewed_at', rr.reviewed_at, 'reviewer_notes', rr.reviewer_notes) INTO v_reg FROM registration_requests rr WHERE rr.id = p_id;
  IF v_reg IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'plot_no', p.plot_no, 'area_acres', p.area_acres,
    'crop_name', p.crop_name, 'irrigation_source', p.irrigation_source)), '[]'::jsonb) INTO v_plots
  FROM registration_request_plots p WHERE p.request_id = p_id;
  RETURN v_reg || jsonb_build_object('plots', v_plots);
END;
$$;

CREATE OR REPLACE FUNCTION admin_approve_registration(p_admin_id UUID, p_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users; v_reg registration_requests; v_farmer_id UUID; v_reviewed_at TIMESTAMPTZ := now();
BEGIN
  v_admin := admin_require(p_admin_id); PERFORM set_config('app.admin_bypass', 'true', true);
  SELECT * INTO v_reg FROM registration_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_reg.status <> 'pending' THEN RAISE EXCEPTION 'Registration not found or already processed'; END IF;
  SELECT id INTO v_farmer_id FROM farmers WHERE mobile = v_reg.mobile;
  IF v_farmer_id IS NULL THEN
    INSERT INTO farmers (name, mobile, date_of_birth, aadhar_no, village, taluka, district, income_source, cluster_type)
    VALUES (v_reg.name, v_reg.mobile, v_reg.date_of_birth, v_reg.aadhar_no, v_reg.village, v_reg.taluka, v_reg.district, v_reg.income_source, v_reg.cluster_type) RETURNING id INTO v_farmer_id;
  ELSE
    UPDATE farmers SET name=v_reg.name, date_of_birth=v_reg.date_of_birth, aadhar_no=v_reg.aadhar_no, village=v_reg.village,
      taluka=v_reg.taluka, district=v_reg.district, income_source=v_reg.income_source, cluster_type=v_reg.cluster_type WHERE id=v_farmer_id;
  END IF;
  -- Remove old plots for this farmer to avoid duplicates on re-approval
  DELETE FROM farm_plots WHERE farmer_id = v_farmer_id;
  INSERT INTO farm_plots (farmer_id, plot_no, area_acres, crop_name, irrigation_source)
    SELECT v_farmer_id, plot_no, area_acres, crop_name, irrigation_source FROM registration_request_plots WHERE request_id=p_id;
  UPDATE registration_requests SET status='approved', reviewed_at=v_reviewed_at, reviewer_notes=NULLIF(left(trim(COALESCE(p_notes, '')), 1000), '') WHERE id=p_id;
  PERFORM admin_write_audit(v_admin, 'approve_registration', 'registration_requests', p_id::text, jsonb_build_object('farmer_id', v_farmer_id, 'notes', p_notes));
  RETURN jsonb_build_object('status', 'approved', 'farmer_id', v_farmer_id);
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_registration(p_admin_id UUID, p_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users;
BEGIN
  v_admin := admin_require(p_admin_id); PERFORM set_config('app.admin_bypass', 'true', true);
  IF NOT EXISTS (SELECT 1 FROM registration_requests WHERE id=p_id AND status='pending') THEN RAISE EXCEPTION 'Registration not found or already processed'; END IF;
  UPDATE registration_requests SET status='rejected', reviewed_at=now(), reviewer_notes=NULLIF(left(trim(COALESCE(p_notes, '')), 1000), '') WHERE id=p_id;
  PERFORM admin_write_audit(v_admin, 'reject_registration', 'registration_requests', p_id::text, jsonb_build_object('notes', p_notes));
  RETURN jsonb_build_object('status', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION admin_dashboard_stats(p_admin_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status JSONB; v_taluka JSONB; v_farmers BIGINT;
BEGIN
  PERFORM admin_require(p_admin_id);
  SELECT COALESCE(jsonb_object_agg(status, count), '{}'::jsonb) INTO v_status FROM (SELECT status, count(*) FROM registration_requests GROUP BY status) s;
  SELECT COALESCE(jsonb_object_agg(taluka, count), '{}'::jsonb) INTO v_taluka FROM (SELECT taluka, count(*) FROM registration_requests GROUP BY taluka) t;
  SELECT count(*) INTO v_farmers FROM farmers;
  RETURN jsonb_build_object('registrations', v_status, 'by_taluka', v_taluka, 'total_farmers', v_farmers);
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_farmers(p_admin_id UUID, p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSONB; v_total BIGINT;
BEGIN
  PERFORM admin_require(p_admin_id);
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb), COALESCE(MAX(total), 0) INTO v_rows, v_total FROM (
    SELECT f.created_at, count(*) OVER () total, jsonb_build_object('id',f.id,'name',f.name,'mobile',f.mobile,'date_of_birth',f.date_of_birth,'village',f.village,'taluka',f.taluka,'district',f.district,'income_source',f.income_source,'cluster_type',f.cluster_type,'created_at',f.created_at) row_data
    FROM farmers f WHERE p_search IS NULL OR f.name ILIKE '%' || p_search || '%' OR f.mobile ILIKE '%' || p_search || '%'
    ORDER BY f.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)
  ) page;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION admin_export_registrations(p_admin_id UUID, p_status TEXT DEFAULT NULL, p_taluka TEXT DEFAULT NULL, p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS TABLE(name TEXT, mobile VARCHAR, date_of_birth DATE, village TEXT, taluka TEXT, district TEXT, income_source TEXT, cluster_type TEXT, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM admin_require(p_admin_id);
  RETURN QUERY SELECT rr.name, rr.mobile, rr.date_of_birth, rr.village, rr.taluka, rr.district, rr.income_source, rr.cluster_type, rr.status, rr.created_at
  FROM registration_requests rr WHERE (p_status IS NULL OR rr.status=p_status) AND (p_taluka IS NULL OR rr.taluka=p_taluka)
    AND (p_search IS NULL OR rr.name ILIKE '%' || p_search || '%' OR rr.mobile ILIKE '%' || p_search || '%')
  ORDER BY rr.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0);
END;
$$;

CREATE OR REPLACE FUNCTION admin_export_farmers(p_admin_id UUID, p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS TABLE(name TEXT, mobile VARCHAR, date_of_birth DATE, village TEXT, taluka TEXT, district TEXT, income_source TEXT, cluster_type TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM admin_require(p_admin_id);
  RETURN QUERY SELECT f.name, f.mobile, f.date_of_birth, f.village, f.taluka, f.district, f.income_source, f.cluster_type, f.created_at
  FROM farmers f WHERE p_search IS NULL OR f.name ILIKE '%' || p_search || '%' OR f.mobile ILIKE '%' || p_search || '%'
  ORDER BY f.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0);
END;
$$;

CREATE OR REPLACE FUNCTION admin_edit_registration(
  p_admin_id UUID, p_id UUID, p_name TEXT, p_mobile TEXT, p_date_of_birth TEXT,
  p_village TEXT, p_taluka TEXT, p_district TEXT, p_income_source TEXT, p_cluster_type TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users; v_before registration_requests; v_after registration_requests;
BEGIN
  v_admin := admin_require(p_admin_id); PERFORM set_config('app.admin_bypass', 'true', true);
  SELECT * INTO v_before FROM registration_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_before.status <> 'pending' THEN RAISE EXCEPTION 'Only pending registrations can be edited'; END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 1 AND 200 OR char_length(trim(p_village)) NOT BETWEEN 1 AND 200
     OR char_length(trim(p_district)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid name, village or district'; END IF;
  IF p_mobile !~ '^[0-9]{10}$' THEN RAISE EXCEPTION 'Invalid mobile number'; END IF;
  IF p_date_of_birth !~ '^\d{4}-\d{2}-\d{2}$' OR (p_date_of_birth::date) > CURRENT_DATE THEN RAISE EXCEPTION 'Invalid date of birth'; END IF;
  IF p_taluka NOT IN ('dharashiv','tuljapur','umarga','lohara','kalamb','washi','bhum','paranda','other') THEN RAISE EXCEPTION 'Invalid taluka'; END IF;
  IF p_income_source NOT IN ('agriculture','business','job','other') THEN RAISE EXCEPTION 'Invalid income source'; END IF;
  IF p_cluster_type NOT IN ('pulses','cereals','cash','fruits','vegs','allied') THEN RAISE EXCEPTION 'Invalid cluster type'; END IF;
  UPDATE registration_requests SET
    name = left(trim(p_name), 200), mobile = trim(p_mobile), date_of_birth = p_date_of_birth::date,
    village = left(trim(p_village), 200), taluka = p_taluka, district = left(trim(p_district), 200),
    income_source = p_income_source, cluster_type = p_cluster_type
  WHERE id = p_id RETURNING * INTO v_after;
  PERFORM admin_write_audit(v_admin, 'edit_registration', 'registration_requests', p_id::text,
    jsonb_build_object('name', v_after.name, 'mobile', v_after.mobile, 'taluka', v_after.taluka,
                       'income_source', v_after.income_source, 'cluster_type', v_after.cluster_type));
  RETURN jsonb_build_object('id', v_after.id, 'status', v_after.status);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_registration(p_admin_id UUID, p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users; v_reg registration_requests;
BEGIN
  v_admin := admin_require(p_admin_id); PERFORM set_config('app.admin_bypass', 'true', true);
  SELECT * INTO v_reg FROM registration_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_reg.status = 'approved' THEN RAISE EXCEPTION 'Approved registrations cannot be deleted'; END IF;
  PERFORM admin_write_audit(v_admin, 'delete_registration', 'registration_requests', p_id::text,
    jsonb_build_object('request_id', v_reg.request_id, 'name', v_reg.name, 'status', v_reg.status));
  DELETE FROM registration_requests WHERE id = p_id;
  RETURN jsonb_build_object('status', 'deleted');
END;
$$;

CREATE OR REPLACE FUNCTION admin_edit_farmer(
  p_admin_id UUID, p_id UUID, p_name TEXT, p_mobile TEXT, p_date_of_birth TEXT,
  p_village TEXT, p_taluka TEXT, p_district TEXT, p_income_source TEXT, p_cluster_type TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users; v_before farmers; v_after farmers;
BEGIN
  v_admin := admin_require(p_admin_id);
  SELECT * INTO v_before FROM farmers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 1 AND 200 OR char_length(trim(p_village)) NOT BETWEEN 1 AND 200
     OR char_length(trim(p_district)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid name, village or district'; END IF;
  IF p_mobile !~ '^[0-9]{10}$' THEN RAISE EXCEPTION 'Invalid mobile number'; END IF;
  IF p_date_of_birth !~ '^\d{4}-\d{2}-\d{2}$' OR (p_date_of_birth::date) > CURRENT_DATE THEN RAISE EXCEPTION 'Invalid date of birth'; END IF;
  IF p_taluka NOT IN ('dharashiv','tuljapur','umarga','lohara','kalamb','washi','bhum','paranda','other') THEN RAISE EXCEPTION 'Invalid taluka'; END IF;
  IF p_income_source NOT IN ('agriculture','business','job','other') THEN RAISE EXCEPTION 'Invalid income source'; END IF;
  IF p_cluster_type NOT IN ('pulses','cereals','cash','fruits','vegs','allied') THEN RAISE EXCEPTION 'Invalid cluster type'; END IF;
  UPDATE farmers SET
    name = left(trim(p_name), 200), mobile = trim(p_mobile), date_of_birth = p_date_of_birth::date,
    village = left(trim(p_village), 200), taluka = p_taluka, district = left(trim(p_district), 200),
    income_source = p_income_source, cluster_type = p_cluster_type
  WHERE id = p_id RETURNING * INTO v_after;
  PERFORM admin_write_audit(v_admin, 'edit_farmer', 'farmers', p_id::text,
    jsonb_build_object('name', v_after.name, 'mobile', v_after.mobile, 'taluka', v_after.taluka,
                       'income_source', v_after.income_source, 'cluster_type', v_after.cluster_type));
  RETURN jsonb_build_object('id', v_after.id);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_farmer(p_admin_id UUID, p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin admin_users; v_farmer farmers;
BEGIN
  v_admin := admin_require(p_admin_id);
  SELECT * INTO v_farmer FROM farmers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  PERFORM admin_write_audit(v_admin, 'delete_farmer', 'farmers', p_id::text,
    jsonb_build_object('name', v_farmer.name, 'mobile', v_farmer.mobile));
  DELETE FROM farmers WHERE id = p_id;
  RETURN jsonb_build_object('status', 'deleted');
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_users(p_admin_id UUID, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSONB; v_total BIGINT;
BEGIN
  PERFORM admin_require(p_admin_id, true);
  SELECT count(*) INTO v_total FROM admin_users;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'username',username,'display_name',display_name,'role',role,'is_active',is_active,'created_at',created_at,'created_by',created_by) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_rows FROM (SELECT * FROM admin_users ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)) u;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_user(p_admin_id UUID, p_username TEXT, p_password TEXT, p_display_name TEXT, p_role TEXT DEFAULT 'admin')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin admin_users; v_user admin_users;
BEGIN
  v_admin := admin_require(p_admin_id, true);
  IF lower(trim(p_username)) !~ '^[a-z0-9._-]{3,64}$' OR char_length(p_password) < 3 OR p_role NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Invalid admin account values'; END IF;
  INSERT INTO admin_users (username,password_hash,display_name,role,created_by) VALUES (lower(trim(p_username)),crypt(p_password,gen_salt('bf',10)),left(trim(p_display_name),120),p_role,v_admin.id) RETURNING * INTO v_user;
  PERFORM admin_write_audit(v_admin,'create_admin','admin_users',v_user.id::text,jsonb_build_object('username',v_user.username,'role',v_user.role));
  RETURN jsonb_build_object('id',v_user.id,'username',v_user.username,'display_name',v_user.display_name,'role',v_user.role,'is_active',v_user.is_active,'created_at',v_user.created_at,'created_by',v_user.created_by);
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_user(p_admin_id UUID, p_target_id UUID, p_display_name TEXT DEFAULT NULL, p_role TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL, p_password TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin admin_users; v_before admin_users; v_after admin_users;
BEGIN
  v_admin := admin_require(p_admin_id, true); SELECT * INTO v_before FROM admin_users WHERE id=p_target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin account not found'; END IF;
  IF v_before.id=v_admin.id AND p_is_active=false THEN RAISE EXCEPTION 'You cannot deactivate your own account'; END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_password IS NOT NULL AND char_length(p_password)<3 THEN RAISE EXCEPTION 'Password must contain at least 3 characters'; END IF;
  UPDATE admin_users SET display_name=COALESCE(left(NULLIF(trim(p_display_name),''),120),display_name), role=COALESCE(p_role,role), is_active=COALESCE(p_is_active,is_active), password_hash=CASE WHEN p_password IS NULL THEN password_hash ELSE crypt(p_password,gen_salt('bf',10)) END WHERE id=p_target_id RETURNING * INTO v_after;
  PERFORM admin_write_audit(v_admin,CASE WHEN p_is_active=false THEN 'deactivate_admin' WHEN p_password IS NOT NULL THEN 'reset_admin_password' ELSE 'edit_admin' END,'admin_users',v_after.id::text,jsonb_strip_nulls(jsonb_build_object('display_name',CASE WHEN v_before.display_name<>v_after.display_name THEN v_after.display_name END,'role',CASE WHEN v_before.role<>v_after.role THEN v_after.role END,'is_active',CASE WHEN v_before.is_active<>v_after.is_active THEN v_after.is_active END)));
  RETURN jsonb_build_object('id',v_after.id,'username',v_after.username,'display_name',v_after.display_name,'role',v_after.role,'is_active',v_after.is_active,'created_at',v_after.created_at,'created_by',v_after.created_by);
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_audit_log(p_admin_id UUID, p_username TEXT DEFAULT NULL, p_action TEXT DEFAULT NULL, p_from TIMESTAMPTZ DEFAULT NULL, p_to TIMESTAMPTZ DEFAULT NULL, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSONB; v_total BIGINT;
BEGIN
  PERFORM admin_require(p_admin_id, true);
  SELECT count(*) INTO v_total FROM admin_audit_log l WHERE (p_username IS NULL OR l.admin_username=p_username) AND (p_action IS NULL OR l.action=p_action) AND (p_from IS NULL OR l.created_at>=p_from) AND (p_to IS NULL OR l.created_at<p_to);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'admin_id',admin_id,'admin_username',admin_username,'action',action,'target_table',target_table,'target_id',target_id,'details',details,'created_at',created_at) ORDER BY created_at DESC),'[]'::jsonb) INTO v_rows FROM (SELECT * FROM admin_audit_log l WHERE (p_username IS NULL OR l.admin_username=p_username) AND (p_action IS NULL OR l.action=p_action) AND (p_from IS NULL OR l.created_at>=p_from) AND (p_to IS NULL OR l.created_at<p_to) ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)) page;
  RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;

-- Table-level access control matching existing pattern
REVOKE ALL ON TABLE admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE admin_audit_log FROM anon, authenticated;

-- Service-role-only RPC exposure, matching the existing admin schema pattern.
REVOKE ALL ON FUNCTION admin_require(UUID, BOOLEAN), admin_write_audit(admin_users,TEXT,TEXT,TEXT,JSONB), admin_authenticate(TEXT,TEXT,TEXT), admin_verify_session(UUID), admin_list_registrations(UUID,TEXT,TEXT,TEXT,INT,INT), admin_get_registration(UUID,UUID), admin_approve_registration(UUID,UUID,TEXT), admin_reject_registration(UUID,UUID,TEXT), admin_edit_registration(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), admin_delete_registration(UUID,UUID), admin_dashboard_stats(UUID), admin_list_farmers(UUID,TEXT,INT,INT), admin_edit_farmer(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), admin_delete_farmer(UUID,UUID), admin_export_registrations(UUID,TEXT,TEXT,TEXT,INT,INT), admin_export_farmers(UUID,TEXT,INT,INT), admin_list_users(UUID,INT,INT), admin_create_user(UUID,TEXT,TEXT,TEXT,TEXT), admin_update_user(UUID,UUID,TEXT,TEXT,BOOLEAN,TEXT), admin_list_audit_log(UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INT,INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_authenticate(TEXT,TEXT,TEXT), admin_verify_session(UUID), admin_list_registrations(UUID,TEXT,TEXT,TEXT,INT,INT), admin_get_registration(UUID,UUID), admin_approve_registration(UUID,UUID,TEXT), admin_reject_registration(UUID,UUID,TEXT), admin_edit_registration(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), admin_delete_registration(UUID,UUID), admin_dashboard_stats(UUID), admin_list_farmers(UUID,TEXT,INT,INT), admin_edit_farmer(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), admin_delete_farmer(UUID,UUID), admin_export_registrations(UUID,TEXT,TEXT,TEXT,INT,INT), admin_export_farmers(UUID,TEXT,INT,INT), admin_list_users(UUID,INT,INT), admin_create_user(UUID,TEXT,TEXT,TEXT,TEXT), admin_update_user(UUID,UUID,TEXT,TEXT,BOOLEAN,TEXT), admin_list_audit_log(UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INT,INT) TO service_role;
