const FUB_ENDPOINT = 'https://api.followupboss.com/v1/events';
const MAX_BODY_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 10_000;
const PUBLIC_ORIGINS = new Set([
  'https://evankrealestate.com',
  'https://www.evankrealestate.com'
]);

export const LEAD_OPTIONS = Object.freeze({
  interest: ['Buying a home', 'Selling a home', 'Buying and selling', 'Exploring my options'],
  area: ['Brentwood', 'Livermore', 'Pleasanton', 'Discovery Bay', 'More than one area', 'Somewhere else'],
  budget: ['Under $700,000', '$700,000–$1 million', '$1–$1.5 million', '$1.5–$2 million', '$2 million+', 'Still deciding'],
  timeline: ['As soon as possible', 'Within 3 months', '3–6 months', '6–12 months', 'Just researching'],
  contact_method: ['email', 'text', 'call'],
  request_type: ['Home comparison', 'Pricing report', 'Consultation']
});

class InvalidInput extends Error {}
class BodyTooLarge extends Error {}

function reply(status, code, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(code ? { success: false, code } : { success: true }), {
    status, headers
  });
}

function permittedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin === 'null') return null;
  if (PUBLIC_ORIGINS.has(origin)) return origin;
  try {
    const target = new URL(request.url);
    const supplied = new URL(origin);
    const localHosts = ['localhost', '127.0.0.1', '[::1]'];
    if (
      localHosts.includes(target.hostname) &&
      supplied.origin === target.origin &&
      origin === supplied.origin &&
      ['http:', 'https:'].includes(target.protocol)
    ) return origin;
  } catch {
    // Invalid origins are rejected without echoing their contents.
  }
  return null;
}

async function readJson(request) {
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new BodyTooLarge();
  if (!request.body) throw new InvalidInput();
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let position = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.byteLength;
  }
  try {
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InvalidInput();
    return data;
  } catch {
    throw new InvalidInput();
  }
}

function text(data, field, max = 200, { required = false, multiline = false } = {}) {
  const input = data[field];
  if (input === undefined || input === null || input === '') {
    if (required) throw new InvalidInput();
    return '';
  }
  if (typeof input !== 'string' || input.length > max) throw new InvalidInput();
  const value = input.trim().replace(/\r\n?/g, '\n');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new InvalidInput();
  if (!multiline && /[\r\n]/u.test(value)) throw new InvalidInput();
  if (required && !value) throw new InvalidInput();
  return value;
}

function choice(data, field, required = false) {
  const value = text(data, field, 100, { required });
  if (value && !LEAD_OPTIONS[field].includes(value)) throw new InvalidInput();
  return value;
}

