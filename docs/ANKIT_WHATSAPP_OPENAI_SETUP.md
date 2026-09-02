# Ankit setup: WhatsApp Cloud API + OpenAI replies

This is the implementation runbook for the Pillar 9 WhatsApp channel. The code receives WhatsApp messages, preserves the Relink/Zeus criteria-confirmation flow, searches only through the server-side Matrix adapter, sends approved proactive templates, and uses the OpenAI Responses API for short natural-language replies when no deterministic workflow applies.

The bot must identify itself as Pillar 9’s automated representative. It must never claim to be a human, licensed REALTOR, or the brokerage. Keep this disclosure in every approved template and at the start of each new inbound thread.

## 1. Accounts and assets

Prepare:

1. A Meta Business Portfolio controlled by Pillar 9 or the authorized operating entity.
2. A Meta developer app with the WhatsApp product enabled.
3. A WhatsApp Business Account and approved business phone number.
4. The WhatsApp phone-number ID, WABA ID, Meta app secret, and a production access token with the permissions required by Meta for Cloud API messaging.
5. A publicly reachable HTTPS deployment of this service.
6. An OpenAI API project and server-side API key. A ChatGPT subscription is not an API key and does not provide API billing.
7. Written WhatsApp opt-in evidence by contact and purpose, plus the existing suppression/DNC process.

The default Graph API version is `v26.0`, which was the current version shown by Meta on 2026-08-30. It is configurable because Meta versions and deprecations change.

## 2. Configure environment variables

Start in dry-run mode:

```dotenv
OPENAI_ENABLED=true
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=replace-with-a-project-api-key
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low

WHATSAPP_ENABLED=true
WHATSAPP_DRY_RUN=true
META_GRAPH_BASE_URL=https://graph.facebook.com
META_GRAPH_API_VERSION=v26.0
WHATSAPP_PHONE_NUMBER_ID=replace-me
WHATSAPP_BUSINESS_ACCOUNT_ID=replace-me
WHATSAPP_ACCESS_TOKEN=replace-me
META_APP_SECRET=replace-me
WHATSAPP_VERIFY_TOKEN=generate-a-long-random-token
WHATSAPP_TEMPLATE_LANGUAGE=en_CA
```

Use a secret manager in production. Never put keys in source, client-side JavaScript, Bland variables, prompts, logs, template parameters, or the training dataset.

The OpenAI integration calls `POST /v1/responses` with the configured model. It uses `store:false`, low reasoning effort, a privacy-preserving hashed `safety_identifier`, a maximum 12-message local window, and redaction before model input. No Matrix credentials or private/member-only listing fields are sent to OpenAI.

## 3. Configure the Meta webhook

In the WhatsApp app configuration:

