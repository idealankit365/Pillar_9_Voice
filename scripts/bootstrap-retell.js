// Creates or updates the Retell Response Engine (LLM) and Agent that carry the approved
// Pillar 9 prompt, the thirteen authenticated tools, and the webhook. Dry-run by default:
// it prints a redacted preview and writes it to generated/ without calling Retell.
import fs from 'node:fs';
import path from 'node:path';
import { buildConfig } from '../src/config.js';
import { RetellClient } from '../src/adapters.js';
import { buildRetellToolManifest } from '../src/tool-manifest.js';
import { buildRetellGeneralPrompt, RETELL_BEGIN_MESSAGE } from '../src/prompts.js';
import { CAMPAIGN_MODES } from '../src/modes.js';

const config = buildConfig();
const apply = process.argv.includes('--apply');
const agent = {
  name: config.licensedAgent.name, brokerage: config.licensedAgent.brokerage,
  transferPhone: config.licensedAgent.transferPhone, mortgageTransferPhone: config.licensedAgent.mortgageTransferPhone
};

const tools = buildRetellToolManifest(config, { transferPhone: agent.transferPhone, mortgageTransferPhone: agent.mortgageTransferPhone });
const llmPayload = {
  model: config.retell.model,
  general_prompt: buildRetellGeneralPrompt(config, agent),
  begin_message: RETELL_BEGIN_MESSAGE,
  general_tools: tools,
  default_dynamic_variables: {
    assistant_name: config.assistantName, service_name: config.serviceName, agent_name: agent.name,
    brokerage_name: agent.brokerage, callback_number: agent.transferPhone, first_name: 'there',
    reason: CAMPAIGN_MODES.buyer_followup.callReason, mode_label: CAMPAIGN_MODES.buyer_followup.label,
    objective: CAMPAIGN_MODES.buyer_followup.objective, mode_rule: '', contact_id: ''
  }
};
const agentPayload = (llmId) => ({
  agent_name: `${config.serviceName} — ${config.assistantName} (automated representative)`,
  response_engine: { type: 'retell-llm', llm_id: llmId },
  voice_id: config.retell.voiceId,
  voice_speed: config.retell.voiceSpeed,
  language: 'en-US',
  webhook_url: `${config.publicBaseUrl}/webhooks/retell`,
  webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
  max_call_duration_ms: config.maxCallDurationMinutes * 60 * 1000,
  end_call_after_silence_ms: 30000,
  post_call_analysis_data: [
    { type: 'string', name: 'next_step', description: 'The single next step the person agreed to, or "none".' },
    { type: 'boolean', name: 'opted_out', description: 'True if the person asked not to be contacted again.' }
  ]
});

// Secrets must never reach the preview file.
const redactTools = (list) => list.map((tool) => tool.headers ? { ...tool, headers: { ...tool.headers, 'x-p9-tool-key': '[REDACTED]' } } : tool);
const preview = {
  provider: 'retell', dryRun: !apply, voiceId: config.retell.voiceId, model: config.retell.model,
  webhookUrl: `${config.publicBaseUrl}/webhooks/retell`, toolCount: tools.length,
  llm: { ...llmPayload, general_tools: redactTools(llmPayload.general_tools) },
  agent: agentPayload(config.retell.llmId || '<llm_id-created-at-apply>')
};
const target = path.resolve('generated/retell-bootstrap-preview.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(preview, null, 2));

if (!apply) {
  console.log(JSON.stringify({ ok: true, dryRun: true, preview: 'generated/retell-bootstrap-preview.json', toolCount: tools.length,
    next: 'Re-run with --apply once RETELL_API_KEY is set and PUBLIC_BASE_URL is publicly reachable over HTTPS.' }, null, 2));
  process.exit(0);
}

if (!config.retell.apiKey) { console.error(JSON.stringify({ ok: false, error: 'RETELL_API_KEY is required for --apply.' })); process.exit(1); }
if (!config.publicBaseUrl.startsWith('https://')) console.warn(JSON.stringify({ level: 'warn', message: 'PUBLIC_BASE_URL is not HTTPS; Retell will not be able to reach the tool and webhook URLs.', publicBaseUrl: config.publicBaseUrl }));

const client = new RetellClient(config.retell);
const llm = config.retell.llmId ? await client.updateLlm(config.retell.llmId, llmPayload) : await client.createLlm(llmPayload);
const llmId = llm.llm_id || llm.llmId || config.retell.llmId;
const built = agentPayload(llmId);
const created = config.retell.agentId ? await client.updateAgent(config.retell.agentId, built) : await client.createAgent(built);
const agentId = created.agent_id || created.agentId || config.retell.agentId;

let numberBinding = null;
if (config.retell.inboundNumber) {
  const binding = [{ agent_id: agentId, agent_version: created.version ?? 'latest', weight: 1 }];
  numberBinding = await client.updatePhoneNumber(config.retell.inboundNumber, { inbound_agents: binding, outbound_agents: binding });
}
console.log(JSON.stringify({ ok: true, applied: true, llmId, agentId, agentVersion: created.version ?? null,
  boundNumber: numberBinding ? config.retell.inboundNumber : null, toolCount: tools.length,
  next: `Put RETELL_LLM_ID=${llmId} and RETELL_AGENT_ID=${agentId} in .env, then set RETELL_DRY_RUN=false to place live calls.` }, null, 2));
