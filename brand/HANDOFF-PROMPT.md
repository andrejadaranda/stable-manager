# Longrein. logo handoff — paste in new chat

Below is a ready-to-paste prompt. Copy from the line below, paste into a new conversation, then add your specific request at the end.

---

## Prompt

Hi. I have the Longrein. logo system finished. Here is where everything lives and where each file should go. Use this as ground truth — do not re-create any logo assets, reuse what is here.

**Brand basics (locked, do not change):**
- Name: **Longrein.** (with the period — the period is the brand mark)
- Typography: Source Serif 4 (headings + wordmark) · Inter (body)
- Colours: Paddock Green `#1E3A2A` · Saddle Tan `#B5793E` · Arena Cream `#F4ECDF` · Tack Black `#1B1B1B` · Brick Red `#9C3D2A` (alerts only) · Stone Grey `#6E6760` (captions)
- Forbidden: navy + orange palette, purple/blue SaaS gradients, horse silhouettes, hoofprints, emojis in the wordmark.

**Where the files live (on my computer):**
```
/Documents/Claude/Projects/APP/brand/
├── Longrein-Logo-System.html        ← full brand book (open in browser)
├── Longrein-Logo-System-Overview.png ← single-image summary
├── HANDOFF-PROMPT.md                ← this file
└── logo/
    ├── longrein-wordmark.svg              ← PRIMARY — green-on-cream
    ├── longrein-wordmark-cream.svg        ← reverse — cream-on-dark
    ├── longrein-wordmark-mono-black.svg   ← single-colour black
    ├── longrein-icon.svg                  ← APP ICON — green tile
    ├── longrein-icon-mono.svg             ← cream tile (for dark bg)
    ├── longrein-icon-favicon.svg          ← optimised for 16–64 px
    ├── longrein-stacked.svg               ← icon-over-wordmark vertical lockup
    ├── longrein-symbol-arc.svg            ← decorative long-rein arc
    └── png/
        ├── wordmark-760x180.png · 1520x360.png · 3040x720.png  (1×/2×/4× retina)
        ├── wordmark-cream-760x180.png · 1520x360.png
        ├── wordmark-mono-black-760x180.png · 1520x360.png
        ├── icon-60x60.png · 180x180.png · 512x512.png · 1024x1024.png
        ├── icon-cream-512x512.png · 1024x1024.png
        ├── favicon-16x16.png · 32x32.png · 64x64.png
        ├── stacked-480x360.png · 960x720.png
        └── symbol-arc-240x90.png · 480x180.png
```

**Where each file should go:**

| Surface | File | Notes |
|---|---|---|
| Web app — top-left header | `longrein-wordmark.svg` | Inline SVG so it scales |
| Web app — favicon | `longrein-icon-favicon.svg` + `favicon-16x16.png` / `32x32.png` | Both, for older browsers |
| Web app — apple-touch-icon | `png/icon-180x180.png` | iOS home-screen save |
| Web app — login / splash screen | `longrein-stacked.svg` | Centred, generous padding |
| Mobile app — iOS app icon | `png/icon-1024x1024.png` | App Store master |
| Mobile app — Android icon | `png/icon-512x512.png` | Play Store master |
| Email signature | `png/wordmark-760x180.png` | PNG, not SVG (mail clients) |
| Slack workspace icon | `png/icon-512x512.png` | |
| Instagram profile photo | `png/icon-1024x1024.png` | Crops to circle automatically |
| LinkedIn company logo | `png/icon-1024x1024.png` | |
| Pitch decks / Google Slides | `longrein-wordmark.svg` or `png/wordmark-1520x360.png` | SVG if PowerPoint accepts it, otherwise PNG |
| Canva designs | upload `longrein-wordmark.svg` to brand kit | Plus install Source Serif 4 in Canva |
| Print (business cards, signage) | `longrein-wordmark.svg` (vector) | Send to printer as-is |
| Dark backgrounds / over photos | `longrein-wordmark-cream.svg` | Use cream variant — never green-on-green |
| 1-colour press / fax | `longrein-wordmark-mono-black.svg` | When colour isn't available |

**Clear-space rule:** keep at least 1× the cap-height of the L as padding on every side of the wordmark. Minimum size on screen: 80 px wide. Do not re-colour, stretch, condense, drop the period, or swap the typeface.

**Source-of-truth caveat:** SVGs reference Source Serif 4 via Google Fonts. They render correctly in browsers without setup. For Figma / Canva / Illustrator, install Source Serif 4 first (free at fonts.google.com/specimen/Source+Serif+4). If a tool won't render the SVG, use the matching PNG instead.

---

**My request:** [→ write what you want done here. Examples: "Drop the favicon and apple-touch-icon into the Next.js app at /app/icon.png" or "Upload the icon to my Instagram profile and set it as the avatar" or "Add the wordmark to the login page header"]
