import type { CapacitorConfig } from '@capacitor/cli'

// =============================================================================
// THE NATIVE SHELL AROUND THE EXISTING PWA
// =============================================================================
// DialerSeat already ships a real PWA -- manifest, service worker, maskable
// icons, standalone display -- and on a phone it already feels like an app.
// Nothing here restructures that. This wraps it so it can be installed from the
// App Store and Play Store, and so the things a browser tab cannot do (keep a
// call alive in the background, stay inside the app across subdomains) become
// possible.
//
// ── IT LOADS THE LIVE SITE, IT DOES NOT BUNDLE ONE ─────────────────────────
// `server.url` rather than a bundled `webDir`, because this is a server-
// rendered Next.js app: every page is built per request against Clerk sessions
// and live data, so there is no static export to ship inside the binary.
//
// The consequence is the best part of this route. The app's SCREENS are a
// website, so every deploy reaches mobile users immediately, with no store
// review and no over-the-air update machinery. A store build is only needed
// when something NATIVE changes -- a permission, an icon, a Capacitor
// upgrade -- which is a couple of times a year rather than weekly.
//
// The tradeoff is equally real and worth stating: with no bundled assets, the
// app shows nothing useful offline. That is already true of the dialer, which
// cannot place calls without a network, so it costs nothing here -- but it
// would be a bad trade for an app whose content could be cached.
//
// ── allowNavigation IS THE WHOLE SUBDOMAIN FIX ─────────────────────────────
// Anything not matched here opens in the system browser. That is exactly the
// behaviour being removed: a white-label tenant on its own subdomain currently
// bounces the user out to Safari, which breaks the illusion and drops them into
// a session they have to sign into again.
//
// Listing the wildcard keeps every tenant inside the app. Deliberately scoped
// to our own domains and NOT widened to third parties: an allowlist that
// includes a payment or identity provider would render those pages inside our
// WebView, which is both a security smell and, for Google OAuth, explicitly
// refused -- see the auth note below.
const config: CapacitorConfig = {
  appId: 'com.dialerseat.app',
  appName: 'DialerSeat',
  // Required by the CLI even when unused: `server.url` wins at runtime. Points
  // at `public` so `npx cap sync` has something real to copy rather than
  // failing on a missing directory.
  webDir: 'public',

  server: {
    url: 'https://dialerseat.com',
    // No cleartext. Every origin this app touches is HTTPS, and allowing plain
    // HTTP would let a hostile network inject into a WebView that holds a live
    // Clerk session.
    cleartext: false,
    androidScheme: 'https',
    // Kept in the app. Add new first-party domains here, never third parties.
    allowNavigation: [
      'dialerseat.com',
      '*.dialerseat.com',
    ],
  },

  ios: {
    // The PWA's own background colour, so the gap between launch and first
    // paint is not a white flash against a dark dashboard.
    backgroundColor: '#0a0a0f',
    // Inline playback matters for a dialer: without it iOS can hand audio to
    // the fullscreen player, which is not where a call belongs.
    limitsNavigationsToAppBoundDomains: false,
    contentInset: 'always',
  },

  android: {
    backgroundColor: '#0a0a0f',
    // Mixed content stays off for the same reason cleartext does.
    allowMixedContent: false,
    captureInput: true,
  },

  plugins: {
    // Splash held until the WebView has something to show. A server-rendered
    // first paint is slower than a bundled one, and the alternative is a blank
    // screen the user reads as a crash.
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
    },
  },
}

export default config

// ── WHAT STILL HAS TO BE TRUE OUTSIDE THIS FILE ────────────────────────────
//
// MICROPHONE. NSMicrophoneUsageDescription on iOS and RECORD_AUDIO on Android.
// Without them getUserMedia fails inside the shell in a way that looks like a
// broken dialer rather than a missing permission.
//
// BACKGROUND AUDIO. UIBackgroundModes: audio on iOS, and an AVAudioSession
// category of playAndRecord. This is the ONE genuinely unproven part of this
// route: Safari suspends WebRTC when backgrounded, and whether a WKWebView
// inside a native shell with the audio background mode holds an ALREADY
// ESTABLISHED call is a different question that has to be answered on a real
// device before this ships. If it fails, the fix is a small native plugin that
// owns the audio session while a call is up -- not a rewrite of the dialer.
//
// AUTH. Google refuses OAuth inside embedded WebViews, so sign-in must go
// through ASWebAuthenticationSession on iOS and Custom Tabs on Android. Those
// are system sheets that share cookies and dismiss themselves; they read as
// part of the app rather than as a popup, which is why they are not in
// allowNavigation above.
//
// APPLE GUIDELINE 4.2. A thin website wrapper is rejected under "minimum
// functionality". This app clears it on microphone use, background audio and
// placing real phone calls -- but the review notes have to say so, with a test
// account a reviewer can actually dial from, rather than leaving them to find
// it.
//
// BUILDING. Android builds on any machine with Android Studio. iOS needs
// macOS and Xcode; from Windows that means a Mac or a cloud builder. The
// JavaScript is identical either way -- only the native build step differs.
