# 09 — Quick Undo

**What to build:** Staff can reverse their latest eligible Score action from its success toast without deleting or rewriting history.

**Blocked by:** 06 — Atomic Score actions.

**Status:** in-progress — implementation complete; exhaustive timeout/deduction/race tests remain

- [x] A successful award or deduction displays a Thai toast with an Undo action available for 15 seconds.
- [x] Staff can undo only their own latest eligible ordinary Score Transaction in that Camp while the Camp is Active.
- [x] Undo creates one linked opposite Score Transaction with type `quick_undo` and a database timestamp; the original transaction remains immutable.
- [x] Repeated Undo requests are idempotent, and already-undone, expired, superseded, unauthorized, or cross-Camp requests are rejected.
- [x] Undo is rejected if current state would violate Group Score, Camp Budget, or the full integrity invariant.
- [x] Totals and all open clients reflect the correction through the existing live-update behavior.
- [ ] Integration and mobile browser tests cover award Undo, deduction Undo, timeout, latest-only rule, race conditions, and preserved history.
