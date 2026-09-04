# 06 — Atomic Score actions

**What to build:** authorized Staff and Admin can award or deduct Score with one tap while the database guarantees correct Budget, Group Score, identity, and concurrency behavior.

**Blocked by:** 05 — Staff Join and Camp view.

**Status:** complete

- [x] The scoring RPC accepts Camp, Group, actor session, Score Button, and client action UUID; it derives the signed amount from the enabled Camp button.
- [x] The RPC validates actor membership, active Camp, Group ownership, and all trusted values inside one database transaction.
- [x] Camp writes lock the Camp row first and the target Group row second, then update the immutable Score Transaction, Group Score, `score_reached_at`, and Distributed Score atomically.
- [x] Award is rejected when Remaining Budget is insufficient; deduction is rejected when Group Score is insufficient; no invariant can become negative.
- [x] Every successful write verifies Distributed Score equals the sum of Group Scores and stops safely on an Integrity Failure.
- [x] Reusing a client action UUID with the same payload returns the original outcome, while a changed payload returns an idempotency conflict.
- [x] Only the tapped button shows pending, ordinary Score actions use no confirmation modal, and Thai success/error feedback includes the affected Group and amount.
- [x] Admins may opt an exceptional Score Button into confirmation while all existing and newly created buttons remain one-tap by default.
- [x] Parallel integration tests prove one winner for two competing +1,000 actions against 1,000 Remaining Budget, no lost updates for five Staff on one Group, preserved writes for ten Staff across Groups, and one transaction for duplicate retries.
