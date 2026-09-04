# EQ-BANK design system

> Revised 2026-08-25 by ADR-0012, which supersedes ADR-0010. Imagery, brand
> panels, and the EQGROUP colours are now in scope. Sections below marked
> **v6** replace what ADR-0010 specified.

## Product identity

`EQ-BANK` is the user-facing product name. Existing Camp data such as
`EQCAMP Demo`, routes, RPCs, database objects, CSV fields, and `eqcamp:*`
browser keys remain unchanged.

The repository contains two unchanged source assets:

- `logo/logo-eqcamp.jpg` — EQCAMP program artwork and provisional PWA icon.
- `logo/logo-cqgroup.png` — owner-confirmed EQGROUP corporate artwork despite
  the stale filename.

Neither image is a license to invent a new logo, crop/recolor the artwork, or
fill application surfaces with every sampled hue. Private Home, Admin login,
and operational headers use accessible `EQ-BANK` text. The large corporate
endorsement shown in `pain point-image/` is intentionally absent from the UI.

## Visual direction

**v6.** The entry surface is promotional: a brand-coloured panel, the EQCAMP
mark as artwork, and the EQGROUP credit. Everything behind the entry surface
stays an internal field tool. It follows
the shared pattern found in the official Vercel Geist, Shopify Polaris, GitHub
Primer, Atlassian, Carbon, GOV.UK, and USWDS guidance: neutral surfaces create
hierarchy; one accent family marks interaction; semantic color communicates a
specific state and is never decoration.

Application chrome stays flat and opaque. The entry surface may use a hero, a
single-hue gradient panel, and the mark as a low-opacity watermark. Glass,
glow, and decorative circles remain out.

## Approved application tokens

**v6.** The blue is a twelve-step scale with a fixed role per step (Radix
convention): 3 component surface, 6 separator, 7 interactive border, 9 solid
fill, 10 solid hover, 11 and 12 text. Steps 3/7/9/10/12 are the exact values in
the table below; the rest are derived with `color-mix()`. Neutrals carry a
little of the brand hue: canvas `oklch(0.977 0.003 240)`, sunk
`oklch(0.966 0.005 240)`, hairline `oklch(0.905 0.008 240)`. Text colours are
unchanged, so every contrast pair below still holds. The EQGROUP green
`#80E800` and orange `#FF6F00` are permitted on the entry surface.

Runtime Group colors are domain data and are excluded from this token table.
They may appear only as labeled swatches or narrow Group strips.

| Role                          | Value     | Provenance and limit                  |
| ----------------------------- | --------- | ------------------------------------- |
| Canvas / surface              | `#FFFFFF` | exact logo canvas                     |
| Subtle layer                  | `#F5F5F5` | black 4% over white                   |
| Primary text / critical       | `#212121` | black 87% over white                  |
| Secondary text                | `#5C5C5C` | exact EQGROUP gray                    |
| Divider                       | `#E0E0E0` | black 12% over white; decorative only |
| Strong control border         | `#638EB2` | EQCAMP deep blue 70% over white       |
| Selected surface              | `#E7F6FD` | EQCAMP bright blue 12% over white     |
| Primary action / link / focus | `#205E91` | exact EQCAMP deep blue                |
| Action hover                  | `#1B507B` | deep blue 85% over black              |
| Action pressed                | `#18476D` | deep blue 75% over black              |
| Positive status glyph         | `#407400` | EQGROUP green 50% over black          |
| Attention status glyph/text   | `#A64800` | EQGROUP orange 65% over black         |
| Add Score fill                | `#205E91` | exact EQCAMP deep blue                |
| Subtract Score border/glyph   | `#36B8F2` | exact EQCAMP sky blue                 |
| Subtract Score surface        | `#E7F6FD` | EQCAMP sky blue 12% over white        |

`#80E800` and `#FF6F00` at full strength are artwork-only. `#36B8F2` may appear
as the thin Subtract Score border/glyph, but not as a page, card, metric,
status, notification, or large button fill.

Verified contrast pairs used by the UI include `#212121` on white (16.10:1),
`#5C5C5C` on white (6.69:1), white on `#205E91` (6.84:1), `#18476D` on
`#E7F6FD` (8.79:1), `#407400` on white (5.65:1), and `#A64800` on white
(5.92:1). `#E0E0E0` is not a text color.

## Typography and hierarchy

- **v6.** Anuphan, self-hosted through `next/font`, falling back to
  `Noto Sans Thai` then the system stack.
- **v6.** Negative letter-spacing applies to numbers only (`tnum`:
  `tabular-nums` with `-0.022em`). Thai never takes it — the vowel and tone
  marks collide.
- Primary page title: 28–36px, weight 700, normal Thai letter spacing.
- Section title: 20–24px, weight 700.
- Control and label: 14–16px, weight 600.
- Body: 14–16px, weight 400 with 1.5–1.65 line height.
- Score number: weight 700 with tabular figures.
- Do not use weight 900 as the default hierarchy and do not compress Thai
  headings with arbitrary negative tracking.

## Shape, elevation, and spacing

