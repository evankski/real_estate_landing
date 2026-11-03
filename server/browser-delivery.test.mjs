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

for (const status of [404, 405]) {
  test(`static host HTTP ${status} falls back to email with the inquiry intact`, async () => {
    const delivery = deliveryWith([
      new Response('<html>Static host</html>', { status }),
      Response.json({ success: 'true' })
    ]);
    const payload = { name: 'Local test', email: 'test@example.invalid', utm_source: 'facebook' };
    await delivery.send(payload);
    assert.deepEqual(delivery.requests.map(request => request.url), [
      '/api/leads', 'https://formsubmit.co/ajax/evan@thewowski.com'
    ]);
    const post = new Request(delivery.requests[1].url, delivery.requests[1].options);
    assert.match(post.headers.get('Content-Type'), /^application\/x-www-form-urlencoded/);
    assert.deepEqual([...post.headers.keys()].sort(), ['accept', 'content-type']);
    assert.deepEqual(Object.fromEntries(new URLSearchParams(await post.text())), payload);
  });
}

test('explicitly unconfigured API falls back to email', async () => {
  const delivery = deliveryWith([
    Response.json({ code: 'NOT_CONFIGURED' }, { status: 503 }),
    Response.json({ success: true })
  ]);
  await delivery.send({});
  assert.equal(delivery.requests.length, 2);
});

test('successful API delivery never also emails the lead', async () => {
  const delivery = deliveryWith([Response.json({ success: true })]);
  await delivery.send({});
  assert.equal(delivery.requests.length, 1);
});

test('a preview-only response cannot unlock a public form', async () => {
  const delivery = deliveryWith([Response.json({success: false, code: 'LOCAL_PREVIEW'})]);
  await assert.rejects(delivery.send({}));
  assert.equal(delivery.requests.length, 1);
});

test('ambiguous failures never resubmit through email', async () => {
  for (const response of [
    Response.json({ success: false }, { status: 500 }),
    Response.json({ code: 'UPSTREAM_ERROR' }, { status: 503 }),
    new Error('network failure')
  ]) {
    const delivery = deliveryWith([response]);
    await assert.rejects(delivery.send({}));
    assert.equal(delivery.requests.length, 1);
  }
});

const appointment = {campaign_id:'C02',request_type:'First Home Game Plan time request'};
test('a lost appointment receipt automatically replays the identical request only to the outbox', async () => {
  const d = deliveryWith([new Error('response lost'), Response.json({success:true,delivery:{email:'queued'}},{status:202})]);
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
  const d=deliveryWith([Response.json({success:true,delivery:{email:'queued'}},{status:202})]);
  assert.equal(await d.send(appointment,undefined,hosted),'accepted');
  assert.equal(d.requests[0].url,hosted);
  const local=deliveryWith([Response.json({success:false,code:'LOCAL_PREVIEW'})],true);
  assert.equal(await local.send(appointment,undefined,hosted),'preview');
  assert.equal(local.requests[0].url,'/api/leads');
});
