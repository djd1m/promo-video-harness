# 04: Assemble and render

Run `bin/promo-video render demo` with the accepted capture assets path and all
resource/time flags from the [walkthrough](../../../../docs/pipeline-walkthrough.md).
The CLI forwards the existing [renderer](../../../../promo/remotion/shared/render.sh)
to its portable execution adapter; do not invoke the legacy branch as quickstart.

The adapter checks capture receipt identity against current source, config and
resolved image, then stages the template, manifests, TypeScript config and fixed
`0-45` synthetic policy outside Git. Prepared dependencies mount read-only at
`/deps/node_modules`; the sole intended dependency symlink points there. Image
DejaVu fonts and three recordings become regular sealed public files. Unexpected
execution files or runtime-changing symlinks fail verification.

The existing [template contract](../../../../promo/remotion/shared/README.md)
requires five scenes totaling 45 seconds, one final outro, valid tracks/segments,
crops within source bounds, readable captions and footnotes. Config inspection
exports caption, visible-window and boundary rows. Confirm exclusions against
actual visible windows; a crop rectangle is not a redaction mask.

Portable execution performs, sequentially:

1. Existing config gate and bundle.
2. Full 16:9, 9:16 and 1:1 renders and each existing probe.
3. Full 16:9 repeat using identical flags, then byte comparison (`cmp`).
4. Existing decoded-media gate: 1,350 decoded frames and no audio per format.
5. Existing storyboard sampling every 0.25s and scene/segment boundary ±5 frames.
6. Existing transition `make`, caption-proof placeholders, execution/input sealing.

Encoding stays H.264 High, CRF 20, yuv420p, bt709, 30 fps, concurrency 1 and
512MiB off-thread video cache; output is 1920×1080 / 1080×1920 / 1080×1080.
CPU ≤ 2, RAM 3g, operation timeout 900s and whole-command timeout 4,800s are
explicit accepted settings, not CLI defaults. No partial frame range or reduced
duration counts. A timeout, including a partially written MP4, is 2, not pass.

The render lock is `$PROMO_ARTIFACTS/render.lock` with bounded acquisition; it
coordinates that artifact workspace only. Shared hosts need their separate
execution protocol. Do not silently repeat the same timed-out attempt. Keep its
receipt, diagnose the cause, and assign a changed bounded next step.

The attempt contains `out/final/{16x9,9x16,1x1,16x9-repeat}.mp4`, operation logs,
`out/final/proof/` and `receipt.json`. Render exit 0 establishes generation and
required automated checks. Visual/caption/transition declarations remain `?`
until independent review. Continue with [measure](05-measure-and-receipt.md).

Legacy `render.sh`/`render-run.sh`, stills and frame helpers are optional adapters
with explicit `PROMO_ASSETS`, `PROMO_LOCK`, `PROMO_IMAGE`, `PROMO_REMOTION` or
`PROMO_RENDER` as their code requires. Their resource/host-watchdog and text
receipt contracts differ. They are not an alternate portable acceptance path;
no silent install, hidden assets or old environment defaults may be assumed.
