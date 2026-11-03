# C02 · First Home Game Plan

The ad destination is `/first-purchase/`. The video area, offer, and worksheet are public. The main action is **Book My First Home Game Plan**. The free call lasts 20 minutes. Evan emails a written recap within two business days **after the call**.

- The public page opens without a form. The booking button jumps directly to the five short preparation questions. A buyer can choose “Still exploring,” “Not yet,” or an existing agent relationship and continue.
- The old `/first-purchase/watch/` link redirects to the public page. `/book/first-home-plan/` and `/thanks/first-home-plan/` open that page at `#booking`. Node and the Worker redirect before rendering. Static hosting uses a small redirect page. Incoming query parameters survive, including Meta click IDs. The JavaScript-disabled static fallback links to the same destination without its query.
- **Email me the sheet** sends a separate inquiry through the existing lead API. FUB receives the inquiry when configured, otherwise the existing FormSubmit relay sends it to Evan. Evan personally sends the buyer the PDF. There is no outbound email integration to deliver it automatically. The enhanced form acknowledges an accepted request in place. The native form returns to `/first-purchase/sheet-request/` with the download.
- **Request my 20-minute call** saves the validated request in private Cloudflare storage before replying. The buyer can close the page once they see “Your request … is saved.” Evan still personally confirms the appointment. If the internet connection drops before acknowledgment, the form retries automatically while open. Resubmitting the same details maps to the same request.
- An independent background job sends the buyer’s callback number, preparation answers, date, time zone, ad attribution and Outlook draft to **evan@thewowski.com**. It also sends the tagged FUB inquiry if the key was present at intake. Email runs independently of FUB. Unavailable destinations retry after 30 seconds with increasing intervals up to one hour. Successful destinations aren’t deliberately resent if the other fails. A provider timeout after acceptance can result in a second copy; the reference identifies the same request. Earlier requests aren’t backfilled into FUB when a key is added later.
- The canonical worksheet at `/resources/first-home-next-steps-sheet.pdf` is the exact four-page attachment, with 56 fillable fields. Its SHA-256 is `1b3297881a529d188bc82de18ea5e70094cec426b5afe9310c5fe752b179b44b`. The visible preview is rendered from page one. The completed PDF stays with the buyer.

## Turn on appointment email

Use the existing Microsoft app with Evan’s GoDaddy Microsoft 365 mailbox. Evan's inbox receives the request. Reply goes to the buyer. The Outlook link opens a draft for Evan to review and send. Follow these steps in order. The website and Worker are separate deployments.

