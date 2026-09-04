# 03 — Create and revisit a Draft Camp

**What to build:** an authenticated Admin can create a Draft Camp in short mobile-friendly steps and later reopen it from their Camp list.

**Blocked by:** 02 — Secure Admin entry.

**Status:** complete

- [x] An Admin can create a Draft Camp with name, optional location, Bangkok-facing Camp date, and a positive Camp Budget.
- [x] Creation assigns a unique non-UUID public-facing Camp code and automatically gives the creator active Admin membership.
- [x] New Camps default to Draft status and Leaderboard Visibility off.
- [x] The Camp list shows only Camps for which the signed-in Admin has active membership; direct access to another Camp is denied by RLS.
- [x] The creation flow is split into short steps, preserves safe in-progress values, validates at the trusted boundary, and reports Thai errors clearly.
- [x] Camp creation and material Draft edits are audited with actor, before/after state, and database timestamp.
- [x] Integration and browser tests prove creation, validation, membership isolation, and reopening the Draft Camp.
