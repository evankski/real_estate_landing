import { readFile } from 'node:fs/promises';
import { bookingLinks, firstHomeIntakeUrl, site, videos } from './campaign-config.mjs';
import { firstHomeAlias, worksheetCampaigns } from '../server/worksheet-campaigns.mjs';
import { firstHomeAppointment } from '../server/first-home-appointment.mjs';

const c = worksheetCampaigns.C02;
const primary = 'Book My First Home Game Plan';
const footer = `<footer class="c02-footer"><div class="container">
  <p><strong>Evan Karwowski</strong> · CA DRE #02102429<br />WR Properties · Brokerage DRE #02029047</p>
  <p>WR Properties is a registered DBA of Winning Results Realty, Inc. · 613 1st Street, Suite 211, Brentwood, CA 94513 · Equal Housing Opportunity</p>
  <p><a href="tel:+19254927023">925-492-7023</a> · <a href="mailto:evan@thewowski.com">Email Evan</a></p>
  <nav aria-label="Privacy and legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/cookies.html">Cookies</a><a href="/accessibility.html">Accessibility</a><button type="button" class="text-button" id="cookieSettingsButton">Cookie settings</button><button type="button" class="text-button" id="doNotSellButton">Do not sell or share my information</button><a href="/privacy.html#privacy-choices">Privacy requests</a></nav>
  <p id="privacyStatus" role="status" aria-live="polite"></p></div></footer>`;

