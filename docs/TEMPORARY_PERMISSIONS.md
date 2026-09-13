# Temporary permissions

A manager or super admin can grant an employee edit access to one farmer for a bounded period. A grant includes the employee, farmer, allowed fields, reason, grantor, expiry, and optional revocation.

Every mutation checks the grant at execution time. Expired or revoked grants fail automatically. The grant and resulting edits are written to the audit log.
