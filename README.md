# promo-video-harness

A Linux/Docker harness for a local synthetic web demo, using the existing
Playwright recorder, Remotion template and source-bound verification gates.
The current delivery is the complete harness source, without finished MP4 samples.

Historical source `c0910b4` passed 29 tests, UI checks, capture and doctor; a fresh
lockfile install also passed. Full rendering has not completed. These results do
not certify the later watchdog/comment edits or a new export. See
[runtime evidence](docs/runtime-evidence.md) and [delivery scope](docs/current-delivery-scope.md).

## Get the complete harness and prepare dependencies

Use Linux, Bash 4+, Node 22, npm, Docker and the standard tools checked by doctor.
Use the complete source checkout from the public repository:

```bash
git clone https://github.com/djd1m/promo-video-harness.git ./promo-video-harness
cd ./promo-video-harness
(cd promo/remotion && npm ci --ignore-scripts --no-audit --no-fund)
```

Image provisioning is a separate optional step requiring network access. The
[existing pinned recipe](promo/render-image/Dockerfile) previously completed a
clean build (exit 0); this is historical evidence, not a new build of this candidate:

```bash
# Only when provisioning your own image; omit if already prepared.
TAG='promo-render:local-reviewed' bash promo/render-image/build.sh
```

Select that compatible prepared image explicitly. The CLI never installs,
pulls or builds dependencies/images. Create an owned artifact directory outside
both the checkout and your home; generated media and recordings stay outside Git:

```bash
export PROMO_IMAGE='promo-render:local-reviewed'
artifact_dir=$(mktemp -d /tmp/promo-video-demo.XXXXXXXX)
common=(--artifacts "$artifact_dir" --config "$PWD/demo/synthetic/config.mjs"
        --cpus 2 --memory 3g --timeout 900 --attempt-timeout 4800
        --watchdog not_applicable)
bin/promo-video doctor "${common[@]}"
```

## Optional video workflow

Before real browser E2E, perform the read-only resource/image/mount preflight in
the [walkthrough](docs/pipeline-walkthrough.md). No shared-host UI container is
needed by an external user. Execute trusted configuration and recorders only.

```bash
bin/promo-video capture demo "${common[@]}"
# Set to the exact Capture inputs path printed by that successful command.
capture_inputs="$artifact_dir/attempts/capture-XXXXXXXX/assets"
bin/promo-video render demo "${common[@]}" --inputs "$capture_inputs"
# Complete independent visual/caption review before verification.
# Set to the exact Render attempt path printed by that command.
render_attempt="$artifact_dir/attempts/render-XXXXXXXX"
bin/promo-video verify demo "${common[@]}" --inputs "$render_attempt"
```

Replace both placeholders. Per-operation timeout is 900s; attempt timeout is
4,800s plus cleanup grace. Video acceptance needs all gates and independent
review. Codes: **0** named checks passed; **1** demonstrated defect; **2** work or
evidence unavailable/incomplete. A passing capture does not establish video acceptance.

## Connect the skill separately

Register the complete canonical directory `.claude/skills/promo-video/` from this
checkout using your agent's supported skill mechanism. Keep its modules/scripts
and this runtime together; copying `SKILL.md` alone does not install the harness.
Read the [skill](.claude/skills/promo-video/SKILL.md),
[architecture](docs/implementation-decisions.md), [notices](THIRD_PARTY_NOTICES.md)
and [publication status](docs/publication-status.md). Own-code licensing and
publication was explicitly authorized by the owner. No own-code license has
been selected; no additional license grant is implied.
[Русский](README.ru.md).
