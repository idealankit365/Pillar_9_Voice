import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { testRig, insideWindow } from './helpers.js';
import { createHttpServer } from '../src/http.js';
import { buildRetellToolManifest } from '../src/tool-manifest.js';
import { verifyRetellSignature } from '../src/security.js';
import { buildRetellGeneralPrompt } from '../src/prompts.js';

const RETELL = { VOICE_PROVIDER: 'retell' };
const businessTime = new Date('2026-08-31T18:00:00.000Z'); // Monday noon in Edmonton
const rigOf = (t, extra = {}) => { const rig = testRig({ ...RETELL, ...extra }); t.after(rig.close); return rig; };
async function withServer(extra, fn) { const rig = testRig({ ...RETELL, ...extra }); const server = createHttpServer(rig); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`; try { await fn({ rig, base }); } finally { await new Promise((r) => server.close(r)); rig.close(); } }
const sign = (key, body, at = Date.now()) => `v=${at},d=${crypto.createHmac('sha256', key).update(Buffer.concat([Buffer.from(body), Buffer.from(String(at))])).digest('hex')}`;

test('retell outbound dry run builds a create-phone-call payload with disclosure variables', async (t) => {
  const rig = rigOf(t);
  const result = await rig.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime });
  assert.equal(result.dryRun, true);
  assert.equal(result.provider, 'retell');
  assert.equal(result.payload.from_number, '+12365009709');
  assert.equal(result.payload.to_number, '+14035550123');
  assert.equal(result.payload.override_agent_id, 'agent_test_123');
  const vars = result.payload.retell_llm_dynamic_variables;
  assert.equal(vars.first_name, 'Jordan');
  assert.equal(vars.assistant_name, 'Ava');
  assert.equal(vars.contact_id, 'contact_demo_buyer');
  assert.equal(vars.reason, 'to follow up on the home search you requested');
  assert.equal(result.payload.metadata.contact_id, 'contact_demo_buyer');
  assert.equal(rig.retell.sent.length, 0, 'dry run must not dispatch');
});

test('retell live dispatch sends exactly one call and records the interaction', async (t) => {
  const rig = rigOf(t, { RETELL_DRY_RUN: 'false' });
  const result = await rig.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime });
  assert.equal(result.dryRun, false);
  assert.equal(result.callId, 'retell_call_test');
  assert.equal(rig.retell.sent.length, 1);
  assert.equal(rig.bland.sent.length, 0, 'bland must never be used while retell is active');
});

test('permission gate blocks retell dispatch before any provider call', async (t) => {
  const rig = rigOf(t, { RETELL_DRY_RUN: 'false' });
  rig.service.compliance = { async checkOutbound() { return { allowed: false, code: 'DNCL_BLOCK', reason: 'External suppression match.' }; } };
  await assert.rejects(() => rig.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime }), { code: 'DNCL_BLOCK' });
  assert.equal(rig.retell.sent.length, 0);
});

test('retell outbound requires a bootstrapped agent id', async (t) => {
  const rig = rigOf(t, { RETELL_AGENT_ID: '' });
  await assert.rejects(() => rig.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime }), { code: 'RETELL_AGENT_ID_REQUIRED' });
});

test('retell tool manifest exposes the thirteen authenticated tools plus transfers', (t) => {
  const rig = rigOf(t);
  const tools = buildRetellToolManifest(rig.config, { transferPhone: '+14035550101', mortgageTransferPhone: '+14035550102' });
  const custom = tools.filter((x) => x.type === 'custom');
  assert.equal(custom.length, 13);
  assert.equal(tools.filter((x) => x.type === 'transfer_call').length, 2);
  assert.equal(tools.filter((x) => x.type === 'end_call').length, 1);
  for (const tool of custom) {
    assert.equal(tool.method, 'POST');
    assert.equal(tool.payload_args_only, true, 'flat args keep /tools/* parsing unchanged');
    assert.equal(tool.headers['x-p9-tool-key'], 'test-tool-key');
    assert.match(tool.url, /^https:\/\//);
    assert.equal(tool.parameters.type, 'object');
  }
});

test('retell inbound configuration binds the agent to the number', async (t) => {
  const rig = rigOf(t, { RETELL_DRY_RUN: 'false' });
  await rig.service.configureInbound();
  assert.equal(rig.retell.bound.length, 1);
  const [binding] = rig.retell.bound;
  assert.equal(binding.number, '+12365009709');
  assert.equal(binding.payload.inbound_agents[0].agent_id, 'agent_test_123');
  assert.equal(binding.payload.outbound_agents[0].agent_id, 'agent_test_123');
});

test('retell webhook signature verifies raw body plus timestamp', () => {
  const body = Buffer.from(JSON.stringify({ event: 'call_ended' }));
  assert.equal(verifyRetellSignature('key', body, sign('key', body)), true);
  assert.equal(verifyRetellSignature('key', body, sign('wrong-key', body)), false);
  assert.equal(verifyRetellSignature('key', body, sign('key', body, Date.now() - 6 * 60 * 1000)), false, 'stale timestamps are replay attempts');
  assert.equal(verifyRetellSignature('key', body, 'garbage'), false);
});

test('retell webhook rejects an invalid signature and accepts a signed event', () => withServer({}, async ({ base, rig }) => {
  const body = JSON.stringify({ event: 'call_ended', call: { call_id: 'call_abc', direction: 'outbound', disconnection_reason: 'user_hangup', metadata: { contact_id: 'contact_demo_buyer', mode: 'buyer_followup' } } });
  const bad = await fetch(`${base}/webhooks/retell`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-retell-signature': sign('wrong', body) }, body });
  assert.equal(bad.status, 401);
  assert.equal((await bad.json()).error.code, 'INVALID_RETELL_SIGNATURE');

  const good = await fetch(`${base}/webhooks/retell`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-retell-signature': sign(rig.config.retell.apiKey, body) }, body });
  assert.equal(good.status, 200);
  assert.equal((await good.json()).data.processed, true);

  const replay = await fetch(`${base}/webhooks/retell`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-retell-signature': sign(rig.config.retell.apiKey, body) }, body });
  assert.equal((await replay.json()).data.duplicate, true, 'same call+event must be idempotent');
}));

test('a distinct webhook key verifies signatures and falls back to the api key', () => withServer({ RETELL_WEBHOOK_KEY: 'key_webhook_only' }, async ({ base, rig }) => {
  assert.equal(rig.config.retell.webhookKey, 'key_webhook_only');
  assert.equal(rig.config.retell.apiKey, 'test-retell-key', 'the API key stays separate');
  const body = JSON.stringify({ event: 'call_ended', call: { call_id: 'call_hookkey', metadata: { contact_id: 'contact_demo_buyer' } } });
  const wrong = await fetch(`${base}/webhooks/retell`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-retell-signature': sign('test-retell-key', body) }, body });
  assert.equal(wrong.status, 401, 'the api key must not verify when a webhook key is set');
  const right = await fetch(`${base}/webhooks/retell`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-retell-signature': sign('key_webhook_only', body) }, body });
  assert.equal(right.status, 200);
}));

test('retell post-call opt-out applies do-not-contact', async (t) => {
  const rig = rigOf(t);
  rig.service.processRetellWebhook({ event: 'call_analyzed', call: { call_id: 'call_optout', direction: 'outbound', disconnection_reason: 'user_hangup', metadata: { contact_id: 'contact_demo_buyer' }, call_analysis: { call_successful: false, user_sentiment: 'Negative' } } });
  const permission = await rig.service.checkOutboundPermission({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime });
  assert.equal(permission.allowed, true, 'a negative sentiment alone is not an opt-out');

  rig.service.processRetellWebhook({ event: 'call_ended', call: { call_id: 'call_optout_2', direction: 'outbound', metadata: { contact_id: 'contact_demo_buyer' } } });
  rig.service.doNotCall({ contactId: 'contact_demo_buyer', reason: 'customer_request' });
  const blocked = await rig.service.checkOutboundPermission({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime });
  assert.equal(blocked.allowed, false);
});

test('demo panel can preview a live retell call to an international number', () => withServer({}, async ({ base }) => {
  const response = await fetch(`${base}/demo-api/outbound`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-p9-demo-key': 'test-demo-key' },
    body: JSON.stringify({ firstName: 'Ankit', phone: '+917903905731', timezone: 'Asia/Kolkata', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('Asia/Kolkata').toISOString() }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.call.dryRun, true);
  assert.equal(body.data.call.payload.to_number, '+917903905731');
  assert.equal(body.data.call.payload.retell_llm_dynamic_variables.first_name, 'Ankit');
}));

test('demo status reports the active provider', () => withServer({}, async ({ base }) => {
  const response = await fetch(`${base}/admin/demo/status`, { headers: { authorization: 'Bearer test-admin-key' } });
  const body = await response.json();
  assert.equal(body.data.provider, 'retell');
  assert.equal(body.data.voice.dryRun, true);
  assert.equal(body.data.voice.fromNumber, '+12365009709');
  assert.equal(JSON.stringify(body).includes('test-retell-key'), false, 'the retell key must never leave the server');
}));

test('every call carries the contact-local date so the agent never guesses one', async (t) => {
  const rig = rigOf(t);
  const result = await rig.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', at: businessTime });
  const vars = result.payload.retell_llm_dynamic_variables;
  // businessTime is 2026-08-31T18:00Z = noon Monday in Edmonton.
  assert.equal(vars.current_date, '2026-08-31');
  assert.equal(vars.current_weekday, 'Monday');
  assert.equal(vars.contact_timezone, 'America/Edmonton');
  assert.match(vars.current_datetime_local, /^2026-08-31 12:00 \(America\/Edmonton\)$/);
});

test('the appointment tool rejects a past time, which is what the agent hallucinated', async (t) => {
  const rig = rigOf(t);
  assert.throws(() => rig.service.scheduleAppointment({ contactId: 'contact_demo_buyer', startTime: '2024-06-13T00:00:00Z', type: 'licensed_callback' }), { code: 'INVALID_APPOINTMENT_TIME' });
});

test('the prompt forbids claiming an outcome a tool did not return', (t) => {
  const rig = rigOf(t);
  const prompt = buildRetellGeneralPrompt(rig.config, { name: 'Alex Chen', brokerage: 'Example Realty' });
  assert.match(prompt, /never tell the person that something has been booked/i);
  assert.match(prompt, /\{\{current_date\}\}/);
  assert.match(prompt, /never infer or recall one/i);
});

test('transcript updates stream live without flooding the activity feed', async (t) => {
  const rig = rigOf(t);
  const send = (event, call) => rig.service.processRetellWebhook({ event, call: { call_id: 'live1', retell_llm_dynamic_variables: { first_name: 'Ankit' }, ...call } });
  send('call_started', {});
  send('transcript_updated', { transcript_object: [{ role: 'agent', content: 'Hi Ankit.' }] });
  send('transcript_updated', { transcript_object: [{ role: 'agent', content: 'Hi Ankit.' }, { role: 'user', content: 'Go ahead.' }] });

  const during = rig.service.liveTranscript().call;
  assert.equal(during.status, 'live');
  assert.equal(during.turns.length, 2, 'repeated transcript events must not be dropped as duplicates');
  assert.deepEqual(during.turns.map((x) => x.role), ['agent', 'user']);
  // Only call_started should have produced an interaction row.
  assert.equal(rig.repo.listInteractions(50).filter((x) => x.providerCallId === 'live1').length, 1);

  send('call_ended', { call_analysis: { call_summary: 'Wrapped up.' } });
  const after = rig.service.liveTranscript().call;
  assert.equal(after.status, 'ended', 'the panel freezes on this');
  assert.equal(after.turns.length, 2, 'a payload without turns must not wipe the transcript');
  assert.equal(after.summary, 'Wrapped up.');
});

test('a shorter transcript payload cannot clobber a longer one', (t) => {
  const rig = rigOf(t);
  const send = (event, call) => rig.service.processRetellWebhook({ event, call: { call_id: 'live2', ...call } });
  send('call_started', {});
  send('transcript_updated', { transcript_object: [{ role: 'agent', content: 'One' }, { role: 'user', content: 'Two' }, { role: 'agent', content: 'Three' }] });
  send('transcript_updated', { transcript_object: [{ role: 'agent', content: 'One' }] });
  assert.equal(rig.service.liveTranscript().call.turns.length, 3);
});

test('the live transcript store keeps only the five most recent calls', (t) => {
  const rig = rigOf(t);
  for (let n = 0; n < 8; n += 1) rig.service.processRetellWebhook({ event: 'call_started', call: { call_id: `bulk${n}` } });
  assert.equal(rig.service.liveCalls.size, 5, 'a long demo session must not grow memory without bound');
});

test('transcript_updated is read from the top-level transcript_with_tool_calls', (t) => {
  const rig = rigOf(t);
  // Retell puts the transcript at the TOP level for transcript_updated and only under
  // call.transcript_object on call_ended/call_analyzed. Reading only the latter left the
  // live panel permanently empty during a real call.
  rig.service.processRetellWebhook({ event: 'call_started', call: { call_id: 'shape1' } });
  rig.service.processRetellWebhook({
    event: 'transcript_updated',
    call: { call_id: 'shape1' },
    transcript_with_tool_calls: [
      { role: 'agent', content: 'Hi Jordan.', words: [] },
      { role: 'user', content: 'Go ahead.', words: [] },
      { role: 'tool_call_invocation', name: 'p9_search_matrix_listings', arguments: '{}' },
      { role: 'tool_call_result', content: '{"ok":true}' }
    ]
  });
  const call = rig.service.liveTranscript().call;
  assert.equal(call.status, 'live');
  assert.deepEqual(call.turns, [
    { role: 'agent', content: 'Hi Jordan.' },
    { role: 'user', content: 'Go ahead.' }
  ], 'tool-call rows must not appear in the conversation panel');
});
