import {websiteIntakeUrl} from '../scripts/campaign-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const RECEIPT_KEY = 'ek_lead_receipt';

function element(properties = {}) {
  const listeners = new Map();
  const attributes = new Map();
  return {
    dataset: {}, value: '', textContent: '', hidden: false, disabled: false,
    required: false, checked: false, willValidate: false,
    classList: { add() {}, remove() {} },
    addEventListener(name, callback) { listeners.set(name, callback); },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
    checkValidity() { return !this.required || Boolean(this.value); },
    reportValidity() {},
    emit(name, event = {}) { return listeners.get(name)?.(event); },
    ...properties
  };
}

// This runs the unchanged browser script with a small DOM and stubbed services.
// Form values never leave the process, and no advertising script is loaded.
const receipt = () => Response.json({success:true,delivery:{email:'queued',fub:'queued'}},{status:202});
function openForm({
  campaignId = 'C1', requestType = 'Home comparison', interest = 'Buying a home',
  pathname = '/compare/', thanksPath = '/thanks/compare/', query = '',
  extra = {}, responses = [receipt()], storageBlocked = false,
  privacyChoice, gpc = false, origin = 'https://www.evankrealestate.com'
} = {}) {
  const fields = Object.entries({
    campaign_id: campaignId, request_type: requestType, interest, cta_source: `${campaignId} form`,
    name: 'Local Test', email: 'local@example.invalid', phone: '',
    contact_method: 'email', area: 'Brentwood', budget: 'Still deciding',
    timeline: 'Just researching', contact_consent: 'on', cookie_choice: 'not selected', ...extra
  }).map(([name, value]) => element({
    name, value, type: ['campaign_id', 'request_type', 'interest', 'cta_source'].includes(name) ? 'hidden' : 'text',
    willValidate: !['campaign_id', 'request_type', 'interest', 'cta_source'].includes(name),
    required: ['name', 'email', 'contact_consent'].includes(name)
  }));
  fields.namedItem = name => fields.find(field => field.name === name) || null;
  if (!campaignId) {
    const first = fields.namedItem('interest');
    first.type = 'radio';
    for (const value of ['Selling a home', 'Buying and selling', 'Exploring my options']) {
      fields.push(element({ name: 'interest', value, type: 'radio' }));
    }
  }
  const area = fields.namedItem('area');
  area.options = ['Brentwood', 'Oakley', 'Somewhere else'].map(value => ({ value, textContent: value }));
  const next = element();
  const back = element();
  const submit = element({ textContent: 'Request my comparison' });
  const stepFields = [
    fields.filter(field => ['name', 'email', 'phone', 'contact_method'].includes(field.name)),
    fields.filter(field => !['name', 'email', 'phone', 'contact_method'].includes(field.name))
  ];
  const steps = stepFields.map((items, index) => element({
    dataset: { stepLabel: index === 0 ? 'Contact details' : 'Search preferences' },
    querySelectorAll() { return items; },
    querySelector() { return items.find(field => field.type !== 'hidden') || null; }
  }));
  const form = element({
    action:websiteIntakeUrl,
    dataset: { thanksPath, successMessage: 'Your request is on its way. Evan will reply.', ...(campaignId === 'C02' ? {sheetEmail:'true'} : {}) },
    elements: fields,
    appendChild(field) { fields.push(field); },
    querySelector(selector) {
      return { 'button[type="submit"]': submit, '[data-form-next]': next, '[data-form-back]': back }[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-form-step]') return steps;
      if (selector === 'input, select, textarea') return fields;
      if (selector.includes('input[name="interest"]')) {
        return fields.filter(field => field.name === 'interest' && (!selector.includes('[type="radio"]') || field.type === 'radio'));
      }
      return [];
    }
  });
  const ids = {
    contactForm: form, requestType: fields.namedItem('request_type'),
    ctaSourceField: fields.namedItem('cta_source'), areaSelect: area,
    contactMethod: fields.namedItem('contact_method'),
    requestLabel: element(), formStatus: element(), formStepStatus: element(), phoneHint: element(),
    cookieChoiceField: fields.namedItem('cookie_choice'),
    cookieBanner: element(), cookieBannerText: element(),
    acceptCookies: element(), rejectCookies: element(),
    privacyStatus: element(), doNotSellButton: element()
  };
  const cta = element({ dataset: { source: 'campaign hero', interest: 'sell', request: 'Pricing report' } });
  const requests = [];
  const redirects = [];
  const injectedScripts = [];
  const firstScript = { parentNode: { insertBefore(script) { injectedScripts.push(script); } } };
  const stored = new Map();
  const sessionStorage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) {
      if (storageBlocked) throw new Error('Storage blocked');
      stored.set(key, value);
    },
    removeItem(key) { stored.delete(key); }
  };
  const location = new URL(`${origin}${pathname}${query}`);
  location.assign = url => redirects.push(url);
  const fetch = async (url, options) => {
    requests.push({ url, payload: options.body instanceof URLSearchParams
      ? Object.fromEntries(options.body) : JSON.parse(options.body) });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'unexpected extra request');
    return response;
  };
  const document = {
    body: element({ dataset: { campaignId } }), documentElement: element(), referrer: 'https://example.test/saved?email=private',
    getElementById(id) { return ids[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector.startsWith('[data-interest]') ? [cta] : []; },
    createElement() { return element(); },
    getElementsByTagName() { return [firstScript]; }
  };
  const privacyStored = new Map(privacyChoice ? [['ek_cookie_tracking_choice_v3', privacyChoice]] : []);
  const window = {
    location, sessionStorage,
    localStorage: {
      getItem(key) { return privacyStored.get(key) ?? null; },
      setItem(key, value) { privacyStored.set(key, value); }
    },
    fetch, AbortController, setTimeout, clearTimeout, addEventListener() {}
  };
  class FormData {
    constructor(target) { this.fields = target.elements; }
    entries() {
      return this.fields.filter(field => field.name && !field.disabled
        && (!['radio', 'checkbox'].includes(field.type) || field.checked))
        .map(field => [field.name, field.value])[Symbol.iterator]();
    }
  }
  runInNewContext(script, {
    window, document, navigator: { globalPrivacyControl: gpc }, URL, URLSearchParams, Date, FormData, fetch,
    AbortController, setTimeout, clearTimeout, console: { warn() {} }
  }, { timeout: 1000, filename: 'script.js' });
  return {
    fields, ids, form, cta, next, back, submit, steps, requests, redirects, stored, injectedScripts,
    pixelCalls: () => Array.from(window.fbq?.queue || [], args => Array.from(args)),
    submitForm: () => form.emit('submit', { preventDefault() {} })
  };
}

