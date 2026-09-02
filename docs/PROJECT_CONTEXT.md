# Relink / Zeus / Pillar 9 continuity note

This handoff preserves the previously established project boundary with Shane Griffin, Riz Mawani, Pillar 9, Matrix, and OneRLS. It distinguishes two related systems so Ankit does not accidentally turn the voice-calling pilot into the core Zeus product.

## Recovered decisions

- Shane’s August 27 priority was voice conversation → listing attributes for phone-first listing creation and maintenance inside Pillar 9—not a standalone SaaS product.
- Zeus is a containerized/internal Pillar 9 microservice. Its core pipeline is transcript plus current listing state → attribute extraction → validation/confidence → missing/conflict detection → evidence/traceability → agent review and approval → approved Pillar 9 draft/update.
- Accuracy tests, agent validation, and an initial deployment inside Pillar 9 are primary acceptance requirements.
- Phone microphone and camera are the initial inputs. Future Omi Glass or similar hardware is interchangeable through source adapters; the core extraction/validation contract must not depend on one device.
- Matrix/OneRLS data access stays behind Pillar 9-owned server adapters and licensing controls. Models do not receive credentials, raw unrestricted records, private remarks, arbitrary queries, or arbitrary URLs.
- The previously reported prototype path covered capture → events → attributes/confidence/conflicts/missing → Ask Next → agent decisions → validation → signed approval → mock Pillar 9 draft. That prototype is a separate artifact/workstream from this repository.

## What this repository adds

This repository is the adjacent **customer communications representative** across Bland voice and Meta WhatsApp. It handles inbound reception and consented outbound relationship/follow-up workflows. When a customer describes a search, its Relink/Zeus component is deliberately narrower: it converts speech/text to confirmed search attributes, then calls the server-side Matrix adapter for public matching data. OpenAI drafts bounded WhatsApp language but does not create Matrix queries or decide whether an action is permitted.

The packaged 5,000-property Calgary database is synthetic test infrastructure for this communications layer. Its City of Calgary street/community labels do not make it Matrix/OneRLS data, and its 119-field development schema does not replace the Pillar 9 field-mapping checkpoint.

It does not replace the full listing-creation/maintenance Zeus microservice, mobile camera pipeline, React Native capture application, signed listing approval workflow, or Pillar 9/OneRLS deployment work.

## Evidence gap

The retained context confirms that Shane’s latest follow-up email and September 2 requirements were important, but the verbatim email and exact itemized requirements were not retrievable. The bullets above are recovered project decisions, not quotations from Shane.

Before contractual acceptance, attach the original August 27 notes and Shane’s latest email to the controlled requirements record, map each item to an owner/test, and resolve any difference through a versioned change. Do not invent or paraphrase missing email commitments as signed-off requirements.
