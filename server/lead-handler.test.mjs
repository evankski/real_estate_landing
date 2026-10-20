import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLead } from './lead-handler.mjs';
import worker from './worker.mjs';

const valid = {
  name: 'Jamie Buyer',
  email: 'jamie@example.test',
  interest: 'Buying a home',
  contact_method: 'email',
  area: 'Brentwood',
  budget: '$700,000–$1 million',
  timeline: '3–6 months',
  request_type: 'Home comparison',
  contact_consent: 'on',
  consent_version: '2026-10-19',
  submitted_at: '2026-10-19T12:00:00.000Z',
  landing_page: '/',
  referrer_origin: 'https://www.google.com',
  message: 'Please help me compare two homes.'
};
const productionOrigin = 'https://www.evankrealestate.com';
const fakeKey = 'test-key-that-must-stay-server-side';
function request(data = valid, options = {}) {
  return new Request(`${productionOrigin}/api/leads`, {
    method: 'POST',
    headers: { Origin: productionOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options
  });
}

test('valid lead maps to FUB events and preserves qualification, consent, and campaign', async () => {
  let outgoing;
  const result = await handleLead(request({
    ...valid,
    phone: '(925) 555-0100',
    contact_method: 'text',
    utm_source: 'facebook', utm_medium: 'paid-social', utm_campaign: 'brentwood',
    utm_content: 'video-a', utm_term: 'home',
    cta_source: 'hero',
    campaign: { unauthorized: 'never forward me' },
    FUB_API_KEY: 'browser-must-not-control-authentication'
  }), {
    FUB_API_KEY: fakeKey,
    FUB_SYSTEM: 'RegisteredSite',
    FUB_SYSTEM_KEY: 'test-system-key',
    fetch: async (url, init) => {
      outgoing = { url, init, payload: JSON.parse(init.body) };
      return new Response(JSON.stringify({ id: 123 }), { status: 201 });
    }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { success: true });
  assert.equal(outgoing.url, 'https://api.followupboss.com/v1/events');
  assert.equal(outgoing.init.headers.Authorization, `Basic ${btoa(`${fakeKey}:`)}`);
  assert.equal(outgoing.init.headers['X-System'], 'RegisteredSite');
  assert.equal(outgoing.init.headers['X-System-Key'], 'test-system-key');
  assert.equal(outgoing.init.redirect, 'error');
  assert.deepEqual(outgoing.payload.person, {
    firstName: 'Jamie', lastName: 'Buyer',
    emails: [{ value: 'jamie@example.test' }],
    phones: [{ value: '(925) 555-0100' }]
  });
  assert.equal(outgoing.payload.type, 'General Inquiry');
  assert.equal(outgoing.payload.source, 'evankrealestate.com');
  assert.deepEqual(outgoing.payload.campaign, {
    source: 'facebook', medium: 'paid-social', term: 'home', content: 'video-a', campaign: 'brentwood'
  });
  assert.match(outgoing.payload.message, /Budget: \$700,000–\$1 million/);
  assert.match(outgoing.payload.message, /Contact consent: Yes — contact about this request/);
  assert.match(outgoing.payload.message, /Consent version: 2026-10-19/);
  assert.match(outgoing.payload.message, /CTA: hero/);
  assert.ok(!outgoing.init.body.includes(fakeKey));
  assert.ok(!outgoing.init.body.includes('unauthorized'));
});

test('missing API key returns explicit unconfigured state without external traffic', async () => {
  const result = await handleLead(request(), {
    FUB_API_KEY: ' ',
    fetch: () => { throw new Error('must not run'); }
  });
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { success: false, code: 'NOT_CONFIGURED' });
});

test('accepts separate name fields, consent boolean, and existing-contact FUB 200', async () => {
  let payload;
  const { name, ...data } = valid;
  const result = await handleLead(request({ ...data, firstName: 'Jo', lastName: 'Smith', contact_consent: true }), {
    FUB_API_KEY: fakeKey,
    fetch: async (_, init) => {
      payload = JSON.parse(init.body);
      return new Response('{}', { status: 200 });
    }
  });
  assert.equal(result.status, 200);
  assert.equal(payload.person.firstName, 'Jo');
  assert.ok(!payload.person.phones);
  assert.equal(payload.system, 'EvanKarwowskiWebsite');
});

test('invalid or missing qualification data never reaches FUB', async () => {
  const cases = [
    { name: '' }, { email: 'invalid' }, { interest: '' }, { contact_consent: false },
    { interest: 'unknown' }, { area: 'unlisted' }, { budget: 'unlisted' }, { timeline: 'unlisted' },
    { contact_method: 'text', phone: '' }, { contact_method: 'call', phone: '' },
    { phone: 'not-a-phone' }, { contact_method: 'fax' }, { request_type: 'other' },
    { _honey: 'bot' }, { message: 'a'.repeat(4001) }, { email: ['jamie@example.test'] },
    { landing_page: '/?email=private@example.test' },
    { referrer_origin: 'https://example.test/private?email=private@example.test' },
    { referrer_origin: 'javascript:alert(1)' },
    { submitted_at: 'not-a-date' }, { campaign: [] }, { utm_source: 'x'.repeat(201) },
    { name: 'Jamie\nInjected' }
  ];
  for (const changes of cases) {
    let called = false;
    const response = await handleLead(request({ ...valid, ...changes }), {
      FUB_API_KEY: fakeKey,
      fetch: () => { called = true; throw new Error('unexpected'); }
    });
    assert.equal(response.status, 400, JSON.stringify(changes));
    assert.equal(called, false);
  }
});

test('rejects malformed, non-JSON, and oversized requests before contacting FUB', async () => {
  const malformed = await handleLead(request(valid, { body: '{' }), {});
  assert.equal(malformed.status, 400);
  const unsupported = await handleLead(request(valid, {
    headers: { Origin: productionOrigin, 'Content-Type': 'text/plain' }
  }), {});
  assert.equal(unsupported.status, 415);
  const oversized = await handleLead(request({ ...valid, message: '😃'.repeat(5_000) }), {});
  assert.equal(oversized.status, 413);
  const array = await handleLead(request([]), {});
  assert.equal(array.status, 400);
});

test('requires an approved origin and only allows matching loopback origins', async () => {
  for (const origin of ['', 'null', 'https://evil.example', 'https://evankrealestate.com.evil.example']) {
    const response = await handleLead(request(valid, {
      headers: { Origin: origin, 'Content-Type': 'application/json' }
    }), {});
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const local = 'http://127.0.0.1:4173';
  const makeLocal = origin => new Request(`${local}/api/leads`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(valid)
  });
  assert.equal((await handleLead(makeLocal(local), {})).status, 503);
  assert.equal((await handleLead(makeLocal('http://127.0.0.1:1234'), {})).status, 403);
  const options = await handleLead(new Request(`${productionOrigin}/api/leads`, {
    method: 'OPTIONS', headers: { Origin: productionOrigin }
  }), {});
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), productionOrigin);
  assert.equal((await handleLead(new Request(`${productionOrigin}/api/leads`, {
    headers: { Origin: productionOrigin }
  }), {})).status, 405);
});

