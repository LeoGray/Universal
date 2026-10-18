# Apple TV playback compatibility

A separate, minimal Surge module for use alongside the existing DualSubs subtitle module. It replaces iRingo TV's playback URL handling without rebuilding Apple TV's navigation or changing the account storefront, locale, headers, proxy selection, or DNS. It does not translate subtitles itself.

Install this module **instead of iRingo TV**; do not enable both. Keep the existing DualSubs module, its certificate setup, and translation settings. The Universal stable release remains `v1.8.1-leogray.3`; this helper has a separate version and does not upgrade Universal to the diagnostic `.4` release.

Candidate installation URL:

```
https://github.com/LeoGray/Universal/releases/download/apple-tv-playback-v1.0.0/AppleTV.Playback.sgmodule
```

## Why separate it

The iRingo TV 3.4.4 response script rebuilds `applicationProps.tabs` in `/uts/v3/configurations`, independently of `ThirdParty` and `isWorkaroundSSLPinning`. After a Store sign-in restored an affected Apple TV, enabling that module reproduced the failure. System logs show a disk configuration cache hit, successful JavaScript initialization, then `can't get tab bar` and the generic network error screen. The specific field rejected by the app is private in the system log; it has not been identified.

This helper never matches `/configurations`. It only processes successful GET responses under six UTS v3 content endpoints: `canvases`, `shelves`, `movies`, `shows`, `episodes`, and `sporting-events`.

Within those responses, it changes string fields named `hlsUrl` only when their host is exactly `play.itunes.apple.com` or `play-edge.itunes.apple.com`, to their respective `play-cdn` / `play-edge-cdn` aliases. The two accompanying URL Rewrite rules route the aliases back to the original playback hosts. All other JSON bytes are preserved, including navigation metadata, large numeric IDs, DRM/FairPlay license URLs, subtitle metadata and storefront fields. Invalid JSON or other errors pass through unchanged. Responses larger than 2 MiB pass through without the script, according to Surge's `max-size` behavior.

The module has no request script, external API calls, persistent storage, logging, or proxy/DNS rules. It does not clear an existing bad configuration cache. Its MITM hosts are limited to the UTS API and the two aliases; the subtitle hosts remain owned by DualSubs.

## Recovery and validation

1. Disable iRingo TV on the affected Apple TV. Keep it disabled after recovery.
2. If the homepage still fails, repeat the Store sign-out/sign-in that previously restored it, with Surge temporarily off: Settings → Profiles and Accounts → current profile → Store. Do not remove the profile. Verify the homepage before adding the helper.
3. Install the helper in Surge, keep DualSubs enabled, then enable Surge/MITM and test the homepage, an original with official Chinese subtitles, and a licensed movie needing translated Chinese subtitles.
4. If the homepage regresses, disable the helper and report that result. Source and fixture tests are not device playback confirmation.

Release 1.0.0 is a test candidate: offline regression tests cover the script and its module declarations. Device validation of this exact helper is pending. Module installation, toggles, reloads and live Surge validation are user-operated.

## Tests and release

The script is a standalone Surge JavaScript file, with no build or third-party runtime dependencies:

```sh
node --test apple-tv-playback/playback.test.mjs
```

Publish the module and the exact tested script together under `apple-tv-playback-v<version>`. Script URLs are version-pinned. The separate workflow creates a prerelease with `--latest=false` and never uploads or changes any Universal assets.

## Provenance

The playback alias approach comes from [NSRingo/TV v3.4.4](https://github.com/NSRingo/TV/tree/084eff98931d7b85392f47e779645ecc10bed7f2), specifically [response.js](https://github.com/NSRingo/TV/blob/084eff98931d7b85392f47e779645ecc10bed7f2/src/response.js#L280-L304) and the [Surge template](https://github.com/NSRingo/TV/blob/084eff98931d7b85392f47e779645ecc10bed7f2/template/surge.handlebars#L16-L26). This independent implementation retains that limited behavior and excludes the original navigation and region features. Licensed under the repository's Apache-2.0 license.

Surge documents [response scripts and passthrough](https://manual.nssurge.com/scripting/http-response.html) and [URL Rewrite header mode](https://manual.nssurge.com/http/url-rewrite.html). Apple's [profile/account settings guide](https://support.apple.com/zh-cn/guide/tv/atvb13056b3d/tvos) identifies Store sign-in separately from profile removal.
