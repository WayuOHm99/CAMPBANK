# 16 — Pilot polish and readiness

**What to build:** the completed V1 is responsive across modern mobile, tablet, and desktop browsers, uses the approved EQ-BANK/EQGROUP identity, is installable as a basic PWA, documented for a beginner, and proven ready for an EQCAMP pilot without deploying Production.

**Blocked by:** 09 — Quick Undo; 10 — Budget controls, warning, and Dashboard totals; 11 — Leaderboard reveal; 12 — Immutable Transaction History; 13 — Admin Adjustment; 14 — Admin maintenance and Audit Log; 15 — Close Camp safely.

**Status:** in-progress — navigation and flexible setup polish complete; real-device Pilot rehearsal remains

- [x] Staff and Admin critical flows have 44px-or-larger touch targets, readable contrast, text labels alongside Group colors, safe-area support, useful focus states, and no unnecessary modal or nested navigation.
- [x] Layouts use the full available space without horizontal page overflow on supported mobile, tablet, and desktop viewports, while motion stays lightweight and respects reduced-motion preferences.
- [x] Camp Budget inputs show comma-grouped whole numbers while preserving the exact integer sent to PostgreSQL.
- [x] Wizards use previous-step navigation and every non-root surface has a deterministic in-system Back destination rather than depending on browser history.
- [x] Loading, empty, validation, integrity-failure, degraded-Realtime, offline, unauthorized, and Closed Camp states use concise Thai copy and preserve safe behavior.
- [x] Visible Camp statuses and administrative actions use consistent Thai labels; adjacent disclosure cards never stretch open when only one is expanded.
- [x] Camp lifecycle and connection health render as separate text/icon/border statuses and Offline explains that scoring is disabled with no later queue.
- [x] Staff Group rename expands only the selected top-aligned card; compact layout controls use accessible icons and reset to Auto on every page open.
- [x] Camp Setup color selection uses a viewport-safe swatch dialog with used-color states, keyboard movement, Escape, focus return, and optional Group Name.
- [x] Score Button configuration accepts a digit-only magnitude behind explicit Add/Deduct controls and derives the sign and label automatically.
- [x] Admin complete ranking supports CSV plus copy-ready text; Staff/Public links expose full URL Open, Copy, Share, and audited rotation controls.
- [x] Desktop management uses independent column stacks and genuinely long disclosure bodies scroll internally without forcing sibling columns to drop.
- [x] Private user-facing identity uses compact EQ-BANK text with no corporate endorsement/marketing block; both repository logos remain unchanged Brand evidence, the EQCAMP artwork remains only the provisional PWA icon, and EQCAMP data/technical identifiers remain unchanged.
- [x] Application chrome uses neutral surfaces plus one deep-blue action family; full-strength bright blue/green/orange are artwork-only, statuses use small text/icon cues, cards use neutral borders/subtle elevation, and Thai typography does not use universal 900 weight or negative tracking.
- [x] Admin has responsive jump navigation, an exact Staff-facing Score Button preview, ranking-rule guidance, and complete-ranking CSV export.
- [x] A lightweight manifest, icons, install metadata, and text wordmark provide basic PWA installation without caching API data or enabling offline writes.
- [x] Development seed creates the specified Demo Camp, eight Groups, three Staff, one temporary Demo Admin, Activities, Rounds, and default Score Buttons; the Demo PIN is documented as non-production only.
- [x] Beginner documentation contains only verified repository commands for requirements, environment, Local Supabase, migration, seed, development, tests, and build.
- [x] Lint, typecheck, unit tests, authenticated local-Supabase integration tests, Playwright/WebKit E2E tests, and production build all pass from a clean local setup.
- [x] A simulated ten-session run passes all concurrency, idempotency, cross-Camp, close-race, and network-recovery must-pass cases.
- [ ] A documented rehearsal using at least five real iPhone/Safari devices or sessions is completed, or is explicitly marked as the remaining human Pilot gate.
- [x] No Push, merge, paid service, Production database mutation, or Production deployment is performed without separate approval.
