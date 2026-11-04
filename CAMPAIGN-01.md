# C01: Home Shortlist Review

Built November 2, 2026 from the new Real Estate Funnel Build Pack. This is a separate campaign for Livermore and Pleasanton. Its ID is **C01**, distinct from the older **C1** Brentwood/Oakley comparison offer.

## Pages

| Path | Purpose |
| --- | --- |
| `/compare-homes/` | Ad destination: short name/email request for the free sheet and walkthrough |
| `/compare-homes/watch/` | Worksheet access, worked example, video slot and optional review invitation |
| `/book/home-shortlist/` | 20-minute review request, listings, priorities, representation status and preferred times |
| `/thanks/home-shortlist/` | Review request next steps; no claim that an appointment is booked |
| `/resources/3-home-shortlist-sheet.pdf` | Supplied two-page fillable PDF, preserved unchanged with 22 fields |

Example ad destination after deploying this build to the existing domain:

`https://www.evankrealestate.com/compare-homes/?utm_source=facebook&utm_medium=paid_social&utm_campaign=c01_home_shortlist&utm_content=ad_a`

Change `utm_content` for each creative. Use campaign labels only, never contact details or property addresses in URLs. The five supported UTM fields carry into the walkthrough and review form. Form answers stay in the inquiry, not query parameters or custom Pixel event data.

## Lead and scheduling behavior

Both forms use the shared Worker. It saves the request, then emails Evan through Microsoft 365 and sends the same inquiry to FUB. Each destination retries independently.

The server sends C01 inquiries through Follow Up Boss's documented `POST /v1/events`, type `General Inquiry`. Campaign, route version, request type, preparation details and inquiry-only permission are included in the message. Existing UTMs are preserved in campaign data. See the [FUB events documentation](https://docs.followupboss.com/reference/events-post).

- `Shortlist sheet`: resource requested.
- `Home Shortlist Review`: session requested, or eligibility pending when the visitor has an agent or is unsure.
- These are inquiry notes, not assumed custom CRM fields or automatic pipeline transitions.
- Scheduling retains the existing manual preferred-time process. Evan confirms date, time zone, phone/video details and service scope personally. Phone is optional for an email/video request and required for phone/text contact or a phone meeting.
- The supplied PDF and written example are available immediately on the next page. A return visit works without another signup. Filling or saving the PDF does not upload it to the site.
- Resource email delivery, preparation and recaps remain personal follow-up. No automatic email sender, scheduler, reminders, durable outbox or CRM automation was added. Public copy makes no automatic-email or fixed-turnaround promise.
- The pack's offer becomes worksheet + written walkthrough until the real video is supplied. Its two-business-day promise is omitted per Evan's earlier request.

## Pixel and privacy

Meta Pixel **2061494168135844 remains enabled**, using the existing tracking opt-in, saved rejection and Global Privacy Control handling. Inquiry consent and tracking permission remain separate.

| Event | Trigger |
| --- | --- |
| `PageView` | Page visit after tracking is allowed |
| `Lead`, with `content_category: C01` and `content_name: 3 Home Shortlist Sheet` | Accepted resource request with a matching fresh receipt |
| `HomeShortlistReviewRequested` (custom event), with `campaign_id: C01` | Accepted review/time request with a matching fresh receipt |

A direct visit, invented `submitted=1` URL, refresh, stale receipt or cross-campaign receipt does not create a conversion. A review request does not emit `Schedule` or another resource `Lead`. A confirmed booking does not exist in this manual workflow.

The existing privacy links, collection notice, inquiry consent, cookie controls, brokerage/DRE and Equal Housing disclosures are shared. No ads, audiences or account action plans were configured. Check FUB action plans before traffic: this inquiry alone does not authorize automated marketing texts, calls or nurture email.

## Add the real video

Place the authorized recording, poster and captions in `media/campaigns/`. Replace `videos['home-shortlist']` in `scripts/campaign-config.mjs` with a complete local-video object using the same schema as the other campaigns, including an accurate transcript. The current value is `null`, showing Evan's portrait and a clear video-coming-soon message beside the usable written alternative.

Run `npm run build`. The generator validates local video/poster/caption files. Update the FAQ and offer copy to match the actual recording before using ads that promise it. The scenic sample clip used by older pages is not this campaign's instructional video.

## Before paid traffic

1. Deploy the generated pages and worksheet to the existing site. GitHub Pages serves static files; the server-side FUB endpoint requires the separate backend described in `README-FIRST.md`.
2. Check that both deliveries are accepted. Receipt in one service does not establish receipt in the other.
3. Test one authorized inquiry on the deployed site and verify arrival, C01 attribution and permission in the intended inbox/CRM. Automated tests use stubbed services and create no real leads. Verify the Pixel in Events Manager too.
4. Add the recording before running video-promising ads, or accurately offer the worksheet and written example currently available.
5. Confirm the introductory review scope with WR Properties and resolve existing representation before personalized work. Ongoing services and negotiable fees are separate.

## Personal resource follow-up draft

Subject: Your 3 Home Shortlist Sheet

Thanks for requesting the sheet. Download it and see the worked example here:
https://www.evankrealestate.com/compare-homes/watch/

Start with the two things you most need the home to do. If you would like a second set of eyes on homes in Livermore or Pleasanton, request a free 20-minute Home Shortlist Review here:
https://www.evankrealestate.com/book/home-shortlist/

Evan Karwowski | DRE 02102429
WR Properties | Brokerage DRE 02029047
925-492-7023 | evan@thewowski.com
613 1st Street, Suite 211, Brentwood, CA 94513

Reply if you need help or would prefer no further follow-up about this request.

This is an unsent draft for personal fulfillment, not a configured email sequence.
