import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const start = script.indexOf('async function sendInquiry(');
const end = script.indexOf('\n    captureAttribution();', start);
assert.ok(start >= 0 && end > start, 'production delivery function is present');
const deliverySource = script.slice(start, end).trim();

function deliveryWith(responses, isLocalPreviewHost = false) {
  const requests = [];
  const send = runInNewContext(`(${deliverySource})`, {
    URLSearchParams, isLocalPreviewHost, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected request');
      return response;
    }
  });
  return { send, requests };
}

const queued = () => Response.json({success:true,delivery:{email:'queued',fub:'queued'}},{status:202});
test('ordinary inquiries require durable acceptance for both destinations',async()=>{
  for (const response of [new Response(null,{status:404}),Response.json({success:true}),
      Response.json({success:true,delivery:{email:'queued'}},{status:202}),Response.json({success:false,code:'LOCAL_PREVIEW'})]) {
    const d=deliveryWith([response]);
    await assert.rejects(d.send({name:'Test'}));
    assert.equal(d.requests.length,1);
  }
  const url='https://example.test/api/leads', d=deliveryWith([new Error('lost receipt'),queued()]);
  assert.equal(await d.send({name:'Test'},undefined,url),'accepted');
  assert.deepEqual(d.requests.map(r=>r.url),[url,url]);
  assert.equal(d.requests[0].options.body,d.requests[1].options.body);
});

const appointment = {campaign_id:'C02',request_type:'First Home Game Plan time request'};
test('a lost appointment receipt automatically replays the identical request only to the outbox', async () => {
  const d = deliveryWith([new Error('response lost'), queued()]);
  assert.equal(await d.send(appointment),'accepted');
  assert.deepEqual(d.requests.map(x=>x.url), ['/api/leads','/api/leads']);
  assert.equal(d.requests[0].options.body,d.requests[1].options.body);
});
test('absent intake, a stale synchronous success and missing storage never count as a saved appointment', async () => {
  for (const response of [new Response(null,{status:404}), Response.json({success:true}),
    Response.json({success:true,delivery:{email:'failed'}},{status:202})]) {
    const d=deliveryWith([response]);
    await assert.rejects(d.send(appointment), error=>error.retryable===false);
    assert.deepEqual(d.requests.map(x=>x.url), ['/api/leads']);
  }
  const d=deliveryWith(Array.from({length:3},()=>Response.json({code:'INTAKE_UNAVAILABLE'},{status:503})));
  await assert.rejects(d.send(appointment),error=>error.retryable===true);
  assert.deepEqual(d.requests.map(x=>x.url), Array(3).fill('/api/leads'));
});
test('GitHub Pages can send C02 to its configured Worker; local previews cannot reach that remote endpoint',async()=>{
  const hosted='https://example.test/api/leads';
  const d=deliveryWith([queued()]);
  assert.equal(await d.send(appointment,undefined,hosted),'accepted');
  assert.equal(d.requests[0].url,hosted);
  const local=deliveryWith([Response.json({success:false,code:'LOCAL_PREVIEW'})],true);
  assert.equal(await local.send(appointment,undefined,hosted),'preview');
  assert.equal(local.requests[0].url,'/api/leads');
});
