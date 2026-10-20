import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const start = script.indexOf('async function sendInquiry(');
const end = script.indexOf('\n    captureAttribution();', start);
assert.ok(start >= 0 && end > start, 'production delivery function is present');
const deliverySource = script.slice(start, end).trim();

function deliveryWith(responses) {
  const requests = [];
  const send = runInNewContext(`(${deliverySource})`, {
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
    assert.deepEqual(JSON.parse(delivery.requests[1].options.body), payload);
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
