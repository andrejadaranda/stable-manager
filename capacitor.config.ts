// Capacitor config — iOS native shell for Longrein.
//
// Strategy: hybrid. App loads app.longrein.eu (live Next.js SSR) so we
// keep one codebase + zero native rebuilds when shipping web features.
// Native plugins (geolocation, push notifications, share, camera) give
// us functionality the Web PWA can't do — background GPS for live ride
// tracking, native push for lesson reminders, native share sheet for
// ride share cards. That clears App Store guideline 4.2 ("minimum
// functionality") which rejects pure web wrappers.
//
// To regenerate the iOS project after pulling this repo on a Mac:
//   npm install
//   npx cap add ios       # creates ios/ folder with Xcode project
//   npm run cap:sync      # syncs web assets + plugin updates
//   npm run cap:open      # opens Xcode

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:       "eu.longrein.app",
  appName:     "Longrein",
  // Loaded URL — the app is a thin native shell pointing at production.
  // For development, override via CAPACITOR_SERVER_URL env or by
  // pointing webDir at a local Next.js dev server.
  server: {
    url:                "https://app.longrein.eu",
    cleartext:          false,
    androidScheme:      "https",
    iosScheme:          "https",
    // Allow nav to legal pages on the marketing site so Privacy +
    // Terms links don't fall out of the app shell.
    allowNavigation:    [
      "app.longrein.eu",
      "longrein.eu",
      "*.longrein.eu",
      "checkout.stripe.com",
      "billing.stripe.com",
    ],
  },
  // webDir is required by Capacitor even when server.url is set —
  // used as the offline fallback. We bundle a thin "Connecting…"
  // splash so users see something during cold start without network.
  webDir: "ios-fallback",
  ios: {
    contentInset:       "always",
    scrollEnabled:      true,
    // Background colors so cold launch doesn't flash white.
    backgroundColor:    "#F4ECDF",
    // Allow links to open in-app browser when not in allowNavigation.
    handleApplicationNotifications: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:         2000,
      launchAutoHide:             true,
      backgroundColor:            "#1E3A2A",
      androidSplashResourceName:  "splash",
      androidScaleType:           "CENTER_CROP",
      showSpinner:                false,
      iosSpinnerStyle:            "small",
      spinnerColor:               "#F4ECDF",
    },
    StatusBar: {
      style:           "dark",
      backgroundColor: "#1E3A2A",
    },
    Geolocation: {
      // iOS background-modes capability must be enabled in Xcode
      // (Signing & Capabilities → Background Modes → Location updates)
      // so live ride tracker keeps recording when the screen sleeps.
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
