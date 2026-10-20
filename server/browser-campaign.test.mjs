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
function openForm({
  campaignId = 'C1', requestType = 'Home comparison', interest = 'Buying a home',
  pathname = '/compare/', thanksPath = '/thanks/compare/', query = '',
  extra = {}, responses = [Response.json({ success: true })], storageBlocked = false
} = {}) {
  const fields = Object.entries({
    campaign_id: campaignId, request_type: requestType, interest, cta_source: `${campaignId} form`,
    name: 'Local Test', email: 'local@example.invalid', phone: '',
    contact_method: 'email', area: 'Brentwood', budget: 'Still deciding',
    timeline: 'Just researching', contact_consent: 'on', ...extra
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
    dataset: { thanksPath, successMessage: 'Your request is on its way. Evan will reply.' },
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
    requestLabel: element(), formStatus: element(), formStepStatus: element(), phoneHint: element()
  };
  const cta = element({ dataset: { source: 'campaign hero', interest: 'sell', request: 'Pricing report' } });
  const requests = [];
  const redirects = [];
  const stored = new Map();
  const sessionStorage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) {
      if (storageBlocked) throw new Error('Storage blocked');
      stored.set(key, value);
    },
    removeItem(key) { stored.delete(key); }
  };
  const location = new URL(`https://www.evankrealestate.com${pathname}${query}`);
  location.assign = url => redirects.push(url);
  const fetch = async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'unexpected extra request');
    return response;
  };
  const document = {
    body: element(), documentElement: element(), referrer: 'https://example.test/saved?email=private',
    getElementById(id) { return ids[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector.startsWith('[data-interest]') ? [cta] : []; },
    createElement() { return element(); }
  };
  const window = {
    location, sessionStorage,
    localStorage: { getItem() { return null; } },
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
    window, document, navigator: {}, URL, URLSearchParams, Date, FormData, fetch,
    AbortController, console: { warn() {} }
  }, { timeout: 1000, filename: 'script.js' });
  return {
    fields, ids, form, cta, next, back, submit, steps, requests, redirects, stored,
    submitForm: () => form.emit('submit', { preventDefault() {} })
  };
}

test('campaign intent and service stay fixed while source and allowed area can be selected', async () => {
  const page = openForm({ query: '?intent=sell&area=Oakley&utm_source=instagram&email=not-captured' });
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

test('campaign email fallback preserves the offer fields and uses its own confirmation route', async () => {
  const page = openForm({
    campaignId: 'C3', requestType: 'Seller pricing and preparation', interest: 'Selling a home',
    pathname: '/seller-plan/', thanksPath: '/thanks/seller-plan/',
    extra: { property_address: '123 Example Lane', property_notes: 'A preliminary review, please.' },
    responses: [Response.json({ code: 'NOT_CONFIGURED' }, { status: 503 }), Response.json({ success: 'true' })]
  });
  await page.submitForm();
  await page.submitForm();
  assert.deepEqual(page.requests.map(request => request.url),
    ['/api/leads', 'https://formsubmit.co/ajax/evan@thewowski.com']);
  assert.deepEqual(page.requests[0].payload, page.requests[1].payload);
  assert.equal(page.requests[1].payload.property_address, '123 Example Lane');
  assert.equal(page.requests[1].payload.request_type, 'Seller pricing and preparation');
  assert.deepEqual(page.redirects, ['https://www.evankrealestate.com/thanks/seller-plan/?submitted=1']);
});

test('failed campaign delivery preserves answers and produces neither a receipt nor a redirect', async () => {
  const page = openForm({
    extra: { priority_one: 'Home office' },
    responses: [Response.json({ success: false }, { status: 502 })]
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
