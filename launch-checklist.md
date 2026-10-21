# Website compliance review and advertising launch checklist

Reviewed October 19, 2026. This review covers the local homepage, 13 area guides,
four policy pages, thank-you page, browser code, inquiry endpoint, and planned
US housing advertising. The site is still plain HTML/CSS/JavaScript and supports
GitHub Pages. This is a documented risk review and set of implementation fixes,
not a legal opinion, certification, or guarantee against claims.

Evan authorized Meta Pixel activation on October 20, 2026. The current code
loads it only after a fresh visitor opt-in and sends PageView and accepted-inquiry
Lead events. Saved opt-outs and GPC remain honored. The inquiry form requests
permission for a response only. Before paid advertising or automated follow-up, resolve the
business and account checks below with WR Properties and, where necessary,
California privacy/advertising counsel. Website disclaimers do not replace
lawful targeting, consent, service delivery, or data handling.

## Owner decisions confirmed October 20, 2026

- Meta Pixel is enabled at Evan's explicit request, with tracking off until the
  visitor accepts. This supersedes the earlier local instruction to keep it
  paused; it does not verify account settings or authorize marketing follow-up.

- Paid ads will target the **United States only**. This confirms the planned
  campaign geography; it does not prevent people elsewhere from visiting.
- Automatic texts, automated or prerecorded calls, drip emails, and call
  recording remain **undecided**. The current website collects inquiry-response
  permission only. No FUB account settings have been inspected or changed;
  verify that this lead source does not trigger marketing automation before
  sending live inquiries into FUB. Revisit consent and opt-out handling when
  the intended workflow is chosen.
- WR Properties has **not provided guidance yet** on privacy, advertising
  approval, or California privacy requests. Brokerage review remains pending;
  the absence of supplied instructions is not confirmation of approval.

## Changes completed in the local source

Campaign expansion on October 20 adds three offer pages, their confirmation and
manual scheduling pages, a public printable buyer checklist, a communication
preferences page, and an open-house hub/template. Campaign copy emphasizes prompt
personal follow-up without a fixed delivery deadline, at Evan's request.
There is no booking-provider link yet: scheduling forms request preferred times
and require Evan's personal confirmation. Checklist email copies and
personalized work are fulfilled personally, not by a newly added autoresponder.
The offer pages include a locally hosted sample video; Evan's final videos and
authorized property/event details remain to be supplied. See `CAMPAIGN-PAGES.md`
for routes and configuration instructions. These page additions do not activate
ads, FUB marketing rules, call recording, or a calendar. Pixel activation is the
separate October 20 owner decision documented above.

- Verified agent DRE 02102429 and responsible broker Winning Results Realty,
  Inc., DRE 02029047, doing business as WR Properties. Preserved that identity
  across all 19 pages; increased mobile header disclosures to 12px. Kept only
  Evan's requested public phone, 925-492-7023.
- Changed the biography fact to “First licensed in 2019,” added negotiable
  compensation and before-tour buyer-agreement explanations, and clarified
  that an inquiry is not a representation agreement.
- Added a Notice at Collection before the form fields. Expanded privacy/cookie
  notices to match actual recipients, data categories, uses, retention criteria,
  browser storage, rights requests, GPC, and the different older DNT signal.
- Initially paused Meta during the October 19 review. Enabled optional
  measurement October 20 at Evan's request using a fresh v3 preference key;
  v2/v1 opt-outs remain honored and old opt-ins are ignored. Persistent GPC,
  visible browser status, cross-tab revocation and privacy controls remain.
- Limited the form's permission to the selected contact method for the inquiry.
  Both email delivery and FUB record the consent version and wording. The FUB
  message explicitly says marketing permission was not collected; server
  validation rejects an unknown consent version. **This note does not itself
  disable FUB automation rules.**
- Improved form-boundary contrast, focus indicators on dark sections, mobile
  menu scrolling, and navigation without JS. Privacy controls are an inline
  panel so they do not cover focused content. The accessibility statement makes
  no certification or complete-conformance claim.
- Clarified purchase reassessment and supplemental-tax risks in the Brentwood
  and Oakley guides. No income question, loan application, fabricated review,
  star rating, production statistic, or guaranteed result is present.

## Open decisions before launch