function normalizeLead(data) {
  if (text(data, '_honey', 200)) throw new InvalidInput();
  if (data.contact_consent !== true && data.contact_consent !== 'on') throw new InvalidInput();
  const suppliedName = text(data, 'fullName', 100) || text(data, 'name', 100);
  let firstName = text(data, 'firstName', 100);
  let lastName = text(data, 'lastName', 100);
  if (suppliedName) {
    const parts = suppliedName.split(/\s+/u);
    firstName = parts.shift();
    lastName = parts.join(' ');
  }
  if (!firstName || `${firstName} ${lastName}`.trim().length > 100) throw new InvalidInput();
  const email = text(data, 'email', 254, { required: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new InvalidInput();
  const phone = text(data, 'phone', 40);
  if (phone && (!/^[+\d().\s-]+$/u.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')))) {
    throw new InvalidInput();
  }
  const contactMethod = choice(data, 'contact_method') || 'email';
  if (['text', 'call'].includes(contactMethod) && !phone) throw new InvalidInput();

  const lead = {
    firstName, lastName, email, phone, contactMethod,
    interest: choice(data, 'interest', true),
    area: choice(data, 'area'),
    budget: choice(data, 'budget'),
    timeline: choice(data, 'timeline'),
    requestType: choice(data, 'request_type'),
    areaOrListing: text(data, 'area_or_listing', 2_048),
    message: text(data, 'message', 4_000, { multiline: true }),
    ctaSource: text(data, 'cta_source', 150),
    cookieChoice: text(data, 'cookie_choice', 50),
    consentVersion: text(data, 'consent_version', 40),
    submittedAt: text(data, 'submitted_at', 40),
    landingPage: text(data, 'landing_page', 500),
    referrerOrigin: text(data, 'referrer_origin', 300),
    campaign: {}
  };
  if (lead.landingPage && (!lead.landingPage.startsWith('/') || lead.landingPage.startsWith('//') || /[?#\\]/u.test(lead.landingPage))) {
    throw new InvalidInput();
  }
  if (lead.referrerOrigin) {
    try {
      const referrer = new URL(lead.referrerOrigin);
      if (!['http:', 'https:'].includes(referrer.protocol) || referrer.origin !== lead.referrerOrigin) throw new InvalidInput();
    } catch {
      throw new InvalidInput();
    }
  }
  if (lead.submittedAt && !Number.isFinite(Date.parse(lead.submittedAt))) throw new InvalidInput();
  if (data.campaign !== undefined && (!data.campaign || typeof data.campaign !== 'object' || Array.isArray(data.campaign))) {
    throw new InvalidInput();
  }
  // Only FUB's documented marketing fields can reach the campaign object.
  for (const field of ['source', 'medium', 'term', 'content', 'campaign']) {
    const value = text(data, `utm_${field}`, 200) || text(data.campaign || {}, field, 200);
    if (value) lead.campaign[field] = value;
  }
  return lead;
}

function eventPayload(lead, system) {
  const details = [
    ['Request', lead.requestType],
    ['Interest', lead.interest],
    ['Preferred contact', lead.contactMethod],
    ['Area', lead.area],
    ['Budget', lead.budget],
    ['Timeline', lead.timeline],
    ['Town or listing', lead.areaOrListing],
    ['Message', lead.message],
    ['Contact consent', 'Yes — contact about this request'],
    ['Consent version', lead.consentVersion],
    ['Submitted at (browser)', lead.submittedAt],
    ['Received at (server)', new Date().toISOString()],
    ['Landing page', lead.landingPage],
    ['Referrer origin', lead.referrerOrigin],
    ['CTA', lead.ctaSource],
    ['Cookie choice', lead.cookieChoice],
    ...Object.entries(lead.campaign).map(([key, value]) => [`Campaign ${key}`, value])
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
  const person = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    emails: [{ value: lead.email }],
    ...(lead.phone ? { phones: [{ value: lead.phone }] } : {})
  };
  const payload = {
    source: 'evankrealestate.com',
    system,
    type: 'General Inquiry',
    person,
    message: details
  };
  // FUB requires a source when campaign is present. Preserve partial attribution
  // in the inquiry message without inventing a marketing source.
  if (lead.campaign.source) payload.campaign = lead.campaign;
  return payload;
}

/**
 * Shared by Node and Cloudflare Workers. Secrets are read only from env.
 * Tests may inject env.fetch; production uses the standard fetch implementation.
 */
export async function handleLead(request, env = {}) {
  const origin = permittedOrigin(request);
  if (!origin) return reply(403, 'FORBIDDEN');
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
        'Cache-Control': 'no-store'
      }
    });
  }
  if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED', origin);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return reply(415, 'UNSUPPORTED_MEDIA_TYPE', origin);
  }
  let lead;
  try {
    lead = normalizeLead(await readJson(request));
  } catch (error) {
    return reply(error instanceof BodyTooLarge ? 413 : 400, error instanceof BodyTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_INPUT', origin);
  }

  const apiKey = typeof env.FUB_API_KEY === 'string' ? env.FUB_API_KEY.trim() : '';
  if (!apiKey) return reply(503, 'NOT_CONFIGURED', origin);
  const system = typeof env.FUB_SYSTEM === 'string' && env.FUB_SYSTEM.trim()
    ? env.FUB_SYSTEM.trim() : 'EvanKarwowskiWebsite';
  const controller = new AbortController();
  let timer;
  try {
    const headers = {
      'Authorization': `Basic ${btoa(`${apiKey}:`)}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-System': system
    };
    if (typeof env.FUB_SYSTEM_KEY === 'string' && env.FUB_SYSTEM_KEY.trim()) {
      headers['X-System-Key'] = env.FUB_SYSTEM_KEY.trim();
    }
    const fetchImpl = typeof env.fetch === 'function' ? env.fetch : globalThis.fetch;
    const response = await Promise.race([
      fetchImpl(FUB_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(eventPayload(lead, system)),
        signal: controller.signal,
        redirect: 'error'
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('upstream-timeout'));
        }, REQUEST_TIMEOUT_MS);
      })
    ]);
    // FUB 204 means this source is archived and ignored, not delivered.
    if (response.status !== 200 && response.status !== 201) {
      await response.body?.cancel();
      return reply(502, 'DELIVERY_FAILED', origin);
    }
    // No upstream content or contact data is returned to the browser.
    await response.body?.cancel();
    return reply(200, null, origin);
  } catch {
    return reply(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'DELIVERY_TIMEOUT' : 'DELIVERY_FAILED', origin);
  } finally {
    clearTimeout(timer);
  }
}