1. **Install the admin tools on your Mac.** Open Terminal and run the commands below, one line at a time. A prompt about the PowerShell Gallery (PSGallery) is for the Microsoft Exchange module. [Homebrew PowerShell](https://formulae.brew.sh/formula/powershell) · [Microsoft Exchange module](https://learn.microsoft.com/en-us/powershell/exchange/exchange-online-powershell-v2?view=exchange-ps).

   ```sh
   cd "/Users/evan/Documents/real_estate_landing_basic"
   brew install powershell
   pwsh -NoProfile -Command 'Install-Module ExchangeOnlineManagement -Scope CurrentUser -Repository PSGallery'
   ```

2. **Grant send access for your mailbox.** In Entra, open Enterprise apps → your First Home Game Plan app → Permissions. A separate tenant-wide application mail grant would add to the Exchange grant. For this dedicated app, verify there is no other application grant for mail or calendars. You don't need to add Microsoft Graph permissions or turn on SMTP. In the same Terminal, run:

   ```sh
   pwsh -NoProfile -File ./scripts/c02-authorize-mail.ps1
   ```

   Sign in as `evan@thewowski.com`. The script checks the tenant, verifies the recipient filter matches only Evan, creates the Exchange reference and assigns **Application Mail.Send** to that mailbox. It uses the app, directory and enterprise Object IDs supplied earlier. Look for `Application Mail.Send` and `InScope True` for Evan. The script checks a second mailbox if one exists and stops on a conflicting assignment. If Microsoft denies a command, save the command name and error text. [Microsoft’s scope and permission guide](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

3. **Create the app credential.** In Microsoft Entra → App registrations, open the First Home Game Plan app (client ID `05985af6-cf25-47c3-b126-b7f3d89e86d6`). Under **Certificates & secrets → Client secrets → New client secret**, name it `C02 appointment email`, choose an expiry and click **Add**. Save the **Value** in your password manager immediately and set a reminder before expiry. Keep the value out of chat, GitHub, the site, and command-line arguments. The current sender uses a client secret. Microsoft recommends a certificate or federated credential for production hardening. [Microsoft credential instructions](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials).

4. **Send one test before publishing.** In the project folder, run this exact command. Paste the secret **Value** at the masked prompt and press Return:

   ```sh
   pwsh -NoProfile -Command 'Read-Host -MaskInput "Microsoft app secret Value" | node ./scripts/c02-test-mail.mjs; exit $LASTEXITCODE'
   ```

   Open Evan’s Outlook inbox and look for a subject starting with `[C02 TEST]`. Check Junk as well. Open the Outlook draft to inspect the requested time and close it. This test addresses only Evan, bypasses FUB and does not book a meeting. Microsoft accepting the message and it arriving in the inbox are separate checks. `MS_TOKEN_401` usually means the credential was rejected. For `MS_SEND_403`, check step 2 and allow for Exchange permission propagation (Microsoft documents 30 minutes to two hours) before retrying. [Microsoft sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

5. **Publish the form backend when ready.** From the same project folder, sign in to your Cloudflare account and deploy the default Worker. Enable Workers and choose your account’s `workers.dev` subdomain if prompted. The Worker serves the form API at its own address while GitHub Pages continues to host the website. The following deploy and secret commands make changes in Cloudflare:

   ```sh
   npm run build
   npm test
   npx wrangler@4 login
   npx wrangler@4 deploy
   npx wrangler@4 secret put C02_MS_CLIENT_SECRET
   ```

   At the secret prompt, paste the same Microsoft secret **Value**. Copy the actual `https://…workers.dev` address from the deploy output. To send new requests into Follow Up Boss, also run `npx wrangler@4 secret put FUB_API_KEY` and enter the FUB key at its prompt **before** accepting ad leads. Requests received before the FUB key is added are not backfilled. [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

6. **Connect and publish the GitHub Pages form.** Open `scripts/campaign-config.mjs`. Set `firstHomeIntakeUrl` to the actual HTTPS Worker address from step 5 with `/api/leads` on the end. Run `npm run build` and `npm test` again. Check that `first-purchase/index.html` contains that exact URL in `data-intake`. In your normal Git client, review the intended website release including generated pages, scripts and assets, commit and push it to the `main` branch of `evankski/real_estate_landing`. The Pages source is **main / (root)**. Publish the generated files at the repository root. Your secret goes only into Cloudflare.

7. **Test the actual buyer experience.** Wait for GitHub’s Pages deployment to finish. On `https://evankrealestate.com/first-purchase/?utm_source=instagram&utm_medium=paid_social&utm_campaign=c02_test#booking`, submit your own contact information under a clearly labeled test name and request a future time. Verify the saved-request receipt, the email in Outlook with the buyer’s callback number and answers, and the 20-minute Outlook draft. Use **Send** in Outlook when you want to invite the buyer. With FUB configured, verify the contact and tags `Marketing lead`, `C02 - First Home Game Plan`, `Appointment request`, `Paid ad` and `Instagram`. If the form saved the request and no email arrives, check `npx wrangler@4 tail` for `C02 delivery retry` and its error code. Fix the sender and the saved request will retry. Record the test result before starting ads.

**Using the existing Resend sender instead.**

If switching back to Resend, set the Worker’s `C02_MAIL_PROVIDER` to `resend` before publishing that configuration.

1. Verify the sending subdomain `mail.evankrealestate.com` in Resend by adding its verification records to the existing DNS at GoDaddy. The sender is `appointments@mail.evankrealestate.com`, the recipient is fixed to `evan@thewowski.com`, and Reply goes to the buyer. This does not change your nameservers, website hosting or Microsoft 365 inbox. See [Resend’s GoDaddy instructions](https://resend.com/docs/guides/dns/godaddy).
2. In the hosting account for this Worker, set a sending-only Resend key using `npx wrangler secret put RESEND_API_KEY` (never in HTML or client JS). Build the site and deploy the default Worker when ready to publish. Its migration creates the private outbox. If using FUB, set its secret on the Worker too; email works without it.
3. If GitHub Pages serves the site, set `firstHomeIntakeUrl` in `scripts/campaign-config.mjs` to the actual deployed HTTPS workers.dev URL ending in `/api/leads`, rebuild, and publish the generated page and JS when approved. The Worker accepts the two public site origins. If the Worker serves the site itself, leave the URL empty to use its same-origin endpoint. Pages alone cannot run the outbox.
4. Submit one labeled test from the **public C02 page**. Verify the subject, buyer’s answers, reply address and requested time in Evan’s Outlook inbox and open the calendar draft. Resend’s email log shows delivered, delayed or bounced mail; API acceptance alone does not prove inbox placement. Worker logs record `C02 delivery retry` with only a reference, channel, attempt and error code. Fix persistent errors such as sender verification or mailbox suppression; pending jobs resume automatically. Verify the FUB lead separately if that key is enabled.

The Node preview on port 4173 never sends C02 appointments externally. To exercise the outbox without sending mail, run `npm run build` then `npx wrangler dev --env mailtest --local`. This test environment routes the message to Wrangler’s local mail simulator and prints the captured file’s location. The Resend option uses [Resend’s send API](https://resend.com/docs/api-reference/emails/send-email) with a [stable idempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys). No buyer answers are saved in browser storage. After all configured providers accept, the outbox discards the payload and keeps only a duplicate marker for seven days.

## Calendar and recording

Buyers enter a callback number and choose a date and start time in their device’s time zone. Evan emails to confirm, then calls from 925-492-7023. The worksheet-only request asks for name and email. The three preparation questions with fixed answers use tap choices on mobile. The request email includes an **Open in Outlook** draft for the exact 20-minute call. Open it while signed in to Microsoft 365 as `evan@thewowski.com`, review the buyer and time against your calendar, and save or send the invitation to confirm. The same draft link is included in the FUB inquiry when configured. Opening the link alone does not reserve a time. Microsoft account access and actual inbox delivery still require a live check.

On a keyless local preview, submit the form using sample details. The result has an **Open test draft in Outlook** link so you can inspect the requested time without sending email or creating a lead. On the deployed site the draft goes to Evan, not the visitor. The backend validates the time and builds its own link from the submitted details. Older cached forms that send only a free-text time window still reach Evan for personal scheduling.

The optional adapter supports a verified Calendly event in `bookingLinks['first-home-plan']` in `scripts/campaign-config.mjs`. Before enabling it, verify ownership, free 20-minute duration, real availability, time-zone behavior, confirmations and an actual test reservation. Configure the event to accept full name, email and six text answers in this order: area, move timing, lender conversation, agent relationship, optional question, callback number. The widget pre-fills these values and leaves final availability and submission to the provider. A different calendar needs its own handoff and verified confirmation signal. Provider implementation references: [Calendly embed events](https://calendly.com/help/advanced-calendly-embed-for-developers) and [prefilled answers](https://calendly.com/help/how-to-pre-fill-invitee-information-in-an-embed).

`videos['first-home-plan']` currently uses the site’s 12-second coastal demo, labeled “Play sample video.” When Evan supplies his recording, replace this entry with the real video, poster, English VTT captions and accurate transcript, omit the demo flag, and rebuild.

## FUB tags and advertising links

Every C02 submission through the lead API gets `Marketing lead` and `C02 - First Home Game Plan` in FUB, even when the ad link has no tracking labels. `Appointment request` and `Worksheet request` distinguish the two forms. The same marketing tag applies to other recognized campaign forms and to site forms reached through a paid medium. `Paid ad` means the URL had an explicitly paid medium such as `paid_social`, `cpc` or `ppc`. A recognized source such as `facebook` or `instagram` adds the corresponding platform tag. Source, medium, campaign, content and term remain available in the inquiry details.

Use the **Facebook** or **Instagram** destination from [the C02 ad materials](campaign-materials/c02.json) when setting up an ad. For example, Facebook uses `https://www.evankrealestate.com/first-purchase/?utm_source=facebook&utm_medium=paid_social&utm_campaign=c02_first_home_game_plan`. Set `utm_content` to the ad name if you want to distinguish creatives.

Dot can filter on these source tags. Use the permission and unsubscribe records maintained in Dot for drip eligibility. The forms collect inquiry-response permission only.

## Measurement

The existing Meta Pixel and cookie controls apply. Tracking requires consent and honors Global Privacy Control. Parameters are fixed campaign identifiers, never contact details, prep answers, appointment URIs, or time windows.

| Event | Trigger |
| --- | --- |
| `Lead` with C02 and the worksheet name | The delivery service accepts an email-copy inquiry. Direct downloads, previews and failed requests do not count. |
| `C02BookingStarted` | The buyer finishes preparation and continues to scheduling. Fires once per page, including if they edit their answers. |
| `C02ManualTimeRequested` | The server acknowledges a durably saved manual time request; independent of email and CRM speed. |
| `Schedule` | Only the configured calendar widget’s own frame, origin, scheduled-event signal and event URI can confirm the appointment. A date click, email submission, redirect, direct visit or refresh cannot trigger it. |

## Campaign copy

Use [the editable C02 materials](campaign-materials/c02.json) for the five ad scripts, VSL, shot instructions, agent disclosures and personal email replies. The original external pack is a reference. The editable scripts direct buyers to the public video and download. The VSL closing uses the current booking button. Ads promising the video are for use after the real recording is in place. The `recording_pickups` list identifies lines to replace if already recorded, including the “I’ll send both” ad endings and the old VSL button name. No finished C02 recording was supplied. Replies are manual inquiry fulfillment, not a marketing sequence.

Preview with `npm run dev` and open `/first-purchase/`. Rebuild with `npm run build`, then run `npm test`. Browser/provider regression checks use test data and simulated provider acknowledgments. Verify email recipient activation and actual inbox/FUB routing on the intended deployment before directing ad traffic there.