| Check | Current status and required action |
| --- | --- |
| WR supervision and policies | Evan confirmed October 20 that WR has provided no guidance yet. Have WR review these pages, services promised, disclosure placement, lead handling, privacy-request responsibilities, and actual ad creative. |
| Automated follow-up | Evan confirmed October 20 that automatic texts, automated or prerecorded calls, drip emails, and call recording are undecided. Website consent remains inquiry-only; FUB account settings are unverified. Keep this source out of marketing automation until the workflow and appropriate consent are approved. |
| Privacy-law coverage | Determine whether Evan, WR, or the relevant combined business meets CCPA/CPRA applicability criteria. Do not infer coverage from this website's traffic alone. Also inventory actual disclosures over the prior 12 months; source code cannot establish that history. |
| Privacy operations | Assign responsibility for access/correction/deletion/opt-out requests, identity verification, authorized agents, deadlines, provider coordination, and suppression records. If covered and not exclusively online, check the toll-free request-channel requirement; the published 925 number is not toll-free. |
| Retention and providers | Adopt an actual category-based retention/deletion schedule and configure FUB, email, host logs and backups accordingly. Review contracts and provider uses. FormSubmit's public policy does not establish a detailed retention/deletion schedule; verify it or choose an approved alternative before relying on it for an ad campaign. |
| Meta | Enabled October 20 at Evan's request, with visitor opt-in required for PageView and accepted-inquiry Lead events. Account ownership/settings and separate integrations remain unverified. See facebook-pixel-setup.md for checks; activation is not evidence that the account was inspected. |
| Market/geography | Evan confirmed October 20 that paid ads will target the United States only. Check that campaign settings match this decision. Actual visitors and activities can still create other state/country obligations; review again before expanding targeting. |
| Hosting and delivery | These changes are local, not deployed. Verify the live HTTPS site, domain, published policies, consent behavior and actual delivery after publishing. The live www domain could not be fetched by the research tool; that result alone does not establish an outage. |

## California real estate and advertising

