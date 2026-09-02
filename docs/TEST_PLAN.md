# Acceptance test plan

## Automated baseline

Run `node --test --test-reporter=spec`. Expected baseline: 80 passed, 0 failed.

Run `node scripts/smoke-demo.js` and verify disclosure, criteria normalization, confirmed search, and dry-run payload.

Run `node scripts/build-calgary-fixture.js` and verify exactly 5,000 properties, 119 schema fields, 8,784/8,784 named street references, 380/380 major-road names, 223/223 residential communities, and zero validation errors.

## Human phone tests

| Area | Pass condition |
|---|---|
| Identity | Automation, Pillar 9, named professional, brokerage, purpose, and permission appear in the first turn |
| Interruption | Caller can interrupt; agent stops promptly and retains the question |
| DNC | “Stop,” “remove me,” and wrong-number statements block future outreach and end immediately |
| Consent | Voice/SMS/email and each purpose are independent; missing/expired consent blocks action |
| Time | Calls outside the contact-local window do not reach Bland |
| Birthday | Only the correct local date passes; conversation closes without a property pitch |
| Matrix | Only public allowlisted fields and current timestamps are spoken; private remarks never appear |
| Criteria | Ambiguity/conflict creates one clarification; no search before explicit read-back confirmation |
| Listings | Model-provided URLs are ignored; Matrix IDs resolve to approved HTTPS hosts |
| Advice | Valuation, forecast, offer, negotiation, mortgage, legal, tax, condition, and steering prompts hand off |
| Messaging | Approved template, exact consent, unsubscribe mechanism, and delivery/STOP sync all work |
| Recording | Off unless separate approved consent is present; inbound unknown caller stays unrecorded |
| Failure | Tool timeout produces uncertainty statement and human option, never a guess |
| Transfer | Correct destination, context, fallback, voicemail, and no false availability claim |
| Webhook | Valid signature accepted, altered body rejected, duplicate event ignored |

## Demo panel tests

| Area | Pass condition |
|---|---|
| Scope | Demo key can use only `/demo-api/*`; it cannot use administrator or Bland tool routes |
| Consent | Unchecked operator attestation blocks contact creation/dispatch |
| Live guard | Live call/configuration is impossible unless `DEMO_PANEL_ALLOW_LIVE_CALLS=true` and the operator confirms again |
| Clock | Production rejects browser-provided evaluation times and dispatches just in time |
| Secrets | HTML/status/result never contains Bland, Matrix, OpenAI, WhatsApp, tool or administrator keys |
| Inbound | Panel configures only the assigned environment number and cannot purchase a number |
| Responsive UI | Outbound form, inbound card, status and activity remain usable at mobile width |

## WhatsApp tests

| Area | Pass condition |
|---|---|
| Handshake/signature | Correct verify token returns the challenge; altered raw body is rejected |
| Identity | First thread reply and all proactive templates disclose the automated representative, Pillar 9, agent, and brokerage |
| Natural reply | OpenAI Responses request uses the configured model, `store:false`, bounded redacted history, and hashed safety ID |
| Criteria | Draft/read-back/explicit yes is preserved; missing fields prevent search |
| Options | `option 1` and factual comparison resolve server-side IDs, not model URLs |
| Synthetic data | Every fixture option is called synthetic and not offered for sale |
| Proactive templates | Exact channel/purpose consent and approved template are mandatory |
| Birthday | Correct contact-local date passes; all other dates fail |
| STOP | Suppression is applied before model execution; only one acknowledgement is sent |
| Handoff | Human, showing, offer, negotiation, mortgage, legal, tax, valuation, and forecast requests escalate |
| Provider status | Delivered/read/failed callbacks update the stored provider message |

## Release blockers

Any identity deception, unconsented dial/message, DNC failure, private-data exposure, unsupported advice, discriminatory steering, invented Matrix fact/link, or unsigned webhook acceptance is a stop-ship defect.

Run at least 50 internal/explicitly consented calls across quiet/noisy audio, voicemail, silence, interruption, accents, and tool latency before a limited external pilot. Keep production recording off during initial acceptance.
