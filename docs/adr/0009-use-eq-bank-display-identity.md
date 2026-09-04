# 0009 — Use EQ BANK as the display identity without renaming the domain

## Status

Superseded — 2026-08-24; spelling superseded by ADR-0011 and entry-surface
logo treatment superseded by ADR-0010

## Context

The owner approved `EQ BANK` as the product name shown to users and confirmed
the legal company name `บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)`. The existing system
already contains EQCAMP Camp data, URLs, database objects, RPCs, audit labels,
and browser preference keys. Renaming those identifiers would add migration
risk without changing user-facing capability.

Two raster files are approved evidence: `logo/logo-eqcamp.jpg` is EQCAMP
program/heritage artwork and `logo/logo-cqgroup.png` is the EQGROUP corporate
endorsement artwork despite its stale filename.

## Decision

- Render `EQ BANK` as product text in metadata, PWA name, entry surfaces, and
  operational headers.
- Render `บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)` as the legal owner line.
- Retain both raster assets unchanged as evidence; ADR-0010 controls whether
  either asset appears in private operational entry surfaces. Do not invent an
  EQ BANK logo or alter the embedded artwork text.
- Keep Camp names such as `EQCAMP Demo` as Camp data.
- Keep routes, database tables, RPCs, generated types, `camp_id`, CSV schemas,
  and `eqcamp:*` localStorage keys unchanged.
- Continue to describe scores as simulated activity points, never deposits,
  payments, balances, or real money.

## Consequences

The product identity changes atomically at user-facing surfaces without a data
migration or session reset. The PWA temporarily uses the unchanged EQCAMP
program artwork as an `any` icon; no maskable purpose is claimed until an
owner-approved EQ BANK launcher asset exists. Brand/legal review of the name
remains an organizational release gate outside application behavior.
