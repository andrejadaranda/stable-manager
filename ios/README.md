# Longrein iOS — workflow

Hybrid Capacitor shell wrapping the live Next.js app at app.longrein.eu.
Status: SCAFFOLDED. Run the steps below on a Mac with Xcode 15+ installed.

## 0. Prerequisites

- Node 20+ and npm
- Xcode 15.0+ (from the Mac App Store)
- A paid Apple Developer Program membership (€99/year) — active, not pending
- Cocoapods (auto-installed by `npx cap add ios` on first run)

## 1. First-time setup (one time)

```bash
cd /Users/andrejadaranda/Documents/App-projektas/Codebase

# 1. Install the Capacitor packages added to package.json
npm install

# 2. Generate the ios/ Xcode project. This creates ios/App/App.xcworkspace
#    and ios/App/Podfile. Do this OUTSIDE this repo's ios/ folder so it
#    doesn't conflict with the docs already there.
npx cap add ios

# 3. Sync web assets + plugins
npm run cap:sync

# 4. Open Xcode
npm run cap:open
```

In Xcode → **Project navigator → App → Signing & Capabilities**:
1. Team: pick your Apple Developer account (only available once
   Apple Dev membership is active, NOT pending).
2. Bundle Identifier: **eu.longrein.app**
3. Capabilities → tap **+ Capability**, add:
   - Background Modes → check **Location updates**, **Background fetch**,
     **Remote notifications**
   - Push Notifications
   - Sign in with Apple (only if/when we add Google login)

In Xcode → **App → Info** (the Info.plist editor):
- Paste every key from `ios/INFO_PLIST_PERMISSIONS.md` into Info.plist.

## 2. Build to a real device for testing

```bash
# Plug your iPhone into the Mac
# In Xcode: select your iPhone as the destination, click Run
```

The first run triggers Xcode to provision a development certificate +
provisioning profile automatically. Trust the developer profile on the
iPhone (Settings → General → VPN & Device Management → trust).

## 3. TestFlight beta (after Apple Dev active)

```bash
# In Xcode: Product → Archive
# Xcode Organizer → Distribute App → App Store Connect → Upload
# Wait 5-30 minutes for processing
# Then go to https://appstoreconnect.apple.com → My Apps → Longrein →
# TestFlight → add your 15 founding clients as External Testers
```

Beta period: 1-2 weeks. Collect feedback. Patch. Re-upload until you're
ready to submit for App Store review.

## 4. App Store submission

1. App Store Connect → My Apps → **+** → New App
   - Platform: iOS
   - Name: Longrein
   - Primary language: English (U.K.)
   - Bundle ID: eu.longrein.app
   - SKU: longrein-ios-app
2. Paste every field from `ios/APP_STORE_LISTING.md`
3. Upload screenshots (6.5", 5.5", iPad Pro 12.9") — taken from
   `/s/avalon` + signed-in Avalon demo.
4. App Privacy → answer the questionnaire per `APP_STORE_LISTING.md`
5. App Review Information → demo account credentials:
   - Email: `demo.owner@longrein.eu`
   - Password: `LongreinDemo2026!`
   - Notes: "Sign in with these credentials to access a fully populated
     demo stable showing every feature."
6. Submit for review.

Apple reviews take 24–72h typically. Expect at least one rejection on
the first submission — common reasons:
- Permission strings too generic → fix in Info.plist
- "Just a web wrapper" → emphasize native plugins (we use Geolocation,
  Push, Share — that should clear 4.2)
- Sign in with Apple missing → only required if you add Google/Facebook login

## 5. Native plugins available out of the box

| Plugin | What we get |
|---|---|
| `@capacitor/geolocation` | Background GPS for live ride tracker — works while screen is off |
| `@capacitor/push-notifications` | Native iOS push for lesson reminders, vet/farrier due dates |
| `@capacitor/share` | Native share sheet for ride share card → WhatsApp, Messages, IG |
| `@capacitor/status-bar` | Match status bar color to brand (paddock green) |

To call these from web code, use Capacitor's runtime detection:

```ts
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

if (Capacitor.isNativePlatform()) {
  await Geolocation.requestPermissions({ permissions: ["location"] });
  const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (pos) => {
    if (pos) sendToServer(pos.coords);
  });
}
```

The same web code path runs in Safari + PWA; the `isNativePlatform()`
check is a no-op outside the native shell.

## 6. App Icon assets

Master: `ios/app-icon-1024.svg`

To generate all required PNG sizes from the SVG:

```bash
# Requires Inkscape or rsvg-convert
brew install librsvg
cd ios
for size in 1024 180 167 152 120 87 80 76 60 58 40 29 20; do
  rsvg-convert -w $size -h $size app-icon-1024.svg -o icon-${size}.png
done
```

Drop the generated PNGs into Xcode → `Assets.xcassets → AppIcon`.

## 7. Splash screen

Capacitor handles splash via `capacitor.config.ts` (already set:
2-second paddock-green flash before web content loads). For custom
launch image, drop a 2732×2732 PNG into Xcode's `LaunchImage` slot.

## 8. Universal Links (deep links into the app)

After TestFlight is live, set up Apple-App-Site-Association to make
links like `https://app.longrein.eu/horses/{id}` open inside the app
when installed:

1. App Store Connect → My Apps → Longrein → identifiers → Associated
   Domains capability → add `applinks:app.longrein.eu`
2. Host `/.well-known/apple-app-site-association` at
   `https://app.longrein.eu/.well-known/apple-app-site-association`
   with the right team ID + bundle ID.

Defer this until after first App Store approval.

## 9. Cost & timeline reality check

| Step | Cost | Time |
|---|---|---|
| Apple Developer membership | €99/year | 24-48h to activate after purchase |
| Xcode + tooling | Free | 30min download |
| TestFlight setup | Free | 30min after Apple Dev active |
| App Store review (first submission) | Free | 24-72h, often 1 rejection cycle |
| Yearly maintenance (renewals + iOS version bumps) | €99/yr + ~4h/yr | Ongoing |

Total path from "Apple Dev approved" → "live in App Store": ~3-5
working days assuming no surprise rejections.
