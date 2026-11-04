import { worksheetCampaigns } from './worksheet-campaigns.mjs';
import { firstHomeAppointment } from './first-home-appointment.mjs';
import { saveAppointment } from './c02-outbox.mjs';
import { submitFubEvent } from './fub-event.mjs';

const worksheets = Object.values(worksheetCampaigns);

const EMAIL_ENDPOINT = 'https://formsubmit.co/ajax/evan@thewowski.com';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_BODY_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 10_000;
const PAID_MEDIA = new Set(['paid', 'ad', 'ads', 'paidmedia', 'paidsocial', 'socialpaid', 'paidsearch',
  'paidvideo', 'display', 'ppc', 'cpc', 'cpm', 'retargeting', 'remarketing']);
const CHANNEL_NAMES = new Map([
  ['facebook', 'Facebook'], ['fb', 'Facebook'], ['instagram', 'Instagram'], ['ig', 'Instagram'],
  ['meta', 'Meta'], ['google', 'Google'], ['googleads', 'Google'], ['adwords', 'Google']
]);
export const CONTACT_CONSENT_VERSION = '2026-10-19-inquiry-v2';
export const CONTACT_CONSENT_TEXT = 'I ask Evan Karwowski with WR Properties to reply to this inquiry using my selected contact method. This is not consent to automated marketing calls, marketing texts, or an email newsletter.';
const PUBLIC_ORIGINS = new Set([
  'https://evankrealestate.com',
  'https://www.evankrealestate.com'
]);

export const LEAD_OPTIONS = Object.freeze({
  interest: ['Buying a home', 'Selling a home', 'Buying and selling', 'Exploring my options'],
  area: ['Brentwood', 'Oakley', 'Livermore', 'Pleasanton', 'Discovery Bay', 'More than one area', 'Somewhere else'],
  budget: ['Under $700,000', '$700,000–$1 million', '$1–$1.5 million', '$1.5–$2 million', '$2 million+', 'Still deciding'],
  timeline: ['As soon as possible', 'Within 3 months', '3–6 months', '6–12 months', 'Just researching'],
  contact_method: ['email', 'text', 'call'],
  request_type: [
    'Home comparison', 'Pricing report', 'Consultation', 'Buyer readiness plan',
    'Seller pricing and preparation', 'Open-house details',
    'Buyer planning call', 'Seller planning conversation',
    ...worksheets.flatMap(c => [c.resourceType, c.title]), worksheetCampaigns.C02.manualType
  ],
  campaign_id: ['C1', 'C2', 'C3', 'C4', ...worksheets.map(c => c.id)],
  readiness_question: ['Process', 'Financing conversation', 'Home search', 'Representation', 'Not sure yet'],
  meeting_format: ['Phone', 'Video'],
  representation_status: ['Not working with an agent', 'Working with an agent', 'Not sure']
});
const CAMPAIGN_REQUESTS = Object.freeze({
  C1: ['Home comparison', 'Buyer planning call'],
  C2: ['Buyer readiness plan', 'Buyer planning call'],
  C3: ['Seller pricing and preparation', 'Seller planning conversation'],
  C4: ['Open-house details'],
  ...Object.fromEntries(worksheets.map(c => [c.id, [c.resourceType, c.title, ...(c.manualType ? [c.manualType] : [])]]))
});
const GENERAL_REQUESTS = ['Home comparison', 'Pricing report', 'Consultation'];
const SCHEDULING_REQUESTS = ['Buyer planning call', 'Seller planning conversation', ...worksheets.map(c => c.title)];

class InvalidInput extends Error {}
class BodyTooLarge extends Error {}

