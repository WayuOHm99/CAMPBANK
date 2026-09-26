# Online readiness

Status: ready-for-agent

Prepare the existing Next.js/Supabase app for a staged online release with repeatable checks. Preserve the accepted Camp authorization model until its replacement is specified. Do not deploy to a hosted project without an identified target and release approval.

## Decisions

- 2026-09-26: Upgrade within Next.js 16.3 and update vulnerable transitive dependencies. Preserve the SQL-first architecture.
- Required Group colors are reference data, not Demo data. Supply identical defaults through an additive migration; preserve existing rows. Keep Demo seed usable for development.
- CI uses disposable Supabase and never requires hosted secrets. Browser tests receive local URL/key from CLI status instead of trusting `.env.local`.
- Linux CI runs browser behavior with image comparisons disabled because existing baselines are Windows-specific. Windows visual tests and physical-device pilot remain separate release gates.
- Authentication redesign and polling changes need explicit behavioral requirements and regression coverage; do not silently remove permission-revocation checks.

## Acceptance

Dependency audit, lint, typecheck, unit tests and build pass. Fresh migrations supply all colors without Demo accounts/Camps. SQL, integration and browser checks run against a disposable local database. Document any remaining failures precisely. Hosted setup and physical-device checks remain explicitly unverified until performed.
