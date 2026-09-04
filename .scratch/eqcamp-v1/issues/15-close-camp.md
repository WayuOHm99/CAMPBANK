# 15 — Close Camp safely

**What to build:** an Admin can irreversibly close a Camp so every open device stops ordinary scoring immediately while final results and audited correction remain available.

**Blocked by:** 08 — Realtime and connection safety; 13 — Admin Adjustment; 14 — Admin maintenance and Audit Log.

**Status:** in-progress — implementation complete; exhaustive repeat-close test matrix remains

- [x] Closing requires an authorized Admin, an explicit risky-action confirmation, and a reason.
- [x] The close operation takes the Camp lock, verifies full integrity, records `closed_at` from the database, changes status once, and creates an audit entry atomically.
- [x] Ordinary award, deduction, Quick Undo, Budget edits, and Camp configuration changes are rejected after closure even from stale open pages.
- [x] Current clients receive the Closed state through live synchronization, show `ค่ายนี้ปิดแล้ว`, and disable Score actions.
- [x] Closing revokes Staff Access Sessions and prevents the old Staff link from creating a usable scoring session.
- [x] Authorized Admins retain read access to Dashboard, History, Audit Log, and Leaderboard control; reasoned Admin Adjustment remains allowed within the existing Camp Budget.
- [x] A Closed Camp cannot be reopened or deleted in V1.
- [x] Before closing, Admin sees the final ranking preview, Budget totals, transaction count, public visibility, and an explicit list of post-close effects.
- [ ] Integration and multi-page browser tests cover close-versus-score races, stale clients, session revocation, repeated close, post-close Adjustment, and irreversible state.
