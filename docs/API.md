# API reference

All JSON responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message" } }`. Request bodies are limited to 1 MB. Administrator endpoints use a bearer key; tool endpoints use `x-p9-tool-key`. Do not expose either key to a browser. The internal one-page panel uses a separate, limited `DEMO_PANEL_API_KEY` and never embeds administrator/provider keys.

## Demo panel and limited API

- `GET /demo` — responsive internal demo console; disabled when `DEMO_PANEL_ENABLED=false`.
- `GET /demo-api/status` — safe capability/configuration summary.
- `POST /demo-api/outbound` — `{firstName, phone, timezone, birthday?, mode, consentConfirmed, liveConfirmed?, at?}`. It creates only a demo contact/attestation and runs every normal call gate. `at` is development dry-run only.
- `POST /demo-api/inbound/configure` — dry-run/live inbound configuration; live use additionally requires server opt-in and confirmation.
- `GET /demo-api/interactions?limit=12` — recent dispatch/webhook activity.

These routes require `x-p9-demo-key: $DEMO_PANEL_API_KEY`. They do not grant access to `/admin/*` or `/tools/*`. Live demo actions are blocked unless `DEMO_PANEL_ALLOW_LIVE_CALLS=true`.

## Administrator routes

- `GET /admin/modes` — approved outbound modes.
- `GET /admin/contacts` — development/admin contact list.
- `POST /admin/contacts` — `{id, phone, firstName, lastName?, email?, timezone, birthday?, representedByOther?}`.
- `POST /admin/consents` — `{contactId, channel, purpose, status, source, evidence?, capturedAt?, expiresAt?}`.
- `POST /admin/calls/outbound` — `{contactId, mode, reason?}`. Production forbids caller-supplied `startTime` or `at` and uses the server clock for just-in-time permission checks.
- `POST /admin/inbound/configure` — builds/updates the assigned Bland inbound configuration.
- `POST /admin/inbound/purchase` — `{confirmed:true}` plus environment billable-action switches.
- `POST /admin/whatsapp/send` — `{contactId, mode, listingIds?, variables?, at?}`. Always uses an approved Meta template and exact-purpose WhatsApp consent.
- `GET /admin/whatsapp/messages?contactId=...&limit=20` — inspect the bounded stored WhatsApp history for an authorized administrator.

## Bland tool routes

- `POST /tools/permission`
- `POST /tools/context`
- `POST /tools/criteria`
- `POST /tools/listings/search`
- `POST /tools/listings/details`
- `POST /tools/listings/compare`
- `POST /tools/market-context`
- `POST /tools/affordability`
- `POST /tools/appointments`
- `POST /tools/follow-up`
- `POST /tools/relationship`
- `POST /tools/do-not-call`
- `POST /tools/escalate`

Generate complete Bland definitions with `node scripts/bootstrap-bland.js` in dry-run mode.

## Webhook

`POST /webhooks/bland` verifies an HMAC-SHA256 signature against the exact raw body when `BLAND_WEBHOOK_SECRET` is set (mandatory in production). The handler accepts the configured Bland signature header variants, claims a call/event ID idempotently, persists the disposition, and enforces a DNC disposition fallback.

Validate the exact header and signing format against the current [Bland webhook-signing documentation](https://docs.bland.ai/tutorials/webhook-signing) during integration testing.

## WhatsApp webhook

- `GET /webhooks/whatsapp` implements Meta's `hub.mode`, `hub.verify_token`, and `hub.challenge` verification handshake.
- `POST /webhooks/whatsapp` verifies `X-Hub-Signature-256` over the exact raw body using `META_APP_SECRET`, deduplicates provider message IDs, stores inbound text/button/interactive replies, sends the bounded response, and records delivery status events.

Inbound property language follows the same Relink/Zeus draft → complete read-back → explicit `yes` → Matrix search sequence as voice. General text can use the OpenAI Responses API; the server handles STOP, handoff, criteria, search, listing details, comparison, and outbound-template decisions deterministically.

Approved WhatsApp modes are `birthday`, `property_matches`, `buyer_followup`, `showing_followup`, `relationship_checkin`, and `appointment_reminder`. See `ANKIT_WHATSAPP_OPENAI_SETUP.md` for variables and consent purposes.
