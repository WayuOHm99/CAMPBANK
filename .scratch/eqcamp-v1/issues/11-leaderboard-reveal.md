# 11 — Leaderboard reveal

**What to build:** Admins can preview every rank and reveal a configurable Public Result Range through a separate read-only public link without exposing Staff access.

**Blocked by:** 06 — Atomic Score actions.

**Status:** complete

- [x] Ranking orders Groups by current Score descending, database `score_reached_at` ascending, then configured Group order.
- [x] The Admin Dashboard always shows the complete ranking and can select top 3, top 5, or top 10 for public results.
- [x] Staff and public clients receive no rank data while Leaderboard Visibility is off, and previously displayed public ranking clears immediately when it turns off.
- [x] When visibility is on, the separate public code provides only the selected Public Result Range for that Camp with no Staff identity or Score capability.
- [x] Ranking and visibility update through current-Camp live synchronization after Score changes.
- [x] Visibility changes are authorized, confirmed where appropriate, and audited.
- [x] Unit, RLS, and browser tests cover ties, tertiary order, reveal/hide transitions, invalid codes, cross-Camp isolation, and public read-only access.