test('campaign intent and service stay fixed while source and allowed area can be selected', async () => {
  const page = openForm({ query: '?intent=sell&area=Oakley&utm_source=instagram&email=not-captured' });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.fields.namedItem('interest').value, 'Buying a home');
  assert.equal(page.fields.namedItem('request_type').value, 'Home comparison');
  assert.equal(page.fields.namedItem('cta_source').value, 'C1 form');
  assert.equal(page.fields.namedItem('area').value, 'Oakley');
  page.cta.emit('click');
  assert.equal(page.fields.namedItem('interest').value, 'Buying a home');
  assert.equal(page.fields.namedItem('request_type').value, 'Home comparison');
  assert.equal(page.fields.namedItem('cta_source').value, 'campaign hero');
  assert.equal(page.ids.formStepStatus.textContent, 'Step 1 of 2 · Contact details');
  assert.equal(page.steps[1].hidden, true);
  await page.submitForm();
  assert.equal(page.requests.length, 0, 'step one is not an abandoned-contact submission');
  assert.equal(page.ids.formStepStatus.textContent, 'Step 2 of 2 · Search preferences');
  assert.equal(page.form.scrolled, true);
  await page.submitForm();
  assert.equal(page.requests.length, 1);
  const payload = page.requests[0].payload;
  assert.equal(payload.campaign_id, 'C1');
  assert.equal(payload.request_type, 'Home comparison');
  assert.equal(payload.email, 'local@example.invalid');
  assert.equal(payload.utm_source, 'instagram');
  assert.equal(payload.landing_page, '/compare/');
  assert.equal(payload.referrer_origin, 'https://example.test');
  assert.equal(payload.consent_version, '2026-10-19-inquiry-v2');
  assert.deepEqual(page.redirects, ['https://www.evankrealestate.com/thanks/compare/?submitted=1']);
  const receipt = JSON.parse(page.stored.get(RECEIPT_KEY));
  assert.deepEqual(Object.keys(receipt).sort(), ['acceptedAt', 'campaignId', 'status', 'thanksPath']);
  assert.equal(receipt.thanksPath, '/thanks/compare/');
  assert.equal(receipt.campaignId, 'C1');
  assert.equal(receipt.status, 'accepted');
  assert.equal(page.injectedScripts.length, 0, 'contact permission is separate from advertising permission');
  await page.submitForm();
  assert.equal(page.requests.length, 1, 'repeat submits after acceptance do not duplicate the inquiry');
});

