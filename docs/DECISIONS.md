# Decisions

## 2026-09-13

- Membership activates automatically after successful ₹500 payment.
- Employees may collect cash, keep it, and pay the company online from their personal account.
- Farmer and employee referrals ship in the current release.
- Default referral commission is 10% for all eligible referrers.
- Farmer referral receives commission when an employee assists; the employee receives onboarding-count credit.
- Referral payouts and claims happen offline; the application only records and displays completed payouts.
- Authentication uses mobile number and password.
- Farmers receive referral, earnings, and payout views rather than a general farmer-management dashboard.
- Mobile and Aadhaar are unique. Current farmer and plot fields remain.
- Managers and super admins edit farmer details; employees require scoped temporary access.
- The system starts with a fresh Supabase project and does not migrate legacy records.
- Receipts render on-device; only the small receipt record is retained.
