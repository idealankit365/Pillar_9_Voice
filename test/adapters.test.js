import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { MatrixAdapter, OpenAIResponsesClient, WhatsAppClient, fetchJson } from '../src/adapters.js';
import { Repository } from '../src/db.js';
import { testRig } from './helpers.js';
import { buildRetellGeneralPrompt } from '../src/prompts.js';
const BASE_RETELL_PROMPT_FOR_TEST = buildRetellGeneralPrompt({ assistantName: 'Ava', serviceName: 'Pillar 9' }, { name: 'Alex Chen', brokerage: 'Example Realty' });

test('HTTP Matrix defense-in-depth strips private fields and inactive rows',async()=>{const adapter=new MatrixAdapter({mode:'http'},null);adapter.http=async()=>({listings:[{matrixId:'A1',status:'ACTIVE',listPrice:1,publicUrl:'https://listings.pillar9.ca/A1',privateRemarks:'door code 1234'},{matrixId:'A2',status:'EXPIRED',privateRemarks:'secret'}],source:'Matrix'});const result=await adapter.search({},5);assert.equal(result.listings.length,1);assert.equal(result.listings[0].matrixId,'A1');assert.equal(result.listings[0].privateRemarks,undefined);});

async function mockServer(handler,run){const server=http.createServer(handler);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));try{return await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise((resolve)=>server.close(resolve));}}

test('OpenAI adapter calls the Responses API with no stored conversation',()=>mockServer(async(request,response)=>{let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw);assert.equal(request.url,'/responses');assert.equal(request.headers.authorization,'Bearer openai-test');assert.equal(body.model,'gpt-5.6-luna');assert.equal(body.store,false);assert.equal(body.safety_identifier,'wa_safe_test');response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({id:'resp_1',output:[{type:'message',content:[{type:'output_text',text:'Natural reply'}]}]}));},async(base)=>{const client=new OpenAIResponsesClient({enabled:true,apiKey:'openai-test',apiBaseUrl:base,model:'gpt-5.6-luna',reasoningEffort:'low',maxOutputTokens:200,timeoutMs:2000});const result=await client.create({instructions:'Test',input:'Hello',safetyIdentifier:'wa_safe_test'});assert.equal(result.outputText,'Natural reply');}));

test('WhatsApp adapter sends the current Cloud API text shape',()=>mockServer(async(request,response)=>{let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw);assert.equal(request.url,'/v26.0/phone-123/messages');assert.equal(request.headers.authorization,'Bearer meta-test');assert.deepEqual(body,{messaging_product:'whatsapp',recipient_type:'individual',to:'14035550123',type:'text',text:{preview_url:false,body:'Hello'}});response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({messages:[{id:'wamid.1'}]}));},async(base)=>{const client=new WhatsAppClient({enabled:true,dryRun:false,graphBaseUrl:base,graphApiVersion:'v26.0',phoneNumberId:'phone-123',accessToken:'meta-test'});const result=await client.sendText('+1 403 555 0123','Hello');assert.equal(result.id,'wamid.1');}));

test('fixture search treats Southwest Calgary as SW Calgary',()=>{const repo=new Repository('./fixtures/calgary-synthetic-5000.sqlite');try{const adapter=new MatrixAdapter({mode:'fixture'},repo);const result=adapter.fixtureSearch({priceMax:400000,bedroomsMin:2,areas:['Southwest Calgary'],propertyTypes:['apartment'],niceToHave:['newer','parking','reasonable condo fee']},5);assert.ok(result.count>0);assert.ok(result.listings.length>0);assert.equal(result.listings.every((x)=>x.quadrant==='SW'),true);assert.equal(result.catalogCount,5000);assert.ok(result.activeCatalogCount>0);assert.equal(result.syntheticCatalogCount,5000);}finally{repo.close();}});

test('search returns a compact summary a voice model can actually read', async (t) => {
  const rig = testRig(); t.after(rig.close);
  const draft = rig.service.captureCriteria({ contactId: 'contact_demo_buyer', utterance: 'two bedroom in southwest Calgary under nine hundred thousand' });
  const confirmed = rig.service.captureCriteria({ contactId: 'contact_demo_buyer', criteria: draft.criteria, confirm: true, draftId: draft.draftId });
  const result = await rig.service.searchListings({ contactId: 'contact_demo_buyer', criteriaId: confirmed.criteriaId, limit: 5 });
  assert.ok(result.listings.length > 0);
  // 94 fields x 5 listings was ~19KB of JSON per search: too much for the model to parse
  // and billed on every call. Detail stays available via p9_get_listing_details.
  const fields = Object.keys(result.listings[0]);
  assert.ok(fields.length <= 20, `expected a summary, got ${fields.length} fields`);
  assert.ok(JSON.stringify(result.listings).length < 6000, 'search payload must stay small');
  for (const required of ['matrixId', 'address', 'listPrice', 'bedrooms', 'community']) {
    assert.ok(fields.includes(required), `summary must keep ${required}`);
  }
  assert.equal(fields.includes('publicRemarks'), false, 'long prose belongs in the details tool');
});