test('manual scheduling requires phone only when the requested format or contact method needs it', () => {
  const page = openForm({
    requestType: 'Buyer planning call', thanksPath: '/thanks/booking/',
    extra: { meeting_format: 'Video', preferred_time_one: 'Tuesday afternoon', timezone: 'America/Los_Angeles' }
  });
  const phone = page.fields.namedItem('phone');
  const meeting = page.fields.namedItem('meeting_format');
  assert.equal(phone.required, false);
  meeting.value = 'Phone';
  meeting.emit('change');
  assert.equal(phone.required, true);
  meeting.value = 'Video';
  meeting.emit('change');
  assert.equal(phone.required, false);
  page.ids.contactMethod.value = 'text';
  page.ids.contactMethod.emit('change');
  assert.equal(phone.required, true);
});

test('homepage query and CTA selection still update its general inquiry and original thank-you route', async () => {
  const page = openForm({
    campaignId: '', pathname: '/', thanksPath: undefined, query: '?intent=sell',
    requestType: 'Consultation'
  });
  assert.equal(page.fields.find(field => field.name === 'interest' && field.checked).value, 'Selling a home');
  assert.equal(page.fields.namedItem('request_type').value, 'Pricing report');
  page.cta.dataset.interest = 'buy';
  page.cta.dataset.request = 'Home comparison';
  page.cta.emit('click');
  assert.equal(page.fields.find(field => field.name === 'interest' && field.checked).value, 'Buying a home');
  assert.equal(page.fields.namedItem('request_type').value, 'Home comparison');
  // Remove campaign configuration to exercise the unchanged homepage default.
  delete page.form.dataset.thanksPath;
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.requests[0].payload.interest, 'Buying a home');
  assert.equal(page.requests[0].payload.request_type, 'Home comparison');
  assert.deepEqual(page.redirects, ['https://www.evankrealestate.com/thanks.html?submitted=1']);
  assert.equal(JSON.parse(page.stored.get(RECEIPT_KEY)).campaignId, '');
});

test('campaign retry through the same Worker preserves the offer fields and uses its own confirmation route', async () => {
  const page = openForm({
    campaignId: 'C3', requestType: 'Seller pricing and preparation', interest: 'Selling a home',
    pathname: '/seller-plan/', thanksPath: '/thanks/seller-plan/',
    extra: { property_address: '123 Example Lane', property_notes: 'A preliminary review, please.' },
    responses: [Response.json({ code: 'NOT_CONFIGURED' }, { status: 503 }), receipt()]
  });
  await page.submitForm();
  await page.submitForm();
  assert.deepEqual(page.requests.map(request => request.url),
    [websiteIntakeUrl, websiteIntakeUrl]);
  assert.deepEqual(page.requests[0].payload, page.requests[1].payload);
  assert.equal(page.requests[1].payload.property_address, '123 Example Lane');
  assert.equal(page.requests[1].payload.request_type, 'Seller pricing and preparation');
  assert.deepEqual(page.redirects, ['https://www.evankrealestate.com/thanks/seller-plan/?submitted=1']);
});

