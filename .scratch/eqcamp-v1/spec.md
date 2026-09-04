# EQ-BANK Web App V1 (EQCAMP domain)

Status: ready-for-agent

## Problem Statement

EQCAMP currently distributes simulated activity money and records Group Scores on paper. The process can run out of materials, miss Groups, produce arithmetic errors, lose history, obscure who changed a Score, and make the final top three slow to calculate while 5–10 Staff work concurrently.

## Solution

Build EQ-BANK, a Thai responsive web application for modern mobile, tablet, and desktop browsers that replaces simulated activity money and paper with auditable Score Transactions. Staff enter through a private Camp link, select their name, and use large Score Buttons; Admins manage Camps, Budget, Groups, activities, people, corrections, and Leaderboard visibility. PostgreSQL is authoritative for permissions, concurrency, Budget, Score, history, and ranking, while Supabase Realtime keeps devices synchronized. The legal owner is บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP); existing EQCAMP names remain Camp/domain data.

## User Stories

1. As Staff, I want to enter through a private Staff Join Link and select my unique name without a PIN, so that I can start quickly.
2. As Staff, I want the device to remember my latest identity separately for each Camp, so that repeat entry is fast.
3. As Staff, I want to see every Group by color and its optional Group Name, with a deterministic color-based fallback until a name is chosen, so that a Camp can start from scarf or ribbon colors without creating ambiguous cards.
4. As Staff, I want Remaining Budget, current identity and Activity context, Camp connection state, last successful refresh time, and a manual refresh action to remain visible, so that I know whether scoring is safe.
5. As Staff, I want to find any of 1–20 Groups through fixed-order cards and quick search/jump, so that card movement and long scrolling do not slow me down.
6. As Staff, I want to set or replace a Group Name without changing Group structure or color, so that participants can name their color-assigned Group safely after the Camp starts.
7. As Staff, I want to optionally select and remember an Activity and Activity Round, so that Score context is captured without blocking fast actions.
8. As Staff or Admin, I want to use enabled Score Buttons such as +500, +1,000, -500, and -1,000, so that ordinary scoring takes one tap while an Admin may require confirmation only for exceptional buttons.
9. As Staff, I want only the tapped button to show pending and retries to remain idempotent, so that the page stays usable without duplicate Scores.
10. As Staff, I want clear rejection messages when Camp Budget or Group Score is insufficient, so that neither can become negative.
11. As Staff, I want a 15-second Quick Undo for my latest eligible Score Transaction, so that immediate mistakes create an audited correction instead of deleting history.
12. As Staff, I want to read the latest 50 Camp Score Transactions, so that I can understand recent field activity without changing old records.
13. As Staff, I want scoring disabled only when the server is unreachable and refreshed after reconnection, so that no Score is queued offline.
14. As Admin, I want one PIN-protected Admin Account with explicit Camp Memberships, so that one login can manage only authorized Camps.
15. As Admin, I want to create a Draft Camp through short steps for identity, Budget, 1–20 manually added Groups, colors, people, optional activities, an actionable readiness review, and activation.
16. As Admin, I want to manage unique Group colors, optional Group Names, Staff, Admins, Activities, Rounds, and Score Buttons, so that each Camp fits its event.
17. As Admin, I want safe activation rules and soft disabling after records are referenced, so that incomplete Camps and broken history cannot enter operation.
18. As Admin, I want to edit Active Camp Budget with a reason and confirmation while never going below Distributed Score, so that capacity can change safely.
19. As Admin, I want Amount and/or Percentage Budget Warnings visible to Staff and Admin, so that low capacity is noticed before rejection.
20. As Admin, I want ordinary Score actions separated from reasoned Admin Adjustments, so that activity scoring and historical correction remain distinguishable.
21. As Admin, I want Dashboard totals, paginated History, filters, immutable Audit Logs, complete-ranking CSV, copy-ready ranking text, and filtered History CSV, so that Camp state and administrative changes are traceable and portable.
22. As Admin, I want to control Leaderboard Visibility, inspect every rank, and choose a Public Result Range of top 3, top 5, or top 10, so that the public result matches each Camp while full records remain available.
23. As a public viewer, I want a separate read-only Public Leaderboard Link, so that I can see permitted Camp results without gaining Staff access.
24. As Admin, I want to close a Camp atomically, so that all later ordinary Score actions are rejected even on pages left open.
25. As EQ-BANK, I want simultaneous Camps isolated by Camp Membership and `camp_id`, so that users and data never cross Camp boundaries.
26. As Admin, I want each Staff Join Link shown as a full URL with Open, Copy, and device Share actions, so that I can distribute it without manually reconstructing the address.
27. As every user, I want Camp lifecycle and connection health shown as separate labeled states with icons and non-color cues, so that Active, Closed, Live, Degraded, Connecting, and Offline cannot be confused.

