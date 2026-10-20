# Meta Pixel activation checklist

Meta Pixel is **paused** in `script.js` (`metaPixelEnabled: false`). No Meta script
or events are loaded, including for visitors with an older saved opt-in. The
site and inquiry form work normally. Pixel ID 2061494168135844 is retained as a
configuration value, not proof of a connected or verified advertising account.

## Before enabling measurement

1. Confirm the intended Meta account owns the dataset and review the current
   Business Tools terms and privacy requirements with WR Properties. Check any
   connected CAPI, offline events, audience uploads or other data integrations;
   this site's cookie switch cannot control separate account integrations.
2. Turn off automatic advanced matching and automatic/event-setup collection
   that could read form fields or page metadata beyond the intended events.
   The script also queues `autoConfig: false` before initialization. Verify the
   resulting network payloads; do not treat that single setting as a guarantee.
3. Do not put names, emails, phone numbers, financial details or other sensitive
   information in campaign URLs or Meta event parameters. Meta can receive a
   page URL and network/browser information even when no form fields are passed.
4. Review the active uses with the broker/privacy adviser, including California
   sale/sharing duties, provider terms and the actual targeting geography.
   Update `privacy.html`, `cookies.html`, and the visible status copy to describe
   the enabled practice accurately before changing the flag.
5. Keep rejection as easy as acceptance. Preserve stored opt-outs and GPC
   enforcement. Do not reuse a past opt-in after materially changing the
   disclosure. The current v2 preference key ignores v1 opt-ins; if changing
   terms again, migrate existing rejections while requiring a fresh opt-in.
6. After the preceding checks, change `metaPixelEnabled` to `true`. Do not add
   an unconditional Pixel snippet, noscript image, or second tag-manager route.

## Verify in a review deployment

- Fresh visitors send no requests to Meta before choosing **Allow tracking**.
- **Keep tracking off**, the footer opt-out and GPC prevent measurement; the
  opt-out remains after removing GPC and applies across open tabs.
- If storage is blocked, failed persistence must not silently enable tracking.
- Once explicitly allowed, inspect PageView and accepted-inquiry Lead events.
  There must be no contact details, budget, message, sensitive URL data or
  automatic form events in the payloads.
- A direct visit, refresh or replay of the thank-you URL must not create another
  lead conversion. Declining measurement must not prevent an inquiry.
- Withdrawal stops future optional tracking; explain that it cannot undo data
  previously received by Meta. Verify provider/account handling too.

Use only a clearly identified test inquiry approved for the intended delivery
route. Unit tests use mocks and do not verify Meta settings or real delivery.

## Housing advertisements

Evan confirmed on October 20, 2026 that paid ads will target the United States
only. Apply that geography in campaign settings; the website itself remains
publicly accessible.

Declare Housing for these real-estate campaigns. Inspect current
Ads Manager targeting, exclusions, placement and lead-form restrictions before
launch. A website disclosure does not fix a discriminatory audience or a missing
DRE disclosure in the creative. See `launch-checklist.md` for the full review and
open business-side items.
