# Facebook / Meta Pixel setup

The website is already wired so the Meta Pixel does not load until a visitor clicks Approve in the cookie banner.

## Step 1: Get your Pixel ID

1. Go to Meta Business Suite or directly to Meta Events Manager: https://business.facebook.com/events_manager2/
2. Open Data Sources.
3. Create or select your website data source / Meta Pixel.
4. Open Settings for that data source.
5. Copy the numeric Pixel ID. Meta may also show it near the data source name or under dataset details.

## Step 2: Add it to the site

The current installed Dataset / Pixel ID is:

const CONFIG = {
  metaPixelId: '2061494168135844'
};

If Meta gives you a different numeric Pixel ID later, replace 2061494168135844 with the new numeric Pixel ID.

Example:

const CONFIG = {
  metaPixelId: '123456789012345'
};

## Step 3: Upload and test

1. Upload the updated files to your host.
2. Open the live website in a clean browser.
3. Click Approve in the cookie banner.
4. Use the Meta Pixel Helper Chrome extension or Events Manager Test Events to confirm PageView fires.
5. Submit the contact form with test information and confirm the Lead event fires.

## Step 4: Housing ads reminder

Real estate related Meta ads usually need to be handled under Meta Special Ad Category rules for housing. Do not build audiences or ad copy in a way that excludes or targets protected classes. Have your broker review paid campaigns before launch.

## Privacy reminder

The Privacy Notice and Cookie Policy describe optional Meta Pixel tracking, but templates are not legal advice. Have privacy language reviewed before retargeting visitors.
