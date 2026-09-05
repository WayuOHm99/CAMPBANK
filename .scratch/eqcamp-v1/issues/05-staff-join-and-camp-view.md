# 05 — Staff Join and Camp view

**What to build:** Staff can open a private Camp link, select themselves without a PIN, and reach a fast read-only Camp screen showing the right Groups and Budget.

**Blocked by:** 04 — Configure and activate a Camp.

**Status:** complete

- [x] A valid private Staff Join Link exposes only the intended active Camp and its active Staff names; the root page does not enumerate Camps.
- [x] Selecting a Staff name binds an anonymous Supabase identity to a Camp-scoped Access Session without trusting local storage for authority.
- [x] The device remembers the latest Staff identity separately per Camp and allows the user to switch identity explicitly.
- [x] The main screen shows every active Group with color text, optional Group Name or `กลุ่มสี<ชื่อสี>` fallback, and comma-formatted Score.
- [x] Group cards stay in configured order and support quick search or jump for 1–20 Groups.
- [x] Active Staff may set or replace only a Group Name; color, order, creation, and removal remain unavailable and unauthorized at the RPC boundary.
- [x] Staff can switch between responsive Auto, one-column, two-column, and horizontally scrolling Group layouts; every page open starts in Auto and configured Group order is preserved.
- [x] Staff presentation controls use compact accessible icons, Group Name editing stays hidden behind a labeled edit action, and current identity/context/last refresh remain visible with manual refresh.
- [x] Successful Score feedback identifies actor, Group and amount, with reduced-motion-aware haptic feedback on supported devices.
- [x] Invalid, rotated, disabled, cross-Camp, Draft, and Closed access is denied with an appropriate Thai state.
- [x] RLS and browser tests prove Staff can read only the minimum data for their own Camp and cannot gain Admin privileges.
