# 02 — Secure Admin entry

**What to build:** a first Admin can be bootstrapped safely, sign in with a four-digit PIN, and reach an empty authorized Camp list without exposing credentials or privileged access.

**Blocked by:** 01 — Foundation and local quality gate.

**Status:** complete

- [x] The first Admin Account is created through a documented server-only bootstrap flow with a hashed temporary PIN.
- [x] Admin PIN verification happens only in a restricted database/server path; PIN values and hashes never reach browser state, logs, or audit payloads.
- [x] Five failed attempts lock the Admin Account for 15 minutes, and the UI gives a safe Thai error without revealing account details.
- [x] A successful login creates a 12-hour authorized session and requires replacement of a temporary PIN before Camp administration.
- [x] Login success, failure, lockout, PIN change, and session revocation produce immutable security audit entries without sensitive data.
- [x] RLS denies unauthenticated and anonymous users access to Admin Account data.
- [x] PIN entry makes the active digit position visually explicit, announces progress, and disables caret motion under reduced-motion preferences.
- [x] Automated tests cover success, wrong PIN, lockout, expiration, temporary-PIN change, and unauthorized reads.
