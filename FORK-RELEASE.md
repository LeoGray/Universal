Release 1.8.1-leogray.3: extend the Chinese subtitle language label and distinct rendition ID fix to Apple TV hardware. Preserve official Chinese tracks and the 30-second Apple translation timeout.

This fork adds official-Chinese-first behavior for Apple TV playback and the Mac/tvOS Chinese subtitle selection fix.

- Full official Simplified/Traditional Chinese tracks are preserved without synthetic Chinese options in the same subtitle group. Forced-only Chinese does not suppress full translation. Embedded Chinese CC is recognized when linked by a variant.
- If Chinese is absent, the Mac/tvOS translated track gets a distinct rendition ID and Chinese language label. Original tracks stay unchanged.
- iOS retains upstream generated-track labeling. The tvOS fix has source and compiled-bundle test coverage; on-device playback confirmation is pending.
- The earlier Mac rendition fix was verified by actual playback; the official-Chinese-first policy has automated fixture coverage, pending on-device confirmation.

Install (replace the original Universal module; keep iRingo TV enabled):
https://github.com/LeoGray/Universal/releases/latest/download/DualSubs.Universal.sgmodule

Build provenance: the patched Manifest is built from source. Unchanged runtime assets come from upstream v1.8.1 and are SHA-256 checked against upstream-release.json. The upstream protobuf submodule is unavailable publicly, so this fork does not claim to rebuild those unchanged bundles. Module/resource URLs are pinned to this fork release; the shared PreferencePanes API remains an upstream dependency.

Original project and Apache-2.0 license: https://github.com/DualSubs/Universal
