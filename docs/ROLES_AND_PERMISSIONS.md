# Roles and permissions

| Capability | Farmer referrer | Employee | Manager | Super admin |
|---|---:|---:|---:|---:|
| View own referral earnings/payouts | Yes | Yes | Yes | Yes |
| Create assisted registration | No | Yes | Yes | Yes |
| View onboarded farmers | No | Own | All | All |
| Edit paid farmer | No | Temporary grant | Yes | Yes |
| Record offline referral payout | No | No | Yes | Yes |
| Manage temporary grants | No | No | Yes | Yes |
| Manage employee accounts/roles | No | No | No | Yes |
| Change future fee/rate | No | No | No | Yes |
| View full audit/payment exceptions | No | No | Operational | Yes |

All authorization is enforced on the server. Navigation visibility is only a user-interface convenience.

## Role-aware navigation — 16 September 2026

Managers and super admins land in the operations workspace. Their own referrals and onboarding history remain at `/dashboard?personal=1`; employees and farmer referrers continue to land on their scoped dashboard. Managers may view team activity but cannot create or activate/deactivate staff. Staff administration and Trash remain super-admin-only, with protected staff targets hidden and independently rejected by the database.

The same admin navigation configuration drives desktop/mobile visibility. UI labels and redirects do not replace signed-session, active-account, row-scope or temporary-grant checks. No new role, grant field, financial operation or system-setting permission was introduced. See [role matrix and pre-change audit](ROLE_UI_AUDIT_20260916.md) and [remediation report](ROLE_UI_REMEDIATION_20260916.md).
