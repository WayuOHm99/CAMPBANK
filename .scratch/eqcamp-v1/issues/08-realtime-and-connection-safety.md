# 08 — Realtime and connection safety

**What to build:** every open device sees current Camp state quickly, while connection failures are visible and never create an offline Score queue.

**Blocked by:** 06 — Atomic Score actions.

**Status:** complete

- [x] Staff, Admin, and permitted Leaderboard clients subscribe only to the current Camp's Groups, Budget totals, status, visibility, and recent Score Transactions.
- [x] A successful Score action appears on other normal connections within the 1–2 second target without a full-page reload.
- [x] If Realtime degrades while RPC remains reachable, the UI shows a warning and refreshes current Camp snapshots approximately every two seconds.
- [x] If the server is unreachable, Score Buttons become unavailable and the UI states that the connection is lost.
- [x] Reconnection refreshes authoritative state before restoring Score actions; no Score write is stored or replayed from an offline queue.
- [x] Duplicate Realtime events and reconnects do not duplicate displayed transactions or corrupt current totals.
- [x] Automated multi-page browser tests cover live update, degraded fallback, offline disablement, and resynchronization.
