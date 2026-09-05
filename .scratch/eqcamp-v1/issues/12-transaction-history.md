# 12 — Immutable Transaction History

**What to build:** Staff and Admins can inspect trustworthy recent Score history without loading an entire Camp or losing the labels that were shown when each action occurred.

**Blocked by:** 07 — Activity and Round context.

**Status:** complete

- [x] History displays database time in Asia/Bangkok, actor, Group color and name, Activity, Round, transaction type, signed amount, and correction linkage.
- [x] Displayed labels come from immutable transaction snapshots and remain unchanged after related entities are renamed or disabled.
- [x] Staff can read only the minimum recent history allowed for their own active Camp; Admins can read authorized Camp history.
- [x] The first page returns at most 50 records and later pages use stable keyset pagination without omissions or duplicates.
- [x] Admin filters support Group, Staff, Activity, and transaction type and compose with pagination.
- [x] No normal client role can update or delete a Score Transaction.
- [x] Admin can export every History item matching the current filters as a UTF-8 CSV through the authorized paginated RPC.
- [x] Integration and browser tests cover pagination boundaries, filters, renamed entities, immutable records, and cross-Camp denial.
