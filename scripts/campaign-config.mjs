// Shared public identity and campaign copy. Keep these details consistent with
// the main site and the current brokerage-approved advertising identity.
export const site = {
  name: 'Evan Karwowski',
  broker: 'WR Properties',
  brokerLegal: 'Winning Results Realty, Inc.',
  agentDre: '02102429',
  brokerDre: '02029047',
  phone: '+19254927023',
  phoneDisplay: '925-492-7023',
  email: 'evan@thewowski.com',
  domain: 'https://www.evankrealestate.com',
  brokerUrl: 'https://www.wrpropertiesre.com/',
  address: '613 1st Street, Suite 211, Brentwood, CA 94513',
};

export const campaigns = {
  compare: {
    id: 'C1',
    title: 'Brentwood & Oakley Home Comparison',
    eyebrow: 'Brentwood + Oakley home search',
    headline: 'Know which homes deserve a closer look.',
    lede: 'Compare up to three homes against your working budget and priorities, with the relevant differences and unanswered questions in one place.',
    cta: 'Request my home comparison',
    requestType: 'Home comparison',
    interest: 'Buying a home',
    delivery: 'I will follow up promptly to understand your priorities and get your comparison started. A planning call is optional.',
    summaryTitle: 'A useful comparison starts with your priorities.',
    summaryBullets: [
      'Up to three available options, including homes you send when appropriate.',
      'Relevant facts, trade-offs, and questions that still need checking.',
      'A practical next step, whether that is a closer look or a change to the search.',
    ],
    process: [
      {
        title: 'Tell me what matters.',
        text: 'Share your preferred area, working budget, timing, and top two priorities. You can include homes you have already saved.',
      },
      {
        title: 'I organize the comparison.',
        text: 'I review available information, check current status, and separate supported facts from questions that need more investigation.',
      },
      {
        title: 'Choose the next step.',
        text: 'Review the comparison on your own, or request a 15-minute planning call to talk through it. Any property tour is arranged separately.',
      },
    ],
    faq: [
      {
        q: 'Do I have to book a call?',
        a: 'No. You can receive and review the comparison first. A short conversation is optional.',
      },
      {
        q: 'What if no homes fit my search?',
        a: 'I will explain the mismatch and the choices worth reconsidering. The comparison may include fewer than three homes; I will not fill it with unsuitable options.',
      },
      {
        q: 'Can I send homes I have already found?',
        a: 'Yes. Share the listing links and what you like or want to understand. I will check whether the homes are still available and appropriate to include.',
      },
      {
        q: 'Is this an inspection or an appraisal?',
        a: 'No. It organizes available information and questions for further investigation. Inspections, appraisals, lending advice, and legal advice require the appropriate professionals.',
      },
      {
        q: 'What if I already have an agent?',
        a: 'Please tell me before requesting personalized work. Existing representation can affect what assistance is appropriate.',
      },
      {
        q: 'Does this request hire you as my agent?',
        a: 'No. We would discuss services, duration, and negotiable compensation in a separate written buyer representation agreement before touring homes together.',
      },
    ],
    formTitle: 'What should we compare?',
    formIntro: 'A few preferences will make the comparison useful. If you are unsure about something, say so.',
    thanksTitle: 'Your home-comparison request is received.',
    thanksMessage: 'I will review your preferences and follow up personally as soon as I can to get your comparison started. A planning call is optional.',
    callMinutes: 15,
  },
  'buyer-plan': {
    id: 'C2',
    title: 'Buyer Starting Checklist & Readiness Plan',
    eyebrow: 'Your next step toward buying',
    headline: 'Thinking about buying? Get clear on what to do next.',
    lede: 'Start with the checklist below. You can request an email copy and, if you would like help putting it into practice, a personalized outline of your next three steps.',
    cta: 'Read the buyer checklist',
    requestType: 'Buyer readiness plan',
    interest: 'Buying a home',
    delivery: 'The checklist is available here now. Request an email copy or a personalized outline, and I will follow up with you directly.',
    summaryTitle: 'You do not need every answer to begin.',
    summaryBullets: [
      'A public checklist covering priorities, financing questions, representation, and tours.',
      'An optional outline of three next steps based on what you have already completed.',
      'Room to plan around your timing, including a later check-in if that makes sense.',
    ],
    process: [
      {
        title: 'Start with the checklist.',
        text: 'Read the steps below and identify what you have already done. You can use the checklist without sharing your contact details.',
      },
      {
        title: 'Ask for the help you want.',
        text: 'Request an email copy to keep. You can also choose a personalized outline and tell me what you have already done and what still feels unclear.',
      },
      {
        title: 'Choose a useful next step.',
        text: 'I will respond personally to your request. If you asked for an outline, I will suggest three practical next steps. A 15-minute planning call is optional.',
      },
    ],
    faq: [
      {
        q: 'Do I need to be preapproved first?',
        a: 'No. The checklist can help you prepare for a lender conversation and organize the questions to ask before a more detailed home search.',
      },
      {
        q: 'Will this tell me exactly what I can afford?',
        a: 'No. Your finances and lending options need a separate conversation with a qualified professional. This resource helps you prepare for that conversation.',
      },
      {
        q: 'Do I have to buy soon?',
        a: 'No. Tell me your timeframe so the next steps fit your plans. Waiting or choosing a time to revisit the decision can be reasonable.',
      },
      {
        q: 'Do I have to share my email to use the checklist?',
        a: 'No. The full checklist is available on this page. Use the form if you would like an email copy. You can separately choose a personalized next-step outline.',
      },
      {
        q: 'Is a call or representation agreement required?',
        a: 'A call is optional, and requesting introductory help does not hire me as your agent. Before touring homes together, we would discuss the appropriate written agreement, including services and negotiable compensation.',
      },
    ],
    formTitle: 'Keep the checklist. Ask for more help if you want it.',
    formIntro: 'Request an email copy below. For a personalized outline, select the optional checkbox and tell me what you have already completed and what still feels unclear. Please keep financial documents out of this form.',
    thanksTitle: 'Your checklist request is received.',
    thanksMessage: 'I will follow up personally as soon as I can with your email copy and help with your next steps if you requested a personalized outline. The public checklist is available to read or print now.',
    callMinutes: 15,
  },
  'seller-plan': {
    id: 'C3',
    title: 'Seller Pricing & Preparation Plan',
    eyebrow: 'Brentwood + Oakley seller planning',
    headline: 'Before you list, get a clearer plan for price and preparation.',
    lede: 'Review relevant comparable sales, the questions affecting your pricing discussion, and the preparation decisions worth considering before you commit to a listing plan.',
    cta: 'Request my seller plan',
    requestType: 'Seller pricing and preparation',
    interest: 'Selling a home',
    delivery: 'I will follow up promptly to discuss your property and get your preliminary review started. Some recommendations may require a walkthrough.',
    summaryTitle: 'Make the next decision with better information.',
    summaryBullets: [
      'Relevant comparable sales, with the reasons they matter and the limits of the comparison.',
      'Preparation questions organized by priority and what still needs investigation.',
      'A clear next step toward a plan for your property and timing.',
    ],
    process: [
      {
        title: 'Tell me about the property.',
        text: 'Share the address, your approximate timing, and the decisions you want help making. Include any useful condition or improvement notes.',
      },
      {
        title: 'I prepare an initial review.',
        text: 'I look at relevant sales and available property information, distinguish asking prices from closed sales, and identify what needs a closer look.',
      },
      {
        title: 'Decide what comes next.',
        text: 'Review the plan first, or request an optional 20-minute seller conversation. We can discuss whether an agreed walkthrough would be useful.',
      },
    ],
    faq: [
      {
        q: 'Is this a formal appraisal?',
        a: 'No. It is a preliminary real estate pricing and preparation discussion based on available information. A formal appraisal is a separate service.',
      },
      {
        q: 'Will you guarantee what my home will sell for?',
        a: 'No. Pricing and the outcome depend on the property, market conditions, buyer response, and the agreed strategy. The plan explains the information behind the discussion.',
      },
      {
        q: 'Should I make repairs before requesting a plan?',
        a: 'You do not need to make repairs to request the plan. We can discuss the property before you spend money on assumptions. Some recommendations will need a walkthrough or advice from a qualified specialist.',
      },
      {
        q: 'Do I have to schedule a walkthrough?',
        a: 'No walkthrough is automatically scheduled by this form. I will explain which conclusions are preliminary and whether seeing the property would help.',
      },
      {
        q: 'Does this commit me to listing with you?',
        a: 'No. A listing agreement is a separate decision and document. Services, timing, and negotiable compensation would be discussed before you agree to representation.',
      },
      {
        q: 'What if my home is outside Brentwood or Oakley?',
        a: 'Tell me the location. I will confirm whether I can help with the property or discuss an appropriate next step before preparing the review.',
      },
    ],
    formTitle: 'Tell me about your property.',
    formIntro: 'Start with the address, approximate selling timeframe, and what you want to understand. A request does not commit you to listing.',
    thanksTitle: 'Your seller-plan request is received.',
    thanksMessage: 'I will review your property details and follow up personally as soon as I can to discuss your next steps. Some conclusions may need a walkthrough, which we would arrange separately.',
    callMinutes: 20,
  },
};

