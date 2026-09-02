# Ankit’s end-to-end Bland setup runbook

## Outcome

At the end, one Canadian Bland number can receive calls and place narrowly scoped, consented calls through an automated Pillar 9 representative working for a specific licensed professional and brokerage. The first sentence always discloses automation. This runbook does not approve deceptive human impersonation or unconsented telemarketing.

## Day 0: obtain required decisions (blockers)

Do not configure live dialing until the project owner supplies and compliance verifies:

- Exact service name, assistant name, licensed professional, licence number, brokerage, and public callback number.
- Written purposes allowed for inbound and each outbound mode.
- CRM schema and evidence source for voice/SMS/email/WhatsApp consent and opt-outs.
- Internal and National DNCL screening procedure, exemptions analysis, suppression synchronization, calling-hour policy, complaint route, retention rules, and any recording notice/consent process.
- Pillar 9/Matrix owner’s approved adapter contract and public listing URL hosts.
- Authorized transfer numbers for real-estate and mortgage professionals.
- Voice rights documentation. Do not clone Shane, an agent, an actor, or any other person without express documented permission.

## Day 1 morning: local dry run

1. Install Node.js 24 or build the included Docker image. This project has no npm dependencies.
2. Copy `.env.example` to `.env` and replace only development values. Leave `BLAND_DRY_RUN=true`.
3. Generate three independent random secrets of at least 24 characters for `ADMIN_API_KEY`, `TOOL_API_KEY`, and the limited `DEMO_PANEL_API_KEY`. Never reuse one key for another scope.
4. Run:

   ```bash
   node scripts/seed.js
   node scripts/build-calgary-fixture.js
   node scripts/build-knowledge-base.js
   node scripts/build-whatsapp-templates.js
   node --test --test-reporter=spec
   node scripts/smoke-demo.js
   node scripts/bootstrap-bland.js
   node scripts/bootstrap-bland-tests.js
   ```

5. Review `generated/bland-bootstrap-preview.json`. It contains the 13 exact tool definitions and inbound configuration but places no call and creates no Bland object.

Expected tests: 80 pass, 0 fail. Never proceed around a failing safety test.

6. Start `node src/server.js`, open `http://127.0.0.1:8787/demo`, enter `DEMO_PANEL_API_KEY`, and preview one buyer follow-up. Keep `DEMO_PANEL_ALLOW_LIVE_CALLS=false`.

## Day 1 afternoon: deploy the Pillar 9 API

1. Deploy the container behind HTTPS at a dedicated hostname such as `voice-api.pillar9.ca`.
2. Persist `/app/data` or replace the reference SQLite repository with the approved CRM/database adapter.
3. Put secrets in the deployment secret manager—never in source control, generated JSON, a Bland prompt, or Matrix request data.
4. Set `PUBLIC_BASE_URL` to the exact public HTTPS origin.
5. Restrict administrator routes at the network/API gateway as well as with the bearer key.
6. Confirm `GET /health` returns HTTP 200.
7. Connect the Matrix adapter described in `MATRIX_CONTRACT.md`; change `MATRIX_MODE=http`; test only synthetic or approved non-production records.
8. Connect the accountable outbound compliance/DNCL service described in `COMPLIANCE_GATE_CONTRACT.md`; production fails closed without it.
9. Configure the messaging webhook, HTTPS unsubscribe URL, and opt-out callback. Test SMS and email consent independently.
10. Configure WhatsApp and OpenAI using `ANKIT_WHATSAPP_OPENAI_SETUP.md`; test WhatsApp consent independently from calls/SMS/email.

## Day 1 afternoon: Bland account and number

1. Create or select the Pillar 9 Bland workspace and obtain an API key.
2. Obtain a Canadian-capable number in the Bland dashboard, or use Bland’s inbound-number purchase API. A programmatic purchase is intentionally locked behind all three conditions:

   - `BLAND_DRY_RUN=false`
   - `BLAND_PURCHASE_NUMBER=true`
   - body `{ "confirmed": true }`

3. Verify Canadian inbound/outbound capability, caller-ID behavior, callback routing, emergency limitations, pricing, and area code availability directly with Bland before purchase.
4. Put the assigned E.164 number into both `BLAND_FROM_NUMBER` and `BLAND_INBOUND_NUMBER` as appropriate.
5. Set a strong random `BLAND_WEBHOOK_SECRET`. Configure Bland to sign webhooks with the same secret, then verify a test event reaches `/webhooks/bland`.

## Voice: Bland and ElevenLabs, accurately

For a two-day pilot, use an approved Bland female voice available in the workspace—Paige or Maya are candidate names only if the current voice list contains them. Desired direction: warm, clear, composed, optimistic, Canadian-neutral, medium pace, low pressure. Do not optimize for seduction, flirtation, or identity deception.

Bland’s public voice documentation describes Bland voices and Bland-native cloning. It does **not** document a simple production connector where an ElevenLabs `voice_id` is pasted into a Bland call. Do not invent that integration.

Choose one supported route:

1. **Recommended pilot:** list/listen to the voices currently available in the workspace, then set `BLAND_VOICE` to the selected name or UUID.
2. **Authorized Bland clone:** record/use only material for which Pillar 9 has documented speaker and usage rights. Follow current Bland quality requirements, then run:

   ```bash
   VOICE_AUDIO_FILE=/secure/path/authorized.wav \
   VOICE_NAME="Pillar 9 Approved Voice" \
   VOICE_RIGHTS_ATTESTATION=I_HAVE_DOCUMENTED_RIGHTS \
   node scripts/clone-bland-voice.js
   ```

   Bland’s current BTTS V3 constraint is exactly one file, roughly 10 seconds ideal, maximum 10 MB. First run the helper with `BLAND_DRY_RUN=true`, then review and deliberately enable live mode.