function reply(status, code, origin, delivery) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify({ success: !code, code: code || undefined, delivery }), {
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
    if (
      LOOPBACK_HOSTS.has(target.hostname) &&
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

function optionalCheckbox(data, field) {
  if (data[field] === undefined || data[field] === '' || data[field] === false) return false;
  if (data[field] === true || data[field] === 'on') return true;
  throw new InvalidInput();
}

function listingLink(data, field, required = false) {
  const value = text(data, field, 600, { required });
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new InvalidInput();
  } catch { throw new InvalidInput(); }
  return value;
}

function normalizeLead(data) {
  if (text(data, '_honey', 200)) throw new InvalidInput();
  if (data.contact_consent !== true && data.contact_consent !== 'on') throw new InvalidInput();
  if (text(data, 'consent_version', 40) !== CONTACT_CONSENT_VERSION) throw new InvalidInput();
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
  const meetingFormat = choice(data, 'meeting_format');
  if ((['text', 'call'].includes(contactMethod) || meetingFormat === 'Phone') && !phone) throw new InvalidInput();
  const campaignId = choice(data, 'campaign_id');
  const requestType = choice(data, 'request_type');
  if (campaignId && !CAMPAIGN_REQUESTS[campaignId].includes(requestType)) throw new InvalidInput();
  if (!campaignId && requestType && !GENERAL_REQUESTS.includes(requestType)) throw new InvalidInput();
  const isSchedulingRequest = SCHEDULING_REQUESTS.includes(requestType);
  const isShortlistReview = campaignId === 'C01' && requestType === 'Home Shortlist Review';
  const isFirstHomeSession = campaignId === 'C02' && requestType === worksheetCampaigns.C02.title;
  const manualFirstHome = campaignId === 'C02' && requestType === worksheetCampaigns.C02.manualType;

  const lead = {
    firstName, lastName, email, phone, contactMethod,
    interest: choice(data, 'interest', true),
    area: choice(data, 'area'),
    budget: choice(data, 'budget'),
    timeline: choice(data, 'timeline', isFirstHomeSession),
    requestType, campaignId, meetingFormat,
    priorityOne: text(data, 'priority_one', 300, { required: isShortlistReview }),
    priorityTwo: text(data, 'priority_two', 300, { required: isShortlistReview }),
    representationStatus: choice(data, 'representation_status', isShortlistReview || isFirstHomeSession || manualFirstHome),
    buyingArea: manualFirstHome ? text(data, 'buying_area', 160, { required: true }) : '',
    moveTiming: manualFirstHome ? text(data, 'move_timing', 80, { required: true }) : '',
    lenderStatus: manualFirstHome ? text(data, 'lender_status', 80, { required: true }) : '',
    listingOne: listingLink(data, 'listing_one', isShortlistReview),
    listingTwo: listingLink(data, 'listing_two'),
    listingThree: listingLink(data, 'listing_three'),
    routeVersion: text(data, 'route_version', 40),
    readinessQuestion: choice(data, 'readiness_question'),
    personalizedOutline: optionalCheckbox(data, 'personalized_outline'),
    completedSteps: text(data, 'completed_steps', 1_500, { multiline: true, required: isFirstHomeSession }),
    propertyAddress: text(data, 'property_address', 500, { required: requestType === 'Seller pricing and preparation' }),
    propertyNotes: text(data, 'property_notes', 2_000, { multiline: true }),
    preferredTimeOne: text(data, 'preferred_time_one', 200, { required: isSchedulingRequest }),
    preferredTimeTwo: text(data, 'preferred_time_two', 200),
    timezone: text(data, 'timezone', 100, { required: isSchedulingRequest || manualFirstHome }),
    propertySlug: text(data, 'property_slug', 100),
    areaOrListing: text(data, 'area_or_listing', 2_048, { multiline: true }),
    message: text(data, 'message', 4_000, { multiline: true, required: isFirstHomeSession }),
    ctaSource: text(data, 'cta_source', 150),
    cookieChoice: text(data, 'cookie_choice', 50),
    consentVersion: text(data, 'consent_version', 40),
    submittedAt: text(data, 'submitted_at', 40),
    landingPage: text(data, 'landing_page', 500),
    referrerOrigin: text(data, 'referrer_origin', 300),
    campaign: {}
  };
  if (manualFirstHome) {
    const phoneBooking = lead.routeVersion === worksheetCampaigns.C02.phoneBookingVersion;
    if (phoneBooking) {
      if (!phone) throw new InvalidInput();
      lead.contactMethod = 'call';
      lead.meetingFormat = 'Phone';
    }
    // Cached older forms submitted only a written time window. Their requests
    // remain readable, but can't be turned into precise calendar events.
    if (phoneBooking || lead.routeVersion === worksheetCampaigns.C02.version || data.appointment_start !== undefined) {
      lead.appointment = firstHomeAppointment({
        appointment_start: text(data,'appointment_start',30,{required:true}),
        appointment_date: text(data,'appointment_date',10,{required:true}),
        appointment_time: text(data,'appointment_time',5,{required:true}),
        timezone: lead.timezone, name: [firstName,lastName].filter(Boolean).join(' '), email, phone
      });
      if (!lead.appointment) throw new InvalidInput();
      lead.preferredTimeOne = lead.appointment.label;
    } else if (!lead.preferredTimeOne) throw new InvalidInput();
  }
  if (isSchedulingRequest && !meetingFormat) throw new InvalidInput();
  if (lead.propertySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lead.propertySlug)) throw new InvalidInput();
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

// Tags come only from recognized forms and acquisition labels, never form answers.
function sourceTags(lead) {
  const medium = (lead.campaign.medium || '').toLowerCase().replace(/[-_ ]/g, '');
  const paid = PAID_MEDIA.has(medium);
  if (!paid && !lead.campaignId) return [];
  const tags = ['Marketing lead'];
  const worksheet = worksheetCampaigns[lead.campaignId];
  if (lead.campaignId) tags.push(worksheet ? `${worksheet.id} - ${worksheet.title}` : `Campaign ${lead.campaignId}`);
  if (worksheet?.resourceType === lead.requestType) tags.push('Worksheet request');
  if (lead.requestType === worksheetCampaigns.C02.manualType) tags.push('Appointment request');
  if (paid) tags.push('Paid ad');
  const channel = CHANNEL_NAMES.get((lead.campaign.source || '').toLowerCase());
  if (channel) tags.push(channel);
  return tags;
}

function eventPayload(lead, system) {
  const tags = sourceTags(lead);
  const worksheet = worksheetCampaigns[lead.campaignId];
  const resourceRequest = worksheet && lead.requestType === worksheet.resourceType;
  const sessionState = lead.campaignId === 'C02' ? 'Time requested — Evan must confirm personally' : lead.representationStatus === 'Not working with an agent'
    ? 'Session requested — scope and availability to confirm' : 'Eligibility pending — clarify existing representation before personalized work';
  const details = [
    ['Request', lead.requestType],
    ['Offer', lead.campaignId],
    ['Source tags', tags.join(', ')],
    ['Campaign name', worksheet ? `${worksheet.title} — November 2026` : ''],
    ['Route version', worksheet ? lead.routeVersion : ''],
    ['Funnel state', worksheet ? (resourceRequest ? 'Resource requested' : sessionState) : ''],
    ['Resource link', worksheet ? `https://www.evankrealestate.com${worksheet.id === 'C02' ? worksheet.pdf : worksheet.watch}` : ''],
    ['Resource follow-up', resourceRequest ? 'Personal email follow-up requested. Immediate on-page worksheet access; no automatic resource email was sent by this endpoint.' : ''],
    ['Interest', lead.interest],
    ['Preferred contact', lead.contactMethod],
    ['Area', lead.area],
    ['Considering buying in', lead.buyingArea],
    ['Move timing', lead.moveTiming],
    ['Lender conversation', lead.lenderStatus],
    ['Budget', lead.budget],
    ['Timeline', lead.timeline],
    ['First priority', lead.priorityOne],
    ['Second priority', lead.priorityTwo],
    ['Existing agent relationship', lead.representationStatus],
    ['Public listing 1', lead.listingOne],
    ['Public listing 2', lead.listingTwo],
    ['Public listing 3', lead.listingThree],
    ['Readiness question', lead.readinessQuestion],
    ['Personalized outline requested', lead.personalizedOutline
      ? 'Yes — an additional service request, not marketing permission'
      : lead.campaignId === 'C2' && lead.requestType === 'Buyer readiness plan'
        ? 'No — checklist copy only' : ''],
    ['Steps already completed', lead.completedSteps],
    ['Property address', lead.propertyAddress],
    ['Property notes', lead.propertyNotes],
    ['First proposed time', lead.preferredTimeOne],
    ['Alternative proposed time', lead.preferredTimeTwo],
    ['Time zone', lead.timezone],
    ['Review in Outlook using evan@thewowski.com, then save or send the invitation', lead.appointment?.outlookUrl],
    ['Meeting format requested', lead.meetingFormat],
    ['Scheduling status', SCHEDULING_REQUESTS.includes(lead.requestType) || lead.requestType === worksheetCampaigns.C02.manualType ? 'Time request only — no appointment has been booked or confirmed' : ''],
    ['Property reference', lead.propertySlug],
    ['Town or listing', lead.areaOrListing],
    ['Message', lead.message],
    ['Contact consent', 'Yes — contact about this request'],
    ['Consent text', CONTACT_CONSENT_TEXT],
    ['Marketing permission', 'Not collected by this form. Do not enroll in automated marketing from this inquiry alone.'],
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
    ...(tags.length ? { tags } : {}),
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

async function emailInquiry(lead, payload, { fetchImpl, origin, signal }) {
  // The provider envelope and recipient are server-controlled.
  const email = await fetchImpl(EMAIL_ENDPOINT, {
    method: 'POST', redirect: 'manual', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: origin + '/' },
    body: JSON.stringify({
      name: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
      email: lead.email, ...(lead.phone ? { phone: lead.phone } : {}),
      message: payload.message,
      _subject: (lead.requestType || 'Website inquiry') + ' | Evan Karwowski',
      _url: origin + (lead.landingPage || '/'), _template: 'table', _captcha: 'false'
    })
  });
  if (!email.ok) { await email.body?.cancel(); return false; }
  const result = await email.json();
  return result?.success === true || result?.success === 'true';
}

// Non-appointment forms still deliver synchronously.
async function attemptDelivery(send, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    const accepted = await Promise.race([
      send(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('upstream-timeout'));
        }, timeoutMs);
      })
    ]);
    return accepted ? 'accepted' : 'unconfirmed';
  } catch {
    return controller.signal.aborted ? 'timeout' : 'unconfirmed';
  } finally {
    clearTimeout(timer);
  }
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
  const manual = lead.requestType === worksheetCampaigns.C02.manualType;
  if ((manual ? !env.C02_OUTBOX : !apiKey) && origin === new URL(request.url).origin && LOOPBACK_HOSTS.has(new URL(origin).hostname)) {
    // The local walkthrough can be exercised without retaining or transmitting a lead.
    return reply(200, 'LOCAL_PREVIEW', origin);
  }
  const system = typeof env.FUB_SYSTEM === 'string' && env.FUB_SYSTEM.trim()
    ? env.FUB_SYSTEM.trim() : 'EvanKarwowskiWebsite';
  const payload = eventPayload(lead, system);
  if (manual) {
    try {
      await saveAppointment(env.C02_OUTBOX, lead, payload, Boolean(apiKey));
      return reply(202, null, origin, {email:'queued', fub:apiKey ? 'queued' : 'not_configured'});
    } catch {
      console.error('C02 appointment storage unavailable');
      return reply(503, 'INTAKE_UNAVAILABLE', origin);
    }
  }
  const config = { apiKey, system, systemKey: env.FUB_SYSTEM_KEY, fetchImpl: env.fetch || globalThis.fetch, origin };
  const fub = apiKey
    ? await attemptDelivery(signal => submitFubEvent(payload, { ...config, signal }), REQUEST_TIMEOUT_MS)
    : 'not_configured';
  const email = !apiKey
    ? await attemptDelivery(signal => emailInquiry(lead, payload, { ...config, signal }), REQUEST_TIMEOUT_MS)
    : 'not_requested';
  if (fub === 'accepted' || email === 'accepted') return reply(200, null, origin);
  const timedOut = fub === 'timeout' || email === 'timeout';
  return reply(timedOut ? 504 : 502, timedOut ? 'DELIVERY_TIMEOUT' : 'DELIVERY_FAILED', origin);
}
