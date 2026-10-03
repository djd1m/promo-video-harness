# 03: Capture

Use the exact doctor/capture commands in the
[walkthrough](../../../../docs/pipeline-walkthrough.md). Work from the accepted
fixed commit, with trusted [config](../../../../demo/synthetic/config.mjs)
and [recorder](../../../../demo/synthetic/record.mjs). Provision image and
lockfile dependencies separately. No automatic install or missing-lockfile
creation is permitted during capture.

Immediately before real Docker browser E2E, do a read-only preflight: available
CPU/RAM/disk, active jobs and container limits/mounts, selected image identity,
artifact ownership and any required host lock. On a shared host, coordinate the
heavy execution slot and do not stop another lane's containers. Playwright 1.63
host UI checks are separate; the portable capture requires 1.60.0.

The synthetic recorder opens only its local file UI. It captures three 37-second
recordings at 1920×1080, 1080×1920 and 1080×1080, 25 fps, using the existing HiDPI
recorder. Three actions per viewport occur near file seconds 1, 12 and 23. Final
render output is separately fixed at 30 fps and 45 seconds.

Required output in the unique capture attempt:

- `assets/demo-16x9.webm`, `demo-9x16.webm`, `demo-1x1.webm`;
- `assets/record-log-demo.json`, with `video.start`, file-relative `t_file_s`
  action events and `video.saved` observations;
- capture/config/log output, container observations, cleanup and `receipt.json`.

The CLI invokes existing `gate-log.mjs`; log success does not prove what the
finished video shows. Preserve each original receipt and its input hashes. Use
only the exact `Capture inputs:` path printed by this attempt for rendering;
never select the newest-looking directory or reuse an older green receipt.

The portable containers disable network and ports, cap CPU ≤ 2/RAM 3g under the
accepted flags, and receive only explicit input/output mounts. No Docker socket,
host secrets or database ports. Selected image ID, exits, OOM/restarts, timeout
and cleanup are observed in the receipt. Missing inspection or required watchdog
evidence gives 2; measured execution defects give 1. Timeout gives 2.

An optional legacy `scripts/capture.sh` adapter needs explicit `PROMO_CAPTURE`,
`PROMO_ASSETS`, trusted recorder/manifests, prepared dependency tree and its host
watchdog protocol. It is not the supported portable CLI and does not inherit the
portable timeout/watchdog guarantees. Do not rely on its historical defaults.

Stop on failed authorization, unavailable environment or failed capture/log
check. Preserve evidence and assign a new bounded corrective attempt. Continue
with [render](04-assemble-and-render.md) only after capture exit 0 against the
same accepted source/config/image.
