import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const NOW = 1_800_000_000_000;
const CHOICE_KEY = 'ek_cookie_tracking_choice_v3';
const LEGACY_CHOICE_KEYS = ['ek_cookie_tracking_choice_v2', 'ek_cookie_tracking_choice'];
const RECEIPT_KEY = 'ek_lead_receipt';
const NEUTRAL_TITLE = 'Let’s talk about your next move.';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function element(textContent = '') {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    textContent, hidden: false, disabled: false, value: '', dataset: {}, scrollCalls: [],
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    focus() {},
    scrollIntoView(options) { this.scrollCalls.push(options); },
    click() { listeners.get('click')?.(); }
  };
}

// Default cases execute unchanged production code with measurement enabled.
// Only rollback coverage replaces the single feature flag, guarded against drift.
// Injected script elements are recorded, never loaded; no network exists here.
function openPage({
  choice, gpc = false, thanks = false, search, receipt,
  measurementEnabled,
  href, links = [], campaignId = '', confirmedTitle, confirmedMessage,
  localStorage = storage(choice ? { [CHOICE_KEY]: choice } : {}),
  sessionStorage = storage(receipt === undefined ? {} : {
    [RECEIPT_KEY]: typeof receipt === 'string' ? receipt : JSON.stringify(receipt)
  })
} = {}) {
  const ids = Object.fromEntries([
    'year', 'cookieBanner', 'acceptCookies', 'rejectCookies',
    'cookieSettingsButton', 'doNotSellButton', 'cookieChoiceField',
    'thanksTitle', 'thanksMessage', 'privacyStatus', 'cookieBannerText'
  ].map(id => [id, element(id === 'thanksTitle' ? NEUTRAL_TITLE : '')]));
  const injectedScripts = [];
  const anchors = links.map(href => {
    const anchor = element();
    anchor.setAttribute('href', href);
    return anchor;
  });
  const firstScript = { parentNode: { insertBefore(script) { injectedScripts.push(script); } } };
  const body = element();
  if (thanks) body.dataset.leadSuccess = 'true';
  body.dataset.campaignId = campaignId;
  if (confirmedTitle) body.dataset.confirmedTitle = confirmedTitle;
  if (confirmedMessage) body.dataset.confirmedMessage = confirmedMessage;
  const document = {
    body,
    documentElement: element(),
    getElementById(id) { return ids[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === 'a[href]' ? anchors : []; },
    createElement() { return element(); },
    getElementsByTagName() { return [firstScript]; },
    contains(node) { return Object.values(ids).includes(node); }
  };
  const navigator = { globalPrivacyControl: gpc };
  const location = new URL(href || (thanks ? 'https://www.evankrealestate.com/thanks.html' : 'https://www.evankrealestate.com/'));
  if (search !== undefined) location.search = search;
  const windowListeners = new Map();
  const window = {
    localStorage, sessionStorage, location, navigator,
    addEventListener(name, callback) { windowListeners.set(name, callback); }
  };
  let executable = script;
  const flag = 'metaPixelEnabled: true,';
  assert.equal(script.split(flag).length - 1, 1, 'Expected the production Meta flag to be enabled');
  if (measurementEnabled === false) executable = script.replace(flag, 'metaPixelEnabled: false,');
  class FixedDate extends Date {
    static now() { return NOW; }
  }
  runInNewContext(executable, {
    window, document, navigator, URLSearchParams, URL, Date: FixedDate,
    console: { warn() {} }
  }, { timeout: 1000, filename: 'script.js' });
  const calls = () => Array.from(window.fbq?.queue || [], args => Array.from(args));
  const leadCount = () => calls().filter(args => args[0] === 'track' && args[1] === 'Lead').length;
  const storageEvent = event => windowListeners.get('storage')?.(event);
  return { ids, anchors, injectedScripts, window, localStorage, sessionStorage, calls, leadCount, storageEvent };
}

test('disabling the feature for rollback prevents any allow action from loading Meta', () => {
  const page = openPage({ measurementEnabled: false });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.window.fbq, undefined);
  assert.equal(page.ids.cookieBanner.hidden, true);
  assert.match(page.ids.privacyStatus.textContent, /currently paused/);
  page.ids.cookieSettingsButton.click();
  assert.equal(page.ids.cookieBanner.hidden, false);
  assert.equal(page.ids.acceptCookies.disabled, true);
  assert.equal(page.ids.cookieBanner.scrollCalls.length, 1);
  assert.equal(page.ids.cookieBanner.scrollCalls[0].block, 'center');
  page.ids.acceptCookies.click();
  assert.equal(page.localStorage.getItem(CHOICE_KEY), null);
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.window.fbq, undefined);
});