3. **Existing ElevenLabs voice is mandatory:** open a Bland support/enterprise architecture request and obtain a currently supported migration or custom-TTS design in writing. Re-run latency, disclosure, interruption, DTMF, transfer, and failover tests. Do not assume Bland can call an ElevenLabs voice directly merely because both have APIs.

The reference never ships a cloned voice or training audio.

## Create Bland tools and knowledge

1. Confirm `PUBLIC_BASE_URL` and `TOOL_API_KEY` point to the deployed non-production service.
2. Set `BLAND_API_KEY` and keep `BLAND_DRY_RUN=true`; rebuild and inspect the preview.
3. Change to `BLAND_DRY_RUN=false` only in the controlled setup environment.
4. Run `node scripts/bootstrap-bland.js`. The script:

   - creates 13 legacy custom tools;
   - uploads `generated/pillar9-agent-knowledge.txt`;
   - polls knowledge processing when a status is returned;
   - optionally requests Pathway generation when `BLAND_GENERATE_PATHWAY=true`;
   - writes non-secret object IDs to `generated/bland-bootstrap-result.json`.

5. Copy tool IDs into `BLAND_TOOL_IDS` and the knowledge ID into `BLAND_KNOWLEDGE_BASE_IDS` in the secret-managed runtime.
6. Open every tool in Bland. Confirm URL, HTTP method, auth header, request variables, response availability, and timeout behavior. Run one valid and one unauthorized request per tool.

## Prompt or Pathway

The fastest pilot uses the disclosure-first task prompt generated by `src/prompts.js`. A Pathway is preferred after the flow stabilizes because global interrupts and handoffs can be inspected visually.

If `BLAND_GENERATE_PATHWAY=true`, treat generated output as a draft:

- Verify the first inbound and outbound node discloses automation, Pillar 9, named professional, brokerage, and purpose.
- Make permission-to-continue a separate early node.
- Add global interrupt nodes for DNC/wrong number, human request, automation question, recording refusal, distress, discriminatory steering, licensed/financial/legal questions, tool error, and ambiguity.
- Enforce draft → read-back → explicit yes → confirmed criteria before search.
- Give birthday its own terminal branch with no proactive sales transition.
- Manually create and test transfer nodes. Bland notes that `transfer_list` is ignored when Pathways control the call.
- Publish a pinned reviewed version; do not silently move production to a staging draft.

## Configure inbound

1. With dry run on, inspect the payload from:

   ```bash
   curl -sS -X POST "$PUBLIC_BASE_URL/admin/inbound/configure" \
     -H "Authorization: Bearer $ADMIN_API_KEY"
   ```

2. Confirm the first sentence starts with the automated identity.
3. Confirm recording is `false`. The reference intentionally does not record unknown inbound callers.
4. Turn on live mode and repeat once to update the assigned number.
5. Call the number from a test phone and exercise unknown caller, known caller, human transfer, DNC, tool outage, and unsupported language.

An inbound call does not create permission for later marketing calls, texts, emails, or WhatsApp outreach. Capture each channel/purpose separately with evidence.

## Configure outbound

Never import a list and “blast” it from Bland. The CRM scheduler sends one just-in-time request per eligible contact. Example:

```json
{
  "contactId": "crm_contact_id",
  "mode": "property_match",
  "reason": "to share an update on the property alerts you requested"
}
```

Before calling Bland, the service checks active exact-purpose voice consent, internal DNC, representation by another professional, consent age/expiry, contact-local window, and birthday date when applicable. Production rejects deferred provider scheduling because a contact could opt out between scheduling and dialing.

Modes are defined in `src/modes.js`. Do not invent a free-form marketing campaign name.

## Training data workflow

The JSON files are curated response/evaluation data—not copied YouTube transcripts or private call recordings. Do not crawl or ingest recordings without a clear licence, participant permission, privacy review, and documented source rights.

1. Review every entry with the licensed professional, Pillar 9 privacy/security, and Canadian compliance counsel.
2. Mark edits in source JSON; do not train from production call transcripts by default.
3. Run `node scripts/build-knowledge-base.js`.
4. Upload the regenerated text and keep the previous KB version available for rollback.
5. Use `node scripts/bootstrap-bland-tests.js` to preview or create the 20 adversarial scenarios.
6. Add anonymized failures only after human review; never store financial, government-ID, access-code, private-remark, or protected-trait data.

## Day 2: acceptance and limited pilot

1. Execute all local tests and the test matrix in `TEST_PLAN.md`.
2. Use only internal staff and specifically consented pilot contacts.
3. Evaluate at least: first-sentence disclosure, interruption latency, pronunciation, silence, voicemail, DTMF, transfer, tool timeout, hallucination, opt-out, wrong number, status freshness, SMS consent, birthday isolation, and every licensed boundary.
4. Require human sign-off from product, Pillar 9/Matrix, the licensed brokerage, privacy/security, and Canadian compliance/legal owners.
5. Start with recording off, low volume, one agent/brokerage, and daily transcript-free metrics. Pause automatically on any DNC failure, identity deception, private data exposure, unsupported advice, or wrong-purpose call.

Two days is realistic for a controlled, consented pilot with fixtures and a ready Matrix/CRM adapter. It is not a responsible promise for unrestricted production telemarketing.