## Implementation Decisions

- Use one npm-managed Next.js App Router application with TypeScript and Tailwind, deployed to Vercel. Use Supabase PostgreSQL, Auth, RLS, RPC, and Realtime directly; do not add an ORM or separate backend service.
- Define schema changes only through versioned SQL migrations and generate TypeScript database types from the resulting schema.
- Core entities are Camps, Groups, Admin Accounts, Camp Memberships, Access Sessions, Color Presets, Activities, Activity Rounds, Score Buttons, Score Transactions, and Audit Logs.
- Use `EQ-BANK` only as the user-facing product display name and `บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)` as the verified legal owner. Preserve EQCAMP Camp data, technical routes, database/RPC/type names, CSV schemas, and `eqcamp:*` browser keys. Keep both confirmed raster assets unchanged as Brand evidence, use the EQCAMP artwork only as the provisional PWA icon, render private operational identity as `EQ-BANK` text, and do not invent an EQ-BANK wordmark or repeat a corporate endorsement block in the UI.
- Use 32-bit integer Score values. Camp Budget, Distributed Score, Remaining Budget, and every Group Score must stay non-negative; Distributed Score must not exceed Camp Budget and must equal the sum of Group Scores.
- Store current Group Score and Camp Distributed Score as database-maintained read values. Every Score-writing RPC, activation, and close verifies the full Camp integrity invariant and blocks scoring on an Integrity Failure rather than repairing data silently.
- Staff and public viewers use Supabase anonymous identities bound to Camp-scoped Access Sessions. Staff sessions survive device reuse until switching identity, disablement, code rotation, or Camp closure. Browser preferences never carry authority.
- Admin PIN hashes live only in Admin Accounts and are verified in a restricted PostgreSQL RPC with throttling and a 15-minute lock after five failures. Admin sessions last 12 hours. New Admins must replace a temporary PIN on first login, and a Camp cannot disable its final active Admin.
- Create the first Admin through a server-only bootstrap operation. Keep Service Role credentials server-only and reserve them for bootstrap/recovery rather than normal application traffic.
- Use separate random Staff and public codes of at least 12 human-readable characters. Activation creates both codes atomically. Show the resulting Staff URL with Open, Copy, and Web Share; unsupported Share falls back to Copy. Rotating the Staff code requires a reason and confirmation and revokes existing Staff sessions. Do not publicly enumerate Camps.
- Staff ordinary scoring sends a Score Button identifier, not a trusted amount. The database derives the enabled signed amount and validates Camp, actor, Group, Activity, Round, Budget, and Group Score.
- Score Buttons have an Admin-controlled `requires_confirmation` flag that defaults off. It affects only the Staff interaction before submission; the database remains authoritative and applies the same validation regardless of client confirmation UI.
- Serialize Score, lifecycle, and Budget writes by locking the Camp row first, followed by the Group row when needed. The transaction that obtains the Camp lock first determines ordering for concurrent Score, Budget, and close actions.
- Give every client action a UUID. A repeated UUID with the same payload returns its original result; a different payload produces an idempotency conflict. A client with an unknown outcome retries with the same UUID.
- Score Transactions are immutable and contain entity references plus display snapshots for Group, color, actor, Activity, and Round. Ordinary types are award and deduction; Quick Undo and Admin Adjustment create opposite or corrective records linked when applicable.
- Quick Undo is limited to the actor's latest eligible transaction within 15 seconds and is rejected if it would violate Score or Budget invariants. Admin Adjustment always requires a reason and confirmation, may be unlinked when initiated from a Group, and remains allowed after Camp closure within the existing Budget.
- Draft Camps allow full configuration. Step 1 starts at zero and changes only the Group count from 1–20 through direct numeric entry or increase/decrease controls; it does not assign color or name data. Step 2 explicitly assigns one unique preset color to every Group through a viewport-safe picker that shows every swatch before selection, identifies colors used by other Groups, and may leave Group Names empty in Draft and at activation; convenience actions may fill unused colors or clear all selections without saving automatically. The final review exposes each readiness requirement and returns the Admin directly to an incomplete step. Activation still requires positive Budget, at least one active Admin and Staff member, and enabled positive and negative Score Buttons. After the first Score Transaction, Groups cannot be added, removed, or disabled; audited Admin color changes and Admin or Staff Group Name changes remain allowed while the Camp is Active.
- Until a Group Name is set, every surface uses `กลุ่มสี<ชื่อสี>` as the deterministic display fallback. Score Transactions keep the displayed Group identity snapshot used when the transaction occurred.
- Staff Group Name changes require an active Camp-scoped Staff Access Session, cannot change color/order/structure, and create an immutable Audit Log entry with the Staff actor and before/after name.
- Hard delete only unreferenced Draft configuration. Never hard-delete Score Transactions or Camps. Closing a Camp is irreversible in V1, blocks ordinary scoring and Budget edits, and still permits audited Admin Adjustments.
- Rank Groups by current Score descending, then database `score_reached_at` ascending, then configured Group order. All Groups receive the same initial reached time at activation. Calculate Realtime ranking from current Group rows rather than storing another Leaderboard table.
- New Camps start with Leaderboard Visibility off and Public Result Range top 3. Admin may select top 3, top 5, or top 10; Admin ranking remains complete while the Public Leaderboard and public Camp result expose only the selected range. When visibility is off, only Admin sees ranking; Staff still sees fixed-order Group Scores and public reads return no ranking data. Clear previously displayed public ranking immediately when visibility turns off.
- Subscribe only to the current Camp. If Realtime is degraded but RPC remains reachable, show a warning and refresh snapshots approximately every two seconds; disable Score actions when the server is unreachable. Never queue Score Transactions offline.
- Use Thai interface copy, Bangkok display time over UTC database timestamps, comma-separated whole numbers without a currency symbol, 44px-or-larger touch targets, visible text labels with color, safe-area support, responsive layouts from 320px mobile screens through wide desktops, and lightweight reduced-motion-aware interaction feedback only.
- Treat EQ-BANK as a private operational product, not a public marketing page. Home and Admin login omit the company/two-logo card, promotional hero, decorative artwork, and full-page Brand fills. Application chrome uses white/neutral layers with EQCAMP deep blue for general actions, links, selection, and focus. Full-strength bright green/orange remain artwork-only; exact EQCAMP sky blue may appear as the thin Subtract Score border/glyph but not as a large fill. The localized Score action pair uses EQCAMP deep blue `#205E91` with white content for Add, while Subtract uses the soft sky-blue surface `#E7F6FD`, exact sky-blue border/glyph `#36B8F2`, and deep-blue text `#18476D`. Every Score action also shows explicit Thai text, a plus/minus glyph, and a signed value so meaning never depends on color alone. Dark green/orange remain limited to small status glyphs, text, or thin attention edges. Cards use neutral 1px borders, 16px radius, subtle elevation, and readable 700/600/400 typography rather than universal 900 weight. This visual decision does not remove the separate Admin-controlled Public Leaderboard workflow.
- Admin PIN entry exposes the active four-digit position visually and to assistive technology. Icon-only controls retain accessible names, visible focus, and explanatory tooltips without adding persistent visual clutter.
- The Staff Group view starts in responsive Auto mode whenever the page opens and may switch to one column, two columns, or one horizontally scrollable row. This presentation state is not persisted and never changes configured Group order or scoring authority.
- Group-card editing and Admin disclosures expand only the activated surface. Sibling cards stay top-aligned; desktop management uses independent column stacks, and only genuinely long panel bodies receive contained scrolling.
- Score Button configuration separates Add/Deduct direction from a positive digit-only magnitude, derives `+`/`-` and the label automatically, and sends the same signed-integer RPC contract.
- Camp lifecycle (`draft`, `active`, `closed`) and connection health (`connecting`, `live`, `degraded`, `offline`) remain two simultaneously visible axes with Thai text, icons, border patterns, and live-region announcements.
- Implement a basic installable PWA named EQ-BANK with no offline API/data cache. Use the unchanged EQCAMP program artwork only as a provisional `any` launcher icon and do not claim maskable artwork until an owner-approved asset exists.
- Keep Score Transactions as the audit source for Score changes. Audit Logs cover Budget, configuration, Membership, visibility, closure, login success/failure, lockout, PIN reset, and session revocation without storing PINs or request bodies.
- Ranking CSV and copy-ready text are generated from the complete Admin ranking. History CSV follows the current Admin filters and retrieves every matching page through the authorized History RPC; exports do not bypass RLS or introduce a new data surface.

