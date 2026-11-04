# Evan Karwowski real estate website

The public site is plain HTML, CSS, and JavaScript. A small server endpoint sends
qualified inquiries to Follow Up Boss. There are no application dependencies.

## GitHub Pages

The website still runs on GitHub Pages as ordinary HTML, CSS, and JavaScript.
No Node server, npm command, or compilation is needed to display the published
pages. `npm run dev` is an optional local preview server. `npm run build`
regenerates the campaign HTML from its shared copy/template and copies the public
files into `dist/` for deployment tools that need that folder. The generated HTML
is also saved in the repository, so GitHub Pages can serve it directly.

The campaign pages, video slots, and manual scheduling setup are documented in
[CAMPAIGN-PAGES.md](CAMPAIGN-PAGES.md). Edit `scripts/campaign-config.mjs` for offer
copy and future videos; edit `scripts/generate-campaigns.mjs` for shared markup.
Run `npm run build` after those edits and include the regenerated HTML in your
next commit. `campaigns.css` and `campaigns.js` supply the shared presentation
and optional browser enhancements.

GitHub Pages serves the public forms. Each posts directly to the same Cloudflare Worker at the `websiteIntakeUrl` in `scripts/campaign-config.mjs` (the homepage HTML action must match). The Worker uses the existing Microsoft 365 mailbox and FUB credentials; no keys are included in the static files. The archived `/old/` URL leads to the current homepage form.

Use an HTTP preview or the published website to view the full site and check
form behavior. Campaign pages use root-relative URLs for their shared assets.

## Preview locally

Use Node.js 22 or later:

```sh
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:4173`. The local server binds only to the loopback interface
and restarts when its server code changes. Run `npm run build` after editing page
templates and refresh your browser for the updated HTML.
Set `PORT` in `.env` to use another port.

The Node preview validates submissions locally without sending email, creating a CRM record, or counting a lead conversion. Enable JavaScript for the local preview; native posts to the public endpoint are blocked here. Use sample details. The private delivery queue runs on the Worker, not the Node server. Store production credentials in Worker secrets, never in HTML, browser scripts, or the repository.

## Follow Up Boss integration

The browser submits JSON to `/api/leads`. The server validates the name, email,
interest, contact permission and its current text version, allowed selections,
field lengths, and honeypot.
A phone number is required when the visitor chooses a call or text. It then
sends a `General Inquiry` to `POST https://api.followupboss.com/v1/events` using
HTTP Basic authentication with the API key as username and an empty password.

