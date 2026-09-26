# Group color library and capacity

Status: ready-for-agent

Camps sometimes need more than 20 Groups, and the 20 fixed Color Presets run out. Group colors mirror the physical scarves or ribbons participants wear (see `.scratch/eqcamp-v1/spec.md` story 3), so every color must be a real, nameable color that Admin can match to fabric bought in Thailand.

## Decisions

- 2026-09-26: Raise the Group limit from 1–20 to 1–30 per Camp (user: largest expected Camp is at most 30 Groups).
- 2026-09-26: Group colors stay unique within a Camp. No duplicated colors distinguished only by number or name.
- 2026-09-26: Replace "20 colors" with a searchable Color Preset library of roughly 60–80 colors, so a 30-Group Camp still has at least twice as many choices as Groups. Colors are global reference data supplied by an additive migration, not per-Camp custom colors.
- Existing 20 preset keys, names and hex values are unchanged. Existing Groups, Transactions and snapshots must not change.
- Every preset has a Thai name used by Thai fabric and ribbon sellers, an English name for search, and a hue family (red, orange, yellow, green, cyan/teal, blue, purple, pink, brown, neutral).
- Free hex entry ("any color in the world") is out of scope for now. It would break the `groups.color_key → color_presets` reference and the uniqueness rule; revisit only if the library proves insufficient.

## Why not simply add many colors

People reliably tell apart roughly 10–12 colors at a glance; beyond ~20, neighbors such as เขียว / เขียวมะกอก / เขียวมะนาว blur on a phone outdoors, and about 8% of men have red–green color vision deficiency. With up to 30 Groups the product must help Admin pick colors that are far apart and keep non-color cues visible.

## Behavior

1. **Library**: Color Presets gain `name_en` and `family`. The migration inserts new presets with `on conflict do nothing`; `sort_order` orders presets by family, then lightness.
2. **Picker search**: The Group color dialog (`src/components/shared/color-picker-dialog.tsx`) gets a search field matching Thai name, English name, family and hex, plus family filter chips. Colors used by another Group stay visible but disabled with "ใช้โดย …", as today.
3. **Auto-assign by distance**: "Assign colors automatically" chooses each next color with the largest minimum perceptual distance (OKLab) from colors already assigned, instead of list order.
4. **Near-color warning**: Picking a color whose distance to another Group's color is below a threshold shows a non-blocking warning naming that Group. Pick the threshold with the existing 20 presets as fixtures and record it here.
5. **Capacity**: Every 20-Group limit becomes 30: `save_draft_setup` and `activate_camp` (redefine from their latest definitions in `20260824040623_flexible_groups_and_public_results.sql`), and the Draft setup UI checks in `src/components/admin/admin-camp-screen.tsx` (readiness label, maximum, add button, validation message, step copy).
6. **Non-color cue**: Show the configured Group order number beside the color swatch on Staff Group cards, Admin lists and the Leaderboard, so Staff can confirm "7 · แดง" without relying on hue alone. Staff quick search already exists and must also match the number.

## Acceptance

- Fresh migrations (with `--no-seed`) supply the full library; update `supabase/tests-production/reference_data.test.sql` counts; existing 20 rows keep their key, Thai name, hex, text color and sort order.
- Integration: a Draft Camp saves and activates with 30 Groups and rejects 31 and duplicate colors, with Thai error copy.
- Unit: distance-based auto-assign and near-color threshold.
- E2E: Admin finds a color by Thai and English search and sets up 30 Groups on iPhone Safari and desktop Chrome; Staff finds a Group by number.
- Windows visual baselines updated only where layouts intentionally changed.
- Lint, typecheck, unit, integration, E2E and build pass. Production migration is applied only with the user's approval.

## Progress

- 2026-09-26: `NEAR_COLOR_DISTANCE = 0.08` (OKLab). It already flags three confusable original pairs: เขียว/เขียวมะนาว 0.045, น้ำตาล/ทอง 0.056, เขียวอมฟ้า/คราม 0.058.
- 2026-09-26: Added `src/lib/colors/color-distance.ts` with unit tests (not yet used by the UI).
- 2026-09-26: Draft library of 60 colors (20 original + 40 new, no new color within 0.05 of another) in `draft-migration.sql`; dry-run in a rolled-back transaction applied cleanly. Auto-assigning 30 Groups keeps every pair at least 0.097 apart. Six very light colors (ขาว, ครีม, เบจ, เหลืองมะนาว, เหลือง/เขียวสะท้อนแสง) need a swatch border on white surfaces.
- Blocked: UI and migration placement wait until Codex commits its uncommitted deployment/invitation work.

## Open

- The user reviews the proposed color list (Thai names and swatches) before the migration reaches production.