- **v6.** Chips 8px, controls 10px, cards/dialogs 14px. Inner radius equals
  outer radius minus padding. Reserve full pills for short metadata chips only.
- **v6.** Depth is a shadow stack, not a border: `elev-1` is a 1px spread ring
  plus `0 1px 2px`, `elev-2` adds a soft `0 10px 20px -10px` for floating
  surfaces, and `elev-solid` gives solid buttons an inset top highlight.
- Page gutters: 16px mobile, 24px tablet, 32px desktop.
- Interactive targets are at least 44×44 CSS pixels; primary form controls are
  normally 48–56px high.
- Support 320px upward, portrait/landscape, tablet/desktop, safe areas, 200%
  zoom, and content-driven wrapping without horizontal page overflow.

## Status and feedback

Camp lifecycle and connection health are separate axes and remain visible
together. A normal state is a white 32–36px compact label with a neutral border,
small glyph, and explicit Thai text:

| State                       | Treatment                                               |
| --------------------------- | ------------------------------------------------------- |
| Draft / connecting          | deep-blue glyph or spinner + explicit label             |
| Active / live               | dark-green glyph + `กำลังใช้งาน` / `ข้อมูลสด`           |
| Degraded / warning          | dark-orange glyph/text or 3px attention edge on white   |
| Closed                      | gray glyph + `ปิดค่ายแล้ว` and persistent blocking copy |
| Offline / integrity failure | near-black glyph/edge + explicit consequence            |

Never use a neon fill, thick black pill outline, continuous blinking light, or
color as the only cue. Offline copy states that scoring is disabled and nothing
will be queued for later.

## Component rules

- Primary button: deep blue with white text; hover/pressed use the approved
  darker derivatives. Do not use deep blue as an informational card fill.
- Secondary button: white or selected-blue surface, visible border, deep-blue
  label. Critical irreversible actions use near-black and explicit Thai copy.
- Score action pair: Add uses an EQCAMP deep-blue fill with white content;
  Subtract uses the soft sky-blue surface, exact sky-blue border/glyph, and
  deep-blue text. Both show an explicit `เพิ่มคะแนน`/`ลดคะแนน` label, a
  plus/minus glyph, and a signed tabular value. Use the same pair in Staff
  cards, Admin previews, direction controls, and confirmation dialogs; meaning
  must never depend on color alone.
- Field: visible label, neutral or strong border, associated help/error, and a
  44px minimum target. Placeholder text never replaces the label.
- Card: white, neutral border, small radius/shadow. Group identity is a narrow
  runtime-color strip plus its written color and Group Name.
- Notice: white surface with explicit text and a 3px semantic left edge only
  when attention is needed.
- Dialog: centered on wider screens and bottom-sheet-like on small screens;
  opaque white, contained scrolling, Escape support, and focus return.
- Disclosure: only the selected panel opens. Desktop uses independent column
  stacks so opening one panel cannot stretch or drop its neighbor.
- Motion: 160–240ms color/opacity/transform feedback only. Respect
  `prefers-reduced-motion`; avoid layout animation and performance-heavy blur.

## Private entry surfaces

- **v6.** Home is a two-panel entry: a brand panel carrying the EQCAMP mark and
  the product promise, and an action panel carrying the EQGROUP credit, one
  Admin action, the instruction that Staff use their private Camp link, and a
  short capability list.
- Home still exposes no Camp directory, no search, and no generic Staff login.
  These are access-control guarantees, not styling, and `tests/unit/home-page.test.tsx`
  holds them.
- Admin login is a centered form on every viewport: Admin selector, one real
  four-digit password field over four visible positions, progress, submit, and
  Back.
- The active PIN position has a visible caret and an announced `หลักที่ N`;
  typing, paste, Backspace, autofill, and numeric keyboards continue to work.

## Workflow-specific rules

- Camp creation formats the Camp Budget with comma-grouped whole numbers while
  preserving the exact integer sent to PostgreSQL.
- Setup step 1 manages only Group count. Step 2 assigns a unique visible color
  and optional Group Name; a Group may be saved without a name.
- The color picker shows swatches before selection, identifies used colors,
  supports arrow/Home/End/Escape, contains long content, and returns focus.
- Staff Group layout starts in Auto on every page open and may switch to one
  column, two columns, or horizontal rail. The choice is not persisted.
- Editing a Group Name expands only that top-aligned Group card.
- Score Button editing separates Add/Deduct from a positive digit-only
  magnitude and derives the sign and label before sending the existing signed
  RPC value.
- Staff/Public links show the full absolute URL plus Open, Copy, and Share;
  unsupported Share falls back to Copy. Rotation remains confirmed and audited.
- Admin complete ranking provides CSV and copy-ready text. Public Top 3/5/10
  controls only the separate Public Leaderboard output.

## Verification

Verify Home, Admin login, Staff Join, Staff scoring, Admin setup/dashboard,
History, and Public Leaderboard at 320, 390, 834, and 1440 CSS pixels. Required
quality gates are formatting, lint, typecheck, unit, authenticated integration,
responsive Playwright E2E, concurrency, and production build. A physical-device
rehearsal remains the human Pilot gate.
