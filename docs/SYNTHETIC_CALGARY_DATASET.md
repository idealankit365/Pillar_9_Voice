# Synthetic Calgary property database

This package includes a ready, deterministic database for agent development:

- `fixtures/calgary-synthetic-5000.sqlite` — SQLite database with exactly 5,000 synthetic property records.
- `datasets/synthetic-calgary/properties.jsonl` — the same records as JSON Lines for retrieval, evaluation, or permitted training experiments.
- `datasets/synthetic-calgary/property-schema.json` — strict 119-field JSON Schema.
- `datasets/synthetic-calgary/manifest.json` — counts, source hashes, splits, validation result, and dataset hash.
- three source snapshots containing City of Calgary street-name rows, unique current major-road names, and residential community labels.

## What “coverage” means

The 2026-08-30 source snapshot contains 8,785 Street Names rows. One row has no street name and is intentionally rejected. All 8,784 named street-reference rows are linked to at least one synthetic property as either its primary street-language reference or a simulated nearby-road reference. All 380 unique current Calgary names selected from the Major Road Network are also linked as simulated nearby-major-road references. All 223 residential community labels are represented, as are NW, NE, SW, and SE Calgary.

This is catalog-language coverage, not a claim that 5,000 properties can represent every real Calgary address or every geographic relationship. Street/community proximity is deliberately simulated. The records use non-deliverable identifiers such as `SYN-CGY-000001 — synthetic property on Macadams Gate NE`, not real parcel addresses.

## Dataset profile

| Item | Count |
|---|---:|
| Synthetic properties | 5,000 |
| Required fields per property | 119 |
| Named street catalog rows covered | 8,784 / 8,784 |
| Major-road names covered | 380 / 380 |
| Residential communities covered | 223 / 223 |
| Train split | 3,996 |
| Development split | 493 |
| Locked holdout | 511 |

Field groups:

| Group | Fields |
|---|---:|
| Identity and source | 11 |
| Listing lifecycle | 5 |
| Price and fees | 9 |
| Address and area | 19 |
| Proximity | 5 |
| Classification | 11 |
| Rooms and size | 14 |
| Interior | 12 |
| Exterior | 7 |
| Parking | 5 |
| Utilities | 5 |
| Accessibility | 1 |
| Marketing/public presentation | 9 |
| Governance | 6 |

Every record includes a synthetic warning, source labels, a property-level split, group provenance, visibility policy, completeness indicators, and a record hash. There are no private remarks, showing instructions, access codes, occupant names, member-only fields, real MLS identifiers, or copied MLS descriptions.

## Important boundary

The 119-field schema is a comprehensive development fixture, not the confirmed Matrix/OneRLS field dictionary. Exact Matrix identifiers, enums, units, visibility rules, null handling, licensing, evaluation rights, and training/fine-tuning permissions still require written confirmation from Pillar 9 and the domain owner. Do not use Matrix exports to train a model merely because this synthetic fixture can be used that way.

## Use it

To run the service directly against the packaged fixture:

```bash
cp fixtures/calgary-synthetic-5000.sqlite data/pillar9-voice.sqlite
MATRIX_MODE=fixture node src/server.js
```

To rebuild deterministically from the included snapshots:

```bash
npm run build:calgary
```

To refresh the public catalogs and rebuild:

```bash
npm run refresh:calgary
```

Refreshing changes source hashes and may change source counts. Review the diff and rerun the full test suite before accepting a new fixture.

## Database tables

- `listings` stores indexed search columns plus the complete public fixture record in `details` JSON.
- `synthetic_street_catalog` stores normalized Street Names rows.
- `synthetic_community_catalog` stores residential community labels.
- `synthetic_major_road_catalog` stores unique current Calgary names from the Major Road Network.
- `synthetic_listing_streets` proves primary/nearby coverage.
- `synthetic_listing_roads` proves major-road reference coverage.
- `synthetic_catalog_sources` stores source URL, retrieval time, record count, licence label, and SHA-256.

The fixture adapter filters to `ACTIVE`, applies hard criteria, ranks preferred features and price fit, returns at most five results, strips internal fields, and labels every result and response as synthetic. It never creates a Matrix query or exposes Matrix credentials.

## Source and licence

The only real place data is the public naming taxonomy from the City of Calgary:

- [Street Names — Open Calgary](https://data.calgary.ca/Base-Maps/Street-Names/hjbp-5p9j)
- [Community District Boundaries — Open Calgary](https://data.calgary.ca/Base-Maps/Community-District-Boundaries/surr-xmvs)
- [Major Road Network — Open Calgary](https://data.calgary.ca/Transportation-Transit/Major-Road-Network/tqjs-vnhy)

The snapshots record `Open Government Licence - City of Calgary`. Confirm attribution and licence obligations before redistribution outside this development package. All property facts, prices, availability, coordinates, descriptions, amenities, school labels, transit labels, and proximity relationships are newly generated and fictional.