## Testing Decisions

- Test external behavior rather than private implementation. The primary seam is the authenticated Supabase RPC contract against Local Supabase; tests must exercise RLS rather than bypass it with Service Role.
- Use Vitest for pure Ranking, tie-break, Budget Warning, number formatting, and validation behavior.
- Use integration tests for award, deduction, Quick Undo, Admin Adjustment, Budget edits, activation/closure, idempotency, session permissions, immutable history, multiple Camps, and cross-Camp denial.
- Prove concurrency with parallel RPC calls: two +1,000 requests against 1,000 Remaining Budget yield one success; five Staff updating one Group lose no writes; ten Staff updating several Groups preserve every Score Transaction; duplicate UUID requests create one transaction.
- Use Playwright with mobile viewports and WebKit for Staff join, identity selection, scoring, deduction, Quick Undo, Admin login, Camp creation/management, Leaderboard visibility, Realtime updates, and Camp closure.
- Before Pilot-ready status, pass lint, typecheck, unit/integration/E2E tests, build, simulated ten-session concurrency, and a rehearsal using at least five real iPhone/Safari devices or sessions.

## Risk-first Execution Order

- Build the Foundation first, then prove a production-quality seeded Golden Path: Staff selection → +500 → atomic database write → Budget update → second-client refresh → concurrent-write tests.
- Use the seeded Demo Camp to validate RPC, RLS, idempotency, lock ordering, and the minimum Staff screen before building the complete Admin configuration UI.
- After the Golden Path passes, implement secure Admin entry, Camp creation and activation, Staff access hardening, field features, traceability controls, closure, and Pilot polish.
- Keep one implementation ticket in progress at a time. Every completed slice must leave the application runnable and its relevant checks green.
- This ordering changes delivery sequence only; it does not remove or add product scope.

## Out of Scope

- Native iOS/Android applications, app stores, offline Score synchronization, offline write queues, push notifications, chat, AI, payments, real money, accounts for students, student personal data, social login, advanced analytics, complex reporting, multi-language UI, Camp reopening, Camp deletion, and Production deployment without explicit approval.

## Further Notes

- Staff identity is intentionally trust-based: anyone holding a Staff Join Link can select an active Staff name. Private link handling, least privilege, Camp-scoped RLS, revocable sessions, and audit mitigate but do not eliminate impersonation.
- Use Local Supabase for development and one Cloud Supabase/Vercel environment for Pilot. Add CI only after a Git remote is selected.
- Development seed data includes the specified Demo Camp, Groups, Staff, Activities, and default Score Buttons. Its documented four-digit Demo PIN is hashed and must never be seeded into Pilot or Production.
- The domain glossary and accepted ADRs remain authoritative for terminology and architectural rationale.