function alias(target) {
  // Static-host counterpart to the server redirect. Keep the incoming ad query verbatim.
  const [path, anchor] = target.split('#');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${site.domain}${path}"><title>First Home Game Plan | Evan Karwowski</title>
  <script>location.replace(${JSON.stringify(path)} + location.search + ${JSON.stringify(anchor ? '#' + anchor : '')});</script>
  <noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript></head><body><a href="${target}">Continue to the First Home Game Plan</a></body></html>\n`;
}

function scheduling(ui, bookingUrl) {
  if (firstHomeIntakeUrl && !/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/api\/leads$/.test(firstHomeIntakeUrl))
    throw new Error('C02 intake must be the verified HTTPS workers.dev /api/leads endpoint.');
  const { field, input, esc } = ui;
  const choices = (name, question, answers) => `<fieldset class="full-span c02-choice-group"><legend>${esc(question)}</legend>
    <div class="c02-choices">${answers.map(([value, label = value]) =>
      `<label><input type="radio" name="${name}" value="${esc(value)}" required><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
  return `<section class="c02-section c02-booking" id="booking" tabindex="-1"><div class="container c02-columns">
  <div><p class="eyebrow">First Home Game Plan · 20 minutes</p><h2>Let’s find a time to talk.</h2>
  <p>Tell me a little about your plans so we can spend the call on what matters to you.</p>
  ${bookingUrl ? '' : '<p>Choose the date and time you’d like for our 20-minute call. I’ll check my calendar and email you to confirm.</p>'}</div>
  <div><noscript><p><a href="mailto:evan@thewowski.com?subject=First%20Home%20Game%20Plan">Email Evan to arrange the call</a> and include your time zone.</p></noscript>
  <form id="c02-preparation" class="contact-form c02-form" data-calendar="${esc(bookingUrl || '')}" data-intake="${esc(firstHomeIntakeUrl)}" data-request-type="${esc(c.manualType)}" data-version="${esc(c.phoneBookingVersion)}" method="post" action="/first-purchase/#booking" hidden>
  <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" hidden>
  <fieldset id="c02-questions"><legend>A little about your plans</legend><div class="form-grid">
  ${field('Where are you considering buying?', input('buying_area', 160, 'required placeholder="A town, a few areas, or still exploring"'), true)}
  ${choices('move_timing','When might you want to move?', [['Within 3 months'],['3–6 months'],['6–12 months'],['A year or more'],['Still exploring']])}
  ${choices('lender_status','Have you spoken with a lender?', [['Not yet'],['Yes, an initial conversation','We’ve talked'],['Yes, I have a preapproval','I’m preapproved'],['Prefer to discuss on the call','Let’s discuss on the call']])}
  ${choices('representation_status','Are you currently working with a real-estate agent?', [['Not working with an agent','No'],['Working with an agent','Yes'],['Not sure']])}
  ${field('What would you most like help figuring out? (optional)', '<textarea name="message" maxlength="1000" rows="2" placeholder="For example, what should I ask a lender before touring homes?"></textarea>', true)}
  </div></fieldset>
  <fieldset id="c02-contact" hidden disabled><legend tabindex="-1">Arrange your call</legend>
  <button class="text-button" id="c02-edit" type="button">Edit my answers</button>
  <p id="c02-options">${bookingUrl ? 'Choose an available time in the calendar. Check the time zone before confirming.' : 'Pick your preferred start time. I’ll reply to confirm it or suggest another time.'}</p>
  <div class="form-grid">${field('Your name',input('name',100,'autocomplete="name" required'), true)}
  ${field('Email',input('email',254,'type="email" autocomplete="email" required'), true)}
  <div class="full-span">${field('What number should I call?',input('phone',40,String.raw`type="tel" autocomplete="tel" inputmode="tel" required pattern="(?=(?:\D*\d){7,15}\D*$)[0-9+\(\)\s.\-]+" title="Enter a phone number with 7 to 15 digits, including the area code." aria-describedby="c02-callback-hint"`))}<p class="field-hint" id="c02-callback-hint">Once we confirm the time, I’ll call you from 925-492-7023.</p></div>
  <div id="c02-manual-fields" class="full-span" ${bookingUrl ? 'hidden' : ''}>
    ${field('Preferred date','<input type="date" name="appointment_date" required>',true)}
    ${field('Preferred start time','<input type="time" name="appointment_time" required aria-describedby="c02-local-zone">',true)}
    <input type="hidden" name="timezone"><p class="field-hint" id="c02-local-zone"></p></div></div>
  <label class="consent"><input name="contact_consent" type="checkbox" required><span>I ask Evan Karwowski with WR Properties to reply to this inquiry using my selected contact method. This is not consent to automated marketing calls, marketing texts, or an email newsletter.</span></label>
  <p class="form-note">We use these details to prepare and arrange your call.${bookingUrl ? ' Opening the calendar shares these answers with Calendly for scheduling.' : ''} <a href="/privacy.html#notice-at-collection">Notice at Collection</a></p>
  </fieldset>
  <button class="button primary" type="submit" id="c02-continue">Choose a time</button>
  <button class="text-button" id="c02-switch" type="button" hidden>Email a time request instead</button>
  <h3 id="c02-saved-title" tabindex="-1" hidden>Time request received</h3>
  <p id="c02-status" class="form-status" role="status" aria-live="polite"></p>
  <a id="c02-preview-draft" class="text-link" target="_blank" rel="noopener noreferrer" hidden>Open test draft in Outlook</a>
  </form>
  <div id="c02-calendar" hidden><h3 tabindex="-1">Choose an appointment</h3><p>Check the time zone shown in the calendar. If a time is taken, choose another available time.</p><div id="c02-widget"></div></div>
  <p class="c02-contact-link">Prefer to talk first? <a href="sms:+19254927023">Text Evan at 925-492-7023</a>.</p></div></div></section>`;
}

export async function firstHomePages(ui) {
  const { page, esc, videoPlayer, formStart, formEnd, hidden, field, input } = ui;
  const [style, bookingJS] = await Promise.all(['first-home.css','first-home-booking.js'].map(file => readFile(new URL(file, import.meta.url), 'utf8')));
  const bookingUrl = bookingLinks[c.videoKey];
  if (bookingUrl && !/^https:\/\/calendly\.com\/[\w-]+\/[\w-]+\/?$/.test(bookingUrl)) throw new Error('C02 requires a verified Calendly event URL. Other providers need their own confirmation adapter.');
  const pdfLink = `<a class="button secondary" href="${c.pdf}" download="${esc(c.downloadName)}">Download the worksheet (PDF)</a>`;
  const sheetForm = formStart({key:'c02-sheet-email',campaignId:c.id,requestType:c.resourceType,interest:'Buying a home',
    thanks:c.sheetThanks,label:'Email me the sheet', successMessage:'Your worksheet request was received. I’ll email you a copy personally.'})
    .replace('id="contactForm"', 'id="contactForm" data-sheet-email="true"') +
    hidden('contact_method','email') + hidden('route_version',c.version) +
    `<fieldset><legend>Where should I send your copy?</legend><div class="form-grid">
    ${field('Your name',input('name',100,'autocomplete="name" required'),true)}
    ${field('Email',input('email',254,'type="email" autocomplete="email" required'),true)}
    </div>${formEnd('Request an email copy')}`;
  const video = videos[c.videoKey] ? await videoPlayer(c.videoKey, c.title) : `<div class="c02-video-pending" data-video-slot="first-home-plan">
    <img src="/media/campaigns/headshot-480.webp" width="480" height="720" alt="Evan Karwowski" />
    <div><strong>A walkthrough with Evan</strong><p>My video is coming soon. The worksheet is ready to use.</p></div></div>`;
  const faq = [
    ['Can I book if I’m still exploring?', 'Yes. You might be a year out or deciding whether buying makes sense at all. We can start there.'],
    ['Do I need to speak with a lender first?', 'No. We can work out which questions to ask. A lender handles preapproval, loan terms, and estimates specific to your finances.'],
    ['What if I already have an agent?', 'Tell me when you book so we can respect any existing agreement and clarify what we can discuss.'],
    ['Does the free call commit me to working with you?', 'No. If you want help with a home search afterward, we’ll discuss services, representation, and negotiable fees separately.']
  ];
  const content = `<section class="container c02-hero"><div class="c02-hero-copy"><p class="eyebrow">First Home Game Plan</p>
    <h1>Know your next step <span>toward your first home.</span></h1>
    <p class="campaign-lede">In a free 20-minute call, we’ll review what you’ve already done, work through what’s still unclear, and put your next steps in order.</p></div>
    <div class="c02-video" id="video">${video}</div>
    <div class="c02-hero-action"><a class="button primary" href="#booking">${primary}</a><p>A free 20-minute planning call with Evan Karwowski.</p></div></section>
  <section class="c02-section"><div class="container c02-columns"><h2>What you’ll leave with</h2><ol class="c02-outcomes">
    <li><strong>A starting point that fits you.</strong> We’ll look at what you’ve already done, whether that’s saving homes, comparing towns, or talking with a lender.</li>
    <li><strong>Up to three next actions, in order.</strong> For each one, we’ll name who can help and decide what to do first.</li>
    <li><strong>A written recap.</strong> I’ll email your plan within two business days after our call so you have it handy.</li></ol></div></section>
  <section class="c02-section c02-sheet" id="sheet"><div class="container c02-columns"><div><h2>The First Home Next Steps Sheet</h2>
    <p>Start on the page that matches your question. Page two helps you ask a lender for a payment and cash estimate. Page three narrows down which homes are worth touring. On page four, put a date beside your next action.</p>
    <p>You can use the sheet on your own. A call is optional.</p>${pdfLink}
    <details class="c02-email"><summary>Email me the sheet</summary><p>I’ll email a copy personally when I receive your request.</p>${sheetForm}</details></div>
    <figure><a href="${c.pdf}" aria-label="Open the First Home Next Steps Sheet PDF"><img src="${c.preview}?v=4pages" width="560" height="725" loading="lazy" alt="First page of the worksheet: four starting points, a checklist, and space for your timing and main question" /></a><figcaption>Page 1 of 4 · Fillable PDF · Print or save your own copy</figcaption></figure></div></section>
  <section class="c02-section"><div class="container c02-columns"><h2>Before you book</h2><div class="faq-list">${faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>
  ${scheduling(ui,bookingUrl)}`;
  const landing = page({path:c.route,title:c.title,description:'A free 20-minute planning call for first-time buyers, with a worksheet and up to three next actions.',
    cta:'Book my call',href:'#booking',body:'data-campaign-id="C02" data-first-home',footer,content,
    pageStyle:`<style>${style}</style>\n`,pageScript:`<script>{\n${firstHomeAppointment.toString()}\n${bookingJS}\n}</script>\n`,scriptVersion:'c02-durable-intake-v1'});
  const sheetReceipt = page({path:c.sheetThanks, title:'Your First Home Next Steps Sheet', description:'Download the worksheet or return to the First Home Game Plan.', footer,
    noindex:true, cta:'Back to the plan', href:c.route, body:'data-campaign-id="C02" data-first-home',
    pageStyle:`<style>${style}</style>\n`, content:`<section class="container c02-section"><h1>The First Home Next Steps Sheet</h1>
    <p>If you requested an email copy, I’ll reply personally. You can download the PDF here now.</p>${pdfLink}<p><a href="${c.route}">Return to the First Home Game Plan</a></p></section>`});
  return [[c.route,landing],[c.sheetThanks,sheetReceipt], ...[c.watch,c.book,c.thanks].map(path=>[path,alias(firstHomeAlias(path))])]
    .map(([path,html])=>[path.slice(1)+'index.html',html]);
}
