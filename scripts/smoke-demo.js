import { buildConfig } from '../src/config.js';
import { createApplication } from '../src/server.js';
import { RETELL_BEGIN_MESSAGE } from '../src/prompts.js';

buildConfig(); // loads .env into process.env so the smoke run uses the configured provider
const provider = (process.env.VOICE_PROVIDER || 'retell').toLowerCase();
// A dry-run preview still requires a bootstrapped agent; label the placeholder plainly.
const agentPlaceholder = provider === 'retell' && !process.env.RETELL_AGENT_ID ? 'agent_PREVIEW_NOT_BOOTSTRAPPED' : process.env.RETELL_AGENT_ID;
const config = buildConfig({ ...process.env, NODE_ENV: 'test', DATABASE_PATH: ':memory:', AUTO_SEED: 'true',
  BLAND_DRY_RUN: 'true', RETELL_DRY_RUN: 'true', RETELL_AGENT_ID: agentPlaceholder,
  RETELL_FROM_NUMBER: process.env.RETELL_FROM_NUMBER || '+12365009709', APPROVED_LISTING_HOSTS: 'listings.example.test' });
const app = createApplication({ config });

const renderOpening = (call) => {
  if (call.payload.first_sentence) return call.payload.first_sentence;
  const vars = call.payload.retell_llm_dynamic_variables || {};
  return RETELL_BEGIN_MESSAGE.replace(/{{([a-z_]+)}}/gi, (_m, key) => vars[key] ?? `{{${key}}}`);
};

try {
  const draft = app.service.captureCriteria({ contactId: 'contact_demo_buyer', utterance: 'I need a three bedroom detached house in northwest Calgary under seven hundred thousand with a double garage' });
  const confirmed = app.service.captureCriteria({ contactId: 'contact_demo_buyer', criteria: draft.criteria, confirm: true, draftId: draft.draftId });
  const matches = await app.service.searchListings({ contactId: 'contact_demo_buyer', criteriaId: confirmed.criteriaId });
  const call = await app.service.startOutbound({ contactId: 'contact_demo_buyer', mode: 'buyer_followup', reason: 'to follow up on the home search you requested', at: new Date('2026-08-27T17:00:00Z') });
  console.log(JSON.stringify({ ok: true, provider: config.voiceProvider,
    draft: { stage: draft.stage, criteria: draft.criteria }, confirmed: { stage: confirmed.stage },
    matches: matches.listings.map((x) => x.matrixId),
    call: { dryRun: call.dryRun, to: call.payload.to_number || call.payload.phone_number, opening: renderOpening(call) },
    ...(agentPlaceholder === 'agent_PREVIEW_NOT_BOOTSTRAPPED' ? { note: 'RETELL_AGENT_ID is unset; run scripts/bootstrap-retell.js --apply before placing real calls.' } : {}) }, null, 2));
} finally { app.repo.close(); }
