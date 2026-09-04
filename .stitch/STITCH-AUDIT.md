# Stitch design-system audit

Status: historical generated themes rejected; local v4 is the current contract  
Project: `EQCAMP Redesign` (`15767790009660909646`)

## Rejected external output

The earlier Stitch assets and generated `Aerospace Modernist` theme are not
implementation references. They introduced unsupported narrative, Hanken
Grotesk/Inter/JetBrains Mono, substituted blue seeds, red/orange semantic
families, gradients, off-palette surfaces, and layout/component decisions that
were absent from the evidence supplied at that time.

Rejected asset records are retained only for traceability:

- uploaded screen instance `6499403386103108887`;
- generated design-system asset `58c262d14d42467fa30ff863e960bad7`;
- controlled v2 asset `17115788355264709786`, which did not persist required
  font fields;
- font-corrected asset `f0347904e6eb4bfeb8f072333b85d489`, which regenerated
  unapproved colors and gradients.

No screen from those assets is approved for implementation.

## Owner correction recorded on 2026-08-24

The owner rejected the colorful/public treatment visible in
`pain point-image/` and required a private operational product:

- remove the oversized company/two-logo block and marketing hero;
- remove the full blue login panel and decorative artwork;
- remove neon full-fill status pills;
- reset the whole product to neutral surfaces, one deep-blue action family,
  and small semantic status cues;
- preserve the accepted Camp, Admin, Staff, Public Leaderboard, scoring,
  history, and security workflows.

`.stitch/DESIGN.md` version 4.0 is the replacement contract. Full-strength
bright blue, green, and orange are artwork-only. Application chrome is limited
to the finite token ledger in v4; runtime Group colors remain labeled domain
data.

## Gate for any future Stitch import or generation

Before any returned Stitch design can be used:

1. The embedded source must exactly match `.stitch/DESIGN.md` v4.
2. Product name must be `EQ BANK`; no public marketing narrative or invented
   EQ BANK logo may appear.
3. `COLOR_LEDGER` must contain only the v4 application tokens plus labeled
   runtime Group colors.
4. There may be no gradient, glow, glass, blur, decorative circle, full-page
   Brand fill, neon status, or oversized corporate endorsement.
5. Fonts must use the documented system/Noto Sans Thai-compatible stack.
6. Home and Admin login must remain private, task-focused entry surfaces.
7. Every workflow and responsive state must be checked against the repository
   spec and real implementation before adoption.
8. `ASSUMPTIONS` must be empty; unresolved choices return `NEEDS_DECISION`.

Stitch acceptance alone is not approval. A returned screen becomes a reference
only after literal color, copy, responsive, accessibility, and workflow audits
all pass.