test('disabled rollback mode sends no pixel or Lead even with a receipt and stored acceptance', () => {
  const page = openPage({
    measurementEnabled: false, choice: 'accepted', thanks: true, search: '?submitted=1',
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
  });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.window.fbq, undefined);
  assert.equal(page.leadCount(), 0);
  assert.equal(page.sessionStorage.getItem(RECEIPT_KEY), null);
  assert.equal(page.ids.thanksTitle.textContent, 'Your inquiry is on its way.');
  page.ids.acceptCookies.click();
  page.storageEvent({ key: CHOICE_KEY });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.leadCount(), 0);
});

test('production fresh visitors load no pixel until they explicitly allow tracking', () => {
  const page = openPage({ });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.window.fbq, undefined);
  assert.equal(page.ids.cookieBanner.hidden, false);
  assert.equal(page.ids.cookieChoiceField.value, 'not selected');

  page.ids.acceptCookies.click();
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'accepted');
  assert.equal(page.ids.cookieBanner.hidden, true);
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.injectedScripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.ok(page.calls().some(args => args[0] === 'init' && args[1] === '2061494168135844'));
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
  page.ids.acceptCookies.click();
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
});

test('production disables automatic configuration before Pixel initialization', () => {
  const page = openPage({ choice: 'accepted' });
  const calls = page.calls();
  const autoConfigIndex = calls.findIndex(args => args[0] === 'set' && args[1] === 'autoConfig');
  const initIndex = calls.findIndex(args => args[0] === 'init');
  assert.ok(autoConfigIndex >= 0 && autoConfigIndex < initIndex);
  assert.deepEqual(calls[autoConfigIndex], ['set', 'autoConfig', false, '2061494168135844']);
});

for (const legacyKey of LEGACY_CHOICE_KEYS) {
  test(`${legacyKey} acceptance is not reused by the current consent version`, () => {
    const page = openPage({ localStorage: storage({ [legacyKey]: 'accepted' }) });
    assert.equal(page.injectedScripts.length, 0);
    assert.equal(page.ids.cookieChoiceField.value, 'not selected');
    assert.equal(page.ids.cookieBanner.hidden, false);
    assert.equal(page.localStorage.getItem(CHOICE_KEY), null);
    page.ids.acceptCookies.click();
    assert.equal(page.localStorage.getItem(CHOICE_KEY), 'accepted');
    assert.equal(page.injectedScripts.length, 1);
  });

  test(`${legacyKey} rejection remains honored by the current consent version`, () => {
    const page = openPage({ localStorage: storage({ [legacyKey]: 'rejected' }) });
    assert.equal(page.injectedScripts.length, 0);
    assert.equal(page.ids.cookieBanner.hidden, true);
    assert.equal(page.ids.cookieChoiceField.value, 'rejected');
    assert.match(page.ids.privacyStatus.textContent, /Opt-out request honored/);
    assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'true');
    const nextVisit = openPage({ localStorage: page.localStorage });
    assert.equal(nextVisit.injectedScripts.length, 0);
    assert.equal(nextVisit.ids.cookieChoiceField.value, 'rejected');
  });
}

