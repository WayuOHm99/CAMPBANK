# 07 — Activity and Round context

**What to build:** Admins can configure optional Activities and Rounds, and Staff can attach remembered context to a Score action without slowing ordinary scoring.

**Blocked by:** 06 — Atomic Score actions.

**Status:** complete

- [x] An Admin can add, order, rename, enable, and disable Camp-scoped Activities and their ordered Rounds.
- [x] Staff can choose no Activity or one active Activity and, when applicable, one of its active Rounds.
- [x] The browser remembers the latest selection separately for each Camp and Staff identity but the server validates every submitted reference.
- [x] A Round from another Activity, an inactive reference, or a reference from another Camp is rejected without changing Score or Budget.
- [x] Successful Score Transactions store both valid references and display snapshots for Activity and Round.
- [x] Activity configuration changes are audited and existing transaction history remains readable after rename or disablement.
- [x] Integration and mobile browser tests cover optional context, remembered selection, invalid combinations, and snapshots.
