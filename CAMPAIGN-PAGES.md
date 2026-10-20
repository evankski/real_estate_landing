# Campaign pages

The campaign library follows the supplied [campaign manual](/Users/evan/Downloads/Evan_Karwowski_Complete_Real_Estate_Campaign_Manual.pdf). Its updated presentation uses the existing green palette with the centered headline, video and prominent action structure of the [Acquisition.com workshop landing page](https://lp.acquisition.com/workshop-sales-4b). Evan confirmed the delivery promise: personalized comparisons, buyer outlines and preliminary seller reviews are due within two business days after the necessary details arrive. A call remains optional.

The main offers place the video and request button on the first screen, followed immediately by the inquiry section. Supporting booking, confirmation, preferences and resource pages share the same typography, compact header and buttons. The main homepage is unchanged. Booking pages put the form beside the introduction on desktop. No autoplay, countdown, invented testimonial or video-watching requirement is added.

## Routes

The generator creates 14 static pages with the current configuration:

| Route | Purpose |
|---|---|
| `/compare/` | C1 Brentwood/Oakley Home Comparison, illustrative sample and request form |
| `/buyer-plan/` | C2 public checklist, emailed-copy request and optional personalized outline |
| `/seller-plan/` | C3 preliminary pricing and preparation plan, sample and request form |
| `/open-house/` | C4 honest empty state and a general property/event inquiry |
| `/thanks/compare/` | Comparison request next steps |
| `/thanks/buyer-plan/` | Checklist access and buyer-plan next steps |
| `/thanks/seller-plan/` | Seller-plan next steps |
| `/thanks/open-house/` | Open-house inquiry next steps |
| `/book/compare/` | Optional 15-minute buyer-call request |
| `/book/buyer-plan/` | Optional 15-minute buyer-call request |
| `/book/seller-plan/` | Optional 20-minute seller-call request |
| `/thanks/booking/` | Explains that a requested time still needs confirmation |
| `/preferences/` | Contact instructions for changing a request or communication preferences |
| `/resources/buyer-checklist/` | Full public checklist with print/save-as-PDF support |

C5 uses **`/compare/?view=sample`**, a sample-first variation of the original offer. It reuses C1's form and fulfillment rather than introducing another service or registration requirement.

Thank-you URLs alone are not proof of a received inquiry, sent resource or booked appointment. The pages preserve that distinction. The checklist is usable without submitting a form.

## Edit and build

- `scripts/campaign-config.mjs` holds shared identity, C1–C3 copy, the nine-item checklist, video configuration, booking links and optional property/event data.
- `scripts/generate-campaigns.mjs` creates the route HTML using the current shared footer and privacy controls. Its `firstScreen` object holds the compact offer headlines, descriptions, CTA labels and delivery summaries; keep these consistent with the full campaign copy.
- `campaigns.css` supplies the campaign layouts and `campaigns.js` handles campaign-specific interactions; the site’s existing styles and lead flow remain shared.

Regenerate after changing campaign configuration:

```sh
node scripts/generate-campaigns.mjs
```

Create the complete public build:

```sh
npm run build
```

The build regenerates the campaign pages and copies permitted public assets into `dist/`. Keep generated HTML in version control alongside its source configuration. GitHub Pages can serve the generated HTML directly; it cannot execute the `/api/leads` backend. See `README-FIRST.md` for the existing server/FUB setup and FormSubmit fallback requirements. This page work does not deploy anything.

## Sample video and replacement

The `videos` keys are `compare`, `buyer-plan`, `seller-plan`, `thanks`, and `open-house`. The three offer pages currently use the same real, playable sample clip. Its configuration includes `demo: true`, source credit and a transcript that identifies it as a sample. It is scenic stock footage, not Evan's sales presentation. `thanks` and `open-house` remain `null`.

The sample is a 12-second silent excerpt of [View Of The Sea And Waves Crashing by Mark Hajewski](https://www.pexels.com/video/view-of-the-sea-and-waves-crashing-2046575/), downloaded from the original Pexels download link on October 20, 2026. The [Pexels License](https://www.pexels.com/license/) permits free website/commercial use and editing; attribution is optional, and credit is retained here and in the configuration. It is licensed stock footage, not a CC0 dedication. Do not imply the photographer endorses the brokerage.

Local files:

- `media/campaigns/sample-coast.mp4`: H.264 MP4, 960 × 540, 24 fps, 12 seconds, no audio, optimized for progressive playback.
- `media/campaigns/sample-coast-poster.jpg`: a genuine frame extracted from the same footage at one second.
- `media/campaigns/sample-coast-en.vtt`: identifies the silent footage and absence of dialogue.

The original source file was downloaded from `https://videos.pexels.com/video-files/2046575/2046575-hd_1920_1080_30fps.mp4`; the local demo is trimmed, scaled and compressed. It contains no external embed or tracking service.

For Evan's actual VSL, place the authorized recording, genuine poster and accurate captions in `media/campaigns/`. Replace the complete relevant video object in `scripts/campaign-config.mjs` so the sample flag, source credits and sample transcript do not carry over:

```js
compare: {
  src: '/media/campaigns/home-comparison.mp4',
  poster: '/media/campaigns/home-comparison-poster.jpg',
  captions: '/media/campaigns/home-comparison-en.vtt',
  transcript: 'The complete, accurate words spoken in this recording.',
  title: 'How I prepare your home comparison',
},
```

The replacement filenames above are examples, not provided media. The generator requires existing local files under `/media/campaigns/`: `.mp4` or `.webm` video, `.jpg`, `.png` or `.webp` poster, and `.vtt` captions. Filenames must begin with a letter or digit and use only letters, digits, periods, underscores or hyphens. Use lowercase extensions. External video URLs and nested media directories are not supported. The transcript is required plain text, not HTML or a path.

Regenerate and check the controls, captions, transcript and mobile layout with the actual recording. The full offer, sample and form must remain usable without playing it.

## Open-house configuration

`openHouse` remains `null` because no specific authorized property or event was supplied. `/open-house/` says that no event is announced; it does not invent inventory or registration requirements.

The documented schema in `scripts/campaign-config.mjs` covers the slug, address, city, price, property type, verified features, event start/end with timezone, checked-at time, listing attribution, public access/parking details, walk-in policy, authorized photos and authorization confirmation. Supply verified information and permission before enabling it. A configured event adds `/open-house/{slug}/` as a fifteenth page. Never include lockbox codes or private access instructions.

Check the listing role, event status and media rights before publication; update or remove stale event material promptly. A request does not reserve the property or automatically confirm a tour.

## What remains manual

- No booking provider or live calendar was supplied. The `/book/` pages collect a time request; Evan confirms availability afterward. They do not reserve a slot or synchronize calendars.
- The C2 emailed checklist is a request for Evan to fulfill personally. There is no automatic resource email/attachment service. A personalized outline is requested only when the visitor selects its separate unchecked option.
- `/preferences/` offers direct contact instructions; it is not an authenticated CRM preferences portal.
- The existing secure lead endpoint and its documented fallback handle inquiries. This work does not add the manual’s broader durable outbox, CRM reconciliation worker, calendar webhooks or reminder system.
- No ads, retargeting audiences, marketing sequences or external accounts are launched or configured by these pages.

Before paid traffic, verify the real deployed form-to-inbox/CRM path and Evan’s fulfillment process. Add real videos and booking integration when available; do not substitute “sent,” “booked” or “delivered” claims for actions the system has not completed.
