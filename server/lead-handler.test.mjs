import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLead, CONTACT_CONSENT_VERSION, CONTACT_CONSENT_TEXT } from './lead-handler.mjs';
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
  consent_version: CONTACT_CONSENT_VERSION,
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
  assert.ok(outgoing.payload.message.includes(`Consent text: ${CONTACT_CONSENT_TEXT}`));
  assert.match(outgoing.payload.message, /Marketing permission: Not collected by this form/);
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
    { consent_version: '' }, { consent_version: 'outdated' },
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

test('campaign requests preserve their specific preferences without requiring a phone or marketing permission', async () => {
  const requests = [
    {
      campaign_id: 'C1', request_type: 'Home comparison', area: 'Oakley',
      priority_one: 'A place to work from home', priority_two: 'Trail access',
      area_or_listing: 'https://example.test/listing',
      expected: ['Offer: C1', 'Area: Oakley', 'First priority: A place to work from home', 'Second priority: Trail access']
    },
    {
      campaign_id: 'C2', request_type: 'Buyer readiness plan',
      readiness_question: 'Financing conversation', personalized_outline: 'on',
      completed_steps: 'Compared monthly costs.\nNeed to choose the next step.',
      expected: ['Readiness question: Financing conversation', 'Personalized outline requested: Yes — an additional service request, not marketing permission', 'Steps already completed: Compared monthly costs.']
    },
    {
      campaign_id: 'C3', request_type: 'Seller pricing and preparation', interest: 'Selling a home',
      property_address: '123 Example Lane, Brentwood', property_notes: 'Roof condition needs checking.',
      expected: ['Property address: 123 Example Lane, Brentwood', 'Property notes: Roof condition needs checking.']
    },
    {
      campaign_id: 'C4', request_type: 'Open-house details', property_slug: 'example-property',
      expected: ['Request: Open-house details', 'Property reference: example-property']
    }
  ];
  for (const { expected, ...fields } of requests) {
    let payload;
    const result = await handleLead(request({ ...valid, ...fields }), {
      FUB_API_KEY: fakeKey,
      fetch: async (_, init) => {
        payload = JSON.parse(init.body);
        return new Response('{}', { status: 201 });
      }
    });
    assert.equal(result.status, 200, fields.campaign_id);
    assert.equal(payload.person.phones, undefined);
    assert.equal(payload.source, 'evankrealestate.com');
    assert.equal(payload.campaign, undefined, 'offer identity is not an invented ad source');
    for (const detail of expected) assert.ok(payload.message.includes(detail), detail);
    assert.ok(payload.message.includes(CONTACT_CONSENT_TEXT));
    assert.match(payload.message, /Marketing permission: Not collected by this form/);
  }
});

test('comparison requests accept separate saved listing links and preserve their line breaks', async () => {
  const links = 'https://example.test/home-one\r\nhttps://example.test/home-two\nhttps://example.test/home-three';
  let payload;
  const result = await handleLead(request({
    ...valid, campaign_id: 'C1', area: 'Oakley', priority_one: 'Home office',
    area_or_listing: links
  }), {
    FUB_API_KEY: fakeKey,
    fetch: async (_, init) => {
      payload = JSON.parse(init.body);
      return new Response('{}', { status: 201 });
    }
  });
  assert.equal(result.status, 200);
  assert.ok(payload.message.includes(`Town or listing: ${links.replace(/\r\n/g, '\n')}`));
  assert.equal(payload.person.phones, undefined);
});

test('a checklist-copy-only request is accepted without a personalized outline or phone', async () => {
  let payload;
  const result = await handleLead(request({
    name: 'Jamie Buyer', email: 'jamie@example.test', campaign_id: 'C2',
    interest: 'Buying a home', request_type: 'Buyer readiness plan',
    contact_method: 'email', area: 'Oakley', readiness_question: 'Not sure yet',
    contact_consent: 'on', consent_version: CONTACT_CONSENT_VERSION
  }), {
    FUB_API_KEY: fakeKey,
    fetch: async (_, init) => {
      payload = JSON.parse(init.body);
      return new Response('{}', { status: 201 });
    }
  });
  assert.equal(result.status, 200);
  assert.equal(payload.person.phones, undefined);
  assert.match(payload.message, /Personalized outline requested: No — checklist copy only/);
  assert.match(payload.message, /Marketing permission: Not collected by this form/);
  assert.ok(!payload.message.includes('Personalized outline requested: Yes'));
});

test('manual scheduling records a time request, never a booked appointment', async () => {
  for (const [campaignId, requestType] of [
    ['C1', 'Buyer planning call'], ['C2', 'Buyer planning call'], ['C3', 'Seller planning conversation']
  ]) {
    let payload;
    const response = await handleLead(request({
      ...valid, campaign_id: campaignId, request_type: requestType,
      preferred_time_one: 'Tuesday afternoon', preferred_time_two: 'Thursday morning',
      timezone: 'America/Los_Angeles', meeting_format: 'Video'
    }), {
      FUB_API_KEY: fakeKey,
      fetch: async (_, init) => {
        payload = JSON.parse(init.body);
        return new Response('{}', { status: 201 });
      }
    });
    assert.equal(response.status, 200);
    assert.equal(payload.type, 'General Inquiry');
    assert.equal(payload.person.phones, undefined);
    assert.match(payload.message, /First proposed time: Tuesday afternoon/);
    assert.match(payload.message, /Alternative proposed time: Thursday morning/);
    assert.match(payload.message, /Time zone: America\/Los_Angeles/);
    assert.match(payload.message, /Meeting format requested: Video/);
    assert.match(payload.message, /Time request only — no appointment has been booked or confirmed/);
  }
});

test('invalid campaign identities, incompatible offers, and unbounded preferences never reach FUB', async () => {
  const scheduling = {
    campaign_id: 'C1', request_type: 'Buyer planning call',
    preferred_time_one: 'Tuesday afternoon', timezone: 'America/Los_Angeles', meeting_format: 'Video'
  };
  const cases = [
    { campaign_id: 'C9' },
    { campaign_id: 'C1', request_type: 'Buyer readiness plan' },
    { campaign_id: 'C2', request_type: 'Home comparison' },
    { campaign_id: 'C3', request_type: 'Consultation' },
    { campaign_id: 'C4', request_type: 'Buyer planning call' },
    { request_type: 'Seller pricing and preparation' },
    { campaign_id: 'C3', request_type: 'Seller pricing and preparation', property_address: '' },
    { ...scheduling, preferred_time_one: '' }, { ...scheduling, timezone: '' },
    { ...scheduling, meeting_format: '' }, { ...scheduling, meeting_format: 'Phone', phone: '' },
    { meeting_format: 'Unlisted' }, { readiness_question: 'Income' },
    { personalized_outline: 'yes' }, { personalized_outline: [] },
    { priority_one: 'a'.repeat(301) }, { priority_two: 'b'.repeat(301) },
    { completed_steps: 'a'.repeat(1501) }, { property_address: 'a'.repeat(501) },
    { property_notes: 'a'.repeat(2001) }, { preferred_time_one: 'a'.repeat(201) },
    { preferred_time_two: 'a'.repeat(201) }, { timezone: 'a'.repeat(101) },
    { property_slug: '../private' }, { property_slug: 'a'.repeat(101) }
  ];
  for (const changes of cases) {
    let called = false;
    const result = await handleLead(request({ ...valid, ...changes }), {
      FUB_API_KEY: fakeKey, fetch: async () => { called = true; throw new Error('must not run'); }
    });
    assert.equal(result.status, 400, JSON.stringify(changes));
    assert.equal(called, false);
  }
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
