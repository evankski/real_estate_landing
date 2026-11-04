import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLead, CONTACT_CONSENT_VERSION, CONTACT_CONSENT_TEXT } from './lead-handler.mjs';
import worker, { C02AppointmentOutbox } from './worker.mjs';

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
  assert.equal(outgoing.init.redirect, 'manual');
  assert.deepEqual(outgoing.payload.person, {
    firstName: 'Jamie', lastName: 'Buyer',
    emails: [{ value: 'jamie@example.test' }],
    phones: [{ value: '(925) 555-0100' }],
    tags: ['Marketing lead', 'Paid ad', 'Facebook']
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

test('keyless production relays a validated C02 inquiry to the fixed email recipient', async () => {
  let sent;
  const result = await handleLead(request({ ...valid, campaign_id: 'C02',
    request_type: 'First Home Next Steps Sheet', landing_page: '/first-purchase/',
    _cc: 'private@example.invalid', _webhook: 'https://example.invalid', _subject: 'untrusted'
  }), {
    fetch: async (url, init) => {
      sent = {url, init, data: JSON.parse(init.body)};
      return Response.json({ success: 'true' });
    }
  });
  assert.deepEqual(await result.json(), { success: true });
  assert.equal(sent.url, 'https://formsubmit.co/ajax/evan@thewowski.com');
  assert.equal(sent.init.headers.Referer, productionOrigin + '/');
  assert.equal(sent.data.email, valid.email);
  assert.equal(sent.data._url, productionOrigin + '/first-purchase/');
  assert.match(sent.data.message, /Offer: C02/);
  assert.match(sent.data.message, /Consent text:/);
  assert.doesNotMatch(sent.init.body, /_cc|_webhook|untrusted/);
});

test('an unconfirmed email relay does not acknowledge delivery or retry', async () => {
  for (const failure of [Response.json({success: 'false'}), new Response('unavailable'), new Response(null, {status: 503}), new Error('disconnected')]) {
    let calls = 0;
    const response = await handleLead(request(), {fetch: async () => {
      calls++;
      if (failure instanceof Error) throw failure;
      return failure;
    }});
    assert.equal(calls, 1);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {success: false, code: 'DELIVERY_FAILED'});
  }
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
  let sent = false;
  const preview = await handleLead(makeLocal(local), {fetch: () => { sent = true; }});
  assert.equal(preview.status, 200);
  assert.deepEqual(await preview.json(), {success: false, code: 'LOCAL_PREVIEW'});
  assert.equal(sent, false);
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
  assert.equal((await worker.fetch(request(), { ...env, fetch: async () => Response.json({ success: true }) })).status, 200);
  assert.equal(assetRequests.length, 0);
  assert.equal(await (await worker.fetch(new Request(`${productionOrigin}/?utm_source=facebook`), env)).text(), 'asset');
  assert.equal(assetRequests[0].url, `${productionOrigin}/index.html?utm_source=facebook`);
  await worker.fetch(new Request(`${productionOrigin}/areas/brentwood-ca-real-estate.html`, { method: 'HEAD' }), env);
  assert.equal(assetRequests[1].url, `${productionOrigin}/areas/brentwood-ca-real-estate.html`);
  assert.equal(assetRequests[1].method, 'HEAD');
});

const shortlistResource = {
  name: 'Shortlist Test', email: 'shortlist@example.invalid', interest: 'Buying a home',
  contact_method: 'email', campaign_id: 'C01', request_type: 'Shortlist sheet',
  consent_version: CONTACT_CONSENT_VERSION, contact_consent: 'on',
  route_version: '2026-11-02', landing_page: '/compare-homes/'
};
const shortlistReview = {
  ...shortlistResource, request_type: 'Home Shortlist Review', landing_page: '/book/home-shortlist/',
  representation_status: 'Not working with an agent',
  listing_one: 'https://example.invalid/home-a', listing_two: 'https://example.invalid/home-b',
  priority_one: 'Desk space', priority_two: 'Outdoor space',
  meeting_format: 'Video', preferred_time_one: 'Tuesday 4–6 pm', timezone: 'Pacific time'
};

test('C01 resource captures a minimal inquiry separately from the original C1 and does not claim email delivery', async () => {
  let payload;
  const response = await handleLead(request(shortlistResource), {
    FUB_API_KEY: fakeKey, fetch: async (_, init) => { payload = JSON.parse(init.body); return new Response('{}', { status: 201 }); }
  });
  assert.equal(response.status, 200);
  assert.equal(payload.type, 'General Inquiry');
  assert.equal(payload.person.phones, undefined);
  assert.match(payload.message, /Offer: C01\n/);
  assert.match(payload.message, /Funnel state: Resource requested/);
  assert.match(payload.message, /no automatic resource email was sent/);
  assert.match(payload.message, /Do not enroll in automated marketing/);
});

test('C01 review preserves preparation, contact preferences and a pending scheduling state', async () => {
  for (const [representation, state] of [
    ['Not working with an agent', 'Session requested'],
    ['Working with an agent', 'Eligibility pending'],
    ['Not sure', 'Eligibility pending']
  ]) {
    let payload;
    const response = await handleLead(request({ ...shortlistReview, representation_status: representation }), {
      FUB_API_KEY: fakeKey, fetch: async (_, init) => { payload = JSON.parse(init.body); return new Response('{}', { status: 200 }); }
    });
    assert.equal(response.status, 200);
    assert.ok(payload.message.includes(`Funnel state: ${state}`));
    assert.match(payload.message, /Public listing 1: https:\/\/example.invalid\/home-a/);
    assert.match(payload.message, /Second priority: Outdoor space/);
    assert.match(payload.message, /no appointment has been booked or confirmed/);
    assert.equal(payload.person.phones, undefined);
  }
});

test('C01 mismatched campaign, missing intake or unsafe listing links fail before any delivery', async () => {
  for (const change of [
    { campaign_id: 'C1' }, { campaign_id: '' }, { request_type: 'Home comparison' },
    { representation_status: '' }, { representation_status: 'Invented answer' },
    { listing_one: '' }, { listing_one: 'javascript:alert(1)' },
    { listing_two: 'file:///private/file' }, { listing_three: 'https://user:password@example.invalid' },
    { priority_one: '' }, { priority_two: '' }, { meeting_format: '' },
    { meeting_format: 'Phone', phone: '' }, { preferred_time_one: '' }, { timezone: '' }
  ]) {
    let sent = false;
    const response = await handleLead(request({ ...shortlistReview, ...change }), {
      FUB_API_KEY: fakeKey, fetch: () => { sent = true; throw new Error('unexpected'); }
    });
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(sent, false);
  }
});

test('C02 sheet and planning session reach the correct FUB offer with different inquiry states', async () => {
  const resource = { ...shortlistResource, campaign_id: 'C02', request_type: 'First Home Next Steps Sheet', route_version: '2026-11-03', landing_page: '/first-purchase/', utm_source: 'instagram', utm_campaign: 'first_home' };
  const session = { ...resource, request_type: 'First Home Game Plan', landing_page: '/book/first-home-plan/',
    representation_status: 'Not working with an agent', completed_steps: 'Saved listings', message: 'What should I ask a lender?',
    timeline: 'Just researching', preferred_time_one: 'Tuesday afternoon', timezone: 'Pacific time', meeting_format: 'Video' };
  for (const [input, state] of [[resource,'Resource requested'],[session,'Time requested'],[{...session,representation_status:'Working with an agent'},'Time requested']]) {
    let outgoing;
    const res = await handleLead(request(input), { FUB_API_KEY: fakeKey, fetch: async (_,init) => { outgoing = JSON.parse(init.body); return new Response('{}',{status:201}); } });
    assert.equal(res.status,200);
    assert.match(outgoing.message,/Offer: C02\n/);
    assert.ok(outgoing.message.includes(`Funnel state: ${state}`));
    assert.ok(outgoing.message.includes('/resources/first-home-next-steps-sheet.pdf'));
    assert.ok(!outgoing.message.includes('/compare-homes/'));
    assert.equal(outgoing.campaign.campaign,'first_home');
    assert.equal(outgoing.person.phones,undefined);
    if (input === resource) assert.ok(!outgoing.message.includes('Scheduling status:'));
    else for (const detail of ['Saved listings','What should I ask a lender?','Just researching','no appointment has been booked']) assert.ok(outgoing.message.includes(detail));
  }
  for (const invalid of [{ ...session, campaign_id:'C2' }, { ...resource, request_type: 'Shortlist sheet' },
    ...['completed_steps','message','representation_status','timeline','preferred_time_one','timezone'].map(key=>({...session,[key]:''})),
    {...session,meeting_format:'Phone'}]) {
    let sent=false;
    const res=await handleLead(request(invalid),{FUB_API_KEY:fakeKey,fetch:async()=>{sent=true;return new Response('{}',{status:201});}});
    assert.equal(res.status,400); assert.equal(sent,false);
  }
});

const appointment = {
  ...valid, campaign_id: 'C02', request_type: 'First Home Game Plan time request',
  landing_page: '/first-purchase/', buying_area: 'Livermore', move_timing: 'A year or more',
  lender_status: 'Not yet', representation_status: 'Working with an agent', message: 'Where should I start?',
  preferred_time_one: 'Tuesday after 4', timezone: 'America/Los_Angeles',
  utm_source: 'ig', utm_medium: 'paid_social', utm_campaign: 'c02_first_home', utm_content: 'ad_a'
};
const fubEndpoint = 'https://api.followupboss.com/v1/events';
// The fake namespace keeps its storage across fresh object instances (as after a restart).
function outboxFixture(withKey=true) {
  const storage = {saved:null, alarm:null,
    async get(){return structuredClone(this.saved);}, async put(k,v){this.saved=structuredClone(v);},
    async setAlarm(t){this.alarm=t;}, async deleteAll(){this.saved=null;this.alarm=null;}};
  const ids=[], emails=[], events=[];
  const h={storage,ids,emails,events,emailOk:true,fubOk:true};
  const env={
    ...(withKey ? {FUB_API_KEY:fakeKey} : {}),
    BOOKING_EMAIL:{send:async mail=>{emails.push(mail);if(!h.emailOk) throw Error('provider offline');return {messageId:'test-id'};}},
    fetch:async(url,init)=>{assert.equal(url,fubEndpoint);assert.equal(init.headers.Authorization,'Basic '+btoa(fakeKey+':'));
      events.push(JSON.parse(init.body));return new Response(null,{status:h.fubOk?201:503});},
    C02_OUTBOX:{idFromName:key=>{ids.push(key);return key;}, get:()=>({fetch:(url,init)=>h.instance().fetch(new Request(url,init))})}
  };
  h.env=env;
  h.instance=()=>new C02AppointmentOutbox({storage},env);
  h.alarm=()=>h.instance().alarm();
  return h;
}

test('C02 acknowledges durable storage, even during an email outage, then delivers the original answers after a restart',async()=>{
  const h=outboxFixture(); h.emailOk=false;
  const response=await worker.fetch(request(appointment),h.env);
  assert.equal(response.status,202);
  assert.deepEqual(await response.json(),{success:true,delivery:{email:'queued',fub:'queued'}});
  assert.equal(h.emails.length+h.events.length,0);
  assert.ok(h.storage.alarm);
  await h.alarm();
  assert.equal(h.storage.saved.emailPending,true);
  assert.equal(h.storage.saved.fubPending,false);
  assert.ok(h.storage.alarm>Date.now());
  const duplicate=await worker.fetch(request({...appointment,submitted_at:new Date().toISOString()}),h.env);
  assert.equal(duplicate.status,202); assert.equal(h.ids[0],h.ids[1]);
  assert.equal(h.storage.saved.attempts,1);
  h.emailOk=true; await h.alarm();
  assert.equal(h.events.length,1);
  assert.deepEqual(h.emails[0],h.emails[1]);
  assert.equal(h.emails[1].to,'evan@thewowski.com'); assert.equal(h.emails[1].replyTo,appointment.email);
  for (const key of ['buying_area','move_timing','lender_status','representation_status','message','preferred_time_one','timezone']) {
    assert.ok(h.emails[1].text.includes(appointment[key]),key);
  }
  const event=h.events[0];
  assert.deepEqual(event.person.tags,['Marketing lead','C02 - First Home Game Plan','Appointment request','Paid ad','Instagram']);
  assert.equal(event.campaign.content,'ad_a');
  assert.match(event.message,/no appointment has been booked/);
  assert.match(event.message,/Marketing permission: Not collected/);
  assert.deepEqual(h.storage.saved,{complete:true});
  await worker.fetch(request(appointment),h.env); assert.deepEqual(h.storage.saved,{complete:true});
  await h.alarm(); assert.equal(h.storage.saved,null); // expiry of non-personal dedup marker
});

test('CRM outages do not block or resend accepted email; a FUB key is optional',async()=>{
  for (const withKey of [true,false]) {
    const h=outboxFixture(withKey); h.fubOk=false;
    await worker.fetch(request(appointment),h.env); await h.alarm();
    assert.equal(h.emails.length,1); assert.equal(h.events.length,withKey?1:0);
    if(withKey){ assert.equal(h.storage.saved.emailPending,false); h.fubOk=true;await h.alarm(); assert.equal(h.events.length,2); }
    assert.equal(h.emails.length,1); assert.deepEqual(h.storage.saved,{complete:true});
  }
});

test('permanent configuration faults keep the job recoverable; only committed requests get a receipt',async()=>{
  const h=outboxFixture(false);
  delete h.env.BOOKING_EMAIL;
  const result=await worker.fetch(request(appointment),h.env);
  assert.equal(result.status,202);
  for(let i=0;i<9;i++) await h.alarm();
  assert.equal(h.storage.saved.emailPending,true); assert.equal(h.storage.saved.attempts,9);
  assert.ok(h.storage.alarm>Date.now());
  for(const key of ['buying_area','lender_status','representation_status','move_timing','timezone','contact_consent']) {
    assert.equal((await worker.fetch(request({...appointment,[key]:''}),h.env)).status,400);
  }
  for(const env of [{}, {C02_OUTBOX:{idFromName:x=>x,get:()=>({fetch:async()=>new Response(null,{status:500})})}}]) {
    const fail=await worker.fetch(request(appointment),env);
    assert.equal(fail.status,503); assert.equal((await fail.json()).success,false);
  }
});

test('production mail to Evan survives a lost Resend acknowledgment with the same provider idempotency key',async()=>{
  const h=outboxFixture(false);
  delete h.env.BOOKING_EMAIL;
  h.env.RESEND_API_KEY='test-server-secret';
  const calls=[];
  h.env.fetch=async(url,init)=>{
    assert.equal(url,'https://api.resend.com/emails');
    calls.push({headers:init.headers,mail:JSON.parse(init.body)});
    if(calls.length===1) throw Error('response lost');
    return Response.json({id:'simulated-message-id'});
  };
  const res=await worker.fetch(request({...appointment,to:'intruder@example.invalid'}),h.env);
  assert.equal(res.status,202); await h.alarm(); await h.alarm();
  assert.deepEqual(calls[0],calls[1]);
  assert.match(calls[0].headers['Idempotency-Key'],/^c02\/[a-f0-9]{64}$/);
  assert.equal(calls[0].headers.Authorization,'Bearer test-server-secret');
  assert.deepEqual(calls[0].mail.to,['evan@thewowski.com']);
  assert.equal(calls[0].mail.from,'appointments@mail.evankrealestate.com');
  assert.equal(calls[0].mail.reply_to,appointment.email);
  assert.deepEqual(h.storage.saved,{complete:true});
});

test('the source of a campaign can be filtered even if UTMs are missing, without claiming an ad click or consent', async () => {
  for (const [fields, expected] of [
    [{ campaign_id:'C02',request_type:'First Home Next Steps Sheet' }, ['Marketing lead','C02 - First Home Game Plan','Worksheet request']],
    [{ campaign_id:'C01',request_type:'Shortlist sheet',utm_source:'facebook',utm_medium:'organic_social' }, ['Marketing lead','C01 - Home Shortlist Review','Worksheet request','Facebook']],
    [{ campaign_id:'C1',request_type:'Home comparison',utm_medium:'PPC',utm_source:'google'}, ['Marketing lead','Campaign C1','Paid ad','Google']],
    [{ utm_source:'facebook',utm_medium:'organic_social'}, undefined]
  ]) {
    let event;
    const response=await handleLead(request({...valid,...fields,tags:['auto-enroll-me']}),{FUB_API_KEY:fakeKey, fetch:async (_,init)=>{
      event=JSON.parse(init.body);
      return new Response('{}',{status:200});
    }});
    assert.equal(response.status,200);
    assert.deepEqual(event.person.tags,expected);
    assert.match(event.message,/Marketing permission: Not collected/);
  }
});

test('Microsoft sends only to Evan, retries refused mail, and accepts an empty 202 independently of FUB', async () => {
  const h = outboxFixture(false);
  delete h.env.BOOKING_EMAIL;
  Object.assign(h.env,{C02_MAIL_PROVIDER:'microsoft', C02_MS_TENANT_ID:'00000000-0000-0000-0000-000000000001',
    C02_MS_CLIENT_ID:'00000000-0000-0000-0000-000000000002', C02_MS_CLIENT_SECRET:'test-only'});
  let sends = 0;
  h.env.fetch = async (url,init) => {
    assert.equal(init.redirect, 'manual', 'Workers must not follow a redirect with credentials');
    if (url === 'https://login.microsoftonline.com/' + h.env.C02_MS_TENANT_ID + '/oauth2/v2.0/token') {
      assert.equal(init.body.get('scope'),'https://graph.microsoft.com/.default');
      assert.equal(init.body.get('grant_type'),'client_credentials');
      assert.equal(init.body.get('client_secret'),h.env.C02_MS_CLIENT_SECRET);
      return Response.json({access_token:'unit-test-only'});
    }
    assert.equal(url,'https://graph.microsoft.com/v1.0/users/evan%40thewowski.com/sendMail');
    assert.equal(init.headers.Authorization,'Bearer unit-test-only');
    const {message} = JSON.parse(init.body);
    assert.deepEqual(message.toRecipients,[{emailAddress:{address:'evan@thewowski.com'}}]);
    assert.deepEqual(message.replyTo,[{emailAddress:{address:appointment.email}}]);
    assert.match(message.body.content,/Callback number: 925-555-0123/);
    return new Response(null,{status: ++sends === 1 ? 307 : 202});
  };
  await worker.fetch(request({...appointment, phone:'925-555-0123',to:'ignored@example.invalid'}),h.env);
  await h.alarm();
  assert.ok(h.storage.saved.emailPending);
  await h.alarm();
  assert.equal(sends,2);
  assert.deepEqual(h.storage.saved,{complete:true});
});

test('the email and FUB receive a Microsoft 365 draft for the same 20-minute appointment', async () => {
  for (const [date,utc] of [['2099-01-16','18:00'],['2099-07-16','17:00']]) {
    const start = date + 'T' + utc + ':00.000Z';
    const data = {...appointment, route_version:'outlook-request-v3', appointment_date:date,
      appointment_time:'10:00', appointment_start:start, preferred_time_one:'ignore this browser label',
      'Open in Outlook':'https://bad.example'};
    const h=outboxFixture();
    const response=await worker.fetch(request(data),h.env);
    assert.equal(response.status,202); await h.alarm();
    const link=h.events[0].message.match(/https:\/\/outlook\.office\.com\/[^\n]+/)[0];
    assert.ok(h.emails[0].text.includes(link));
    assert.ok(!h.emails[0].text.includes('bad.example'));
    const draft = new URL(link);
    assert.equal(draft.pathname,'/calendar/0/deeplink/compose');
    assert.equal(draft.searchParams.get('startdt'),start);
    assert.equal(Date.parse(draft.searchParams.get('enddt')) - Date.parse(start),20*60_000);
    assert.equal(draft.searchParams.get('to'),appointment.email);
    assert.ok(draft.searchParams.get('subject').includes(appointment.name));
    assert.ok(!link.includes('Livermore'));
    assert.match(h.events[0].message,/10:00 AM/);
  }
});

test('invalid or past appointment times never reach either provider',async()=>{
  const data={...appointment,route_version:'outlook-request-v3',appointment_date:'2099-01-16',
    appointment_time:'10:00',appointment_start:'2099-01-16T18:00:00.000Z'};
  let delivered=false;
  for (const change of [{appointment_start:''},{appointment_date:'2099-01-17'},{appointment_time:'11:00'},
    {timezone:'Bogus/Zone'},{appointment_start:'2020-01-16T18:00:00.000Z',appointment_date:'2020-01-16'},
    {appointment_date:'2099-03-08',appointment_time:'02:30',appointment_start:'2099-03-08T10:30:00.000Z'}]) {
    const response=await handleLead(request({...data,...change}),{FUB_API_KEY:fakeKey,fetch:async()=>{delivered=true;}});
    assert.equal(response.status,400,JSON.stringify(change));
  }
  assert.equal(delivered,false);
});

test('C02 phone requests validate the callback number and preserve it in FUB, email, and the Outlook draft', async () => {
  const data = {...appointment, route_version:'phone-call-v4', appointment_date:'2099-01-16',
    appointment_time:'10:00', appointment_start:'2099-01-16T18:00:00.000Z', phone:'(925) 555-0146'};
  const h = outboxFixture();
  for (const phone of ['', '123', 'call me', '1234567890123456']) {
    assert.equal((await worker.fetch(request({...data,phone}),h.env)).status,400);
  }
  assert.equal(h.ids.length,0);
  assert.equal((await worker.fetch(request(data),h.env)).status,202);
  await h.alarm();
  const event = h.events[0], mail = h.emails[0];
  assert.deepEqual(event.person.phones,[{value:data.phone}]);
  assert.match(event.message,/Meeting format requested: Phone/);
  assert.match(event.message,/Preferred contact: call/);
  assert.ok(event.person.tags.includes('Appointment request'));
  assert.equal(mail.to,'evan@thewowski.com');
  assert.ok(mail.text.includes('Callback number: ' + data.phone));
  const draftBody = new URL(mail.text.match(/https:\/\/outlook\.office\.com\/\S+/)[0]).searchParams.get('body');
  assert.ok(draftBody.includes(data.phone) && draftBody.includes('925-492-7023'));
  for (const phone of ['925-555-0146','925-555-0189']) await worker.fetch(request({...data,phone}),h.env);
  assert.equal(h.ids[0],h.ids[1]);
  assert.notEqual(h.ids[0],h.ids[2]);
});