// Educational public resource adapted from the manual, pages 62–63.
// Keep the checklist visible without a form submission or video requirement.
export const checklist = [
  {
    title: 'Name the decision you are making.',
    text: 'Are you exploring whether to buy, deciding where to search, comparing homes, or preparing to make an offer? Start with the question in front of you.',
  },
  {
    title: 'Write down your timing.',
    text: 'Separate a firm deadline from a preference. Include a current lease or sale that affects your plans, and note what could change your timing.',
  },
  {
    title: 'Choose two or three home priorities.',
    text: 'Identify what is essential and what you might trade for the right property or location. Focus on what you need from the home.',
  },
  {
    title: 'Prepare for a financing conversation.',
    text: 'If needed, ask a qualified lender about the application process, current options, documents, and approval limits. Use the lender’s secure channel for financial documents.',
  },
  {
    title: 'Look beyond the asking price.',
    text: 'Ask the appropriate professionals about down payment, closing costs, reserves, insurance, taxes after a purchase, HOA charges, and maintenance. The listing price is not the full cost.',
  },
  {
    title: 'Understand representation before signing.',
    text: 'Ask how services, responsibilities, compensation, duration, and termination are documented. Compensation is negotiable; do not assume a fixed rate or that another party will pay it.',
  },
  {
    title: 'Compare homes with your priorities.',
    text: 'Record what is verified, what is uncertain, and what could change your decision. Use current information alongside the listing photos.',
  },
  {
    title: 'Prepare for a useful tour.',
    text: 'Agree on the appropriate representation and showing arrangements, confirm access, and bring your questions. A tour does not replace inspections or disclosure review.',
  },
  {
    title: 'Choose one next action.',
    text: 'It might be a lender conversation, a narrower search, a home comparison, or a later check-in. Waiting can be a reasonable next step.',
  },
];

