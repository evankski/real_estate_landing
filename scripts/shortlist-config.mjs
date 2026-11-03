import { worksheetCampaigns } from '../server/worksheet-campaigns.mjs';
// C01 is the November 2026 campaign, distinct from the older C1 /compare/ offer.
// Adapted from the supplied campaign pack. No fixed turnaround or automatic
// email-delivery promise: the current site uses personal follow-up.
export const shortlist = Object.freeze({
  ...worksheetCampaigns.C01,
  duration: 20,
  scope: 'There is no charge for this introductory review. We will clarify any existing agent relationship, the scope of the review, and any required agreements before personalized services. Ongoing representation, services and negotiable fees are discussed separately. A review request does not arrange a property showing.',
  benefits: [
    'Compare up to three saved homes against the same two must haves.',
    'Separate what fits from a mismatch or an unanswered question.',
    'Give the next tour a question worth answering.'
  ],
  faq: [
    ['What do I get right away?', 'The two-page, fillable 3 Home Shortlist Sheet and a written walkthrough open on the next page. You can save or print the PDF. I’ll follow up personally by email.'],
    ['Can you help with my actual homes?', 'Yes. Request a free 20-minute Home Shortlist Review for homes in Livermore or Pleasanton. Share up to three public listing links and your two must haves. We will confirm the time, scope and any existing agent relationship before personalized preparation.'],
    ['Do I need to book a call to use the sheet?', 'No. The worksheet and example are yours to use on your own. A personal review is optional.'],
    ['Am I signing up for marketing messages?', 'No. The form asks for permission to respond to this request only. It does not subscribe you to a newsletter, automated marketing texts or calls. Advertising tracking has its own separate choice.']
  ]
});