test('either legacy rejection takes precedence over an acceptance from another old version', () => {
  for (const [first, second] of [['accepted', 'rejected'], ['rejected', 'accepted']]) {
    const page = openPage({
      localStorage: storage({ [LEGACY_CHOICE_KEYS[0]]: first, [LEGACY_CHOICE_KEYS[1]]: second })
    });
    assert.equal(page.injectedScripts.length, 0);
    assert.equal(page.ids.cookieChoiceField.value, 'rejected');
  }
});

test('a fresh current-version permission may replace an older opt-out', () => {
  const page = openPage({
    localStorage: storage({ [LEGACY_CHOICE_KEYS[0]]: 'rejected', [CHOICE_KEY]: 'accepted' })
  });
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.ids.cookieChoiceField.value, 'accepted');
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
});

test('declining tracking loads no pixel and is remembered on another visit', () => {
  const page = openPage({ });
  page.ids.rejectCookies.click();
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'rejected');
  assert.equal(page.ids.cookieChoiceField.value, 'rejected');
  assert.equal(page.ids.cookieBanner.hidden, true);
  assert.equal(page.injectedScripts.length, 0);
  const nextVisit = openPage({ localStorage: page.localStorage });
  assert.equal(nextVisit.injectedScripts.length, 0);
  assert.equal(nextVisit.ids.cookieBanner.hidden, true);
});

test('withdrawing previously granted tracking sends consent revoke', () => {
  const page = openPage({ choice: 'accepted' });
  page.ids.doNotSellButton.click();
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'rejected');
  assert.ok(page.calls().some(args => args[0] === 'consent' && args[1] === 'revoke'));
  assert.match(page.ids.privacyStatus.textContent, /Opt-out request honored/);
  assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'true');
});

test('rejection or cleared preferences in another tab revoke existing consent', () => {
  const page = openPage({ choice: 'accepted' });
  page.localStorage.setItem(CHOICE_KEY, 'rejected');
  page.storageEvent({ key: CHOICE_KEY });
  assert.deepEqual(page.calls().at(-1), ['consent', 'revoke']);
  assert.equal(page.ids.cookieChoiceField.value, 'rejected');
  assert.match(page.ids.privacyStatus.textContent, /Opt-out request honored/);
  assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'true');

  page.localStorage.removeItem(CHOICE_KEY);
  page.storageEvent({ key: null });
  assert.deepEqual(page.calls().at(-1), ['consent', 'revoke']);
  assert.equal(page.ids.cookieChoiceField.value, 'not selected');
  assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'false');
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
});

test('unrelated storage events cannot change privacy state', () => {
  const page = openPage({ choice: 'accepted' });
  const initialCalls = page.calls();
  page.localStorage.setItem(CHOICE_KEY, 'rejected');
  page.storageEvent({ key: 'unrelated-browser-key' });
  assert.deepEqual(page.calls(), initialCalls);
  assert.equal(page.ids.cookieChoiceField.value, 'accepted');
});

test('current permission granted in another tab loads once without inventing a lead', () => {
  const page = openPage();
  assert.equal(page.injectedScripts.length, 0);
  page.localStorage.setItem(CHOICE_KEY, 'accepted');
  page.storageEvent({ key: CHOICE_KEY });
  page.storageEvent({ key: CHOICE_KEY });
  assert.equal(page.ids.cookieChoiceField.value, 'accepted');
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
  assert.equal(page.leadCount(), 0);
});

test('unavailable local storage does not load Meta before a visitor explicitly allows it', () => {
  const page = openPage({
    localStorage: {
      getItem() { throw new Error('Storage unavailable'); },
      setItem() { throw new Error('Storage unavailable'); }
    }
  });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.ids.cookieBanner.hidden, false);
  page.ids.acceptCookies.click();
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.calls().filter(args => args[1] === 'PageView').length, 1);
  assert.equal(page.leadCount(), 0);
});

