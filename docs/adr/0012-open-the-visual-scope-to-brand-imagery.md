# 0012 — Open the visual scope to brand imagery and a graded blue scale

## Status

Accepted — 2026-08-25. Supersedes ADR-0010 in full.

## Context

ADR-0010 locked the product to a private, calm operational surface: no hero, no
imagery, no full-page Brand fill, no corporate endorsement, and Group colours
confined to labelled swatches. That decision was made when the owner rejected
the public-marketing treatment captured in `pain point-image/`.

The owner has since reversed it and asked for the opposite: real imagery, brand
fills, and the EQGROUP colours in use. The two repository logos were also still
unused as artwork — `logo/logo-eqcamp.jpg` is a lightbulb-and-orbit mark with a
wordmark whose letters run from deep blue to bright blue, and
`logo/logo-cqgroup.png` is the EQGROUP mark in green, blue, and orange.

Separately, the palette had grown without a structure. Five blues were in use
(`#E7F6FD`, `#638EB2`, `#205E91`, `#1B507B`, `#18476D`) with no defined role
per value, `--eq-brand-600/700/900` all resolved to the same colour, and the
neutral greys (`#F5F5F5`, `#E0E0E0`) were untinted, so they read as a separate
family from the brand blue rather than part of one system.

## Decision

- Imagery, brand-coloured panels, gradients within one hue, and the EQGROUP
  green/blue/orange are permitted. The entry surface carries a hero, a brand
  panel, and the EQGROUP credit.
- Both logos stay unmodified as sources. Derived assets in `public/brand/`
  (`eqcamp-mark.png`, `eqcamp-lockup.png`, `eqgroup-mark.png`) are the same
  artwork with the white background keyed to transparency and nothing else
  changed. No new mark may be drawn and no proportion may be altered.
- The EQCAMP mark alone is used on brand-coloured surfaces and in application
  headers. The full lockup is used only on light surfaces, because its wordmark
  letters are deep blue and do not read on the brand panel.
- The blue is a twelve-step scale with a fixed role per step, following the
  Radix scale convention: 3 is a component surface, 6 a separator, 7 an
  interactive border, 9 the solid fill, 10 its hover, 11 and 12 text. The five
  values already in use become steps 3, 7, 9, 10, and 12 unchanged; the missing
  steps are derived from them with `color-mix()` rather than chosen by eye.
- Neutral surfaces carry a small amount of the brand hue
  (`oklch(0.977 0.003 240)` canvas, `oklch(0.905 0.008 240)` hairline). Text
  colours are untouched, so every contrast pair recorded in
  `docs/design-system.md` still holds.
- Depth is a shadow stack rather than a border: a zero-blur 1px spread ring,
  optionally with real shadows above it, and an inset top highlight on solid
  buttons. Card radius moves from 16px to 14px, controls to 10px.
- Thai text never takes negative letter-spacing; its vowel and tone marks
  collide. Numbers take `tabular-nums` with `-0.022em`. The `tnum` utility
  carries both.
- Anuphan is the interface typeface, self-hosted through `next/font`.
- Tokens live in Tailwind's `@theme` block so they generate utilities. The 46
  existing `--eq-*` names remain defined as aliases; the 432 references to them
  in components are not rewritten.

## Consequences

The entry surface is now promotional in a way ADR-0010 forbade, and the unit
test that asserted the absence of the EQGROUP credit is inverted. What did not
change: Home still exposes no Camp directory and no Staff login, Staff still
enter only through a private Camp link, and every RPC, route, and authorisation
boundary is untouched.

One rule from ADR-0010 survives on operational rather than aesthetic grounds:
the Add and Subtract Score pair keeps its blue pairing, its Thai label, its
glyph, and its signed value. Issue 17 requires that the meaning of a Score
action never depend on colour alone, and Staff act on these buttons at speed in
daylight. Recolouring them green and orange would put that at risk, so it is
out of scope for this decision rather than permitted by it.

Where a Staff card previously repeated `เพิ่มคะแนน` and `ลดคะแนน` inside all
four buttons, the label now appears once per direction above its group of
buttons, and each button keeps its `aria-label`. Group colour moved from a
10px band above the card to a 4px rail along its full height.
