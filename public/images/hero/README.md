# Homepage hero photos

Add real photo files here, named to match `src/lib/homepageImages.ts`:

- kakum-canopy-walk.jpg
- cape-coast-castle.jpg
- kejetia-market.jpg
- kente-weaving.jpg
- accra-skyline.jpg

The carousel degrades gracefully if a file is missing (shows the gradient
background only, no broken-image icon) — you can add these one at a time.

## Recommended sizing
- At least 1920×1080px, landscape orientation
- JPEG, optimized for web (aim for under ~400KB each so the homepage
  loads quickly)

## Where to get real, properly licensed photos
Best option: your own team's or Local Data Agents' photography from
these locations — most authentic, and you own it outright.

If you need stock photography in the meantime, **Unsplash**
(unsplash.com) explicitly licenses photos for free commercial use with
no attribution required. Search terms that match the current config:
"Kakum canopy walkway," "Cape Coast Castle," "Kejetia market Kumasi,"
"Kente weaving," "Accra skyline." Download and place the files here
directly — don't hotlink external URLs in production (adds an external
dependency and defeats Next.js's image optimization).

To add more than 5 images, or change the set, edit
`src/lib/homepageImages.ts` — the carousel reads directly from that list.