test('GPC overrides a stored acceptance and cannot be overridden by an allow action', () => {
  const page = openPage({
    choice: 'accepted', gpc: true, thanks: true, search: '?submitted=1',
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
  });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.leadCount(), 0);
  assert.equal(page.ids.cookieChoiceField.value, 'rejected');
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'rejected');
  assert.match(page.ids.privacyStatus.textContent, /Opt-out request honored/);
  assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'true');
  page.ids.cookieSettingsButton.click();
  assert.equal(page.ids.acceptCookies.disabled, true);
  // Invoke the handler even though a real disabled button cannot be clicked.
  page.ids.acceptCookies.click();
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'rejected');
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.leadCount(), 0);
  const laterWithoutGpc = openPage({
    localStorage: page.localStorage
  });
  assert.equal(laterWithoutGpc.injectedScripts.length, 0);
  assert.equal(laterWithoutGpc.ids.cookieChoiceField.value, 'rejected');
});

test('production persists and visibly honors GPC with measurement enabled', () => {
  const page = openPage({ choice: 'accepted', gpc: true });
  assert.equal(page.localStorage.getItem(CHOICE_KEY), 'rejected');
  assert.match(page.ids.privacyStatus.textContent, /Opt-out request honored/);
  assert.equal(page.ids.doNotSellButton.getAttribute('aria-pressed'), 'true');
  assert.equal(page.injectedScripts.length, 0);
});

test('visiting the thank-you URL directly never records a lead or confirms delivery', () => {
  const page = openPage({ choice: 'accepted', thanks: true, search: '?submitted=1' });
  assert.equal(page.leadCount(), 0);
  assert.equal(page.ids.thanksTitle.textContent, NEUTRAL_TITLE);
});

test('a recent accepted receipt records one lead, is consumed, and cannot replay', () => {
  const page = openPage({
    choice: 'accepted', thanks: true, search: '?submitted=1',
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 9 * 60 * 1000 }
  });
  assert.equal(page.leadCount(), 1);
  assert.equal(page.sessionStorage.getItem(RECEIPT_KEY), null);
  assert.equal(page.ids.thanksTitle.textContent, 'Your inquiry is on its way.');
  page.ids.acceptCookies.click();
  page.ids.acceptCookies.click();
  assert.equal(page.leadCount(), 1);
  const reload = openPage({
    thanks: true, search: '?submitted=1',
    localStorage: page.localStorage, sessionStorage: page.sessionStorage
  });
  assert.equal(reload.leadCount(), 0);
  assert.equal(reload.ids.thanksTitle.textContent, NEUTRAL_TITLE);
});

test('an accepted receipt waits for tracking consent and still records only once', () => {
  const page = openPage({
    thanks: true, search: '?submitted=1',
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
  });
  assert.equal(page.injectedScripts.length, 0);
  assert.equal(page.leadCount(), 0);
  assert.equal(page.ids.thanksTitle.textContent, 'Your inquiry is on its way.');
  page.ids.acceptCookies.click();
  assert.equal(page.leadCount(), 1);
  page.ids.acceptCookies.click();
  assert.equal(page.leadCount(), 1);
});

test('a confirmed inquiry with tracking refused remains confirmed without any Meta script or event', () => {
  const page = openPage({
    choice: 'rejected', thanks: true, search: '?submitted=1',
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
  });
  assert.equal(page.ids.thanksTitle.textContent, 'Your inquiry is on its way.');
  assert.equal(page.sessionStorage.getItem(RECEIPT_KEY), null);
  page.ids.rejectCookies.click();
  assert.equal(page.injectedScripts.length, 0);
  assert.deepEqual(page.calls(), []);
});

