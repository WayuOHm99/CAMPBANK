# EQ BANK Brand evidence ledger

Status: verified raster evidence; not an official master Brand guide  
Evidence date: 2026-08-24  
Stitch project: `EQCAMP Redesign` (`15767790009660909646`)

## Sources

| File                    | Verified properties                                                                                                              | Product classification                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `logo/logo-eqcamp.jpg`  | SHA-256 `2485F0217BF75B44662F59E5E50EDA050062E8B95EBBC66C7ECE6D5192796BE1`; 700×700; RGB JPEG; visible `EQCAMP` and `SINCE 2017` | EQCAMP program artwork; provisional PWA icon                                         |
| `logo/logo-cqgroup.png` | SHA-256 `89CB0B80532B1229C644F9705C4233437E98B79FA5A86872FBA3E363562F13E4`; 250×250; indexed PNG rendered without alpha          | corporate artwork supplied by the owner; evidence-only in the private operational UI |

The owner confirmed the legal company name as
`บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)` and the product display name as `EQ BANK`.
No EQ BANK logo asset exists, so the product name is rendered as text and no
wordmark is synthesized.

No SVG, AI, EPS, PDF, source font, or official Brand manual was found in the
repository. Clear space, minimum size, monochrome treatment, alternate
backgrounds, and launcher mask treatment remain undocumented.

## EQCAMP exact pixel evidence

These are exact RGB pixels counted from the compressed JPEG, not claims about
an uncompressed master file.

| Value     | Exact pixels | Example coordinates                   | Observed role                    |
| --------- | -----------: | ------------------------------------- | -------------------------------- |
| `#36B8F2` |       11,263 | `(339,146)`, `(341,146)`, `(339,147)` | bright-blue fill and `CAMP` text |
| `#205E91` |          433 | `(434,272)`, `(411,278)`, `(409,280)` | deep-blue rocket/mark and text   |
| `#000000` |        3,704 | `(203,103)`, `(204,103)`, `(205,103)` | orbit strokes and marks          |
| `#FFFFFF` |      396,294 | `(0,0)`, `(1,0)`, `(2,0)`             | canvas and negative space        |
| `#666666` |          317 | `(203,109)`, `(314,124)`, `(468,124)` | grayscale caption/edge pixels    |

Nearby JPEG values such as `#35B7F1` are compression/antialiasing content and
must not become separate tokens.

## Corporate exact pixel evidence

Dominant exact pixels in the PNG include white `#FFFFFF` (50,588), blue
`#37B8F0` (2,980), green `#80E800` (2,676), orange `#FF6F00` (2,282), green
`#7CE700` (984), blue `#38B1F0` (389), and gray `#5C5C5C` (158). The indexed
image contains 128 exact colors including edge variants; frequency alone does
not establish a master palette.

The near-blue and near-green variants remain artwork-only because the available
rasters do not prove which value is canonical. The exact green, orange, and gray
may be recorded as evidence, but the owner's latest design correction limits
full-strength green/orange to unchanged artwork.

## Observable visual language

The EQCAMP artwork uses a white square canvas, generous negative space, a
centered blue orb, black hand-drawn orbit/cross marks, a deep-blue outlined
rocket-like mark, an uppercase blue `EQCAMP` treatment, and a small gray
caption. These are observations only; no mascot, narrative, personality, or
typeface is inferred.

The corporate raster combines multiple saturated colors on white. That makes it
valid artwork evidence, not permission to distribute every hue throughout the
application.

## Approved application policy

- Private Home, Admin login, Staff Join, and operational headers use compact
  accessible `EQ BANK` text. The large corporate endorsement treatment shown in
  `pain point-image/` is intentionally removed.
- White and black-derived neutrals form the application hierarchy.
- Exact deep blue `#205E91` is the sole action/link/focus family.
- Full-strength `#36B8F2`, `#80E800`, and `#FF6F00` are artwork-only.
- Dark green `#407400` and dark orange `#A64800` are formula-recorded
  derivatives permitted only for small status glyph/text/attention edges on
  white.
- Runtime Group colors are Camp data. They appear only with a written color
  label as a swatch or narrow strip and never become Brand/status colors.
- All remaining finite derivatives, contrast pairs, type, layout, component,
  and workflow limits are recorded in `.stitch/DESIGN.md` version 4.0.

## Evidence limits

1. Official master RGB/HEX values are unknown because the sources are raster
   exports.
2. Logo/wordmark fonts cannot be identified reliably.
3. No licensed Brand font or official Thai type specification is available.
4. The corporate raster's embedded wording must not be re-typeset or corrected
   inside the image.
5. PWA maskable artwork remains unapproved; the current icon purpose is `any`.

Any value or claim outside this ledger and `.stitch/DESIGN.md` is
`NEEDS_DECISION`, not a generation prompt.
