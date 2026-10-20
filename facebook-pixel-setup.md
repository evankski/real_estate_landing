# Meta Pixel configuration and verification

Evan explicitly authorized activation on October 20, 2026. Meta Pixel is enabled
in `script.js` (`metaPixelEnabled: true`) and remains **opt-in only**. Pixel ID
`2061494168135844` is configured; this does not establish dataset ownership,
verified account settings or successful Meta receipt. No live Meta requests
were made as part of this notice/configuration update.

## Implemented behavior

- Until a visitor chooses **Allow tracking**, the site does not load the Meta
  script or send optional events. The inquiry form works with tracking off.
- Allowed measurement sends `PageView` and `Lead` after the inquiry-delivery
  service accepts a submission. Form answers are not added to event parameters.
  A Lead event does not mean an appointment is booked or an email has been read.
- The tracking key is `ek_cookie_tracking_choice_v3`. Older v2/v1 opt-ins are
  ignored; their opt-outs remain honored. The v1 key is
  `ek_cookie_tracking_choice`; v2 is `ek_cookie_tracking_choice_v2`.
- **Keep tracking off**, the footer opt-out and detected Global Privacy Control
  keep measurement off. GPC opt-outs persist after the signal is removed.
  Preference changes are also handled across open tabs.
- Failed storage persistence must not silently enable tracking. Withdrawal
  revokes future optional measurement; it cannot erase data already received
  by Meta or necessarily remove existing cookies.
- Tracking permission is separate from inquiry-response permission. Neither
  automatically grants marketing-call, marketing-text or newsletter consent.

Do not add an unconditional Pixel snippet, noscript image, second tag-manager
route or additional events that bypass these controls.

## Account checks still unverified

Check the intended account/dataset ownership and settings in Meta. Review
automatic advanced matching and automatic/event-setup collection so they do
not collect form fields or information beyond the intended events. The site
queues `autoConfig: false`; that does not verify the account or every payload.
Inspect separate CAPI, offline events, audience uploads and connected tools;
the website's cookie controls cannot configure those integrations.

Keep names, emails, phone numbers and sensitive information out of campaign
URLs and event parameters. Ordinary pixel events can still disclose page,
browser, network and identifier information. These checks remain follow-up;
they do not reverse Evan's instruction to enable the consent-gated Pixel.

## Verify the deployed behavior

- Fresh visitors and visitors with only an old opt-in send no Meta requests
  before choosing **Allow tracking**.
- Old and current opt-outs and GPC prevent loading and events.
- After a fresh opt-in, inspect PageView and accepted-inquiry Lead behavior;
  event parameters must not include form answers or automatic form events.
- Direct visits, refreshes and replayed thank-you URLs must not create extra
  lead conversions. Declining tracking must not block inquiries.
- Check withdrawal, cross-tab changes, storage failure and visible status.

Use a controlled test inquiry only when testing the intended delivery route.
Mocked local tests do not prove account settings or real Meta receipt.

## Housing advertisements

Evan confirmed October 20, 2026 that paid ads will target the United States
only. Apply that geography in campaign settings; the website remains public.
No campaign was launched by enabling the Pixel. Use the Housing category for
the planned real-estate campaigns and check current targeting, placement and
lead-form settings when preparing ads. See `launch-checklist.md` for the
existing advertising review and remaining business-side checks.