test('cross-tab permission records a previously confirmed inquiry once and GPC still prevents transfer', () => {
  for (const gpc of [false, true]) {
    const page = openPage({
      gpc, thanks: true, search: '?submitted=1',
      receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
    });
    page.localStorage.setItem(CHOICE_KEY, 'accepted');
    page.storageEvent({ key: CHOICE_KEY });
    page.storageEvent({ key: CHOICE_KEY });
    assert.equal(page.injectedScripts.length, gpc ? 0 : 1);
    assert.equal(page.leadCount(), gpc ? 0 : 1);
    assert.equal(page.ids.cookieChoiceField.value, gpc ? 'rejected' : 'accepted');
  }
});

for (const [reason, receipt] of [
  ['expired at the ten-minute boundary', { status: 'accepted', acceptedAt: NOW - 10 * 60 * 1000 }],
  ['unknown status', { status: 'pending', acceptedAt: NOW - 1000 }],
  ['future timestamp', { status: 'accepted', acceptedAt: NOW + 1000 }],
  ['missing timestamp', { status: 'accepted' }],
  ['invalid JSON', '{not valid JSON']
]) {
  test(`${reason} receipts never record a lead or confirm delivery`, () => {
    const page = openPage({
      choice: 'accepted', thanks: true, search: '?submitted=1',
      receipt: typeof receipt === 'string' ? receipt : { thanksPath: '/thanks.html', campaignId: '', ...receipt }
    });
    assert.equal(page.leadCount(), 0);
    assert.equal(page.ids.thanksTitle.textContent, NEUTRAL_TITLE);
  });
}

test('a receipt without the expected redirect flag does not record a lead', () => {
  const page = openPage({
    choice: 'accepted', thanks: true,
    receipt: { status: 'accepted', thanksPath: '/thanks.html', campaignId: '', acceptedAt: NOW - 1000 }
  });
  assert.equal(page.leadCount(), 0);
  assert.equal(page.ids.thanksTitle.textContent, NEUTRAL_TITLE);
});

test('campaign confirmation uses the accepted destination and fixed offer, with page-specific copy', () => {
  const page = openPage({
    choice: 'accepted', thanks: true, search: '?submitted=1',
    href: 'https://www.evankrealestate.com/thanks/compare/', campaignId: 'C1',
    confirmedTitle: 'Your comparison request is on its way.',
    confirmedMessage: 'Evan will review your preferences.',
    receipt: {
      status: 'accepted', acceptedAt: NOW - 1000,
      thanksPath: '/thanks/compare/', campaignId: 'C1'
    }
  });
  assert.equal(page.ids.thanksTitle.textContent, 'Your comparison request is on its way.');
  assert.equal(page.ids.thanksMessage.textContent, 'Evan will review your preferences.');
  assert.equal(page.sessionStorage.getItem(RECEIPT_KEY), null);
  assert.equal(page.injectedScripts.length, 1);
  assert.equal(page.leadCount(), 1);
});

for (const [reason, receipt] of [
  ['another campaign', { thanksPath: '/thanks/compare/', campaignId: 'C2' }],
  ['another confirmation route', { thanksPath: '/thanks/buyer-plan/', campaignId: 'C1' }],
  ['an older unbound receipt', {}]
]) {
  test(`campaign confirmation rejects ${reason}`, () => {
    const page = openPage({
      choice: 'accepted', thanks: true, search: '?submitted=1',
      href: 'https://www.evankrealestate.com/thanks/compare/', campaignId: 'C1',
      receipt: { status: 'accepted', acceptedAt: NOW - 1000, ...receipt }
    });
    assert.equal(page.ids.thanksTitle.textContent, NEUTRAL_TITLE);
    assert.equal(page.leadCount(), 0);
    assert.equal(page.sessionStorage.getItem(RECEIPT_KEY), null);
  });
}

