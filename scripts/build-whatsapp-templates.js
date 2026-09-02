import fs from 'node:fs';
import path from 'node:path';
import { buildConfig } from '../src/config.js';
import { WHATSAPP_TEMPLATE_DEFINITIONS } from '../src/whatsapp.js';

const config=buildConfig();const output=path.resolve('generated/meta-whatsapp-templates.json');const templates=WHATSAPP_TEMPLATE_DEFINITIONS.map((template)=>({...template,name:config.whatsapp.templateNames[template.key],language:config.whatsapp.templateLanguage,reviewNotice:'Submit in WhatsApp Manager and use only after Meta approval. Meta may reclassify the suggested category.'}));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,`${JSON.stringify({generatedAt:new Date().toISOString(),graphApiVersion:config.whatsapp.graphApiVersion,templates},null,2)}\n`);console.log(JSON.stringify({ok:true,output,templates:templates.length},null,2));
