# Production deployment checklist

## Technical

- [ ] Node 24 image built and vulnerability-scanned.
- [ ] HTTPS public origin, health check, firewall/WAF, rate limits, and administrator network restriction configured.
- [ ] Strong independent administrator/tool keys and Bland/Matrix/messaging secrets stored in a secret manager.
- [ ] Demo panel is disabled in production unless explicitly required; if enabled, its separate limited key is strong, network-restricted, rate-limited, and `DEMO_PANEL_ALLOW_LIVE_CALLS` has an accountable owner.
- [ ] Real durable CRM/database adapter and backup/restore tested.
- [ ] `NODE_ENV=production`, `MATRIX_MODE=http`, real Matrix credentials, and real approved listing hosts.
- [ ] Messaging webhook and HTTPS unsubscribe endpoint; inbound STOP updates central DNC/consent state.
- [ ] External compliance/DNCL decision service configured and fail-closed behavior tested.
- [ ] Bland webhook secret and altered-body rejection tested.
- [ ] Tool IDs and knowledge IDs pinned; Pathway version reviewed and pinned.
- [ ] Canadian-capable number, caller ID, callback, voicemail, transfer, and failure routing tested.
- [ ] Recording remains off unless separately approved and consented.
- [ ] Meta WABA/phone-number ID, permanent token, app secret, verify token, and Graph version configured in the secret manager.
- [ ] WhatsApp GET challenge and raw-body `X-Hub-Signature-256` rejection tested at the public origin.
- [ ] Six exact WhatsApp template names/languages approved and mapped; Meta category/status reviewed.
- [ ] OpenAI project key, current allowed model, usage budget/alerts, `store:false`, timeout, and error fallback tested.

## Identity and professional scope

- [ ] Licensed professional name, licence number, brokerage, and destinations independently verified.
- [ ] Pillar 9 correctly described as service provider, not brokerage.
- [ ] First-sentence automated disclosure approved verbatim.
- [ ] Brokerage and regulator owners approve licensed boundaries and handoffs.

## Consent and compliance

- [ ] Exact-purpose voice/SMS/email/WhatsApp consent evidence ingested and testable.
- [ ] Internal DNC plus applicable National DNCL process runs immediately before dialing.
- [ ] Contact-local hours, time zones, consent age/expiry, represented-by-other, and birthday gates accepted.
- [ ] CRTC, CASL, privacy, provincial regulator, and Matrix/licensing review documented with date/owner.
- [ ] Complaint, access/correction, incident, retention, and deletion processes assigned.

## Release

- [ ] 80 local tests, the 5,000-property fixture validation, and all Bland adversarial scenarios pass.
- [ ] Demo panel key scope, missing-consent block, live-action lock, secret non-disclosure, mobile layout, and number-purchase exclusion pass.
- [ ] WhatsApp inbound, option details/comparison, STOP, birthday, templates, status callbacks, OpenAI failure, and licensed handoff acceptance pass.
- [ ] Human phone acceptance matrix passes.
- [ ] Low-volume specifically consented pilot approved with kill switch and on-call owner.
- [ ] Daily DNC/complaint/tool-error review during pilot.
- [ ] Rollback restores the previous prompt/Pathway, tools, knowledge, and call configuration.
