# Capture/render image

The portable Linux/Docker harness uses a provisioned image with Playwright
**1.60.0**, Chromium from that matching installation, FFmpeg/ffprobe and fonts.
Remotion **4.0.529** is a separately prepared lockfile dependency tree, not
installed by the runtime CLI. Read the
[walkthrough](../../docs/pipeline-walkthrough.md) for supported execution.

The [Dockerfile](Dockerfile) pins:

| Component | Recipe input |
|---|---|
| Runtime base | `mcr.microsoft.com/playwright:v1.60.0-noble` |
| Playwright package | `1.60.0`, matching base browsers; browser download disabled during package install |
| FFmpeg/ffprobe | `7:6.1.1-3ubuntu5` |
| DejaVu | `fonts-dejavu-core=2.37-8`; regular/bold used by synthetic demo |
| Font builder base | `node:22.22.0-bookworm-slim` |
| Onest input | `@fontsource-variable/onest@5.3.1`, integrity checked before extraction |

These are recipe pins, not a fresh image-build result or byte identity promise.
The CLI resolves `PROMO_IMAGE` to an immutable image ID and records actual
container identity. An available image is not proof of clean-build provenance.
The [font builder](fonts/build_onest.py) constructs static fonts and retains
nonempty package license/notice/copyright text and existing font metadata.
Package notices and source/font/dependency rights still require release review.
No own LICENSE or blanket redistribution permission is asserted.

## Separate provisioning

Only if image provisioning is authorized, build with the existing recipe:

```bash
# From the fixed trusted harness checkout; network/build work is separate.
image_tag='promo-render:local-reviewed'
TAG="$image_tag" bash promo/render-image/build.sh
export PROMO_IMAGE="$image_tag"
```

This example is not a claim that a clean build was performed. The build script
returns 0 when built, 1 on build failure and 2 when Docker is unavailable. Do not
pull/build inside capture/render. Provision dependencies separately from the
reviewed lockfile with `npm ci --ignore-scripts --no-audit --no-fund`.

Select an already prepared own image explicitly, then use the supported doctor:

```bash
export PROMO_IMAGE='promo-render:local-reviewed'
artifact_dir=$(mktemp -d /tmp/promo-video-image-check.XXXXXXXX)
bin/promo-video doctor --artifacts "$artifact_dir"   --cpus 2 --memory 3g --timeout 900 --attempt-timeout 4800   --watchdog not_applicable
```

Doctor inspects image/dependency/tool availability; it does not execute a clean
image build or certify final media. The legacy `check.sh IMAGE` is an optional
recipe diagnostic with a separate test-render/resource contract, not the
portable quickstart. Its historical measurements are not current evidence.

## Runtime isolation

The portable adapter uses no network, no published ports (including databases),
no Docker socket and no host secrets or user-home mounts. Explicit read-only source and
dependency mounts plus an external writable artifact directory are sufficient.
CPU ≤2, RAM 3g, concurrency 1, dropped capabilities, no new privileges, bounded
PIDs/shared memory/file size, no restart and owned-CID cleanup apply. Perform a
read-only image/resource/process/mount preflight immediately before browser E2E.
Never stop another user's containers or prune shared Docker data.

Portable host watchdog is `not_applicable` with rationale; Docker exit/state,
OOM/restarts, timeout and cleanup evidence remain mandatory. Required unavailable
watchdog evidence returns 2. Exit 0 is named checks passed, 1 is observed defect,
2 is unavailable/incomplete; timeout is 2. The shared host's Playwright 1.63 UI
container belongs to a separate coordination protocol, not external setup.