test('the spoken disclosure never uses internal provenance words', () => {
  const repo = new Repository(path.resolve('fixtures/calgary-synthetic-5000.sqlite'));
  try {
    const matrix = new MatrixAdapter({ mode: 'fixture' }, repo);
    const result = matrix.fixtureSearch({ areas: ['SW Calgary'], priceMax: 900000, bedroomsMin: 2 }, 5);
    assert.ok(result.listings.length > 0);
    // The agent read these labels aloud on a live call ("synthetic example listings"),
    // which sounds broken to a customer. The disclosure must stay, in plain words.
    for (const word of ['synthetic', 'fixture', 'training data', 'schema']) {
      assert.equal(new RegExp(word, 'i').test(result.statusNotice), false, `statusNotice must not say "${word}"`);
      assert.equal(new RegExp(word, 'i').test(result.source), false, `source must not say "${word}"`);
    }
    assert.match(result.statusNotice, /not live MLS data/i, 'but it must still disclose');
    assert.equal(result.listings[0].synthetic, true, 'machine-readable provenance stays');
  } finally { repo.close(); }
});

test('the prompt tells the agent how to deliver that disclosure', () => {
  assert.match(BASE_RETELL_PROMPT_FOR_TEST, /DATA PROVENANCE/);
  assert.match(BASE_RETELL_PROMPT_FOR_TEST, /never read internal labels aloud/i);
});

test('synthetic listings are spoken as a street, never as an internal label', () => {
  const repo = new Repository(path.resolve('fixtures/calgary-synthetic-5000.sqlite'));
  try {
    const matrix = new MatrixAdapter({ mode: 'fixture' }, repo);
    const result = matrix.fixtureSearch({ areas: ['SW Calgary'], priceMax: 900000, bedroomsMin: 2 }, 5);
    for (const listing of result.listings) {
      // Stored form is "SYN-CGY-004079 — synthetic property on Bridle Estates WY SW",
      // which the agent read aloud verbatim on a live call.
      assert.equal(/synthetic|SYN-CGY/i.test(listing.address), false, `spoken address leaked: ${listing.address}`);
      assert.match(listing.address, /^a property on \S/);
      // no house number: a fabricated address must stay non-actionable
      assert.equal(/^a property on \d/.test(listing.address), false);
      assert.equal(listing.synthetic, true, 'machine-readable provenance is unchanged');
      assert.match(listing.matrixId, /^SYN-CGY-/, 'the id still identifies it as fixture data');
    }
    // two-letter codes are expanded or dropped, never spoken raw
    assert.equal(/\b(?:WY|CI|CV|BA|PS|PZ|PH|CO)\b/.test(result.listings.map((x) => x.address).join(' ')), false);
  } finally { repo.close(); }
});

test('upstream failures surface the provider reason, not just a status code', async () => {
  // A live 402 from Retell showed only "Upstream returned HTTP 402.", which gave the
  // operator no way to tell an out-of-credit account from a bad key or a rate limit.
  const cases = [
    [402, { error_message: 'Insufficient balance' }, /payment required/i],
    [401, { error_message: 'Invalid API key' }, /api key was rejected/i],
    [429, { message: 'Slow down' }, /rate limit/i]
  ];
  for (const [status, payload, expected] of cases) {
    const server = http.createServer((_q, r) => { r.writeHead(status, { 'content-type': 'application/json' }); r.end(JSON.stringify(payload)); });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      await assert.rejects(() => fetchJson(`http://127.0.0.1:${server.address().port}/x`), (error) => {
        assert.equal(error.code, 'UPSTREAM_ERROR');
        assert.match(error.message, expected, `status ${status} must explain itself`);
        assert.match(error.message, new RegExp(String(status)));
        assert.equal(error.details.status, status);
        return true;
      });
    } finally { await new Promise((resolve) => server.close(resolve)); }
  }
});
