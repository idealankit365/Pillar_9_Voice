import { buildConfig } from './config.js';
import { Repository, seedRepository } from './db.js';
import { BlandClient, RetellClient, MatrixAdapter, MessagingAdapter, ComplianceAdapter, OpenAIResponsesClient, WhatsAppClient } from './adapters.js';
import { VoiceAgentService } from './services.js';
import { WhatsAppAgentService } from './whatsapp.js';
import { createHttpServer } from './http.js';

export function createApplication(overrides={}){
  const config=overrides.config||buildConfig();const repo=overrides.repo||new Repository(config.databasePath);if(config.autoSeed&&repo.listContacts().length===0)seedRepository(repo,config);
  const bland=overrides.bland||new BlandClient(config.bland);const retell=overrides.retell||new RetellClient(config.retell);const matrix=overrides.matrix||new MatrixAdapter(config.matrix,repo);const messaging=overrides.messaging||new MessagingAdapter(config.messaging);const compliance=overrides.compliance||new ComplianceAdapter(config.compliance);const service=overrides.service||new VoiceAgentService({config,repo,bland,retell,matrix,messaging,compliance});const openai=overrides.openai||new OpenAIResponsesClient(config.openai);const whatsapp=overrides.whatsapp||new WhatsAppClient(config.whatsapp);const whatsappService=overrides.whatsappService||new WhatsAppAgentService({config,repo,voiceService:service,matrix,openai,whatsapp});const server=createHttpServer({config,service,repo,whatsappService});
  return{config,repo,bland,retell,matrix,messaging,compliance,service,openai,whatsapp,whatsappService,server,listen:()=>new Promise((resolve)=>server.listen(config.port,config.host,()=>resolve(server.address()))),close:()=>new Promise((resolve,reject)=>server.close((error)=>{try{repo.close();}catch{}error?reject(error):resolve();}))};
}

const isMain=process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1];
if(isMain){const app=createApplication();app.listen().then((address)=>console.log(JSON.stringify({level:'info',message:'Pillar 9 voice service listening',address,environment:app.config.nodeEnv,voiceProvider:app.config.voiceProvider,dryRun:app.service.voiceRuntime().dryRun}))).catch((error)=>{console.error(error);process.exitCode=1;});}
