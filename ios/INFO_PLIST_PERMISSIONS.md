# iOS Info.plist permission strings

After `npx cap add ios`, open `ios/App/App/Info.plist` and add the keys below.
Apple reviewers WILL reject the app if these strings are generic ("Allow
location") — every string must explain the user-visible value.

## Location — required for live ride tracker

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Longrein records your route, distance, and pace while you ride so you can review the ride afterwards and share a map with your trainer.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allow Longrein to track your ride in the background so distance, route, and the safety beacon keep recording when your phone screen sleeps.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Longrein keeps your live ride tracker running in the background so the safety beacon and route recording continue when your phone is in your pocket.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

## Camera + Photos — for horse photos + profile photo

```xml
<key>NSCameraUsageDescription</key>
<string>Take photos of your horses to add to their profile.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Pick an existing photo of your horse, your stable, or your profile picture.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save a ride share card or horse photo to your camera roll.</string>
```

## Notifications — lesson reminders, vet/farrier due dates

The Capacitor PushNotifications plugin asks at runtime via JS;
no Info.plist string is required. APNs cert needs Apple Dev active.

## Contacts — emergency safety beacon contact

```xml
<key>NSContactsUsageDescription</key>
<string>Pick an emergency contact to share your live ride location with.</string>
```

## Microphone — voice notes on session log (FUTURE, skip for v1)

Not in MVP. Add when voice memo session notes ship.

## App Transport Security — production HTTPS only

No exception entries needed — app.longrein.eu uses valid TLS.

## Apple Sign-In — required by App Store guideline 4.8

If we offer ANY third-party login (Google, Facebook) in the future we
MUST also offer Sign in with Apple. For v1 we only have email +
password, so this requirement does not apply yet.
