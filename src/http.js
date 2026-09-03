import http from 'node:http';
import { AppError, asAppError, assert } from './errors.js';
import { safeTokenEqual, verifyHmacSha256, verifyRetellSignature, redact } from './security.js';
import { CAMPAIGN_MODES } from './modes.js';
import { DEMO_PANEL_HTML } from './demo-panel.js';

const MAX_BODY=1_000_000;
function reply(response,status,body){const payload=JSON.stringify(body);response.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store','x-content-type-options':'nosniff'});response.end(payload);}
function replyText(response,status,body){const payload=String(body);response.writeHead(status,{'content-type':'text/plain; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store','x-content-type-options':'nosniff'});response.end(payload);}
function replyHtml(response,status,body){const payload=String(body);response.writeHead(status,{'content-type':'text/html; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"});response.end(payload);}
async function readRaw(request){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)throw new AppError(413,'BODY_TOO_LARGE','Request body exceeds 1 MB.');chunks.push(chunk);}return Buffer.concat(chunks);}
function parseJson(raw){if(!raw.length)return{};try{return JSON.parse(raw.toString('utf8'));}catch{throw new AppError(400,'INVALID_JSON','Request body must be valid JSON.');}}
const bearer=(request)=>String(request.headers.authorization||'').replace(/^Bearer\s+/i,'');
function requireAdmin(request,config){assert(safeTokenEqual(config.adminApiKey,bearer(request)),401,'UNAUTHORIZED','Valid administrator credentials are required.');}
function requireTool(request,config){const token=request.headers['x-p9-tool-key']||bearer(request);assert(safeTokenEqual(config.toolApiKey,token),401,'UNAUTHORIZED','Valid tool credentials are required.');}
function requireDemo(request,config){const token=request.headers['x-p9-demo-key']||bearer(request);assert(config.demoPanel.enabled&&safeTokenEqual(config.demoPanel.apiKey,token),401,'UNAUTHORIZED','Valid demo-console credentials are required.');}
const routeKey=(request,url)=>`${request.method} ${url.pathname}`;

export function createHttpHandler({config,service,repo,whatsappService}){
  return async function handler(request,response){const started=Date.now();const url=new URL(request.url,'http://localhost');try{
      if(routeKey(request,url)==='GET /health')return reply(response,200,{ok:true,service:'pillar9-voice-agent',voiceProvider:config.voiceProvider,environment:config.nodeEnv,time:new Date().toISOString()});
      if(request.method==='GET'&&(url.pathname==='/demo'||url.pathname==='/demo/')){assert(config.demoPanel.enabled,404,'DEMO_PANEL_DISABLED','The demo panel is disabled.');return replyHtml(response,200,DEMO_PANEL_HTML);}
      if(routeKey(request,url)==='GET /webhooks/whatsapp'){const mode=url.searchParams.get('hub.mode');const token=url.searchParams.get('hub.verify_token');const challenge=url.searchParams.get('hub.challenge');assert(whatsappService?.verify(mode,token),403,'WHATSAPP_VERIFY_FAILED','WhatsApp webhook verification failed.');return replyText(response,200,challenge||'');}
      if(url.pathname.startsWith('/admin/'))requireAdmin(request,config);if(url.pathname.startsWith('/tools/'))requireTool(request,config);if(url.pathname.startsWith('/demo-api/'))requireDemo(request,config);
      const raw=await readRaw(request);let data=parseJson(raw);let result;
      if(url.pathname.startsWith('/tools/')&&data&&typeof data==='object'&&data.args&&typeof data.args==='object'&&!Array.isArray(data.args))data={...data.args,__providerCall:data.call?.call_id||null};
      switch(routeKey(request,url)){
        case 'GET /admin/modes': result={modes:CAMPAIGN_MODES};break;
        case 'GET /admin/demo/status': result=service.demoStatus();break;
        case 'GET /admin/contacts': result={contacts:repo.listContacts()};break;
        case 'GET /admin/interactions': result={interactions:repo.listInteractions(Number(url.searchParams.get('limit'))||25)};break;
        case 'POST /admin/contacts': result=repo.upsertContact(data);break;
        case 'POST /admin/consents': service.requireContact(data.contactId);result=repo.recordConsent(data);break;
        case 'POST /admin/calls/outbound': result=await service.startOutbound(data);break;
        case 'POST /admin/inbound/configure': result=await service.configureInbound();break;
        case 'POST /admin/inbound/purchase': result=await service.purchaseNumber(data);break;
        case 'POST /admin/whatsapp/send': assert(whatsappService,503,'WHATSAPP_NOT_CONFIGURED','WhatsApp service is unavailable.');result=await whatsappService.sendProactive(data);break;
        case 'GET /admin/whatsapp/messages': {const contactId=url.searchParams.get('contactId');service.requireContact(contactId);result={messages:repo.listWhatsAppMessages(contactId,Number(url.searchParams.get('limit'))||20)};break;}
        case 'GET /demo-api/status': result=service.demoStatus();break;
        case 'POST /demo-api/outbound': result=await service.runDemoOutbound(data);break;
        case 'POST /demo-api/inbound/configure': result=await service.configureInboundFromDemo(data);break;
        case 'GET /demo-api/live': result=service.liveTranscript();break;
        case 'GET /demo-api/interactions': result={interactions:repo.listInteractions(Number(url.searchParams.get('limit'))||25)};break;
        case 'POST /tools/permission': result=await service.checkOutboundPermission(data);break;
        case 'POST /tools/context': result=service.getContext(data.contactId);break;
        case 'POST /tools/criteria': result=service.captureCriteria(data);break;
        case 'POST /tools/listings/search': result=await service.searchListings(data);break;
        case 'POST /tools/listings/details': result=await service.details(data);break;
        case 'POST /tools/listings/compare': result=await service.compare(data);break;
        case 'POST /tools/market-context': result=await service.marketContext(data);break;
        case 'POST /tools/affordability': result=service.affordability(data);break;
        case 'POST /tools/appointments': result=service.scheduleAppointment(data);break;
        case 'POST /tools/follow-up': result=await service.sendFollowUp(data);break;
        case 'POST /tools/relationship': result=service.updateRelationship(data);break;
        case 'POST /tools/do-not-call': result=service.doNotCall(data);break;
        case 'POST /tools/escalate': result=service.escalate(data);break;
        case 'POST /webhooks/retell': {
          const signature=request.headers['x-retell-signature'];
          if(config.retell.webhookKey)assert(verifyRetellSignature(config.retell.webhookKey,raw,signature),401,'INVALID_RETELL_SIGNATURE','Retell webhook signature is invalid.');
          else assert(config.nodeEnv!=='production',503,'RETELL_WEBHOOK_KEY_REQUIRED','RETELL_WEBHOOK_KEY (or RETELL_API_KEY) is required to verify Retell webhooks.');
          result=service.processRetellWebhook(data);break;
        }
        case 'POST /webhooks/bland': {
          const signature=request.headers['x-bland-signature']||request.headers['x-webhook-signature']||request.headers['bland-signature'];
          if(config.bland.webhookSecret)assert(verifyHmacSha256(config.bland.webhookSecret,raw,signature),401,'INVALID_WEBHOOK_SIGNATURE','Webhook signature is invalid.');
          else assert(config.nodeEnv!=='production',503,'WEBHOOK_SECRET_REQUIRED','Webhook signing secret is not configured.');
          result=service.processBlandWebhook(data);break;
        }
        case 'POST /webhooks/whatsapp': {
          assert(whatsappService,503,'WHATSAPP_NOT_CONFIGURED','WhatsApp service is unavailable.');const signature=request.headers['x-hub-signature-256'];
          if(config.whatsapp.appSecret)assert(verifyHmacSha256(config.whatsapp.appSecret,raw,signature),401,'INVALID_WHATSAPP_SIGNATURE','WhatsApp webhook signature is invalid.');
          else assert(config.nodeEnv!=='production',503,'WHATSAPP_APP_SECRET_REQUIRED','Meta app secret is not configured.');
          result=await whatsappService.processWebhook(data);break;
        }
        default: throw new AppError(404,'NOT_FOUND','Route not found.');
      }
      reply(response,200,{ok:true,data:result});
    }catch(error){const safe=asAppError(error);const cause=error?.cause;console.error(JSON.stringify({level:'error',code:safe.code,message:redact(error.message),route:`${request.method} ${url.pathname}`,durationMs:Date.now()-started,...(cause?{cause:redact(cause.code||cause.message||String(cause)),...(cause.errors?{causes:cause.errors.slice(0,4).map((e)=>redact(e.code||e.message))}:{})}:{}),...(safe.status>=500&&error?.stack?{at:String(error.stack).split('\n')[1]?.trim()}:{})}));reply(response,safe.status,{ok:false,error:{code:safe.code,message:safe.message,...(safe.details&&config.nodeEnv!=='production'?{details:safe.details}:{})}});}
  };
}

export function createHttpServer(dependencies){return http.createServer(createHttpHandler(dependencies));}
