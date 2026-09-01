-- Run after admin-accounts-audit-migration.sql. Testing-only credentials:
-- superadmin / ganpati, admin1 / admin1, admin2 / admin2,
-- admin3 / admin3, admin4 / admin4. Change these before any real deployment.
-- pgcrypto lives in the `extensions` schema on Supabase.
SET search_path = public, extensions;
WITH super_admin AS (
  INSERT INTO admin_users (username, password_hash, display_name, role)
  VALUES ('superadmin', crypt('ganpati', gen_salt('bf', 10)), 'Super Admin', 'super_admin')
  ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
  RETURNING id
)
INSERT INTO admin_users (username, password_hash, display_name, role, created_by)
SELECT v.username, crypt(v.password, gen_salt('bf', 10)), v.display_name, 'admin', super_admin.id
FROM super_admin
CROSS JOIN (VALUES
  ('admin1', 'admin1', 'Admin 1'),
  ('admin2', 'admin2', 'Admin 2'),
  ('admin3', 'admin3', 'Admin 3'),
  ('admin4', 'admin4', 'Admin 4')
) AS v(username, password, display_name)
ON CONFLICT (username) DO NOTHING;
