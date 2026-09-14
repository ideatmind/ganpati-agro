# Business rules

1. A normalized mobile number identifies one person and must be unique.
2. An Aadhaar lookup fingerprint identifies one person and must be unique. The number is encrypted; only an active super administrator may explicitly reveal it on a registration detail page. Every reveal is audited without the number. It is excluded from ordinary page payloads, logs, receipts and CSV exports; the revealed value clears when the page is hidden or after 60 seconds. Passwords are hashed and cannot be displayed.
3. A registration snapshots its current fee and applicable referral rate before checkout. New live-trial registrations use ₹1 (100 paise); previous ₹500 snapshots remain unchanged.
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
14. A scoped grant may temporarily authorize a named employee to edit a specific farmer they onboarded before its expiry; it cannot grant access to another employee's farmers.
15. Financial records and audit events are retained and corrected with traceable adjustments.
16. No customer/admin refund flow or automatic financial adjustment is offered. Provider refunds, disputes, reversals, chargebacks, corrections and duplicate-charge exceptions are retained in the operational review view without changing original payments, memberships or earnings.
17. Order creation is reserved once per registration. Repeated requests reuse its bound order; an uncertain creation result requires reconciliation rather than an automatic replacement order.
18. A repeated captured payment creates no duplicate entitlement. A different captured payment for a completed registration is retained and flagged for financial review.
19. Repeating an offline payout request with the same UUID and payload returns the same payout. A changed payload under that UUID is rejected, and concurrent deductions are serialized against the referrer's balance.
20. Matching registration retries may resume an existing checkout without changing its fee, commission, referral or submitted person details.

21. Only super-admins manage employee/manager activation. Deactivation revokes existing sessions; staff cannot deactivate themselves or another super-admin through this workflow.
22. Managers and super-admins can revoke an employee's scoped edit grant before expiry. Revocation takes effect on subsequent authorized operations.
23. Admin provider reconciliation fetches authoritative state and can finalize an existing verified capture. It never initiates refunds or creates a replacement order for an uncertain reservation.

Rules 17–23 and the strengthened grant/session controls are locally tested in the MVP revision; coordinated production deployment remains pending. See PROJECT_STATUS.md and the production runbook for release status.

24. Super-admin bulk removal moves registrations to recoverable Trash with an audited reason stored on the archive record. It does not remove payment or membership history, cancel checkout, or prevent capture finalization. Restoring returns the record to active operational lists. Explicit batches accept at most 100 IDs and roll back on an invalid item. Super admin can select every matching registration across all pages; deleting more than 25 selected records, or any all-matching selection, requires that admin’s current password. The server resolves the selection and checks its count before mutation.

25. New and changed passwords require at least 8 characters and at most 72 UTF-8 bytes for every role. Mobile must contain exactly 10 ASCII digits and Aadhaar exactly 12, without whitespace, punctuation or other characters.


26. Registration crop choices and cluster names use the owner-supplied 13-category catalog in `src/shared/crop-catalog.ts`. Each plot selects a listed crop from grouped categories independently of the profile cluster. The profile cluster remains a single selection. New registrations reject unlisted crop names at the API boundary; existing saved crop text is retained. The duplicate fruit spelling सिताफळ is presented once as सीताफळ. Existing six cluster identifiers remain compatible.

Crop display labels use Marathi / English throughout website crop chips and registration options, including allied businesses and protected cultivation. Display translations do not change stored crop values.
