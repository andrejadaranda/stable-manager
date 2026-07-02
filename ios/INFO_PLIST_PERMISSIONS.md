# iOS Info.plist permission strings (FINAL — v1)

After `npx cap add ios`, open `ios/App/App/Info.plist` and add the keys below.
Only declare what v1 actually uses — Apple rejects generic strings ("Allow
location") AND background modes / permissions you don't use.

## Location — required (live ride tracker) ✅

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Longrein records your route, distance, and pace while you ride so you can review the ride afterwards.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allow Longrein to keep recording your ride in the background so distance and route continue when your phone screen sleeps.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

> Also enable it in Xcode: target → **Signing & Capabilities → + Background Modes → Location updates**. This is what lets the ride keep recording with the screen off — and it's the concrete native capability that answers App Store guideline 4.2.

## Camera + Photos — horse photos + profile picture ✅

```xml
<key>NSCameraUsageDescription</key>
<string>Take a photo of your horse to add to its profile.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Choose a photo of your horse, your stable, or your profile from your library.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save a horse photo or ride card to your camera roll.</string>
```

## Push notifications — NOT in v1

Native push (APNs) is a post-launch add — it needs an APNs key from your
Apple Developer account plus server-side APNs sending. v1 does **not** ask
for notification permission and does **not** declare `remote-notification`
background mode. (Lesson reminders go by email in the meantime; the in-app
"Enable notifications" button is hidden inside the native app so there's no
dead feature for the reviewer.) When native push ships, add
`remote-notification` to UIBackgroundModes and wire `@capacitor/push-notifications`.

## Not used in v1 (do NOT add)

- **Contacts** — the safety-beacon share uses the native iOS share sheet, not the Contacts API. No `NSContactsUsageDescription` needed.
- **Microphone** — no voice notes yet.

## App Transport Security

No exceptions needed — `app.longrein.eu` uses valid TLS. Leave ATS default.

## Sign in with Apple (guideline 4.8)

Only email + password login exists → not required. Becomes mandatory only if you add Google/Facebook sign-in later.

---

## Optional — Lithuanian permission prompts (nicer for TJK users)

iOS shows these strings in the app's language. To show them in Lithuanian,
add an `InfoPlist.strings` (Lithuanian) file in Xcode with:

```
"NSLocationWhenInUseUsageDescription" = "Longrein įrašo jūsų maršrutą, atstumą ir greitį jojant, kad galėtumėte peržiūrėti treniruotę.";
"NSLocationAlwaysAndWhenInUseUsageDescription" = "Leiskite Longrein toliau įrašinėti maršrutą fone, kai telefono ekranas užrakintas.";
"NSCameraUsageDescription" = "Nufotografuokite žirgą jo profiliui.";
"NSPhotoLibraryUsageDescription" = "Pasirinkite žirgo, žirgyno ar profilio nuotrauką iš galerijos.";
"NSPhotoLibraryAddUsageDescription" = "Išsaugokite žirgo nuotrauką ar treniruotės kortelę į galeriją.";
```

English strings ship by default and are fully acceptable to Apple; the LT
file is a polish step, not a requirement.
