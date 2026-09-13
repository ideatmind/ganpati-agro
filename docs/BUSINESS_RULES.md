# Business rules

1. A normalized mobile number identifies one person and must be unique.
2. An Aadhaar lookup fingerprint identifies one person and must be unique; the number is encrypted and never returned after registration.
3. A registration snapshots its ₹500 fee and applicable referral rate before checkout.
4. One registration can have multiple payment attempts but only one successful completion.
5. Only a verified, captured payment for the expected order, amount, and currency activates membership.
6. Payment completion creates exactly one farmer, membership, receipt, and optional referral earning.
7. Farmer referral attribution takes precedence when an employee assists a referred farmer. The employee still receives onboarding-count attribution.
8. Self-referrals and referral changes after checkout begins are rejected.
9. Employee cash receipt does not mark a fee paid; only confirmed online payment does.
10. Referral earnings use the snapshotted basis points and fee amount.
11. Referrers can view earnings and payouts but cannot create payout requests.
12. Employees see only registrations and farmers they onboarded.
13. Only managers and super admins can normally edit paid farmer data.
14. A scoped grant may temporarily authorize a named employee to edit a specific farmer before its expiry.
15. Financial records and audit events are retained and corrected with traceable adjustments.
16. No customer refund flow is offered. Provider disputes, reversals, and duplicate-charge exceptions remain visible to super admin.