test('an unconnected C02 email request stays on the public offer without a receipt or conversion', async () => {
  for (const unavailable of [Response.json({ success: false, code: 'LOCAL_PREVIEW' }),
    new Response('Static preview', { status: 405 })]) {
    const page = openForm({ origin: 'http://127.0.0.1:4173', campaignId: 'C02',
      requestType: 'First Home Next Steps Sheet', pathname: '/first-purchase/', thanksPath: '/first-purchase/sheet-request/',
      query: '?utm_source=instagram&name=private', privacyChoice: 'accepted', responses: [unavailable] });
    await page.submitForm();
    await page.submitForm();
    assert.deepEqual(page.requests.map(r => r.url), ['/api/leads']);
    assert.equal(page.stored.has(RECEIPT_KEY), false);
    assert.deepEqual(page.redirects, []);
    assert.match(page.ids.formStatus.textContent, /worksheet request was not sent/);
    assert.ok(!page.pixelCalls().some(call => call[1] === 'Lead'));
  }
});

test('confirmed C02 worksheet access also works when the browser blocks session storage', async () => {
  const page = openForm({ campaignId: 'C02', requestType: 'First Home Next Steps Sheet',
    pathname: '/first-purchase/', thanksPath: '/first-purchase/sheet-request/', storageBlocked: true });
  await page.submitForm();
  await page.submitForm();
  assert.deepEqual(page.redirects, []);
  assert.equal(page.ids.formStatus.dataset.state, 'success');
  assert.equal(page.requests.length, 1);
  assert.equal(page.stored.has(RECEIPT_KEY), false);
});

test('failed campaign delivery preserves answers and produces neither a receipt nor a redirect', async () => {
  const page = openForm({
    extra: { priority_one: 'Home office' },
    responses: [Response.json({ success: false }, { status: 400 })]
  });
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.requests.length, 1);
  assert.equal(page.fields.namedItem('priority_one').value, 'Home office');
  assert.equal(page.fields.namedItem('email').value, 'local@example.invalid');
  assert.equal(page.stored.has(RECEIPT_KEY), false);
  assert.equal(page.redirects.length, 0);
  assert.equal(page.ids.formStatus.dataset.state, 'error');
  assert.equal(page.submit.disabled, false);
});

test('storage-blocked browsers receive truthful in-place confirmation without another send', async () => {
  const page = openForm({ storageBlocked: true });
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.ids.formStatus.textContent, 'Your request is on its way. Evan will reply.');
  assert.equal(page.ids.formStatus.dataset.state, 'success');
  assert.equal(page.redirects.length, 0);
  assert.equal(page.submit.disabled, true);
  await page.submitForm();
  assert.equal(page.requests.length, 1);
});

test('tracking refusal or GPC never blocks an inquiry or creates a Meta event', async () => {
  for (const preferences of [
    { privacyChoice: 'rejected' },
    { privacyChoice: 'accepted', gpc: true }
  ]) {
    const page = openForm(preferences);
    await page.submitForm();
    await page.submitForm();
    assert.equal(page.requests.length, 1);
    assert.equal(page.requests[0].payload.cookie_choice, 'rejected');
    assert.equal(page.redirects.length, 1);
    assert.equal(page.injectedScripts.length, 0);
    assert.deepEqual(page.pixelCalls(), []);
  }
});

test('an opted-in form sends PageView only and leaves Lead for its accepted thank-you receipt', async () => {
  const page = openForm({ privacyChoice: 'accepted' });
  assert.equal(page.injectedScripts.length, 1);
  await page.submitForm();
  await page.submitForm();
  const events = page.pixelCalls().filter(args => args[0] === 'track');
  assert.deepEqual(events, [['track', 'PageView']]);
  assert.equal(page.redirects.length, 1);
  assert.equal(JSON.parse(page.stored.get(RECEIPT_KEY)).status, 'accepted');
  assert.ok(!JSON.stringify(page.pixelCalls()).includes('local@example.invalid'));
});

test('a failed opted-in form submission never records a Meta Lead', async () => {
  const page = openForm({
    privacyChoice: 'accepted',
    responses: [Response.json({ success: false }, { status: 400 })]
  });
  await page.submitForm();
  await page.submitForm();
  assert.deepEqual(page.pixelCalls().filter(args => args[0] === 'track'), [['track', 'PageView']]);
  assert.equal(page.stored.has(RECEIPT_KEY), false);
  assert.equal(page.redirects.length, 0);
});

