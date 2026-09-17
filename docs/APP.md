# The DialerSeat Mobile Apps

iOS and Android, outbound only, feature-identical to the web app.

Status: **shells built and committed, never run on a device.** Nothing here has
been proven on real hardware yet. The one question that decides whether this
route works at all is in section 7, still open.

---

## 1. The decision, and what it rules out

**DialerSeat already ships a real PWA** - manifest, service worker, maskable
icons, `display: standalone`. On a phone it already feels like an app. The only
things it cannot do are the two things that made this project necessary:

1. It cannot be installed from the App Store or Play Store.
2. It bounces a white-label tenant out to Safari when they cross onto their own
   subdomain, which drops them into a session they have to sign into again.

So the shell exists to fix those two things and nothing else. **No
restructuring.** The app's screens are the website, loaded live. There is no
second codebase, no React Native port, no duplicated dialer.

### Routes considered

| Route | Why not |
|---|---|
| **React Native / Flutter rewrite** | A second dialer to keep in step with the first. Every feature built twice, every bug fixed twice, and the web app is the one customers actually use. |
| **Bundled Capacitor app** (assets shipped inside the binary) | DialerSeat is server-rendered Next.js - every page is built per request against Clerk sessions and live data. There is no static export to bundle. And it would put every UI change behind a store review. |
| **PWA only, no store presence** | Doesn't solve either problem above. |
| **Capacitor shell over the live site** | Chosen. |

---

## 2. How updates work

This was the requirement: *automatic, not system software updates.* It is the
strongest argument for this route.

- **Screens, logic, pricing, copy, bug fixes** - ship with a normal Vercel
  deploy. They reach phones on the next app open. No store review, no version
  bump, nothing for the user to accept.
- **A store build is only needed when something NATIVE changes** - a permission,
  the app icon, a Capacitor upgrade. Realistically a couple of times a year.

### Is that allowed?

Yes, and it is worth knowing why rather than assuming. Apple's Developer Program
License Agreement **section 3.3.1(B)** permits an app to download and run
*interpreted code* (JavaScript) after install, provided it does not change the
app's primary purpose, does not act as a code store, and does not bypass the
security sandbox. A shell whose entire purpose is to be the DialerSeat dialer,
loading the DialerSeat dialer, is squarely inside that.

### The tradeoff, stated honestly

With no bundled assets, **the app shows nothing useful offline.** That is
already true of the dialer - it cannot place calls without a network - so it
costs nothing here. It would be a bad trade for an app whose content could be
cached.

---

## 3. What is actually built

Two commits, both on `main`:

- `fecab682` - the shells and `capacitor.config.ts`
- `486b6a2b` - the CI build pipeline

### Versions and identity

| | |
|---|---|
| Capacitor | 8.5.2 (`core`, `cli`, `ios`, `android`) |
| App ID | `com.dialerseat.app` (both platforms) |
| Version | `versionCode 1`, `versionName 1.0` |
| Android SDK | min 24, compile/target 36 |
| iOS dependencies | **Swift Package Manager**, not CocoaPods (`ios/App/CapApp-SPM`) |

The SPM detail matters more than it looks: Capacitor 8 dropped the CocoaPods
requirement, which removes the single most fragile step in signing an iOS build
from CI.

### `capacitor.config.ts`

```ts
server: {
  url: 'https://dialerseat.com',
  cleartext: false,
  androidScheme: 'https',
  allowNavigation: ['dialerseat.com', '*.dialerseat.com'],
}
```

`allowNavigation` **is the subdomain fix.** Anything not matched opens in the
system browser. The wildcard keeps every white-label tenant inside the app.

Deliberately scoped to our own domains and **never widened to third parties** -
an allowlist containing a payment or identity provider would render those pages
inside our WebView, which is a security smell and, for Google OAuth, explicitly
refused (see section 8).

`cleartext: false` because every origin this app touches is HTTPS, and plain
HTTP would let a hostile network inject into a WebView holding a live Clerk
session.

### Permissions - iOS (`ios/App/App/Info.plist`)

- `NSMicrophoneUsageDescription` - without it `getUserMedia` fails *silently*
  inside the WebView. The dialer looks broken rather than unpermitted.
- `UIBackgroundModes: [audio]` - the entitlement that is supposed to make the
  shell different from Safari. **Unproven.** See section 7.