- Callback URL: `https://YOUR_PUBLIC_HOST/webhooks/whatsapp`
- Verify token: exactly the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` field.

The service supports Meta’s GET challenge and verifies every POST over the exact raw request body using `X-Hub-Signature-256` and `META_APP_SECRET`. Never disable signature verification in production.

The inbound parser handles text, button replies, and interactive list/button selections. Unsupported media receives a concise text-channel instruction. Provider message IDs are claimed idempotently, and delivery/read/failure statuses update stored messages.

## 4. Create and approve templates

Generate the six template specifications:

```bash
npm run build:whatsapp
```

Review `generated/meta-whatsapp-templates.json`, then create the matching templates in WhatsApp Manager. Every template:

- identifies Ava as Pillar 9’s automated representative;
- names the licensed professional and brokerage;
- includes `Reply STOP to opt out`;
- uses only positional variables that the server supplies;
- avoids forecasts, valuations, pressure, false urgency, and unverified claims.

Templates included:

| Mode | Default name | Exact consent purpose |
|---|---|---|
| Birthday wish | `p9_birthday_v1` | `relationship_message` |
| Property matches | `p9_property_matches_v1` | `property_followup` |
| Buyer follow-up | `p9_buyer_followup_v1` | `buyer_followup` |
| Showing follow-up | `p9_showing_followup_v1` | `showing_followup` |
| Relationship check-in | `p9_relationship_checkin_v1` | `relationship_checkin` |
| Appointment reminder | `p9_appointment_reminder_v1` | `appointment_reminder` |

The JSON has a suggested Meta category, but Meta controls final classification and may reclassify a submission. Do not send until the exact template/language is approved and its status is confirmed.

## 5. Messaging-window rule

Meta states that service messages can be sent through the Messages API in the customer service window; outside that window, use templates. This implementation uses free-form text only as a direct response to an inbound user message and always uses an approved template for proactive birthday, follow-up, listing-update, relationship, and reminder messages.

The 24-hour window does not create marketing consent, override a STOP request, or authorize a different purpose. The database still requires active `whatsapp` consent for the exact proactive purpose.

Official references:

- [WhatsApp Cloud API: Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
- [WhatsApp webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
- [WhatsApp service messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [WhatsApp template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [OpenAI Responses API quickstart](https://developers.openai.com/api/docs/quickstart)
- [OpenAI function calling and tools](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI current model guidance](https://developers.openai.com/api/docs/guides/latest-model)

## 6. Inbound behavior

The server decides actions; the model only drafts natural text for unstructured questions.

1. Verify signature and deduplicate provider message ID.
2. Resolve or create the minimal CRM contact and thread.
3. Store the inbound message.
4. Process STOP/wrong-number before every other intent and apply global suppression.
5. Escalate human, showing, offer, negotiation, legal, tax, mortgage, valuation, or forecast requests.
6. Run text through Relink/Zeus criteria normalization.
7. Save a draft, read every criterion back, and require explicit `yes`.
8. Ask for missing price, area, or bedroom information instead of silently broadening.
9. Search only the latest confirmed criteria through the Matrix adapter.
10. Present at most three of the five returned options in chat; support `option 1` and `compare option 1 and option 2`.
11. For general questions, call OpenAI with the bounded safety prompt and recent sanitized history.

With the included 5,000-property database, every answer says the options are synthetic test properties. In production, set `MATRIX_MODE=http`; production configuration refuses the fixture adapter.

## 7. Test dry-run outreach

Record exact WhatsApp consent first:

```bash
curl -sS https://YOUR_PUBLIC_HOST/admin/consents \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId":"contact_demo_buyer",
    "channel":"whatsapp",
    "purpose":"property_followup",
    "status":"granted",
    "source":"documented_test_opt_in",
    "evidence":{"synthetic":true}
  }'
```

Preview a property-match template without sending:

```bash
curl -sS https://YOUR_PUBLIC_HOST/admin/whatsapp/send \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId":"contact_demo_buyer",
    "mode":"property_matches",
    "listingIds":["SYN-CGY-000001"]
  }'
```

Keep `WHATSAPP_DRY_RUN=true` until webhook verification, template approval, consent evidence, STOP propagation, provider status callbacks, and licensed handoff tests all pass.

## 8. Go live

Before setting `WHATSAPP_DRY_RUN=false`:

1. Replace all sample identity and phone values with the verified licensed professional and brokerage.
2. Deploy the real Pillar 9 Matrix/OneRLS adapter and approved public listing hosts.
3. Configure the permanent Meta token lifecycle and secret rotation.
4. Confirm every template is approved in `en_CA` under the configured name.
5. Confirm consent import, global DNC sync, complaint handling, retention, access controls, and Canadian legal review.
6. Run `npm test` and the deployment checklist.
7. Send only to internal opted-in test numbers, then a small controlled pilot.
8. Monitor Meta delivery failures, user blocks, STOPs, model errors, handoffs, latency, and OpenAI/Meta usage costs.

No key or provider account was supplied in this package, so the included verification uses local mock endpoints and dry-run payloads. That proves the request shapes and safety gates without sending a real WhatsApp message or incurring API charges.

## 9. Birthday scheduler

Run the birthday job from the Pillar 9 scheduler at a controlled daily contact-local time:

```bash
npm run whatsapp:birthdays
```

The job checks the contact-local birthday, global suppression, exact `whatsapp/relationship_message` consent, and same-day duplicate sends. It previews while `WHATSAPP_DRY_RUN=true`. Live mode additionally requires the explicit command-line flag:

```bash
node scripts/run-whatsapp-birthdays.js --confirmed-live
```

Do not use that flag until the live checklist is signed. Property/showing/buyer follow-ups should be triggered by the corresponding CRM event through `/admin/whatsapp/send`, not by an indiscriminate bulk loop.