test('shared scheduling confirmation accepts only its declared campaigns and exact route', () => {
  for (const campaignId of ['C1', 'C2', 'C3', 'C4', '']) {
    const page = openPage({
      thanks: true, search: '?submitted=1',
      href: 'https://www.evankrealestate.com/thanks/booking/', campaignId: 'C1 C2 C3',
      confirmedTitle: 'Your time request is on its way.',
      receipt: {
        status: 'accepted', acceptedAt: NOW - 1000,
        thanksPath: '/thanks/booking/', campaignId
      }
    });
    assert.equal(page.ids.thanksTitle.textContent,
      ['C1', 'C2', 'C3'].includes(campaignId) ? 'Your time request is on its way.' : NEUTRAL_TITLE);
  }
});

test('same-origin links carry only allowlisted campaign fields, each bounded to 200 characters', () => {
  const query = new URLSearchParams({
    utm_source: 'instagram',
    utm_medium: 'paid social',
    utm_campaign: 'home search',
    utm_content: 'x'.repeat(250),
    utm_term: 'east bay',
    email: 'qa@example.invalid',
    phone: 'not-for-links',
    fbclid: 'not-carried',
    arbitrary: 'not-carried'
  });
  const page = openPage({
    href: `https://www.evankrealestate.com/?${query}`,
    links: ['areas/brentwood-ca-real-estate.html', 'https://www.evankrealestate.com/privacy.html']
  });
  for (const anchor of page.anchors) {
    const destination = new URL(anchor.getAttribute('href'), page.window.location.href);
    assert.equal(destination.origin, page.window.location.origin);
    assert.deepEqual([...destination.searchParams.keys()].sort(), [
      'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term'
    ]);
    assert.equal(destination.searchParams.get('utm_source'), 'instagram');
    assert.equal(destination.searchParams.get('utm_medium'), 'paid social');
    assert.equal(destination.searchParams.get('utm_campaign'), 'home search');
    assert.equal(destination.searchParams.get('utm_content'), 'x'.repeat(200));
    assert.equal(destination.searchParams.get('utm_term'), 'east bay');
    assert.equal(destination.searchParams.has('email'), false);
    assert.equal(destination.searchParams.has('phone'), false);
    assert.equal(destination.searchParams.has('fbclid'), false);
  }
  assert.equal(new URL(page.anchors[0].getAttribute('href'), page.window.location.href).pathname,
    '/areas/brentwood-ca-real-estate.html');
});

test('campaign propagation preserves destination query values and fragments', () => {
  const page = openPage({
    href: 'https://www.evankrealestate.com/areas/brentwood-ca-real-estate.html?utm_source=instagram&utm_campaign=fall',
    links: ['../index.html?intent=buy&area=Brentwood&utm_source=area-guide#contactForm']
  });
  const destination = new URL(page.anchors[0].getAttribute('href'), page.window.location.href);
  assert.equal(destination.pathname, '/index.html');
  assert.equal(destination.searchParams.get('utm_source'), 'area-guide');
  assert.equal(destination.searchParams.get('utm_campaign'), 'fall');
  assert.equal(destination.searchParams.get('intent'), 'buy');
  assert.equal(destination.searchParams.get('area'), 'Brentwood');
  assert.equal(destination.hash, '#contactForm');
});

test('campaign propagation skips fragments and external or non-web links', () => {
  const links = [
    '#contactForm',
    'https://www.wrpropertiesre.com/team',
    '//www.wrpropertiesre.com/team',
    'https://www.evankrealestate.com:444/other',
    'tel:+19254927023',
    'mailto:evan@thewowski.com',
    'javascript:void(0)',
    ''
  ];
  const page = openPage({ search: '?utm_source=instagram', links });
  assert.deepEqual(page.anchors.map(anchor => anchor.getAttribute('href')), links);
});

test('arbitrary visitor query fields alone never rewrite links', () => {
  const links = ['areas/brentwood-ca-real-estate.html', '#contactForm'];
  const page = openPage({
    search: '?email=qa%40example.invalid&phone=not-for-links&arbitrary=value',
    links
  });
  assert.deepEqual(page.anchors.map(anchor => anchor.getAttribute('href')), links);
});
