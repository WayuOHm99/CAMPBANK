# 10 — Budget controls, warning, and Dashboard totals

**What to build:** Admins can understand and safely adjust Camp Budget while Staff and Admins receive an immediate low-Budget warning.

**Blocked by:** 06 — Atomic Score actions.

**Status:** complete

- [x] The Admin Dashboard shows Camp Budget, Distributed Score, Remaining Budget, and Score Transaction count from authoritative Camp data.
- [x] An Admin can change Active Camp Budget only with a reason and risky-action confirmation.
- [x] A new Camp Budget below Distributed Score, outside the integer range, or submitted without authority is rejected atomically.
- [x] Budget edits use the same Camp lock and full integrity check as scoring, so concurrent edits and Score actions have one deterministic order.
- [x] Admins can configure Amount, Percentage, both, or neither warning thresholds; equality with either enabled threshold activates the warning.
- [x] Active warnings are clearly visible to Staff and Admin without blocking valid Score actions.
- [x] Every Budget and warning change stores an immutable audit entry with actor, reason where required, and before/after values.
- [x] Unit, integration, concurrency, and browser tests cover calculations, thresholds, safe edits, rejection, and simultaneous Score actions.
