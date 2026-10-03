# Portable implementation and documentation decisions

The [current delivery scope](current-delivery-scope.md) selects a small Linux/Docker
harness: scenario → authorized inputs → capture → render → measure → independent
review → deliver. Preserve Remotion, existing recorder/template/gates, five
scenes totaling 45s, three formats and a full wide repeat. No hosted service,
new renderer, database or orchestration engine is introduced.

## Canonical interface and trust

[bin/promo-video](../bin/promo-video) is the supported doctor/capture/render/verify
entrypoint. The [canonical skill](../.claude/skills/promo-video/SKILL.md) routes
seven modules to that interface and the [walkthrough](pipeline-walkthrough.md).
Installing only the skill file is not installing the full runtime. Legacy
scripts remain optional explicit environment adapters; historical host defaults,
private watchdog assumptions and single-format drafts do not establish portable
acceptance. No hidden asset path or silent runtime install is part of quickstart.

The historical accepted executable source is `c0910b4`; final candidate changes
are documented separately. HEAD, dirty state and source/config SHA256 inventory remain
separate evidence. A new revision needs new bound evidence. Documentation-only
work never rewrites historical source receipts, telemetry or measurements.

Configuration and recorder are trusted executable code. The synthetic recorder
uses only an owned file UI and rejects non-file network requests. A custom
`--config` remains demo configuration, not permission for arbitrary remote UI
capture. Dependencies are prepared separately using the unchanged reviewed
lockfile and `npm ci --ignore-scripts --no-audit --no-fund`. Remotion is 4.0.529;
capture Playwright is 1.60.0. No separate shared-host UI inspection container is an external-user requirement.

## Resources, isolation and exit semantics

Accepted runtime flags explicitly set CPU 2/RAM 3g, `--timeout 900` per operation
and `--attempt-timeout 4800` per CLI command. Encoding keeps CRF20, concurrency1
and full 45 seconds. These overrides differ from CLI defaults; no reduced
quality/duration, skipped gate or unbounded identical retry can count as success.
The whole supervisor has a 45s cleanup grace. Timeout is code 2, including partial
MP4 output. The old 300s timeout at 816/1,350 frames remains historical failure.

Use an already provisioned compatible own image through `PROMO_IMAGE`; runtime
resolves its immutable ID and never pulls/builds. No ports (including databases),
network, Docker socket or host secrets or user-home mounts in capture/render containers.
Explicit source/dependency inputs mount read-only; owned external artifacts are
writable. PIDs/shared memory/file size are bounded, capabilities dropped, no new
privileges/restarts. Cleanup uses observed created CID and ownership, never a
proposed name that could belong to someone else. Immediately before real browser
E2E, inspect resources/processes/image/mounts read-only and coordinate shared-host
locks. The artifact-workspace render lock alone is not global host coordination.

Codes are preserved: 0 means named checks ran and passed, 1 is a demonstrated
defect, 2 is unavailable/incomplete work/evidence. Aggregate gates prioritize a
measured defect over missing data. Portable watchdog is `not_applicable` with
rationale; a required unavailable watchdog is `unavailable` and returns 2. Never
fabricate clean watchdog evidence. Docker lifecycle observations remain required.

## Source-bound proof and independent judgment

The CLI stages existing sources/manifests/config/policy, with the intended
`work/node_modules -> /deps/node_modules` dependency symlink and read-only prepared
tree. Recording/font assets are regular sealed files. Extra execution inputs,
unexpected symlinks, missing inspections and unavailable cleanup block success.
Original receipts preserve exact attempt/path/source/config/image identity and
input/media/proof hashes; fixture results cannot attest real Docker E2E.

For acceptance of a future video, required operations are capture/log, config inspection, bundle, all three full
renders/probes, wide repeat/byte comparison, decoded-media, storyboard and
transition proof generation, then independent visual/caption/transition review
and receipt verification. An empty transition index is valid only when existing
`make` finds no matching events. It is not evidence of inspecting every frame.

Immutable artifacts include recordings/logs, config/policy, MP4s, proof indexes
and PNG sheets. Existing `verdict.tsv` and `captions-proof.tsv` review declarations
are mutable regular files and retain unknown values until review. Visual verdicts
carry output MP4 SHA256; transition verdicts carry recording SHA256. Caption TSV
has no hash column: bind its review through sealed recording/config hashes and
exact source receipt, documented in the independent review record. Do not extend
schemas or describe gate declarations as automated semantic/visual judgment.
Changed output requires matching proof and new independent review.

Roles are coordinator, author and independent reviewer, with no vendor-plugin
requirement. One writer per checkout; coordinator owns manifests/lockfiles.
Project coding uses only OpenAI coding models, baseline `gpt-6.1-sol high`, a
planner/reviewer different from coder and fresh `gpt-6-astra` review. Requested
model is distinct from actual model; actual model/usage require host evidence,
otherwise null. No invented usage, cost or measured peak-memory values.

Every attempt names files/result/checks/resources/deadline/stop/owner. A deadline
ends that attempt, not the autonomous project. Preserve accepted revision,
remaining criteria and concrete next action; verify its executor starts. A real
external blocker needs evidence and exact required input, while independent
authorized work continues. No scheduler or automatic extension is introduced.

## Current scope and remaining acceptance

Current delivery is the complete harness source, without new MP4 samples.
The [runtime evidence](runtime-evidence.md) distinguishes historical `c0910b4`
installation/doctor/tests/UI/capture results from later candidate changes.
The only candidate runtime change requires an explicit `WATCHDOG_LOG` and returns
2 before access when absent; explicit-file gate behavior stays 0/1/2. Dockerfile
cleanup changes comments only, without changing instructions or pins. Both files
are inventoried in receipts, so historical receipts cannot attest this candidate.

Fast CI checks shell/Node syntax and the existing Node tests with a Docker fixture.
It installs no dependencies and starts no Docker image, capture or render. Public
export includes the full runtime closure plus curated documentation and omits
historical plans, telemetry, secrets and generated assets. The coordinator makes
a fresh Git snapshot, with [provenance and publication status](publication-status.md).

On 2026-10-03 the owner created the public repository and explicitly authorized
uploading the independently accepted source export. This covers source
publication, not a new own-code license: no LICENSE is added. Dependency terms
remain separate. No release tag, hosted image, paid call, deployment or new media
is part of this publication. A future video needs separate full render/repeat/
media and independent visual/caption acceptance.
