# 14 — Admin maintenance and Audit Log

**What to build:** Admins can safely maintain Camp configuration and people during operation, and review an immutable record of every sensitive change.

**Blocked by:** 07 — Activity and Round context.

**Status:** complete

- [x] Admins can rename a Group and change it to an unused preset color while existing Score history retains its original snapshots.
- [x] Staff may set or replace an Active Camp Group Name only; the RPC rejects structural/color changes, cross-Camp access, Draft/Closed Camps, and expired sessions, and records actor plus before/after values in Audit Log.
- [x] After the first Score Transaction, Groups cannot be added, removed, or disabled; allowed changes are validated and audited.
- [x] Admins can add or disable Staff, add Admin Accounts with temporary PINs, assign or remove Camp Memberships, reset Admin PINs safely, and never disable the final active Camp Admin.
- [x] Admins can maintain Score Buttons and Activity configuration without invalidating referenced history; ordinary Score actions reject disabled items immediately.
- [x] Rotating the private Staff code revokes existing Staff Access Sessions, while rotating the public code invalidates the old public link.
- [x] The Admin Audit Log shows actor, action, entity, reason, before/after values, and Bangkok display time with stable pagination.
- [x] Audit records are immutable to normal clients and omit PINs, hashes, secrets, and request bodies.
- [x] RLS, integration, and browser tests cover every maintenance permission, post-transaction restriction, session revocation, audit entry, and cross-Camp denial.
