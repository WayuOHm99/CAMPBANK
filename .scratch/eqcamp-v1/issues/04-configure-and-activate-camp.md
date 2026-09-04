# 04 — Configure and activate a Camp

**What to build:** an Admin can finish the minimum Camp setup, review it, and activate a Camp only when it is safe for Staff scoring.

**Blocked by:** 03 — Create and revisit a Draft Camp.

**Status:** in-progress — count-only Step 1 and explicit color/name Step 2 complete; exhaustive activation guards remain

- [x] The Admin starts with no preset Group count; Step 1 only increases or decreases the count from 1–20, without assigning colors or names.
- [x] Step 2 requires one unused accessible preset color per Group, allows an empty Group Name in Draft and at activation, and keeps the configured insertion order.
- [x] Group setup shows the selected swatch and color label together on mobile, tablet, and desktop.
- [x] Step 1 accepts direct 1–20 numeric entry alongside increase/decrease controls; Step 2 can fill unused colors or clear all selections without saving implicitly.
- [x] The database enforces one use of each color per Camp and initializes every Group at zero Score.
- [x] The Admin can add uniquely named Staff members and the existing Admin membership is visible in the review.
- [x] Default enabled Score Buttons are +500, +1,000, -500, and -1,000, and the Admin can add, order, enable, or disable other non-zero integer buttons.
- [x] Activation is rejected unless Camp Budget is positive, Groups are valid, at least one active Admin and Staff exist, and enabled positive and negative Score Buttons exist.
- [x] Successful activation gives all Groups the same database `score_reached_at`, creates separate random Staff and public codes of at least 12 human-readable characters, and changes status atomically.
- [x] Configuration and activation actions are audited; the final active Admin cannot be disabled.
- [x] The review step presents an actionable readiness checklist and jumps directly to each incomplete setup step.
- [ ] Integration and browser tests cover the happy path and every activation guard.