test('upstream failures including archived source never report success or expose secrets', async () => {
  for (const status of [204, 202, 301, 400, 401, 429, 500]) {
    const result = await handleLead(request(), {
      FUB_API_KEY: fakeKey,
      fetch: async () => new Response(status === 204 ? null : `Upstream private details: ${fakeKey}`, { status })
    });
    assert.equal(result.status, 502);
    const body = await result.text();
    assert.equal(body, JSON.stringify({ success: false, code: 'DELIVERY_FAILED' }));
    assert.ok(!body.includes(fakeKey));
  }
  const failure = await handleLead(request(), {
    FUB_API_KEY: fakeKey,
    fetch: async () => { throw new Error(`Network detail ${fakeKey}`); }
  });
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes(fakeKey));
});

test('upstream timeout aborts fetch and gives an explicit failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started;
  let signal;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = handleLead(request(), {
    FUB_API_KEY: fakeKey,
    fetch: async (_, init) => {
      signal = init.signal;
      started();
      return new Promise(() => {});
    }
  });
  await ready;
  t.mock.timers.tick(10_000);
  const result = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(result.status, 504);
  assert.deepEqual(await result.json(), { success: false, code: 'DELIVERY_TIMEOUT' });
});

test('partial campaign is recorded without inventing its required source', async () => {
  let payload;
  await handleLead(request({ ...valid, utm_campaign: 'local-homes' }), {
    FUB_API_KEY: fakeKey,
    fetch: async (_, init) => {
      payload = JSON.parse(init.body);
      return new Response('{}', { status: 201 });
    }
  });
  assert.equal(payload.campaign, undefined);
  assert.match(payload.message, /Campaign campaign: local-homes/);
});

test('worker routes leads to handler and other requests to its assets binding', async () => {
  const assetRequests = [];
  const env = { ASSETS: { fetch: async (assetRequest) => { assetRequests.push(assetRequest); return new Response('asset'); } } };
  assert.equal((await worker.fetch(request(), env)).status, 503);
  assert.equal(assetRequests.length, 0);
  assert.equal(await (await worker.fetch(new Request(`${productionOrigin}/?utm_source=facebook`), env)).text(), 'asset');
  assert.equal(assetRequests[0].url, `${productionOrigin}/index.html?utm_source=facebook`);
  await worker.fetch(new Request(`${productionOrigin}/areas/brentwood-ca-real-estate.html`, { method: 'HEAD' }), env);
  assert.equal(assetRequests[1].url, `${productionOrigin}/areas/brentwood-ca-real-estate.html`);
  assert.equal(assetRequests[1].method, 'HEAD');
});
