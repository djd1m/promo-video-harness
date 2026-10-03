# Portable pipeline walkthrough

Use the full harness checkout on Linux with Bash 4+, Node 22, Docker and the
standard CLI tools checked by doctor. The canonical
[skill](../.claude/skills/promo-video/SKILL.md) accompanies the runtime; copying
only its `SKILL.md` cannot install the recorder, renderer, gates or dependencies.
The single supported entrypoint is [bin/promo-video](../bin/promo-video).

The owned synthetic Little Board UI provides three actions per viewport. Its
trusted [config](../demo/synthetic/config.mjs) and
[recorder](../demo/synthetic/record.mjs) produce three 37-second inputs. Existing
Remotion 4.0.529 renders five scenes of 6 + 11 + 11 + 11 + 6 = 45 seconds at
30 fps in 1920×1080, 1080×1920 and 1080×1080, plus a full 16:9 repeat. Capture
requires Playwright 1.60.0. No hosted service, new engine, audio or paid provider.

## Fix source and prepare environment separately

Use the reviewed complete source checkout from the [quickstart](../README.md).
Record its own revision and dirty state for every new attempt; a fresh public
snapshot does not contain historical donor commits. Historical acceptance at
`c0910b4` is described in [runtime evidence](runtime-evidence.md), not a command
to check out an absent commit or rebind an old receipt.

```bash
git rev-parse HEAD
git status --short
(cd promo/remotion && npm ci --ignore-scripts --no-audit --no-fund)
```

Only execute trusted configs/recorders/manifests in a dedicated environment.
Provision a compatible pinned [image](../promo/render-image/README.md) separately;
these commands do not authorize image publication or new paid/network services.
The CLI does not install, pull or build. Select an already prepared own image:

```bash
export PROMO_IMAGE='promo-render:local-reviewed'
# Replace only with your already provisioned, validated image reference.
artifact_dir=$(mktemp -d /tmp/promo-video-demo.XXXXXXXX)
config_file="$PWD/demo/synthetic/config.mjs"
common=(--artifacts "$artifact_dir" --config "$config_file"
        --cpus 2 --memory 3g --timeout 900 --attempt-timeout 4800
        --watchdog not_applicable)
```

The artifact directory must be owned and external to the checkout and user home;
mount paths containing colon, comma or newline are rejected. Quote all paths.
Keep recordings, media, logs, screenshots, customer inputs and secrets out of Git.

## Doctor, preflight and capture

```bash
bin/promo-video doctor "${common[@]}"
```

Doctor only inspects tool/image/dependency availability. Immediately before the
real browser E2E, inspect resources, active jobs, image and intended mounts
read-only; obtain any shared-host execution lock. Example inspection:

```bash
free -m
df -h "$artifact_dir"
ps -eo pid,comm,%cpu,%mem --sort=-%cpu
docker ps --no-trunc
docker image inspect "$PROMO_IMAGE" --format '{{.Id}} {{json .Config}}'
# If containers are active, inspect their resources and mounts read-only:
# docker inspect --format '{{json .HostConfig}} {{json .Mounts}}' CONTAINER_ID
# Confirm source/input mounts are trusted and no host-secret/socket mounts exist.
```

Check available capacity before proceeding; do not stop other containers. The
CLI's artifact-workspace render lock does not coordinate unrelated host jobs.
No separate shared-host UI inspection container is required. No database ports
are needed. The portable capture image supplies the matching browser.

```bash
bin/promo-video capture demo "${common[@]}"
```

Use the exact `Capture inputs:` path printed on successful completion, not a
prior attempt. Capture writes three WebMs, file-relative events and a source/
config/image-bound receipt, then invokes existing `gate-log.mjs`.

## Render and measure

```bash
# Replace this placeholder with the exact successful Capture inputs path.
capture_inputs="$artifact_dir/attempts/capture-XXXXXXXX/assets"
bin/promo-video render demo "${common[@]}" --inputs "$capture_inputs"
```

Do not execute the placeholder unchanged. Each command creates a unique attempt
and prints its receipt; render also prints `Render attempt:`. With the accepted
settings each Docker operation is bounded by 900s and the whole CLI command by
4,800s, plus a 45s supervisor cleanup grace. These are explicit overrides: CLI
defaults are 600s operations, 1,800s attempts, CPU2 and RAM4g. Code accepts CPU
(0,2], RAM500m–4096m/1g–4g, operations1–1800s, attempts1–7200s; acceptance here
uses CPU2/RAM3g and never reduces CRF20, full duration or concurrency1.