Name, email, and phone map to the contact. The inquiry message records the
requested service, area, budget, timeline, preferred contact method, listing
link or question, consent version, received time, and campaign context.
It does not infer income, lending eligibility, or marketing consent.
The current inquiry-only consent wording is recorded with the inquiry. FUB
automation settings must be reviewed separately: a note stating that marketing
permission was not collected does not prevent an existing action plan from running.
UTM source, medium, campaign, term, and content map to the FUB campaign object
when a UTM source is present; partial attribution stays in the message.
The FUB lead source is `Website`. Recognized campaign forms and paid ad
traffic receive server-generated acquisition tags. See [C02 attribution and ad links](CAMPAIGN-02.md#fub-tags-and-advertising-links).

Set `FUB_SYSTEM` to your integration's system name. It defaults to
`EvanKarwowskiWebsite`. If your FUB integration has a registered system key, set
`FUB_SYSTEM_KEY` too; it is sent only in the server's `X-System-Key` header.
FUB's documentation asks integrations to register a system and supply its
assigned `X-System` and `X-System-Key` headers. Use your existing registration,
or complete that setup with FUB when activating this integration.

Every submitted lead is saved before the browser receives an acknowledgment. The same private queue handles homepage inquiries, comparisons, buyer and seller plans, open-house requests, worksheet requests, and appointment requests. Microsoft 365 emails the submitted details to `evan@thewowski.com`, with the visitor as Reply-To. FUB gets the corresponding event using the same `FUB_API_KEY`. Only C02 phone appointments include a dated Outlook calendar draft; an inquiry or preferred time is not a confirmed appointment.

The two deliveries retry independently. Microsoft must return HTTP 202; FUB must return 200 or 201. A missing key, inactive source, or provider outage keeps the outstanding delivery pending. Retrying the same submission does not create a second job. A provider can accept a message yet lose the response; check the reference if two emails arrive. Once both deliveries are accepted, only a seven-day duplicate-prevention marker remains in the queue. [Microsoft setup and verification](CAMPAIGN-02.md#turn-on-appointment-email).

The standard HTML contact and resource forms also submit directly to that Worker without JavaScript. No external form relay is used. Contact preferences, privacy requests, and self-guided checklist checkboxes do not enroll visitors in the CRM. FUB’s own lead-flow and automation settings remain under your control.

Production form requests are accepted from `https://evankrealestate.com` and
`https://www.evankrealestate.com`. Local requests must use the same loopback
origin and port as the server. No wildcard CORS is enabled. If adding another
production domain, explicitly update the origin allowlist in
`server/lead-handler.mjs`.

Official references:

- [Sending leads with events](https://docs.followupboss.com/reference/events-post)
- [API authentication](https://docs.followupboss.com/reference/authentication)
- [System registration and identification](https://docs.followupboss.com/reference/identification)
- [Lead provider integration guide](https://docs.followupboss.com/docs/lead-provider-integration-guide)

## Build and checks

```sh
npm test
npm run build
```

Tests use mocked FUB responses and never send external leads. They cover
validation, consent, origin checks, campaign mapping, upstream failures and
timeouts, secret handling, and private-file/path-traversal protection.

`npm run build` creates `dist/` from an explicit public-file allowlist:
the live HTML pages, stylesheet, browser script, favicon, robots/sitemap,
portrait images, and `areas/*.html`. It excludes `.env`, server code,
documentation, and `old/`. Add any future public assets to
`server/public-files.mjs` before building.

## Hosting the API with Cloudflare Workers

**GitHub Pages alone cannot run `/api/leads`.** It can serve the static pages,
but API delivery requires backend hosting. The included Cloudflare Worker serves
both the built public assets and the same `/api/leads` handler. This project has
not been deployed, and no API key has been added.

When ready, use the Cloudflare account intended to own the site:

```sh
npm run build
npx wrangler login
npx wrangler secret put FUB_API_KEY
```

Enter the key at Wrangler's prompt so it does not appear in a shell command.
If using an existing registered FUB system, set its system name in
`wrangler.jsonc` and add the system key with:

```sh
npx wrangler secret put FUB_SYSTEM_KEY
```

Deploy when you intend to publish:

```sh
npx wrangler deploy
```

Keep the public site on GitHub Pages and deploy the Worker for intake. `wrangler.jsonc` binds
`dist/` as `ASSETS` and runs the Worker first for `/api/leads` and the homepage.
The homepage maps to `index.html`; other HTML pages keep their existing `.html`
URLs, matching their canonical links and sitemap.
Preview Worker domains are deliberately not in the production form-origin
allowlist. The Node preview supports local form validation without changing it.

After adding the real key and domain, submit one clearly labeled test inquiry
and verify it appears under the correct FUB source and agent with its
qualification answers and campaign fields. Local mocked tests cannot confirm
your account's credentials, routing, or delivery. Avoid repeating a real test
after a timeout until checking FUB for the original inquiry.

## Public details and privacy choices

Brokerage attribution is WR Properties / Winning Results Realty, Inc.,
CA DRE #02029047. Evan's CA DRE number is 02102429.
Update the sitemap and canonical URLs if the domain changes.

Evan authorized Meta Pixel activation on October 20, 2026.
`metaPixelEnabled: true` enables measurement only after a visitor chooses
**Allow tracking**. The site sends PageView and delivery-service-accepted
inquiry Lead events; it does not add form answers to those event parameters.
The v3 tracking preference requires a fresh opt-in, preserves v2/v1 opt-outs,
and honors Global Privacy Control persistently. Footer controls show the
current browser status. This choice does not authorize marketing follow-up.
See `facebook-pixel-setup.md` for the implementation and account checks.
Activation does not establish Meta account ownership, settings or live receipt.

The October 19, 2026 review, completed fixes, sources, and open business-side
checks are in `launch-checklist.md`. The review is not legal certification.
Privacy-request handling, retention settings, communications consent, brokerage
approval, and live deployment still require the listed operational checks.

## Design and future ad pages

The homepage, 13 area guides, policy pages, and thank-you page share `style.css`
and `script.js`. The visual system uses pale stone, deep green, restrained lime
accents, a large typographic scale, and Evan's existing portrait. Public copy is
based on Evan's supplied biography and services; no reviews, sales totals, or
continuous years-in-practice claims are fabricated. The only public direct
phone is 925-492-7023.

The main offers are a buyer home comparison and a seller pricing report.
Contextual links can preselect the inquiry form, for example:

- `/?intent=buy&area=Pleasanton#contactForm`
- `/?intent=sell&area=Brentwood#contactForm`

Add standard `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and
`utm_term` parameters for campaign attribution. Campaign parameters follow same-site links, so exploring an area guide does
not lose the campaign before an inquiry. They are not stored as a browsing
history or attached to external links. A future focused ad page can reuse the form markup, styles,
and script, with `data-page-intent="buy"` or `"sell"` on its body. Register any new
page in `server/public-files.mjs` so it is included in hosting builds.