// The three offer pages currently share a clearly identified stock demo.
// Replace the demo with Evan's actual recording when available.
// Video object:
// { src, poster, captions, transcript, title }
// src: /media/campaigns/safe-filename.mp4 (or .webm).
// poster: /media/campaigns/safe-filename.jpg (or .png / .webp).
// captions: /media/campaigns/safe-filename.vtt for accurate English captions.
// Each file must exist locally. The generator permits only this directory and
// filenames beginning with a letter or digit, followed by letters, digits,
// periods, underscores or hyphens. Use lowercase file extensions.
// External video URLs, nested paths and hosted-video embeds are not supported.
// transcript: required complete plain-text transcript, not HTML or a file path.
// title: descriptive accessible title for the recording.
// Do not load an empty iframe or show a functional-looking play control for null.
const sampleVideo = {
  src: '/media/campaigns/sample-coast.mp4',
  poster: '/media/campaigns/sample-coast-poster.jpg',
  captions: '/media/campaigns/sample-coast-en.vtt',
  transcript: 'Sample video only. Twelve seconds of silent stock footage show ocean waves moving along a rocky coastline. There is no dialogue or audio. This demonstrates the video player; Evan’s explanation of the offer will replace it.',
  title: 'Sample video: coastal footage',
  demo: true,
  durationSeconds: 12,
  creditLabel: 'Mark Hajewski / Pexels',
  creditUrl: 'https://www.pexels.com/video/view-of-the-sea-and-waves-crashing-2046575/',
  licenseUrl: 'https://www.pexels.com/license/',
};

export const videos = {
  compare: { ...sampleVideo },
  'buyer-plan': { ...sampleVideo },
  'seller-plan': { ...sampleVideo },
  thanks: null,
  'open-house': null,
};

// Evan has not supplied a booking provider. Until a real URL is configured,
// pages should offer a call request and explain that the time is confirmed later.
export const bookingLinks = {
  compare: null,
  'buyer-plan': null,
  'seller-plan': null,
};

// No property or event is currently supplied or authorized.
// Future openHouse object (verify every field before publishing):
// {
//   slug: 'verified-property-slug',
//   address: 'verified street address',
//   city: 'verified city',
//   price: 0, // actual advertised USD price as a number; null if not displayed
//   propertyType: 'verified property type',
//   features: ['verified feature'],
//   eventStart: 'ISO 8601 datetime with explicit local UTC offset',
//   eventEnd: 'ISO 8601 datetime with explicit local UTC offset',
//   checkedAt: 'ISO 8601 datetime when status/details were verified',
//   listingAttribution: 'required listing firm/agent attribution and hosting role',
//   access: 'public arrival/parking information; never lockbox codes',
//   walkIns: true, // only if verified; do not invent a registration requirement
//   photos: [{ src: 'authorized image URL/path', alt: 'accurate description' }],
//   authorizationConfirmed: true
// }
// A valid object is not itself permission to publish: authorization must cover
// the listing, event, advertising and media. Never render this schema as a listing.
export const openHouse = null;
