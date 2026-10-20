# Evan Karwowski real estate website

The public site is plain HTML, CSS, and JavaScript. A small server endpoint sends
qualified inquiries to Follow Up Boss. There are no application dependencies.

## GitHub Pages

The website still runs on GitHub Pages as ordinary HTML, CSS, and JavaScript.
No Node server, npm command, or compilation is needed to display the published
pages. `npm run dev` is an optional local preview server; `npm run build` only
copies the public files into `dist/` for deployment tools that need that folder.

GitHub Pages cannot run the FUB API endpoint. On a static host, an absent endpoint
(404) or unsupported POST (405) sends the form through the existing FormSubmit
email route to `evan@thewowski.com`. That email service must be activated for the
recipient. Direct FUB delivery requires a separately hosted endpoint that keeps
the API key private. The included Cloudflare Worker can handle that endpoint
and the website; moving the static website is not a requirement for using FUB,
but a separate endpoint would need its URL and origin settings connected.

Opening `index.html` directly is sufficient to view the design. Use an HTTP
preview or the published website to check form submissions.

## Preview locally

Use Node.js 22 or later:

```sh
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:4173`. The local server binds only to the loopback interface.
Set `PORT` in `.env` to use another port.

The server loads `.env` with Node's native environment-file reader. Add your
Follow Up Boss API key to `FUB_API_KEY` when ready. Never paste that key into
`script.js`, HTML, a public config file, or a Git commit. `.env` is ignored by Git
and cannot be served by the preview server or copied into the public build.

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
The lead source is `evankrealestate.com`.

Set `FUB_SYSTEM` to your integration's system name. It defaults to
`EvanKarwowskiWebsite`. If your FUB integration has a registered system key, set
`FUB_SYSTEM_KEY` too; it is sent only in the server's `X-System-Key` header.
FUB's documentation asks integrations to register a system and supply its
assigned `X-System` and `X-System-Key` headers. Use your existing registration,
or complete that setup with FUB when activating this integration.

Without `FUB_API_KEY`, the endpoint returns HTTP 503 with code `NOT_CONFIGURED`
and sends nothing to FUB. Only FUB HTTP 200 or 201 counts as delivered.
FUB 204 means the lead source was archived and ignored, so the site treats it
as failure. The endpoint has a ten-second upstream timeout, does not retry an
ambiguous delivery, and never returns FUB contact records or secret details.

The existing FormSubmit email route to `evan@thewowski.com` remains a fallback
when the endpoint is absent, rejects POST as unsupported, or explicitly reports
`NOT_CONFIGURED`. Once the API
is configured, leads use FUB. FUB's Lead Flow controls assignment and any follow-up
actions; review existing action plans and source configuration before activating
API delivery. As of October 20, 2026, Evan has not decided whether to use
automated follow-up or call recording, and no FUB account settings have been
inspected or changed as part of this website work.
The server does not silently switch to another provider after an ambiguous
network failure or a FUB delivery error.

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

Connect `evankrealestate.com` and `www.evankrealestate.com` to this Worker in
Cloudflare so assets and API share the intended domain. `wrangler.jsonc` binds
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

Meta Pixel is paused by default (`metaPixelEnabled: false` in `script.js`).
The browser preserves opt-outs, honors Global Privacy Control persistently,
and does not reuse legacy opt-ins. Footer controls show the current status.
See `facebook-pixel-setup.md` before enabling measurement; update the policy
wording and verify account settings as part of that change.

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
