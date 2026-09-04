---
version: "4.0"
name: EQ BANK Private Operational UI
status: approved-for-controlled-screen-generation
source: logo/logo-eqcamp.jpg
source_sha256: 2485F0217BF75B44662F59E5E50EDA050062E8B95EBBC66C7ECE6D5192796BE1
corporate_source: logo/logo-cqgroup.png
corporate_source_sha256: 89CB0B80532B1229C644F9705C4233437E98B79FA5A86872FBA3E363562F13E4
colors:
  canvas: "#FFFFFF"
  layer: "#F5F5F5"
  ink: "#212121"
  muted: "#5C5C5C"
  divider: "#E0E0E0"
  control-border: "#638EB2"
  selected: "#E7F6FD"
  action: "#205E91"
  action-hover: "#1B507B"
  action-pressed: "#18476D"
  positive-glyph: "#407400"
  attention-glyph: "#A64800"
artwork_only_colors:
  eqcamp-bright: "#36B8F2"
  eqgroup-green: "#80E800"
  eqgroup-orange: "#FF6F00"
typography:
  display-mobile: "28px/40px 700"
  display-desktop: "36px/48px 700"
  heading-large: "24px/36px 700"
  heading-medium: "20px/30px 700"
  body: "16px/26px 400"
  body-small: "14px/22px 400"
  label: "14px/20px 600"
  caption: "12px/18px 500"
  score-number: "32px/40px 700 tabular-nums"
radius:
  small: 8px
  control: 12px
  card: 16px
  dialog: 16px
spacing: [0px, 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px]
---

# EQ BANK Private Operational UI

This file is the generation contract for the current EQ BANK redesign. It is
grounded in repository Brand evidence and the accepted product workflow. It is
not an official master Brand guide and must not fill unknowns with assumptions.

## Authority and no-guessing rule

- `VERIFIED_EVIDENCE`: exact pixels or unchanged artwork from the two source
  files named in frontmatter.
- `APPROVED_DERIVATIVE`: an opaque sRGB mix of a verified color over black or
  white, rounded to the nearest integer channel.
- `PRODUCT_DECISION`: the private operational layout, type, spacing, component,
  motion, and responsive rules in this file.
- `DOMAIN_DATA`: runtime Group colors and Camp content. They are not Brand
  tokens and may not seed application chrome.
- `FORBIDDEN`: any unlisted hue, invented workflow, invented logo, public
  marketing narrative, or inferred behavior.

If generation requires an unknown choice, return `NEEDS_DECISION` and identify
the exact missing evidence. `ASSUMPTIONS` must remain an empty array.

## Product stance

EQ BANK is a private Camp operations tool. Staff enter through a private Staff
Join Link supplied by an operator; Admins use the dedicated login. It is not a
public landing page, financial service, or promotional website.

Remove and never regenerate the treatments captured in `pain point-image/`:

- oversized EQGROUP endorsement or two-logo card;
- company/legal text placed as a prominent UI block;
- public capability hero or split black/blue headline;
- full-screen deep-blue login panel;
- decorative circles, gradients, glow, blur, or large empty marketing canvas;
- neon green/orange status fills, thick black status pills, or blinking lights.

This removal does not cancel the separate Public Leaderboard workflow. That
surface is reachable only by its Admin-controlled hard-to-guess link and must
use the same calm visual system.

## Identity and artwork

- Render `EQ BANK` as accessible product text. There is no approved EQ BANK
  logo asset; never synthesize one.
- Keep `logo/logo-eqcamp.jpg` and `logo/logo-cqgroup.png` byte-for-byte
  unchanged. Do not crop, trace, recolor, remove white backgrounds, merge, or
  infer a logo typeface.
- Private Home, Admin login, Staff Join, and operational headers use compact
  `EQ BANK` text, not a corporate endorsement card.
- The EQCAMP image may remain the provisional PWA launcher icon. The EQGROUP
  image is evidence only and is not repeated in operational screens.
- Existing Camp names such as `EQCAMP Demo` remain domain data.

## Application color allowlist

Only the frontmatter `colors` values may be used in application chrome.
Full-strength values under `artwork_only_colors` may appear only inside the
unchanged raster artwork.

