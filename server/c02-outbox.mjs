import {submitFubEvent} from './fub-event.mjs';
import {sendMicrosoftAppointment} from './c02-microsoft-mail.mjs';

import {worksheetCampaigns} from './worksheet-campaigns.mjs';

// One private Durable Object per logical website inquiry. An acknowledgment
// means the job and its alarm were committed, not that an appointment is booked.
export const bookingInbox = 'evan@thewowski.com';

export async function queueInquiry(namespace, lead, payload) {
  // A lost HTTP response, a double click, and a retry from a refreshed tab
  // produce the same job. Actual changes to the plan create a fresh request.
  const appointment = lead.requestType === worksheetCampaigns.C02.manualType;
  // Preserve existing C02 IDs and pending jobs across deployment.
  const appointmentIdentity = [lead.email.toLowerCase(), lead.firstName, lead.lastName, lead.preferredTimeOne,
    lead.timezone, lead.buyingArea, lead.moveTiming, lead.lenderStatus, lead.representationStatus, lead.message];
  if (lead.phone) appointmentIdentity.push(lead.phone.replace(/\D/g, ''));
  const {submittedAt, referrerOrigin, cookieChoice, ctaSource, ...answers} = lead;
  const identity = appointment ? appointmentIdentity : ['website', {...answers, email:lead.email.toLowerCase()}];
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identity)));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const job = {key, payload, kind:appointment ? 'appointment' : 'inquiry', title:lead.requestType || 'Website inquiry', time:lead.preferredTimeOne, email:lead.email, name:[lead.firstName,lead.lastName].filter(Boolean).join(' '),
    emailPending:true, fubPending:true, attempts:0};
  const stub = namespace.get(namespace.idFromName(key));
  const receipt = await stub.fetch('https://outbox.internal/save', {method:'POST',body:JSON.stringify(job)});
  if (receipt.status !== 201) throw new Error('Inquiry was not saved');
}

export function bookingEmail(job) {
  const phone = job.payload.person.phones?.[0]?.value;
  if (job.kind === 'inquiry') return {from:'appointments@mail.evankrealestate.com', to:bookingInbox, replyTo:job.email,
    subject:job.title + ' | ' + job.name,
    text:[job.name + ' sent a website inquiry.', 'Reply to: ' + job.email, ...(phone ? ['Phone: ' + phone] : []),
      '', job.payload.message, '', 'Request reference: ' + job.key.slice(0,16)].join('\n')};
  // Older pending appointments have no kind.
  return {from:'appointments@mail.evankrealestate.com', to:bookingInbox, replyTo:job.email,
    subject:'First Home Game Plan | ' + job.time,
    text:[job.name + ' requested a 20-minute call.', 'Reply to: ' + job.email,
      ...(phone ? ['Callback number: ' + phone] : []),
      'Please check the requested time and confirm it personally.', '', job.payload.message,
      '', 'Request reference: ' + job.key.slice(0,16)].join('\n')};
}

export class C02AppointmentOutbox {
  constructor(state, env) { this.storage = state.storage; this.env = env; }
  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/save') return new Response(null,{status:404});
    const job = await request.json();
    if (!await this.storage.get('job')) {
      // With no intervening I/O, DO storage groups these writes atomically.
      await Promise.all([this.storage.put('job', job), this.storage.setAlarm(Date.now())]);
    }
    return new Response(null,{status:201});
  }
  async alarm() {
    const job = await this.storage.get('job');
    if (!job) return;
    if (job.complete) { await this.storage.deleteAll(); return; }
    job.attempts++;
    const delay = Math.min(3600000, 30000 * 2 ** Math.min(job.attempts - 1, 7));
    // Schedule recovery *before* contacting either provider. An interrupted
    // Worker resumes the persisted job, even after built-in alarm retries expire.
    await Promise.all([this.storage.put('job',job), this.storage.setAlarm(Date.now() + delay)]);
    if (job.emailPending) {
      let timer;
      try {
        const result = await Promise.race([this.sendEmail(job),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Mail timeout')), 12000); })]);
        if (!result?.messageId && result?.accepted !== true) throw new Error('No provider receipt');
        job.emailPending = false;
      } catch (e) { this.logRetry(job,'email',e); }
      finally { clearTimeout(timer); }
      if (!job.emailPending) {
        await this.storage.put('job',job);
        console.info('Website delivery accepted', {reference:job.key.slice(0,16), channel:'email'});
      }
    }
    if (job.fubPending) {
      try {
        const key = this.env.FUB_API_KEY?.trim();
        if (!key) throw new Error('Missing CRM configuration');
        const ok = await this.sendFub(job.payload, key);
        if (!ok) throw new Error('No CRM receipt');
        job.fubPending = false;
      } catch (e) { this.logRetry(job,'FUB',e); }
      if (!job.fubPending) {
        await this.storage.put('job',job);
        console.info('Website delivery accepted', {reference:job.key.slice(0,16), channel:'FUB'});
      }
    }
    if (!job.emailPending && !job.fubPending) {
      // No buyer data in the deduplication marker. Forget even the marker later.
      await Promise.all([this.storage.put('job',{complete:true}), this.storage.setAlarm(Date.now() + 7*86400000)]);
    }
  }
  async sendEmail(job) {
    const mail = bookingEmail(job);
    // This binding exists only in the local mail simulator configuration.
    if (this.env.BOOKING_EMAIL) return this.env.BOOKING_EMAIL.send(mail);
    if (this.env.C02_MAIL_PROVIDER === 'microsoft') return sendMicrosoftAppointment(mail, this.env);
    const key = this.env.RESEND_API_KEY?.trim();
    if (!key) throw Object.assign(new Error('Sender not configured'), {code:'SENDER_NOT_CONFIGURED'});
    const response = await (this.env.fetch || globalThis.fetch)('https://api.resend.com/emails', {
      method:'POST', redirect:'manual', signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'c02/'+job.key},
      body:JSON.stringify({from:mail.from,to:[mail.to],reply_to:mail.replyTo,subject:mail.subject,text:mail.text})
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error('No email receipt'),{code:'MAIL_HTTP_'+response.status});
    }
    return {messageId:(await response.json()).id};
  }
  async sendFub(payload, apiKey) {
    return submitFubEvent(payload, {apiKey, system:payload.system, systemKey:this.env.FUB_SYSTEM_KEY,
      fetchImpl:this.env.fetch || globalThis.fetch, signal:AbortSignal.timeout(10000)});
  }
  logRetry(job,channel,error) {
    const code = /^[A-Z0-9_]{1,60}$/.test(error?.code) ? error.code : 'UNCONFIRMED';
    console.warn('Website delivery retry', {reference:job.key.slice(0,16), channel, attempt:job.attempts, code});
  }
}
