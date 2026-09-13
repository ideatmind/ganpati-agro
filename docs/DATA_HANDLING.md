# Data handling

Mobile numbers and Aadhaar are sensitive identifiers. Mobile is normalized and access-limited. Aadhaar is encrypted with an application-held key; a keyed fingerprint enforces uniqueness and the last four digits support limited operational display.

Aadhaar must not appear in application logs, analytics, receipts, URLs, client responses after submission, CSV exports, or audit payloads. Secrets stay in server-only environment variables. Financial and authorization records are retained as append-only history.