| Token                    | Role and provenance                                     |
| ------------------------ | ------------------------------------------------------- |
| Canvas `#FFFFFF`         | exact logo white; page and card surface                 |
| Layer `#F5F5F5`          | verified black 4% over white; page separation           |
| Ink `#212121`            | verified black 87% over white; text and critical action |
| Muted `#5C5C5C`          | exact EQGROUP gray; secondary text                      |
| Divider `#E0E0E0`        | black 12% over white; non-text border only              |
| Control border `#638EB2` | EQCAMP deep 70% over white                              |
| Selected `#E7F6FD`       | EQCAMP bright 12% over white                            |
| Action `#205E91`         | exact EQCAMP deep; action/link/focus only               |
| Hover `#1B507B`          | action 85% over black                                   |
| Pressed `#18476D`        | action 75% over black                                   |
| Positive `#407400`       | EQGROUP green 50% over black; small glyph only          |
| Attention `#A64800`      | EQGROUP orange 65% over black; glyph/text/edge only     |

Do not use a Brand color to fill a page, metric card, normal status, or large
notification. Do not add red, teal, purple, gold, or any other semantic hue.
Group colors are the sole exception and must be confined to a labeled swatch or
narrow strip with essential text on a neutral surface.

Contrast pairs: ink/white 16.10:1, muted/white 6.69:1, white/action 6.84:1,
positive/white 5.65:1, and attention/white 5.92:1. Divider is decorative and
must never carry essential text or icon meaning.

## Typography

- Use the system UI stack with `Segoe UI` and `Noto Sans Thai` fallbacks.
- Headings use weight 700; controls and labels use 600; body uses 400.
- Do not use weight 900 as a universal visual style.
- Do not apply negative tracking to Thai text or uppercase Thai copy.
- Scores use tabular figures and comma grouping.
- Text must reflow at 200% zoom without clipping or horizontal page scroll.

## Surface, shape, and elevation

- Page is white or `#F5F5F5`; cards are white with a 1px neutral border.
- Card and dialog radius is 16px; controls are 12px. Reserve a full pill for
  short metadata only and never turn primary sections into pills.
- Standard card shadow is at most `0 1px 2px rgb(0 0 0 / 6%)`.
- No glassmorphism, colored translucent wash, decorative shadow, or backdrop
  blur is allowed.
- Minimum interactive size is 44×44 CSS px; primary fields/buttons are 48–56px.

## Interaction color roles

- Primary action: `#205E91` with white text; hover and pressed use the approved
  darker values.
- Secondary action: white or selected-blue surface, visible border, deep-blue
  label.
- Critical irreversible action: `#212121` with white text and explicit Thai
  consequence; no invented danger hue.
- Focus: 3px action ring with 3px offset on a light surface.
- Informational metrics remain white cards; blue identifies the action, not the
  data container.

## Status system

Camp lifecycle and connection health are separate axes and must be visible
together. Each status is a compact 32–36px white label with an 8px radius,
neutral border, small glyph, and explicit Thai text.

| State             | Small cue                  | Required text behavior                     |
| ----------------- | -------------------------- | ------------------------------------------ |
| Draft             | action-blue glyph          | `ค่ายฉบับร่าง`                             |
| Active            | dark-green dot/check       | `กำลังใช้งาน`                              |
| Connecting        | action-blue spinner        | `กำลังเชื่อมต่อ`                           |
| Live              | dark-green dot/broadcast   | `ข้อมูลสด`                                 |
| Degraded          | dark-orange triangle       | `อัปเดตสำรอง` plus polling explanation     |
| Closed            | gray block/lock            | `ปิดค่ายแล้ว` plus persistent block notice |
| Offline           | near-black x/offline glyph | explicit scoring-disabled/no-queue copy    |
| Integrity failure | near-black stop/edge       | persistent impact and investigation text   |

No status may use color alone, a neon fill, a full colored pill, or continuous
flashing animation.

## Layout and responsiveness

- Support 320px mobile through wide desktop, portrait/landscape, safe-area
  insets, and modern iOS/iPadOS/Android/desktop browsers.
