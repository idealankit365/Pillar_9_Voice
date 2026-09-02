import fs from 'node:fs';
import path from 'node:path';
import { buildConfig } from '../src/config.js';
import { BlandClient } from '../src/adapters.js';
import { AppError } from '../src/errors.js';

const config=buildConfig();const audio=process.env.VOICE_AUDIO_FILE;const name=process.env.VOICE_NAME||'Pillar 9 Approved Voice';const attestation=process.env.VOICE_RIGHTS_ATTESTATION;
if(!audio||!fs.existsSync(path.resolve(audio)))throw new AppError(400,'VOICE_AUDIO_REQUIRED','Set VOICE_AUDIO_FILE to an authorized voice recording.');
if(fs.statSync(path.resolve(audio)).size>10*1024*1024)throw new AppError(400,'VOICE_AUDIO_TOO_LARGE','Bland BTTS V3 accepts one audio file up to 10 MB.');
if(attestation!=='I_HAVE_DOCUMENTED_RIGHTS')throw new AppError(403,'VOICE_RIGHTS_REQUIRED','Set VOICE_RIGHTS_ATTESTATION=I_HAVE_DOCUMENTED_RIGHTS only after documented speaker authorization.');
if(config.bland.dryRun){console.log(JSON.stringify({ok:true,dryRun:true,name,audio:path.resolve(audio),notice:'No voice was uploaded. Bland native cloning requires documented rights; never clone a person without consent.'},null,2));}else{const form=new FormData();form.set('name',name);form.set('gender',process.env.VOICE_GENDER||'female');form.set('description',process.env.VOICE_DESCRIPTION||'Authorized Pillar 9 professional voice');form.set('isBTTS_V3','true');form.set('audio_samples.items',new Blob([fs.readFileSync(path.resolve(audio))]),path.basename(audio));const result=await new BlandClient(config.bland).cloneVoice(form);console.log(JSON.stringify(result,null,2));}
