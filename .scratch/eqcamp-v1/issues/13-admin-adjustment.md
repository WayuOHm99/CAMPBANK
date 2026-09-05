# 13 — Admin Adjustment

**What to build:** an authorized Admin can correct a Group Score with a required explanation while preserving the original history and all Budget invariants.

**Blocked by:** 12 — Immutable Transaction History.

**Status:** complete

- [x] Admins can start an Adjustment from a Group or an existing Score Transaction and submit a non-zero signed integer amount with a required reason.
- [x] A risky-action confirmation shows the Group, current Score, change, resulting Score, and resulting Remaining Budget before submission.
- [x] The database creates a new immutable `adjustment` transaction, links it when initiated from an existing transaction, and never edits or deletes the original.
- [x] Adjustment is rejected for unauthorized Admins, cross-Camp references, insufficient Group Score or Camp Budget, and integrity failures.
- [x] The Camp lock, Group lock, idempotency, snapshots, totals, and live-update behavior match ordinary Score safety.
- [x] Adjustment remains distinguishable from ordinary award/deduction and appears correctly in History.
- [x] Integration and browser tests cover positive/negative corrections, linked/unlinked corrections, required reason, retry, concurrent scoring, and preserved history.