test('C01 accepted resource carries only named campaign attribution into the walkthrough', async () => {
  const page = openForm({
    campaignId: 'C01', requestType: 'Shortlist sheet', pathname: '/compare-homes/', thanksPath: '/compare-homes/watch/',
    query: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=c01_shortlist&utm_content=ad_a&email=private&arbitrary=hidden'
  });
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.requests.length, 1);
  const destination = new URL(page.redirects[0]);
  assert.equal(destination.pathname, '/compare-homes/watch/');
  assert.equal(destination.searchParams.get('utm_campaign'), 'c01_shortlist');
  assert.equal(destination.searchParams.get('utm_content'), 'ad_a');
  assert.equal(destination.searchParams.has('email'), false);
  assert.equal(destination.searchParams.has('arbitrary'), false);
  assert.equal(JSON.parse(page.stored.get(RECEIPT_KEY)).campaignId, 'C01');
});

test('C01 storage-blocked review confirmation counts a request, never a resource lead or confirmed booking', async () => {
  const page = openForm({
    campaignId: 'C01', requestType: 'Home Shortlist Review', pathname: '/book/home-shortlist/', thanksPath: '/thanks/home-shortlist/',
    storageBlocked: true, privacyChoice: 'accepted'
  });
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.pixelCalls().filter(args => args[1] === 'HomeShortlistReviewRequested').length, 1);
  assert.equal(page.pixelCalls().filter(args => ['Lead', 'Schedule'].includes(args[1])).length, 0);
  await page.submitForm();
  assert.equal(page.requests.length, 1);
});

test('C01 review request measurement handles static index and slashless entry URLs', async () => {
  for (const pathname of ['/book/home-shortlist', '/book/home-shortlist/index.html']) {
    const page = openForm({ campaignId: 'C01', requestType: 'Home Shortlist Review', pathname,
      thanksPath: '/thanks/home-shortlist/', storageBlocked: true, privacyChoice: 'accepted' });
    await page.submitForm();
    await page.submitForm();
    assert.equal(page.pixelCalls().filter(args => args[1] === 'HomeShortlistReviewRequested').length, 1);
    assert.equal(page.pixelCalls().filter(args => ['Lead', 'Schedule'].includes(args[1])).length, 0);
  }
});

test('only an accepted C02 sheet request gets its own confirmation and preserves attribution', async () => {
  const page = openForm({ campaignId:'C02', requestType:'First Home Next Steps Sheet', pathname:'/first-purchase/', thanksPath:'/first-purchase/sheet-request/',
    query:'?utm_source=instagram&utm_content=guide&email=private&intent=sell', privacyChoice:'rejected',
    responses:[Response.json({success:false},{status:400}),receipt()] });
  await page.submitForm();
  await page.submitForm();
  assert.equal(page.redirects.length,0);
  assert.equal(page.stored.has(RECEIPT_KEY),false);
  await page.submitForm();
  assert.equal(page.requests.length,2);
  assert.equal(page.requests[1].payload.campaign_id,'C02');
  assert.equal(page.requests[1].payload.request_type,'First Home Next Steps Sheet');
  assert.equal(page.redirects.length,0);
  assert.equal(page.ids.formStatus.dataset.state,'success');
  assert.equal(page.requests[1].payload.utm_source,'instagram');
  assert.equal(page.stored.has(RECEIPT_KEY),false);
  assert.equal(page.pixelCalls().length,0);
});

test('C02 accepted sheet emits only a resource Lead and only with tracking permission', async () => {
  for (const [choice, gpc, count] of [['accepted',false,1],['rejected',false,0],['accepted',true,0]]) {
    const page = openForm({ campaignId:'C02', requestType:'First Home Next Steps Sheet', pathname:'/first-purchase/',
      thanksPath:'/first-purchase/sheet-request/', privacyChoice:choice, gpc });
    await page.submitForm();
    await page.submitForm();
    await page.submitForm();
    assert.equal(page.requests.length,1);
    assert.equal(page.pixelCalls().filter(x=>x[1]==='Lead').length,count);
    assert.ok(!page.pixelCalls().some(x=>x[1]==='Schedule' || x[1]==='C02BookingStarted'));
  }
});