### Permissions - Android (`android/app/src/main/AndroidManifest.xml`)

- `RECORD_AUDIO` - the microphone.
- `MODIFY_AUDIO_SETTINGS` - lets the call own the audio route (earpiece,
  speaker, headset) instead of fighting whatever was playing before.
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` - Android's
  equivalent of the iOS audio background mode. Without a foreground service the
  OS may suspend the WebView when the agent locks the phone, and the call goes
  silent mid-sentence.

**Deliberately absent: `CALL_PHONE` and `READ_PHONE_STATE`.** This app never
touches the device's own dialer - calls are WebRTC to Telnyx. Asking for
telephony permissions an app does not use is both a review risk and a reason for
a user to decline the install.

---

## 4. The build problem

The development machine is **Windows, with no Java, no Android SDK, no Xcode and
no `gh` CLI.** Building these normally means ~5GB of tooling for Android and a
Mac for iOS.

Hence `.github/workflows/mobile-build.yml`, which is the build machine:

| Job | Runner | Produces |
|---|---|---|
| `android` | `ubuntu-latest` | A real, installable **debug APK**. Sideload on any Android phone - no developer account, no store, no signing. |
| `ios` | `macos-14` | A **simulator compile check** with `CODE_SIGNING_ALLOWED=NO`. Needs no Apple account. Cannot be installed on a real iPhone, and is not meant to be. |

Neither job touches the web app. Nothing in `app/`, `components/` or `lib/` is
read, built or deployed by that file.

It triggers manually and on changes to `capacitor.config.ts`, `android/**`,
`ios/**` or the workflow itself. Not on every push - these shells change a few
times a year while the web app deploys many times a day, and building on every
push would spend runner minutes producing identical artifacts.

**Cost note:** macOS runners bill at a **10x multiplier** against the included
allowance. The 2,000 free private-repo minutes on the Free plan are therefore
~200 real macOS minutes/month. A compile check is a few minutes. Not a concern
at this frequency.

---

## 5. Can this be built without a Mac?

Researched properly, because it decides whether a laptop purchase is needed.

### What does not work

- **Xcode on Windows.** Does not exist. Every "Xcode for Windows" search result
  is an ad. Apple ties Xcode to macOS on Apple hardware.
- **Developing on an iPad.** Swift Playgrounds is free, runs on iPad and can
  even submit to the App Store - but it only opens its own `.swiftpm` format
  and **will not open an `.xcodeproj`**. Capacitor generates
  `ios/App/App.xcodeproj`. Dead end.
- **Xcode Cloud as a Mac substitute.** Requires the paid Apple Developer Program
  *and* Xcode 15+ on a Mac to configure the workflows. It doesn't remove the
  Mac. (It includes 25 compute hours/month once you have both.)

### What does work

**A - free, today, no Mac.** The `ios` CI job already compiles the project.
It proves the build is sound. It cannot produce something installable on an
iPhone.

**B - $99, still no Mac, ever.** The wall is *signing*, not the IDE, and
certificates do not actually require Keychain:

1. Generate a private key and CSR with **OpenSSL on Windows**
2. Upload the CSR at developer.apple.com, download the `.cer`
3. Convert `.cer` + Apple's WWDR cert to `.p12` with OpenSSL
   *(use `-legacy` on OpenSSL 3.x - RC2 is disabled by default in 3.0+, and it
   was the default cipher for macOS exports)*
4. Store the `.p12` and provisioning profile as GitHub secrets
5. CI signs a real IPA and uploads it to TestFlight
6. Install on your own iPhone from TestFlight

**C - a MacBook.** Runs both targets natively; Android Studio is
cross-platform including Apple Silicon. Also unlocks free *Personal Team*
signing: sign in to Xcode with a normal Apple ID and install on your own device
with no $99 - limited to **7-day provisioning, 3 devices, 3 apps per device, no
TestFlight, no App Store.**

### The line that decides it

**Free personal-team signing only exists inside Xcode on a Mac.** Those
certificates never appear in the developer portal, so no CI system can use them.

> **Windows + free + a real iPhone - pick two.**

**Recommendation: B.** The $99 is needed eventually anyway for TestFlight and
the store, the pipeline is already built, and it is ~$500 cheaper than a laptop.

---

## 6. Costs

| | |
|---|---|
| Apple Developer Program | **$99/year** - required for TestFlight, the App Store, and any CI signing |
| Google Play Console | **$25 one-time** |
| GitHub Actions | Included allowance covers this build frequency |
| Xcode / Android Studio | Free |

---

## 7. The one unproven thing

**Does an already-established WebRTC call survive the phone locking?**

Everything else on this route is understood. This is not, and it has to be
answered on real hardware before anything ships.

The precise question: Safari suspends WebRTC and Web Audio the moment it is
backgrounded or the screen locks - that is documented and is why the browser
PWA cannot be the whole answer. Whether a **WKWebView inside a native shell
with `UIBackgroundModes: audio`** holds an **already established** call is a
*different* question. The separately documented WKWebView restriction is that it
cannot *start new* audio in the background, which is not the same thing.

I previously described this as a dealbreaker for the PWA route. That overstated
it by conflating the two restrictions. It remains genuinely untested.

**If it fails**, the fix is a small native plugin that owns `AVAudioSession`
while a call is up - not a rewrite of the dialer.

### How to test it, cheapest first

1. **Android first.** Free, needs no account, and the CI job already produces an
   installable APK. Download the artifact, sideload it, place a call, **lock the
   phone.** Same question, $0, and if it fails there it will fail on iOS too.
2. **Then iOS** - either a free Personal Team on a borrowed Mac, or the $99 to
   TestFlight route from Windows.

---

## 8. Store submission - what will be asked for

### Apple Guideline 4.2 (Minimum Functionality)

A thin website wrapper is rejected. **This app clears it** on microphone use,
background audio, and placing real phone calls - but the review notes have to
*say so*, with a **test account a reviewer can actually dial from**, rather than
leaving them to discover it. A reviewer who opens the app, sees a login, and
cannot get past it will reject on 4.2 and 5.1.1 both.

### Authentication

**Google refuses OAuth inside embedded WebViews.** Sign-in must go through
`ASWebAuthenticationSession` on iOS and Custom Tabs on Android. Those are system
sheets that share cookies and dismiss themselves - they read as part of the app
rather than as a popup, which is why those domains are *not* in
`allowNavigation`.

### Still needed before submission

- App Store / Play listing copy, screenshots, privacy labels
- A privacy policy URL (exists on the marketing site - confirm it covers
  microphone and call recording explicitly)
- Recording disclosure, since campaigns can have recording enabled
- Signing keys: an Apple `.p12` + provisioning profile, and an Android upload
  keystore. **Both become repository secrets. Neither exists yet** - which is
  why the CI file produces test artifacts and is honest about it.

---

## 9. Open items

- [ ] **Run the Android lock-screen test.** Everything else waits on this.
- [ ] Decide route B ($99 + CI signing) vs. route C (buy a Mac)
- [ ] Add the signing + TestFlight job to `mobile-build.yml` once secrets exist
- [ ] App icons and splash assets - currently Capacitor defaults
- [ ] `INTERNET` is declared twice in `AndroidManifest.xml` (once in the
      permissions block, once in Capacitor's generated block at the bottom).
      Harmless - Android dedupes - but worth tidying on the next native change.
- [ ] Store listings, screenshots, privacy labels
- [ ] Confirm `ASWebAuthenticationSession` / Custom Tabs sign-in actually works
      in the shell, on both platforms

---

## Sources

Vendor documentation, separated from commentary.

**Apple**
- [Xcode Cloud requirements](https://developer.apple.com/documentation/xcode/requirements-for-using-xcode-cloud)
- [Swift Playgrounds will not open .xcodeproj](https://developer.apple.com/forums/thread/704316)
- Developer Program License Agreement 3.3.1(B) - interpreted code
- App Review Guideline 4.2 - Minimum Functionality

**GitHub**
- [Actions billing and the macOS multiplier](https://docs.github.com/en/actions/concepts/billing-and-usage)

**Community / commentary - treated as leads, not as vendor fact**
- [Creating an iOS provisioning profile and .p12 on Windows](https://www.joshmorony.com/how-to-create-an-ios-provisioning-profile-and-p12-with-windows/)
- [Generating iOS p12 certs without a Mac](https://gist.github.com/jcward/d08b33fc3e6c5f90c18437956e5ccc35)

---

*Last updated 17 September 2026.*
