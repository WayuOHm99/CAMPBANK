# 0010 — Use a private, calm operational UI

## Status

Accepted — 2026-08-24

## Context

The owner rejected the public-marketing treatment captured in
`pain point-image/`: a large company endorsement card, a promotional hero, a
full blue login panel, and a neon green Camp-status pill. EQ-BANK is used by
people who already received an Admin or Staff access path, so those elements
add visual noise without helping the task.

The owner also required the redesign to follow verified public examples rather
than invented styling. The applicable patterns from Vercel Geist, Shopify
Polaris, GitHub Primer, Atlassian, Carbon, GOV.UK, and USWDS are consistent:
neutral surfaces carry hierarchy, one accent family identifies interaction,
and semantic color is reserved for small, meaningful state cues.

This refines ADR-0009, whose original entry treatment rendered both raster
assets and the legal owner line prominently.

## Decision

- Home and Admin login are private, task-focused entry surfaces. They render
  `EQ-BANK` as text and omit the corporate endorsement block, legal/marketing
  copy, promotional hero, decorative artwork, and full-page color fields.
- Keep both source logos unchanged as Brand evidence. The EQCAMP asset may
  remain the provisional PWA icon; the EQGROUP asset is not repeated in the
  operational UI.
- Application chrome uses white and neutral-gray surfaces. EQCAMP deep blue is
  limited to primary actions, links, selected controls, and focus.
- Full-strength EQCAMP bright blue and EQGROUP green/orange remain inside their
  original artwork. Dark derived green/orange may appear only as a small
  status glyph, short state label, or thin attention edge on white.
- Group colors remain runtime Camp data and appear only as labeled swatches or
  narrow strips. They never become product navigation or status colors.
- Cards use a 16px radius, a 1px neutral border, and at most a subtle 1px-level
  shadow. Typography uses 700 for headings, 600 for controls/labels, and normal
  weight for body copy; Thai headings do not use compressed letter spacing.
- Camp lifecycle and connection health remain separate explicit statuses. This
  visual reset does not remove the Public Leaderboard, Staff Join Link, RPCs,
  routes, authorization, or any accepted domain workflow.

## Consequences

Private entry screens disclose no Camp directory and provide no generic Staff
login; Staff still enter through a private Staff Join Link. Normal status is
quiet while offline, integrity, and destructive actions retain explicit text
and strong contrast. This decision supersedes only the entry-surface logo and
endorsement treatment in ADR-0009.