Keep the licensed identity and required DRE identification on first-contact
materials, including each paid creative. License-number type must be no smaller
than the smallest type in that advertisement. Do not rely on the destination
page footer to repair a missing ad disclosure. Broker/team-name rules have
specific contexts; an individual name is not automatically a registered team
name. Retain the reviewed version of each ad and landing page.
Sources: [DRE advertising guidelines](https://www.dre.ca.gov/files/pdf/re27.pdf),
[license disclosure reference](https://www.dre.ca.gov/files/pdf/forms/re559.pdf),
[agent record](https://www2.dre.ca.gov/publicasp/pplinfo.asp?License_id=02102429),
[broker record](https://www2.dre.ca.gov/publicasp/pplinfo.asp?License_id=02029047).

Use brokerage-approved buyer agreements and compensation procedures. The
January 2026 regulations create a rebuttable presumption that an agreement is
practicable before an in-person or virtual showing; they define the applicable
three-month limit as 90 calendar days, with specific exceptions. The website FAQ
is not the agreement. Avoid “standard commission,” “seller always pays,” or a
blanket promise of free buyer representation.
Sources: [DRE adopted buyer-agreement regulations](https://www.dre.ca.gov/files/pdf/relaw/2025/AB2992_Title_10_CalCodeofRegs29061_29063.pdf),
[2026 effective-date list](https://www.dre.ca.gov/files/pdf/relaw/2026/list_of_statutes.pdf).

Review the entire housing campaign: images, copy, audiences, exclusions, lead
qualification and follow-up. Do not select or reject prospects using protected
characteristics or proxies for them. Describe homes and the client's stated
needs, not a preferred demographic resident. An Equal Housing Opportunity line
does not cure discriminatory treatment. Optional price preferences are not
permission to discriminate or ask for protected information.
Sources: [California CRD housing protections](https://calcivilrights.ca.gov/housing/),
[HUD rights and obligations](https://www.hud.gov/stat/fheo/rights-obligations).

Select Meta's **Housing** category for the planned US real-estate campaigns.
Check the current permitted targeting and lead-form questions in the authorized
Ads Manager account; do not work around its restrictions with custom audiences
or demographic proxies. Current detailed Meta Help pages were login-restricted
in this review, so exact available settings, location limits, and question
restrictions remain an account check. Accessible official policy background:
[Meta's ad-fairness announcement](https://about.fb.com/news/2022/06/expanding-our-work-on-ads-fairness/).

## Privacy and communication operations

A published notice must describe actual practice. Apply the collection notice
before collecting data on every new landing page or instant form. Honor both
browser opt-outs and requests connected to a known person; a browser-only
switch does not remove a CRM record or process the person's other requests.
Complete the CCPA applicability assessment and any required prior-year category
disclosures rather than assuming the conditional rights section resolves them.
Sources: [California AG CCPA guidance](https://oag.ca.gov/privacy/ccpa),
[current CPPA regulations](https://www.cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf)
(especially notice, request, verification and opt-out provisions).

FUB is a Zillow brand and distinguishes agent-only customers from people with
an independent Zillow relationship. Do not describe all provider processing as
solely performed on Evan's instructions. Review the actual account agreements,
privacy settings and permitted uses. Limit staff access, use MFA, protect API
keys, and establish secure deletion, incident and privacy-request procedures.
Sources: [FUB privacy notice](https://www.followupboss.com/legal-pages/privacy-notice),
[FormSubmit privacy terms](https://formsubmit.co/privacy.pdf),
[FTC information-security guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).

Before calls or texts, confirm applicable TCPA, DNC, state-law and carrier rules
for the actual technology and campaign. A basic inquiry checkbox is not blanket
permission for automated marketing. If adding a separate marketing opt-in,
make it optional, unbundled from service, specific to the identified sender and
channels, and preserve its exact terms and acceptance record. Implement STOP
and other reasonable revocations across the applicable systems; do not assume a
FUB note or website checkbox implements them. Review recording/transcription
and AI calling separately before enabling them. California confidential-call
recording may require all-party consent.
[California AG recording-law reference](https://www.oag.ca.gov/cyberexploitation/law).
Sources: [FCC calling and texting rule](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200),
[FTC telemarketing guidance](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule).

Keep internal do-not-contact lists and check the applicable National DNC rules.
An inquiry exception for a live follow-up is time-limited and does not override
an entity-specific stop request. Have the broker review any claimed exception
rather than treating a submitted number as unrestricted permission. A January
2026 FCC order delayed one narrow cross-topic revocation provision until
January 31, 2027; it did not suspend consent and revocation requirements generally.
[FCC January 2026 order](https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf).

Commercial email needs accurate sender/subject information, appropriate ad
identification, a valid postal address and an easy opt-out. Honor email opt-outs
within 10 business days and keep the opt-out mechanism available for at least
30 days after the message. Personalizing a marketing email does not automatically
make it exempt. The website privacy link is not a substitute for email-footer
requirements. [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

## Checks when adding new content or features

- **Listings and media:** establish listing authority, seller/listing-broker
  permission, photograph/video rights and the applicable MLS/IDX agreement.
  MLS access alone does not authorize copying images into ads. If adding a feed,
  implement its required attribution, refresh and display rules.
  [Copyright Office photo guidance](https://www.copyright.gov/engage/docs/photography.pdf),
  [NAR competitor-listing guidance](https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/code-comprehension-article-12-display-of-competitors-listings-on-social-media-websites).
- **Altered property photos:** apply California's 2026 disclosure and original-image
  requirements to covered virtual staging or AI edits before publishing. Do not
  hide defects. Ordinary portrait styling is not the property-image case.
  [DRE 2026 AI advisory](https://www.dre.ca.gov/Licensees/Advisories/Advisory_2026_03_17_AI_in_California_Real_Estate.html).
- **AI-assisted work:** verify summaries against source disclosures, preserve
  confidential client information, and use only broker-approved tools and data
  practices. Do not use automated outputs to decide housing access or steer
  people by protected traits. The site has no AI chatbot or eligibility engine.
  [DRE AI advisory](https://www.dre.ca.gov/Licensees/Advisories/Advisory_2026_03_17_AI_in_California_Real_Estate.html).
- **Financial offers:** new interest rates, payment or down-payment examples may
  trigger detailed advertising disclosures. Obtain lender/broker review of
  complete terms; a generic disclaimer does not correct a misleading offer.
  [CFPB Regulation Z advertising rule](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/).
- **Partners and referral offers:** before adding lender/title co-marketing,
  affiliate arrangements, referral rewards or giveaways, review the specific
  arrangement for RESPA, licensing, disclosure and advertising requirements.
  Payment for actual services is different from a prohibited settlement-service
  referral kickback; a disclosure alone does not make a prohibited payment valid.
  [CFPB RESPA guidance](https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/real-estate-settlement-procedures-act/real-estate-settlement-procedures-act-faqs/).
- **Reviews and claims:** use real experiences, document permission and factual
  support, disclose material connections, and do not buy positive sentiment or
  fabricate ratings/schema. Check that claims of timing, services and results
  reflect actual practice. [FTC reviews rule](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers).
- **Accessibility:** keep keyboard operation, labels, focus visibility, contrast,
  reflow, meaningful alternative text and captions as content changes. Test with
  assistive technology; no automated or visual check certifies ADA compliance.
  [DOJ private-business web guidance](https://www.ada.gov/resources/web-guidance/),
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Verification and deployment record

Local checks cover form/consent wording, API validation, email fallback, no
unconfirmed lead conversion, opt-in-only measurement paths, persistent
GPC, cross-tab revocation, privacy links, campaign propagation, and source-file
protection. Browser checks cover narrow/mobile privacy controls and keyboard
access to the last menu item in a short landscape viewport. These do not verify
screen-reader behavior exhaustively, provider contracts, account automation,
actual delivery, or a deployed production build.

Before spending on traffic, publish the reviewed static assets, enforce HTTPS,
verify all live policy links and privacy controls, activate and check the chosen
lead-delivery route, and perform one clearly labeled end-to-end test with the
intended FUB routing and campaign settings. Avoid duplicate submissions after
an ambiguous timeout until checking the destination. Keep dated evidence of the
published disclosures, consent text, creative and account settings. Recheck
this checklist when changing vendors, tracking, audiences, forms or offers.
