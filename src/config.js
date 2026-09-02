import fs from 'node:fs';
import path from 'node:path';
import { AppError } from './errors.js';

function loadDotEnv(file = '.env') {
  const target = path.resolve(file);
  if (!fs.existsSync(target)) return;
  for (const raw of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
const bool = (value, fallback = false) => value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
const int = (value, fallback) => Number.isFinite(Number.parseInt(value ?? '', 10)) ? Number.parseInt(value, 10) : fallback;
const list = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

export function buildConfig(env = process.env) {
  if (env === process.env) loadDotEnv();
  const nodeEnv = env.NODE_ENV || 'development';
  const databasePath = env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(env.DATABASE_PATH || './data/pillar9-voice.sqlite');
  const config = {
    nodeEnv,
    host: env.HOST || '0.0.0.0',
    port: int(env.PORT, 8787),
    publicBaseUrl: (env.PUBLIC_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, ''),
    databasePath,
    autoSeed: bool(env.AUTO_SEED, nodeEnv !== 'production'),
    adminApiKey: env.ADMIN_API_KEY || 'dev-admin-key-change-me',
    toolApiKey: env.TOOL_API_KEY || 'dev-tool-key-change-me',
    logLevel: env.LOG_LEVEL || 'info',
    serviceName: env.SERVICE_NAME || 'Pillar 9',
    assistantName: env.ASSISTANT_NAME || 'Ava',
    demoPanel: {
      enabled: bool(env.DEMO_PANEL_ENABLED, nodeEnv !== 'production'),
      apiKey: env.DEMO_PANEL_API_KEY || (nodeEnv !== 'production' ? 'dev-demo-key-change-me' : ''),
      allowLiveCalls: bool(env.DEMO_PANEL_ALLOW_LIVE_CALLS, false)
    },
    licensedAgent: {
      id: env.LICENSED_AGENT_ID || 'agent_001', name: env.LICENSED_AGENT_NAME || 'Alex Chen',
      licenceNumber: env.LICENSED_AGENT_LICENSE_NUMBER || 'RECA-REPLACE-ME', brokerage: env.BROKERAGE_NAME || 'Example Realty',
      transferPhone: env.TRANSFER_PHONE_NUMBER || '+14035550101', mortgageTransferPhone: env.MORTGAGE_TRANSFER_PHONE_NUMBER || '+14035550102'
    },
    bland: {
      apiBaseUrl: (env.BLAND_API_BASE_URL || 'https://api.bland.ai').replace(/\/$/, ''), apiKey: env.BLAND_API_KEY || '',
      webhookSecret: env.BLAND_WEBHOOK_SECRET || '', dryRun: bool(env.BLAND_DRY_RUN, true), fromNumber: env.BLAND_FROM_NUMBER || '',
      inboundNumber: env.BLAND_INBOUND_NUMBER || '', voice: env.BLAND_VOICE || 'Paige', pathwayId: env.BLAND_PATHWAY_ID || '',
      pathwayVersion: env.BLAND_PATHWAY_VERSION || 'staging', toolIds: list(env.BLAND_TOOL_IDS), knowledgeBaseIds: list(env.BLAND_KNOWLEDGE_BASE_IDS),
      recordCalls: bool(env.BLAND_RECORD_CALLS, false), generatePathway: bool(env.BLAND_GENERATE_PATHWAY, false),
      purchaseNumber: bool(env.BLAND_PURCHASE_NUMBER, false), areaCode: env.BLAND_AREA_CODE || '403'
    },
    voiceProvider: (env.VOICE_PROVIDER || 'retell').toLowerCase(),
    retell: {
      apiBaseUrl: (env.RETELL_API_BASE_URL || 'https://api.retellai.com').replace(/\/$/, ''), apiKey: env.RETELL_API_KEY || '',
      webhookKey: env.RETELL_WEBHOOK_KEY || env.RETELL_API_KEY || '', dryRun: bool(env.RETELL_DRY_RUN, true), agentId: env.RETELL_AGENT_ID || '', agentVersion: env.RETELL_AGENT_VERSION || '',
      llmId: env.RETELL_LLM_ID || '', fromNumber: env.RETELL_FROM_NUMBER || '', inboundNumber: env.RETELL_INBOUND_NUMBER || '',
      voiceId: env.RETELL_VOICE_ID || 'retell-Cimo', model: env.RETELL_LLM_MODEL || 'gpt-4.1',
      voiceSpeed: Math.min(2, Math.max(0.5, Number.parseFloat(env.RETELL_VOICE_SPEED ?? '') || 1)),
      recordCalls: bool(env.RETELL_RECORD_CALLS, false), timeoutMs: int(env.RETELL_TIMEOUT_MS, 30000)
    },
    matrix: {
      mode: env.MATRIX_MODE || 'fixture', baseUrl: (env.MATRIX_BASE_URL || '').replace(/\/$/, ''), apiKey: env.MATRIX_API_KEY || '',
      timeoutMs: int(env.MATRIX_TIMEOUT_MS, 6000), approvedListingHosts: list(env.APPROVED_LISTING_HOSTS || 'listings.example.test').map((host)=>host.toLowerCase())
    },
    openai: {
      enabled: bool(env.OPENAI_ENABLED, false), apiBaseUrl: (env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      apiKey: env.OPENAI_API_KEY || '', model: env.OPENAI_MODEL || 'gpt-5.6-luna', reasoningEffort: env.OPENAI_REASONING_EFFORT || 'low',
      timeoutMs: int(env.OPENAI_TIMEOUT_MS, 20000), maxOutputTokens: int(env.OPENAI_MAX_OUTPUT_TOKENS, 350)
    },
    whatsapp: {
      enabled: bool(env.WHATSAPP_ENABLED, false), dryRun: bool(env.WHATSAPP_DRY_RUN, true), graphBaseUrl: (env.META_GRAPH_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, ''),
      graphApiVersion: env.META_GRAPH_API_VERSION || 'v26.0', phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '', businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '', appSecret: env.META_APP_SECRET || '', verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_CA', templateNames: {
        birthday: env.WHATSAPP_TEMPLATE_BIRTHDAY || 'p9_birthday_v1', propertyMatches: env.WHATSAPP_TEMPLATE_PROPERTY_MATCHES || 'p9_property_matches_v1',
        buyerFollowup: env.WHATSAPP_TEMPLATE_BUYER_FOLLOWUP || 'p9_buyer_followup_v1', showingFollowup: env.WHATSAPP_TEMPLATE_SHOWING_FOLLOWUP || 'p9_showing_followup_v1',
        relationshipCheckin: env.WHATSAPP_TEMPLATE_RELATIONSHIP_CHECKIN || 'p9_relationship_checkin_v1', appointmentReminder: env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER || 'p9_appointment_reminder_v1'
      }
    },
    messaging: { mode: env.MESSAGING_MODE || 'log', webhookUrl: env.MESSAGING_WEBHOOK_URL || '', apiKey: env.MESSAGING_API_KEY || '', unsubscribeUrl: env.UNSUBSCRIBE_URL || 'https://listings.example.test/unsubscribe' },
    compliance: { mode: env.COMPLIANCE_MODE || 'fixture', baseUrl: (env.COMPLIANCE_BASE_URL || '').replace(/\/$/, ''), apiKey: env.COMPLIANCE_API_KEY || '' },
    defaultTimezone: env.DEFAULT_TIMEZONE || 'America/Edmonton',
    callingWindow: { start: env.CALL_WINDOW_START || '09:00', end: env.CALL_WINDOW_END || '20:00', weekendStart: env.WEEKEND_CALL_WINDOW_START || '10:00', weekendEnd: env.WEEKEND_CALL_WINDOW_END || '18:00' },
    maxCallDurationMinutes: int(env.MAX_CALL_DURATION_MINUTES, 12), consentMaxAgeDays: int(env.CONSENT_MAX_AGE_DAYS, 365)
  };
  if (nodeEnv === 'production') {
    if ([config.adminApiKey, config.toolApiKey].some((key) => key.length < 24 || key.includes('change-me'))) throw new AppError(500, 'CONFIG_WEAK_KEYS', 'Production API keys must be at least 24 random characters.');
    if(config.demoPanel.enabled&&(config.demoPanel.apiKey.length<24||config.demoPanel.apiKey.includes('change-me')))throw new AppError(500,'CONFIG_WEAK_DEMO_KEY','An enabled production demo panel requires a separate random key of at least 24 characters.');
    if (!config.publicBaseUrl.startsWith('https://')) throw new AppError(500, 'CONFIG_HTTPS_REQUIRED', 'PUBLIC_BASE_URL must use HTTPS.');
    if (!config.bland.webhookSecret) throw new AppError(500, 'CONFIG_WEBHOOK_SECRET_REQUIRED', 'BLAND_WEBHOOK_SECRET is required.');
    if (!config.bland.apiBaseUrl.startsWith('https://')) throw new AppError(500, 'CONFIG_BLAND_HTTPS_REQUIRED', 'BLAND_API_BASE_URL must use HTTPS.');
    if (!config.bland.dryRun && (!config.bland.apiKey || !config.bland.fromNumber || !config.bland.inboundNumber || !config.bland.toolIds.length)) throw new AppError(500, 'CONFIG_BLAND_REQUIRED', 'Live Bland mode requires API key, inbound/from numbers, and tools.');
    if (![config.bland.fromNumber,config.bland.inboundNumber].every((phone)=>/^\+1\d{10}$/.test(phone))) throw new AppError(500, 'CONFIG_BLAND_NUMBERS_REQUIRED', 'Production Bland numbers must be Canadian/NANP E.164 values.');
    if (config.voiceProvider === 'retell') {
      if (!config.retell.apiBaseUrl.startsWith('https://')) throw new AppError(500, 'CONFIG_RETELL_HTTPS_REQUIRED', 'RETELL_API_BASE_URL must use HTTPS.');
      if (!config.retell.apiKey) throw new AppError(500, 'CONFIG_RETELL_KEY_REQUIRED', 'RETELL_API_KEY is required.');
      if (!config.retell.webhookKey) throw new AppError(500, 'CONFIG_RETELL_WEBHOOK_KEY_REQUIRED', 'RETELL_WEBHOOK_KEY is required to verify webhook signatures (defaults to RETELL_API_KEY).');
      if (!config.retell.dryRun && (!config.retell.agentId || !config.retell.fromNumber || !config.retell.inboundNumber)) throw new AppError(500, 'CONFIG_RETELL_REQUIRED', 'Live Retell mode requires an agent ID and from/inbound numbers.');
      if (![config.retell.fromNumber, config.retell.inboundNumber].every((phone) => /^\+\d{8,15}$/.test(phone))) throw new AppError(500, 'CONFIG_RETELL_NUMBERS_REQUIRED', 'Production Retell numbers must be E.164 values.');
    }
    if (config.matrix.mode !== 'http') throw new AppError(500, 'CONFIG_MATRIX_FIXTURE_FORBIDDEN', 'Production requires MATRIX_MODE=http.');
    if (!config.matrix.baseUrl.startsWith('https://') || !config.matrix.apiKey) throw new AppError(500, 'CONFIG_MATRIX_REQUIRED', 'Production Matrix HTTPS endpoint and credentials are required.');
    if (!config.matrix.approvedListingHosts.length || config.matrix.approvedListingHosts.some((host) => host.endsWith('.example') || host.endsWith('.test'))) throw new AppError(500, 'CONFIG_LISTING_HOSTS_REQUIRED', 'Production requires real APPROVED_LISTING_HOSTS.');
    if (config.compliance.mode !== 'http' || !config.compliance.baseUrl.startsWith('https://') || !config.compliance.apiKey) throw new AppError(500, 'CONFIG_COMPLIANCE_REQUIRED', 'Production requires an HTTPS external compliance/DNCL decision service.');
    if (config.messaging.mode !== 'http' || !config.messaging.webhookUrl.startsWith('https://') || !config.messaging.apiKey) throw new AppError(500, 'CONFIG_MESSAGING_REQUIRED', 'Production requires an authenticated HTTPS messaging adapter.');
    if (!config.messaging.unsubscribeUrl.startsWith('https://')) throw new AppError(500, 'CONFIG_UNSUBSCRIBE_URL_REQUIRED', 'Production requires an HTTPS UNSUBSCRIBE_URL.');
    if(config.openai.enabled&&(!config.openai.apiBaseUrl.startsWith('https://')||!config.openai.apiKey))throw new AppError(500,'CONFIG_OPENAI_REQUIRED','Enabled OpenAI responses require an HTTPS endpoint and OPENAI_API_KEY.');
    if(config.whatsapp.enabled){
      if(!config.whatsapp.verifyToken||!config.whatsapp.appSecret)throw new AppError(500,'CONFIG_WHATSAPP_WEBHOOK_REQUIRED','Enabled WhatsApp requires a verify token and Meta app secret.');
      if(!/^v\d+\.\d+$/.test(config.whatsapp.graphApiVersion))throw new AppError(500,'CONFIG_WHATSAPP_VERSION_INVALID','META_GRAPH_API_VERSION must look like v26.0.');
      if(!config.whatsapp.dryRun&&(!config.whatsapp.phoneNumberId||!config.whatsapp.accessToken))throw new AppError(500,'CONFIG_WHATSAPP_CREDENTIALS_REQUIRED','Live WhatsApp requires phone-number ID and access token.');
      if(!config.openai.enabled)throw new AppError(500,'CONFIG_WHATSAPP_OPENAI_REQUIRED','Production WhatsApp natural-language replies require OPENAI_ENABLED=true.');
    }
    if (config.licensedAgent.licenceNumber.includes('REPLACE') || config.licensedAgent.brokerage === 'Example Realty') throw new AppError(500, 'CONFIG_VERIFIED_IDENTITY_REQUIRED', 'Production requires a verified licence number and real brokerage identity.');
    if (![config.licensedAgent.transferPhone,config.licensedAgent.mortgageTransferPhone].every((phone)=>/^\+1\d{10}$/.test(phone))) throw new AppError(500, 'CONFIG_TRANSFER_NUMBERS_REQUIRED', 'Production transfer numbers must be Canadian/NANP E.164 values.');
  }
  if (!['retell', 'bland'].includes(config.voiceProvider)) throw new AppError(500, 'CONFIG_UNKNOWN_VOICE_PROVIDER', 'VOICE_PROVIDER must be "retell" or "bland".');
  return Object.freeze(config);
}
