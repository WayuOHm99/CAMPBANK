# Online deployment readiness

Live website: https://campbank-fawn.vercel.app (Vercel production deployment `dpl_HeAeaycjgdYig99K2v8S8safknNe`). This deployment was uploaded from the local working tree; include the pending deployment/gate changes in Git before relying on subsequent Git-triggered deployments.

The production project is `oh-m-it-zx/campbank` on Vercel, connected to `WayuOHm99/CAMPBANK` on GitHub. Its database is Supabase `CAMPBANK` (`hhbbabvlmgoufyppvatc`) in Singapore under `WayuOHm99`. All 14 repository migrations have been applied. No Demo seed was applied online.

On 2026-09-26 the user explicitly authorized opening the existing name + four-digit PIN login and enabling Anonymous Sign-ins. Production now sets `EQCAMP_ACCESS_ENABLED=true`. The first Admin, `แพนด้า`, was created with the owner's hidden-input PIN; only its bcrypt hash was transferred to the cloud, and the temporary local hash file was removed. Bootstrap was audited. No Service Role key was placed on Vercel.

Verification for commit `49f01f5` (`feat: harden camp archive operations and live sync`) passed locally: production build, lint, typecheck, 44 unit tests, 25 integration tests on disposable Local Supabase, 19 SQL assertions, dependency audit with zero vulnerabilities, and the full desktop Chromium E2E suite (16/16). The browser suite covers Admin login/PIN change/Camp creation and activation, masked PIN entry, Staff scoring, two Staff sessions receiving Realtime updates and Undo, and Admin archive/unarchive workflows. Screenshot comparisons were skipped; mobile/physical-device pilot verification remains outstanding. The owner must complete the first live PIN login personally and verify that Vercel Production serves this commit.

Use separate hosted Supabase projects for staging and production when access is launched. Preview credentials are intentionally not configured against the production database.

## Verification before release

The `Quality` GitHub Actions workflow checks dependency advisories, lint, types, unit tests and build. A separate job starts disposable Local Supabase, verifies migrations without Demo seed, runs SQL and integration tests, then runs browser behavior tests. No hosted credentials are required. Configure both jobs as required branch checks in GitHub before enabling production deployment from the release branch.

Linux CI deliberately skips screenshot comparisons because the committed image baselines were captured on Windows. Run the full `npm run test:e2e` on Windows for visual verification. CI success does not satisfy the physical-device observations in [pilot-rehearsal.md](pilot-rehearsal.md).

The integration and E2E runners reset Local Supabase data. Run them only against a disposable local project. The E2E runner supplies local URL/key directly to the browser server, overriding any hosted URL in `.env.local`.

## Hosted database

The following steps describe provisioning future environments. Production Auth and first Admin setup have already been completed; do not repeat bootstrap.

1. Select the intended staging project first; check its Postgres major version against `supabase/config.toml` (currently 17).
2. Authenticate the Supabase CLI, link that project, and inspect `supabase db push --dry-run` before applying `supabase db push`.
3. Do not use `--include-seed`: `supabase/seed.sql` contains Demo accounts and known PINs. Required color presets are now supplied by migrations.
4. Enable Anonymous Sign-ins, configure the application URL, and verify the deployed RLS/RPC grants and Realtime publication. Local config is not proof that hosted Auth settings are configured.
5. Bootstrap the first Admin from a trusted interactive terminal using `npm run admin:bootstrap` with the target URL and server-only Service Role key. Change the temporary PIN on first login, then remove the bootstrap credential where no longer needed.
6. Test creating/configuring/activating a Camp with no Demo seed, Staff access, scoring, Undo, visibility, closure and cross-Camp isolation.

## Web deployment

Connect the repository to Vercel using its Next.js preset and Node.js 24. Use `npm ci` and `npm run build`. Configure these separately for Preview and Production **before building**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<target-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-legacy-anon-key>
```

Never put a Service Role or secret key in either browser variable. The app does not need that privileged key on Vercel. Next.js bundles public variables at build time: changing them requires a new build. Never promote a Preview built against staging as production without rebuilding for the production database.

Use Preview with staging data first. Select the release branch and domain only after required checks and the pilot pass. Database migrations are a separate release step; Vercel Git deployment does not apply them. Deploy backward-compatible migrations before dependent web changes. A web rollback does not undo database migrations or restore lost data.

## Remaining release decisions

- Anonymous Auth abuse protection: implement and test CAPTCHA token acquisition in the browser before enabling CAPTCHA in hosted Auth. Account for devices sharing one Wi-Fi/IP.
- Admin account lockout and recovery: review exposure before opening the Admin page publicly. Changing to Google or Passkeys changes ADR-0004 and needs an agreed access model.
- The user selected individual revocable Staff invitations. Their migration and UI are present. Integration tests now use individual invitations and verify rotation/revocation. Local Demo invitations use deterministic test-only values; never seed production.
- Retain periodic permission/visibility checks until replacement invalidation is tested. Do not remove polling merely because score Realtime works.
- Confirm provider plan, backup retention, a successful restore rehearsal, error alerting and ownership. Do not put PINs, private join links, tokens or request bodies in telemetry.

## References

- [Vercel Git deployment](https://vercel.com/docs/git)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase anonymous sign-ins and abuse prevention](https://supabase.com/docs/guides/auth/auth-anonymous)
