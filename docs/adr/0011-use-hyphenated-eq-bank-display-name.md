# 0011 — Use EQ-BANK as the display spelling

## Status

Accepted — 2026-08-24

## Context

The owner refined the approved product display name from `EQ BANK` to
`EQ-BANK` and explicitly removed the spaces around the hyphen. The request
applies to every user-facing page so that navigation, headings, metadata,
installed-app labels, and exported ranking text do not present different names.

## Decision

- Render `EQ-BANK` as the product display name on every user-facing surface.
- Use the same spelling in page metadata, the PWA manifest, and generated
  ranking-share text.
- Preserve existing EQCAMP Camp names, routes, database objects, RPCs, audit
  data, CSV schemas, and browser-storage keys.
- Preserve the approved raster assets unchanged; this spelling decision does
  not create or imply a new logo asset.

## Consequences

The visible product name is consistent without a data migration or session
reset. Existing technical and Camp-domain identifiers remain compatible.
