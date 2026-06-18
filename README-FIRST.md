# Evan Karwowski Real Estate Website Redesign

This folder contains a full static website rebuild using the positioning from the real estate playbook:

Helping Bay Area buyers get more house east of the tunnel. Real neighborhoods, filmed properly. Real math, no hype.

## Files

index.html
style.css
script.js
privacy.html
terms.html
cookies.html
accessibility.html
robots.txt
sitemap.xml
headshot.jpg
facebook-pixel-setup.md
photo-shot-list.md
launch-checklist.md

## Before launch

1. Replace any placeholder contact details if needed.
2. Confirm Evan DRE #02102429 and Broker Karwowski, Inc. DRE #02224747 are exact.
3. Have the broker review the homepage, footer, form consent language, Privacy Notice, Terms of Use, Cookie Policy, and any lead magnet copy.
4. Have a qualified attorney review privacy and terms language before using paid traffic or Meta Pixel retargeting.
5. Confirm the installed Meta Pixel ID in script.js is approved for use after privacy review.
6. Upload the whole folder to GitHub Pages or your web host.
7. Update sitemap.xml if the live domain changes.
8. Submit the sitemap in Google Search Console.

## SEO notes

The homepage includes title tags, meta descriptions, Open Graph tags, canonical URL, structured data, FAQ schema, local service areas, and indexable legal pages.

## Compliance notes

The site displays Evan name, DRE number, broker name, broker DRE number, Equal Housing Opportunity, representation disclaimers, privacy notice links, cookie choices, and non advice language. This is a strong starting point, not a legal guarantee.


## Social link check

I added social links in `index.html` using the public handle format `evankarwowski`:

* Instagram: https://www.instagram.com/evankarwowski/
* Facebook: https://www.facebook.com/evankarwowski/
* YouTube: https://www.youtube.com/@evankarwowski
* TikTok: https://www.tiktok.com/@evankarwowski

Before launch, click each one. If any account uses a different URL, replace the link in the About section, footer section, and the `sameAs` field in the homepage JSON LD.

## Cookie banner behavior

The cookie banner is visible by default on a fresh browser visit. If someone already accepted or rejected tracking, the site remembers that choice and hides the banner on future visits. A browser-based Global Privacy Control signal is treated as an opt out of optional tracking. To reopen the banner, use the Cookie Settings link in the footer.

For testing, use an incognito window or clear site data for the domain if you want to see the first visit experience again.