- Gutters: 16px mobile, 24px tablet, 32px desktop. Form content stays near
  28–32rem while operational shells may use the viewport fluidly.
- Staff Group layouts: Auto, one column, two columns, and horizontal rail.
  Always open in Auto; never persist the choice.
- Group cards are top-aligned. Editing one card changes only that card and does
  not stretch or open adjacent cards.
- Admin desktop management uses independent column stacks. Disclosures do not
  share equal-height grid rows; only genuinely long bodies scroll internally.
- Dialog content is contained. On small screens, use a bottom-sheet position;
  on larger screens, center it. Preserve Escape, focus return, and page scroll.

## Motion

- Press/hover feedback: 160ms. Dialog/panel transition: 240ms.
- Animate only opacity and transform. Do not animate Group layout or History
  rows and do not add a motion library.
- `prefers-reduced-motion: reduce` disables smooth scroll, caret blink, and
  nonessential transitions while preserving state changes.

## Screen contracts

### Private Home

- Compact `EQ BANK` text, `ระบบภายในค่าย`, H1 `เข้าใช้งาน EQ BANK`, one Admin
  CTA, and the instruction that Staff use their supplied private link.
- No Camp directory, search, code entry, generic Staff CTA, company block,
  marketing hero, or disclaimer banner.
- A Demo shortcut may exist only in the local development build.

### Admin login

- Centered single form on mobile and desktop; never a split marketing layout.
- Admin selector, exactly four PIN digits, submit, deterministic Back.
- One real password input overlays four visible positions. The current position
  has a caret; screen readers hear `หลักที่ N` and progress `N จาก 4`.
- Preserve paste, Backspace, autofill, lockout, errors, and PIN-change workflow.

### Staff Join and Staff Camp

- Staff Join lists only the members returned by the private link.
- Staff Camp shows compact product/Camp context, separate lifecycle and live
  statuses, actor/activity/round/sync metadata, neutral Budget card, and Group
  cards distinguished by a narrow runtime-color strip.
- Ordinary Score remains one tap. Only the tapped action is pending. Confirm
  only buttons whose stored option requires it. Offline never queues a write.
- Rename is a compact icon control and expands only the selected Group card.

### Camp creation and setup

- Camp Budget is a comma-formatted non-negative whole number.
- Setup step 1 controls only Group count, direct entry, Add, and Reduce.
- Step 2 shows each color before selection in a swatch dialog, disables already
  used colors with a written reason, and keeps Group Name optional.
- Step 3 adds Staff. Step 4 reviews readiness and supports saving Draft without
  inventing missing values.

### Admin dashboard

- Neutral metric cards, one action-blue family, independent disclosure columns,
  and explicit Camp/link/security controls.
- Score Button editor separates Add/Deduct from digit-only magnitude and derives
  the signed value and label automatically.
- Staff/Public URLs offer Open, Copy, and Share; rotation remains confirmed,
  reasoned, and audited.
- Complete ranking offers CSV plus copy-ready text; Public Top 3/5/10 never
  truncates the Admin record.

### History and Public Leaderboard

- History uses neutral rows, narrow Group strips, explicit signed numbers, and
  immutable snapshot context.
- Public Leaderboard uses the same white/neutral surface system. First place may
  use a strong blue border/text cue, never a full bright-blue card or dark-blue
  page. Preserve Admin-controlled visibility and result limit.

## Generation output contract

Every generated screen must expose:

1. `COLOR_LEDGER` mapping every chrome literal to an approved token.
2. `ASSUMPTIONS: []`.
3. Exact screen state, viewport width, data state, and workflow invariant.
4. A list of reused repository components/assets and any unresolved
   `NEEDS_DECISION` items.

Forbidden output: a substituted palette; public marketing content; company
endorsement card; invented EQ BANK logo; altered raster; gradients; glass;
decorative blobs; neon status fills; new semantic hues; fixed iPhone frames;
Staff PIN; generic Camp code entry; persisted Staff layout; global Score-button
locking; offline Score queue; mock RPC behavior; or any change to accepted
authorization/domain workflows.