The CLI checks current capture source/config/image identity, stages and seals
inputs, then forwards the existing renderer. Prepared dependencies mount
read-only at `/deps/node_modules`. Image fonts and recordings are regular staged
public files; unexpected execution files/symlinks fail. It runs config inspection,
bundle, three full formats/probes, a full wide repeat and `cmp`, decoded-media
checks, storyboard sheets, transition `make` and caption-proof generation.

Outputs are `RENDER_ATTEMPT/out/final/{16x9,9x16,1x1,16x9-repeat}.mp4`, logs,
`proof/` and `RENDER_ATTEMPT/receipt.json`. Encoding is H.264 High, CRF20,
yuv420p, bt709, 30 fps, concurrency1. Required probe/media evidence is 1,350
frames, 45s, correct dimensions and no audio; repeat must match bytes in this
pinned environment. Cross-platform byte identity is not promised.

Preserve original receipts: source HEAD/dirty state/hash inventory, config,
image and observed container identity, exits/OOM/restarts/timeouts, owned-CID
cleanup, input/media/proof hashes and required checks. Requested model is not
actual model evidence; actual model/usage and unmeasured costs/peaks stay null
without host observations. See [measurement module](../.claude/skills/promo-video/modules/05-measure-and-receipt.md).

## Independent review, verify and deliver

The separate reviewer watches all three videos, sampled/boundary sheets and each
dangerous transition frame, and proves every caption from the sealed recording.
Fill existing `proof/verdict.tsv`, `proof/captions-proof.tsv` and transition
verdicts with the exact vocabulary in the
[final-check module](../.claude/skills/promo-video/modules/07-final-check.md).
Preserve MP4/recording SHA256 binding and immutable proof files. Record reviewer
identity, actual model evidence or null, source/config/receipt/media hashes and
findings in external review Markdown. Technical review alone does not accept
video content; generated placeholders remain `?` until actual review.

```bash
# Replace this placeholder with the exact successful Render attempt path.
render_attempt="$artifact_dir/attempts/render-XXXXXXXX"
bin/promo-video verify demo "${common[@]}" --inputs "$render_attempt"
```

Verify first checks immutable source/input/policy/media/proof binding, then the
existing media, visual/caption, transition and receipt gates. Capture-log/config/
probe/repro results remain mandatory through the source-bound prior receipts.
Changed bytes or verdicts for another SHA fail; blanks or missing evidence do
not pass. Review TSVs are mutable regular files; indexes, sheets and media are
immutable. No matching dangerous events yields the transition gate's explicit
empty index result, not an invented visual judgment.

**Every exit:** 0 = named checks performed and passed; 1 = demonstrated defect;
2 = unavailable/incomplete checks or evidence. Timeout/interruption is 2 and
cannot be passed off as a completed video. Aggregate gate results give observed
defects precedence over incomplete evidence. Portable watchdog is
`not_applicable` with rationale; `--watchdog unavailable` returns 2 when required
evidence cannot be obtained. Docker lifecycle evidence is always required.
Render 0 is generation success; delivery needs verify 0 and independent review.

Deliver three MP4s with scenario/authorized inputs, config/logs, receipts,
measurements/repro/proofs and reviewer record. New publication/deploy/paid calls,
license representations and release assets require separate accepted conditions.
Legacy advanced scripts are optional explicit environment adapters. The watchdog
gate requires an explicit readable `WATCHDOG_LOG`; absence returns 2 before log
access. Portable CLI watchdog remains `not_applicable` with rationale.

## Current evidence boundary

The [current delivery scope](current-delivery-scope.md) is the harness source;
new MP4 samples are optional. [Runtime evidence](runtime-evidence.md) records the
exact accepted historical source, installation/doctor/tests/UI/capture outcomes,
and source-inventory changes in this candidate. Full rendering has not completed.
The old 300s timeout at 816/1,350 frames remains an incomplete code-2 attempt.

Do not rewrite original receipts or telemetry, or reuse historical capture
acceptance across changed source inventory. No new capture/render/build is run
for this candidate. Optional future video delivery still needs full render,
repeat/media checks, independent review and verify. Harness publication needs
independent source/export validation, rights/license decisions and available
transport; see [publication status](publication-status.md).
