import test from 'node:test';
import assert from 'node:assert/strict';
import { testRig } from './helpers.js';
import { buildToolManifest } from '../src/tool-manifest.js';
import { BASE_AGENT_PROMPT } from '../src/prompts.js';

test('manifest contains thirteen authenticated tools',t=>{const rig=testRig();t.after(rig.close);const manifest=buildToolManifest(rig.config);assert.equal(manifest.length,13);assert.equal(new Set(manifest.map((x)=>x.name)).size,13);for(const tool of manifest){assert.equal(tool.method,'POST');assert.equal(tool.headers['x-p9-tool-key'],'test-tool-key');assert.match(tool.url,/^https:\/\//);assert.ok(Object.values(tool.body).every((value)=>/^\{\{input\.[A-Za-z]+\}\}$/.test(value)));assert.equal(Object.values(tool.input_schema.properties).some((value)=>Object.hasOwn(value,'required')),false);}});
test('base prompt prohibits human and licensed impersonation',()=>{assert.match(BASE_AGENT_PROMPT,/Never claim to be human/i);assert.match(BASE_AGENT_PROMPT,/automated/i);assert.match(BASE_AGENT_PROMPT,/Never construct Matrix queries/i);});
