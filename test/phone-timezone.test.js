import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTimezone } from '../src/phone-timezone.js';
import { testRig, insideWindow, outsideWindow } from './helpers.js';

test('canadian area codes map to their provincial timezone', () => {
  const cases = { '+14035550123': 'America/Edmonton', '+12365009709': 'America/Vancouver', '+16045550123': 'America/Vancouver',
    '+14165550123': 'America/Toronto', '+15145550123': 'America/Toronto', '+12045550123': 'America/Winnipeg',
    '+13065550123': 'America/Regina', '+19025550123': 'America/Halifax', '+17095550123': 'America/St_Johns' };
  for (const [phone, zone] of Object.entries(cases)) {
    const result = deriveTimezone(phone);
    assert.equal(result.timezone, zone, phone);
    assert.equal(result.source, 'area_code');
  }
});

test('international country codes map to a representative timezone', () => {
  assert.deepEqual(deriveTimezone('+917903905731'), { timezone: 'Asia/Kolkata', source: 'country_code', matched: '91' });
  assert.equal(deriveTimezone('+442071234567').timezone, 'Europe/London');
  assert.equal(deriveTimezone('+61212345678').timezone, 'Australia/Sydney');
});

test('longer country codes win over their shorter prefixes', () => {
  // 971 (UAE) must not be read as 97, and 880 (Bangladesh) must not be read as 88.
  assert.equal(deriveTimezone('+971501234567').timezone, 'Asia/Dubai');
  assert.equal(deriveTimezone('+8801712345678').timezone, 'Asia/Dhaka');
  assert.equal(deriveTimezone('+35315551234').timezone, 'Europe/Dublin');
});

test('unknown prefixes fall back to the supplied default', () => {
  assert.deepEqual(deriveTimezone('+9999999999', 'America/Toronto'), { timezone: 'America/Toronto', source: 'default' });
  assert.equal(deriveTimezone('', 'America/Toronto').timezone, 'America/Toronto');
  assert.equal(deriveTimezone(null).timezone, 'America/Edmonton');
});

test('demo outbound derives the contact timezone from the number', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const result = await rig.service.runDemoOutbound({ firstName: 'Ankit', phone: '+917903905731', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('Asia/Kolkata') });
  assert.equal(result.timezone, 'Asia/Kolkata');
  assert.equal(result.timezoneSource, 'country_code');
  assert.equal(result.call.payload.to_number, '+917903905731');
});

test('a canadian number is gated in canadian local time, not the operator timezone', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const allowed = await rig.service.runDemoOutbound({ firstName: 'Sam', phone: '+14035550777', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') });
  assert.equal(allowed.timezone, 'America/Edmonton');
  assert.equal(allowed.call.dryRun, true);
  // The same number outside Edmonton's window is refused, proving the gate reads
  // the recipient's local clock rather than whatever timezone the operator is in.
  await assert.rejects(() => rig.service.runDemoOutbound({ firstName: 'Sam', phone: '+14035550777', mode: 'buyer_followup', consentConfirmed: true, at: outsideWindow('America/Edmonton') }), { code: 'OUTSIDE_CALLING_WINDOW' });
});

test('an explicit timezone still overrides the derived one', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const result = await rig.service.runDemoOutbound({ firstName: 'Ankit', phone: '+917903905731', timezone: 'America/Edmonton', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') });
  assert.equal(result.timezone, 'America/Edmonton');
  assert.equal(result.timezoneSource, 'explicit');
});

test('the timezone is derived from the dialled E.164 number, not the raw input', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  // "4035550777" dials +14035550777. Reading the raw digits would match country code
  // "40" (Romania) and gate an Alberta call in Bucharest time.
  const result = await rig.service.runDemoOutbound({ firstName: 'Sam', phone: '4035550777', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') });
  assert.equal(result.call.payload.to_number, '+14035550777');
  assert.equal(result.timezone, 'America/Edmonton');
  assert.equal(result.timezoneSource, 'area_code');
});

test('an indian number is not mistaken for the +1 917 area code', () => {
  // "917" is both a Manhattan area code and the start of an Indian mobile number.
  assert.equal(deriveTimezone('+917903905731').timezone, 'Asia/Kolkata');
  assert.equal(deriveTimezone('+19175551234').timezone, 'America/New_York');
});

test('a number already held by a CRM contact reuses that contact and its timezone', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const seeded = rig.repo.getContact('contact_demo_buyer');
  const result = await rig.service.runDemoOutbound({ firstName: 'Someone Else', phone: seeded.phone, mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') });
  assert.equal(result.contactId, 'contact_demo_buyer', 'must not insert a duplicate row for the same number');
  assert.equal(result.timezoneSource, 'contact_record');
  assert.equal(rig.repo.getContact('contact_demo_buyer').firstName, seeded.firstName, 'the CRM record must not be overwritten');
});

test('the same demo number is stable across repeated calls', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const args = { firstName: 'Sam', phone: '+14035550777', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') };
  const first = await rig.service.runDemoOutbound(args);
  const second = await rig.service.runDemoOutbound(args);
  assert.equal(first.contactId, second.contactId);
});

test('the operator-typed name wins for a panel-created contact', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const args = { phone: '+917903905731', mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('Asia/Kolkata') };
  await rig.service.runDemoOutbound({ ...args, firstName: 'Test' });
  const second = await rig.service.runDemoOutbound({ ...args, firstName: 'Ankit' });
  // The greeting must use the name typed for THIS call, not a stale one from an earlier demo.
  assert.equal(second.call.payload.retell_llm_dynamic_variables.first_name, 'Ankit');
  assert.equal(rig.repo.getContact(second.contactId).firstName, 'Ankit');
});

test('a real CRM contact is never renamed by the demo console', async (t) => {
  const rig = testRig({ VOICE_PROVIDER: 'retell' }); t.after(rig.close);
  const seeded = rig.repo.getContact('contact_demo_buyer');
  const result = await rig.service.runDemoOutbound({ firstName: 'Someone Else', phone: seeded.phone, mode: 'buyer_followup', consentConfirmed: true, at: insideWindow('America/Edmonton') });
  assert.equal(result.contactId, 'contact_demo_buyer');
  assert.equal(rig.repo.getContact('contact_demo_buyer').firstName, seeded.firstName);
  assert.equal(result.call.payload.retell_llm_dynamic_variables.first_name, seeded.firstName);
});
