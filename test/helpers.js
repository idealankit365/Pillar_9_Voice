import { buildConfig } from '../src/config.js';
import { Repository, seedRepository } from '../src/db.js';
import { MatrixAdapter, MessagingAdapter } from '../src/adapters.js';
import { VoiceAgentService } from '../src/services.js';
import { WhatsAppAgentService } from '../src/whatsapp.js';

export function testRig(extra={}){const config=buildConfig({NODE_ENV:'test',VOICE_PROVIDER:'bland',RETELL_API_KEY:'test-retell-key',RETELL_FROM_NUMBER:'+12365009709',RETELL_INBOUND_NUMBER:'+12365009709',RETELL_AGENT_ID:'agent_test_123',DATABASE_PATH:':memory:',AUTO_SEED:'false',HOST:'127.0.0.1',PORT:'0',PUBLIC_BASE_URL:'https://voice.example.test',ADMIN_API_KEY:'test-admin-key',TOOL_API_KEY:'test-tool-key',DEMO_PANEL_ENABLED:'true',DEMO_PANEL_API_KEY:'test-demo-key',BLAND_DRY_RUN:'true',BLAND_FROM_NUMBER:'+14035550100',BLAND_INBOUND_NUMBER:'+14035550100',BLAND_VOICE:'Paige',APPROVED_LISTING_HOSTS:'listings.example.test',UNSUBSCRIBE_URL:'https://listings.example.test/unsubscribe',OPENAI_ENABLED:'true',OPENAI_API_KEY:'test-openai-key',WHATSAPP_ENABLED:'true',WHATSAPP_DRY_RUN:'true',WHATSAPP_PHONE_NUMBER_ID:'123456789',WHATSAPP_VERIFY_TOKEN:'test-verify-token',META_APP_SECRET:'test-meta-secret',...extra});const repo=new Repository(':memory:');seedRepository(repo,config,new Date('2026-08-29T12:00:00Z'));const bland={sent:[],async sendCall(payload){this.sent.push(payload);return{call_id:'call_test'};}};
  const retell={sent:[],bound:[],async sendCall(payload){this.sent.push(payload);return{call_id:'retell_call_test',agent_id:payload.override_agent_id,call_status:'registered'};},async updatePhoneNumber(number,payload){this.bound.push({number,payload});return{phone_number:number,...payload};}};const matrix=new MatrixAdapter(config.matrix,repo);const messaging=new MessagingAdapter(config.messaging);const compliance={async checkOutbound({evaluatedAt}){return{allowed:true,decisionId:'test-decision',checkedAt:evaluatedAt};}};const service=new VoiceAgentService({config,repo,bland,retell,matrix,messaging,compliance});const openai={calls:[],async create(payload){this.calls.push(payload);return{id:'resp_test',outputText:'I can help organize your property search. Which Calgary area interests you?',usage:{}};}};const whatsapp={sent:[],async sendText(to,body){const result={dryRun:true,id:`wamid.test.${this.sent.length+1}`,status:'preview'};this.sent.push({type:'text',to,body,...result});return result;},async sendTemplate(to,template){const result={dryRun:true,id:`wamid.test.${this.sent.length+1}`,status:'preview'};this.sent.push({type:'template',to,template,...result});return result;}};const whatsappService=new WhatsAppAgentService({config,repo,voiceService:service,matrix,openai,whatsapp});return{config,repo,bland,retell,matrix,messaging,compliance,service,openai,whatsapp,whatsappService,close:()=>repo.close()};}

// runDemoOutbound records operator consent at the real wall clock, so any evaluation
// time passed to it must be >= now or the consent reads as future-dated. Hardcoded
// dates therefore rot the moment the calendar passes them. These helpers pick the next
// instant that is both in the future and on the correct side of the calling window.
function localParts(timezone, at) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(at);
  const o = Object.fromEntries(p.map(({ type, value }) => [type, value]));
  return { weekend: ['Sat', 'Sun'].includes(o.weekday), hour: Number(o.hour) };
}
const inWindow = ({ weekend, hour }) => weekend ? (hour >= 10 && hour < 18) : (hour >= 9 && hour < 20);
function scan(timezone, want, from = Date.now()) {
  for (let step = 1; step <= 14 * 24 * 4; step += 1) {
    const at = new Date(from + step * 15 * 60 * 1000);
    if (inWindow(localParts(timezone, at)) === want) return at;
  }
  throw new Error(`No ${want ? 'in' : 'out of'}-window time found for ${timezone}`);
}
/** Next future instant inside that timezone's calling window. */
export const insideWindow = (timezone) => scan(timezone, true);
/** Next future instant outside that timezone's calling window. */
export const outsideWindow = (timezone) => scan(timezone, false);
