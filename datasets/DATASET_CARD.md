# Dataset card

Purpose: seed a Pillar 9 automated real-estate representative’s retrieval knowledge and safety evaluation. It is not model fine-tuning data, market truth, a substitute for Matrix, or licensed advice.

Contents:

- `objections.json`: 32 approved objection patterns.
- `faq.json`: 30 scope/data/process answers.
- `criteria-examples.json`: 25 Canadian real-estate attribute-normalization examples.
- `conversation-examples.json`: 12 short disclosure-first patterns.
- `regression-scenarios.json`: 20 adversarial acceptance cases.
- `synthetic-calgary/properties.jsonl`: 5,000 generated property fixtures with 119 fields each, plus a strict schema, manifest, public naming snapshots, and property-level train/development/locked-holdout splits.

All entries are newly authored for this project. No YouTube transcript, private call recording, customer record, Matrix private remark, or proprietary sales script was copied. Any future sourced material needs documented licence/permission, privacy review, provenance, versioning, and human approval.

The property facts are fictional. Only street, major-road, and residential-community labels come from attributed Open Calgary catalogs. The address strings are intentionally non-deliverable, all records carry a synthetic warning, and road/community proximity is simulated. This dataset must never be presented as current inventory, MLS history, a valuation dataset, or permission to train on Matrix/OneRLS content.

Review cadence: before every knowledge deployment and at least quarterly during use. Owners: Pillar 9 product/privacy/security, participating brokerage/licensed professional, and Canadian compliance/legal reviewer.
