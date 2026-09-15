# Field-validation matrix — 15 September 2026

All rendered forms and API-edited fields are covered below. Current validation includes audit fixes; baseline issues are recorded in the main report. No PIN, PAN, email, KSK/business, file upload or settlement fields exist. Static contact addresses are not inputs.

| Screen | Field | Expected type | Current validation | Client | Server | Max length/range | Issue / fix |
|---|---|---|---|---|---|---|---|
| Registration / staff / profile | name | Unicode text | Length only → shared NFC/space normalization and Unicode letters/marks + sensible punctuation | Native length + blur validation | Shared schema | 200 | Fixed; does not restrict to ASCII |
| Registration / login / staff | mobile | ASCII digit string | Exactly 10, no normalization or country prefix | Numeric keyboard, exact pattern; typing/paste guards | Shared mobileSchema | 10 | Prefix intentionally unchanged per owner |
| Registration | aadhar_no | Sensitive ASCII digit string | Exactly 12; encrypt/HMAC on server | Exact pattern, autocomplete off, paste guard | aadhaarSchema | 12 | No number reflected in API error/audit |
| Registration / login / password / staff | password / currentPassword / newPassword | Secret text | 8–72 characters; new passwords ≤72 UTF-8 bytes | Native min/max, password confirmation / visibility where implemented | passwordSchema; current/login length | 72 | Login/current bcrypt truncation compatibility; never log |
| Registration / password change | confirm_password / confirmPassword | Secret text | Match first password | Client equality check | Not persisted; server validates chosen password | 72 | Client-only match is UX, not authority |
| Registration / profile | date_of_birth | ISO calendar date | Valid date; not future | Date input + maximum today | ISO date schema + DB constraint | 10 | No invented age minimum |
| Registration / profile | district | Catalog code | Directory enum | Dependent select | Enum + geography FK | Catalog | Reject unknown districts |
| Registration / profile | taluka | Catalog code | Directory enum belonging to district | Dependent select | Enum/relation + composite FK | Catalog | Partial edits checked against retained DB geography |
| Registration / profile | village | Free text | Trim/nonempty; historic/missing villages allowed | Combobox, optional directory search, max | Schema | 200 | Address-like digits/punctuation allowed |
| Registration / profile | income_source | Enum | agriculture/business/job/other | Radio/select | Enum + DB check | Catalog | Group labels reviewed |
| Registration / profile | cluster_type | Enum | 13-category catalog | Select | Enum + DB check | Catalog | Profile changes do not rewrite receipt or plots |
| Registration | plots | Array | One through ten plots | Add/remove feedback | Bounded array | 10 entries | No arbitrary nested payload writes |
| Registration | plots[].plot_no | Text | Nonempty survey identifier | Required/max; digits/slash allowed | Trim/length | 100 | Never letters-only |
| Registration | plots[].area_acres | Number/decimal string | 0.01–100000; ≤2 decimal places | Numeric min/max/step | Reject booleans, negatives, excess precision | 100000 | Fixed rounding gap |
| Registration | plots[].crop_name | Catalog string | Must belong to selected cluster | Filtered select; cluster change clears incompatible choices | Catalog + relation | 100 | Validated independently of client |
| Registration | plots[].irrigation_source | Enum | Allowed irrigation choices | Select | Enum + DB check | Catalog | Unknown choice rejected |
| Registration | referral_code | Alphanumeric code or empty | Uppercase; 6–16 letters/digits | Editable query prefill and pattern | Regex + active profile lookup | 16 | Invalid query no longer locks field |
| Registration | cash_received | Boolean | Only signed employee/manager/super-admin may attribute cash | Assisted-only checkbox | Actor-derived override + DB snapshot | Boolean | Client actor/amount never trusted |
| Registration | cash_note | Free note | Trim/bound | Input max | Schema | 200 | React escaping; avoid identifiers in notes |
| Registration | consent | Literal true | Mandatory | Required checkbox | Literal true + DB check | Boolean | Demo helper only visible in trial/nonproduction |
| Registration | website | Honeypot | Must be empty | Hidden from keyboard/accessibility tree | Max zero | 0 | No sensitive field |
| Registration | test_mode | Boolean | Allowed only with explicit switch flag | Switch locked for saved checkout | Flag + signed checkout purpose | Boolean | Owner-authorized prelaunch gate |
| Registration | expected_fee_paise | Integer snapshot | Optional displayed fee is checked atomically when sent | Server-rendered value; not editable | Positive bounded integer + RPC equality | 2147483647 | Never used to set actual fee |
| Staff | role | Enum | Employee or manager | Select | Enum + super-admin authorization | 2 values | No super-admin creation through form |
| Staff status | accountId / status | UUID / enum | Other non-super-admin staff only | Selection/confirmation | Strict schema + DB role/scope | UUID / enum | Deactivation revokes sessions |
| Payout | profileId | UUID | Selected referrer | Bounded search/select | UUID + FK + available balance | 36 | Actor derived from session |
| Payout | amountRupees | Decimal string | 0.01–1000000; ≤2 decimals | Number min/step | Regex + exact paise conversion + locked balance | 7 integer digits | No rounding and no negative balance |
| Payout | method | Enum | cash/upi/bank_transfer/other | Select | Enum + DB check | Catalog | Does not execute a money transfer |
| Payout | reference / note | Free text | Trim/bound | Input max | Schema | 100 / 300 | Escaped; no HTML interpretation |
| Payout | offline confirmation | Boolean UX acknowledgment | Confirm money already disbursed | Required checkbox | Role-authorized recording; no settlement API | Boolean | Cannot prove physical disbursement |
| Payout | idempotencyKey | UUID | Stable key for exact payload | Recovery stores payload per acting account | UUID + DB uniqueness/matching | 36 | Original request can be retried after response loss |
| Grant | employeeId / farmerId | UUID | Farmer must belong to employee | Dependent search/select | UUID + roles/ownership | 36 each | Other employee grants denied |
| Grant | fields | Allowed field array | At least one; only seven editable fields | Checkbox group | Enum/min/max + DB subset | 7 | No mobile/Aadhaar/fee/role edits |
| Grant | reason | Text | 3–500 characters | Required min/max | Trim/length + DB constraint | 500 | Stored on grant, not raw PII audit payload |
| Grant | durationHours | Integer | 1–168 | Number min/max | Integer bound + DB seven-day expiry | 168 | Expired/revoked permission rejected |
| Grant revoke | grantId | UUID | Existing permission | Confirmation action | Strict UUID + management role | 36 | Audited |
| Admin list | section / status / sort / size | Enums | Known section/status/sort; 25/50/100 | Links/selects | adminQuery + DB validation | Bounded | Trash super-admin only |
| Admin list | q / page / from / to | Text/integer/date | Search ≤100; page 1–10000; ISO dates in order | Search/date/pagination | Schema + RPC bound | 100 /10000 | Parameterized SQL; prefix wildcards remain performance residual |
| Admin bulk | ids / action | UUID array/enum | 1–100 explicit; all-matching Trash separate | Selection and confirmation | Strict schema + sorted DB locks | 100 | Atomic rollback; purge only Trash |
| Admin bulk | reason / password | Text/secret | Trash reason 3–300; password for purge or large Trash | Required confirmation dialog | Schema + bcrypt DB verification | 300 /72 | Password attempt throttles outside failing transaction |
| Admin bulk | allMatching / expectedCount / filters | Boolean/integer/object | Only Trash; bounded validated filters | Explicit all-pages choice | Strict schema + DB resolved count | As listed | Permanent purge never all-matching |
| Admin lookup | kind / q / employeeId | Enum/text/UUID | 2–100 query, bound employee for farmers | Search button/loading/empty | Schema + authorized RPC | 100 | 20 results max |
| Aadhaar reveal / reconcile | registrationId | UUID | Explicit authorized record | Separate action | Strict UUID + role/throttle | 36 | Reveal no-store and audited |
| Checkout | registrationId / orderId / paymentId / signature | UUID/provider identifiers/HMAC | Signed cookie binding; expected provider values | SDK/hidden state | UUID; provider string limits; HMAC; capture/order/amount/currency | 36 /100 /128 | No arbitrary frontend success flag |
| Receipt / farmer / financial URL | token / id | UUID | Valid UUID; farmer/finance additionally scoped | Links | UUID and DB role/scope | 36 | Receipt bearer capability intentionally public |
| Referral alias | code | Alphanumeric code | 6–16 uppercase letters/digits | URL redirect | Regex before same-site redirect | 16 | No external redirects |
