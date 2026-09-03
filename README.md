# cordova-plugin-boogie-insomnia

![platforms](https://img.shields.io/badge/platforms-android%20%7C%20ios%20%7C%20browser-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![tests](https://img.shields.io/badge/tests-node--test-brightgreen)

Keep the device **screen awake** from JavaScript, on **Android, iOS, and the
browser**. Useful whenever the user is looking without touching: navigation and
maps, video/slideshow playback, showing a QR code or boarding pass, kiosk and
dashboard apps, reading views, live scoreboards.

A fork of [@globules-io/cordova-plugin-insomnia](https://github.com/globules-io/cordova-plugin-insomnia)
(itself a continuation of Eddy Verbruggen's Insomnia PhoneGap plugin) — same
zero-dependency approach (direct Java / Objective-C, no build steps), with a
Promise-based API, an `isKeptAwake()` query, automatic re-assert after
camera/picker interruptions, a Screen Wake Lock browser implementation, and tests.

## Install

From the Git repository:

```
cordova plugin add https://github.com/boogie/cordova-plugin-boogie-insomnia.git
```

Or from a local checkout:

```
cordova plugin add /path/to/cordova-plugin-boogie-insomnia
```

That's all — no permissions, no dependencies, no configuration. On Android the
plugin uses the window-scoped `FLAG_KEEP_SCREEN_ON` (no `WAKE_LOCK` permission
needed); on iOS it toggles `UIApplication.idleTimerDisabled`.

## JavaScript API

The plugin clobbers a global `boogieInsomnia`. Everything is Promise-based.

```js
// Keep the screen on while it matters…
await boogieInsomnia.keepAwake();

// …check the state whenever…
const awake = await boogieInsomnia.isKeptAwake();   // true

// …and let it sleep again when done.
await boogieInsomnia.allowSleepAgain();
```

### `keepAwake()`

Keeps the screen on until `allowSleepAgain()` is called (or the WebView
navigates — see below). Idempotent: calling it twice is fine and both calls
resolve. Rejects only if something fatal prevented the request (no activity on
Android; unsupported browser).

### `allowSleepAgain()`

Returns the screen to its normal sleep schedule. Idempotent — calling it
without a prior `keepAwake()` simply resolves.

### `isKeptAwake()`

Resolves a boolean: whether keep-awake is currently requested.

## Describe and raw exec

A Cordova plugin's JS bridge (`www/insomnia.js`) ships frozen together with its
native half — an over-the-air update of the app's web code never replaces
`plugins/`. App code newer than the bridge therefore gets two uniform escape
hatches, the same on every `boogie*` plugin (bridge contract v1):

### `describe()`

Resolves what the native half is and can do. Cheap and side-effect free — no
permission prompts, no I/O, no timers — and it never fails natively:

```json
{
  "id": "cordova-plugin-boogie-insomnia",
  "version": "1.1.0",
  "platform": "android",
  "api": 1,
  "actions": ["allowSleepAgain", "describe", "isKeptAwake", "keepAwake"],
  "features": { "reassertOnResume": true }
}
```

`version` is the `plugin.xml` version the native half was built from, `platform`
is `"android"`, `"ios"` or `"browser"`, `actions` lists every action that
platform dispatches (sorted), and `features` holds plugin-specific static facts —
here just `reassertOnResume`, the automatic re-assert after camera/picker
interruptions (browser: re-acquire on `visibilitychange`).

### `exec(action, args, onProgress)`

Raw passthrough to `cordova.exec` for the `InsomniaPlugin` service, for reaching
a native action this bridge does not expose. Resolves with the (first) native
result; if `onProgress` is a function every native success callback is passed to
it as well (for `keepCallback` streams). Rejects with an `Error` whose message is
the native error string (or its `.message`, or its JSON) and whose `.native`
holds the raw payload.

```js
const info = await boogieInsomnia.exec('describe');   // same as describe()
```

**Warning:** `exec()` bypasses the bridge entirely — no argument normalisation,
no result coercion (`isKeptAwake` comes back as `1`/`0` on Android, not a
boolean), no protection against unknown actions. Prefer the named methods.

### `ID`, `VERSION`, `SERVICE`

Read-only constants on the global: the plugin id, the bridge version (equals
`plugin.xml` at install time — compare it with `describe().version` if you
suspect a stale install), and the native service name (`InsomniaPlugin`).

## Behavior notes

- **External UI can't silently undo it.** The upstream plugin documented a
  long-standing quirk: after using the camera or the photo picker, the OS
  re-enables the idle timer and the app falls asleep despite `keepAwake()`
  ([iOS report](https://github.com/EddyVerbruggen/Insomnia-PhoneGap-Plugin/issues/29),
  [Android report](https://github.com/EddyVerbruggen/Insomnia-PhoneGap-Plugin/issues/30)),
  so callers had to re-run `keepAwake()` manually. This fork re-asserts the
  keep-awake natively every time the app returns to the foreground while it is
  active — no JS workaround needed.
- **WebView reload releases the lock.** A page navigation destroys the JS state
  that requested the keep-awake, so the native side releases it instead of
  leaving the screen forced on with nothing tracking it. Call `keepAwake()`
  again from the new page.
- **Scope.** The lock is only in effect while your app is in the foreground —
  neither platform keeps the screen on for an app in the background, and the
  flag/idle-timer is per-app, not system-wide.
- **Browser** uses the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API):
  it needs a secure context (HTTPS or localhost) and a supporting browser,
  otherwise `keepAwake()` rejects. The OS releases the lock whenever the tab is
  hidden; the plugin re-acquires it automatically when the tab becomes visible
  again while keep-awake is active.

## TypeScript

`index.d.ts` ships with the plugin and declares the `boogieInsomnia` global —
most setups pick it up automatically via the `types` field; otherwise add the
plugin folder to `typeRoots`/`include`.

## Differences from the original

- Promise-based API on a `boogieInsomnia` global (was callback-style on
  `window.plugins.insomnia`).
- `isKeptAwake()` query (new).
- The keep-awake is re-asserted automatically after camera/photo-picker
  interruptions — upstream's documented quirk — and released on WebView
  navigation instead of leaking.
- Real browser support via the Screen Wake Lock API with automatic re-acquire
  (was a console-log stub).
- Android: activity-null guard, native state tracking; unknown actions are
  reported by Cordova as invalid instead of a custom error string.
- iOS: state moved into the plugin instance, main-thread-safe idle-timer
  access, `UIApplicationDidBecomeActiveNotification` observer.
- Windows/WP8 support dropped (`cordova-windows` is discontinued).
- TypeScript definitions, tests (`npm test`, plain `node:test`, no
  dependencies), and GitHub Actions CI.
- `describe()` / `exec()` / `ID` / `VERSION` / `SERVICE` — the bridge contract
  shared by the `boogie*` plugins (see above).

## Ideas / roadmap

Things that would fit this plugin (or a sibling) nicely — not implemented yet:

- **`keepAwake({ timeout })`** — auto-release after N milliseconds, so a
  forgotten lock can't drain the battery overnight.
- **`keepAwake({ dim: true })`** — keep the screen on but drop its brightness
  (Android `screenBrightness`, iOS `UIScreen.brightness`): the kiosk/dashboard
  sweet spot between "awake" and "wasting power".
- **Charging-aware mode** — `keepAwake({ whileCharging: true })` keeps the
  screen on only while plugged in, the natural policy for dock/nightstand apps.
- **State-change events** — an `onChange` callback firing when the lock is
  acquired, released, or re-asserted (the browser side already knows; native
  sides could report re-asserts after interruptions).
- **Reference counting** — `keepAwake()` returning a handle with its own
  `release()`, so independent app features can hold the lock without stomping
  on each other's `allowSleepAgain()`.
- **CPU wake lock sibling** — a related but different feature: Android
  `PARTIAL_WAKE_LOCK` (needs the `WAKE_LOCK` permission) to keep background
  work running with the screen off; would pair with iOS background tasks.
- **Electron support** — a proxy on `powerSaveBlocker` for
  Cordova-in-Electron / web builds packaged with Electron.

Issues and PRs welcome.

## Tests

```
npm test
```

Runs on Node 18+ with the built-in `node:test` runner — no dev dependencies.
The suite unit-tests the JS bridge against a mocked `cordova/exec`, exercises
the browser proxy against a faked `navigator.wakeLock`/`document` (acquire,
release, denial, re-acquire on visibility), and cross-checks `plugin.xml`,
`package.json`, `index.d.ts`, and the native sources for consistency (ids,
versions, referenced files, action names), including the bridge contract: one
version literal everywhere, `describe` dispatched on every platform, and each
platform's reported action list equal to what it actually dispatches.

## Layout

```
plugin.xml                — Cordova manifest (android + ios + browser)
package.json              — npm/cordova metadata, npm test
index.d.ts                — TypeScript definitions for the boogieInsomnia global
www/insomnia.js           — the JS bridge (global: boogieInsomnia)
src/android/InsomniaPlugin.java — native Android (FLAG_KEEP_SCREEN_ON)
src/ios/InsomniaPlugin.{h,m}    — native iOS (idleTimerDisabled)
src/browser/insomnia.js   — browser proxy (Screen Wake Lock API)
tests/                    — node:test suite (bridge + browser proxy + structure)
```

The Java package is `hu.barthazi.insomnia`; the iOS class is `InsomniaPlugin`.

## Credits & License

MIT. Based on [@globules-io/cordova-plugin-insomnia](https://github.com/globules-io/cordova-plugin-insomnia),
which continues [Eddy Verbruggen](https://github.com/EddyVerbruggen)'s Insomnia
PhoneGap plugin — the Git history of this repository preserves the original
commits.
