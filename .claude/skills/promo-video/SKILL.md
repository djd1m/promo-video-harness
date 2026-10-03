---
name: promo-video
description: >
  Produce and independently review a reproducible 45-second web-product promo
  in 16:9, 9:16 and 1:1 using the portable Linux/Docker harness, authorized
  screen recordings, the existing Remotion template and source-bound gates.
metadata:
  version: "1.2"
  maturity: beta
---

# promo-video

Use this canonical skill with the complete harness checkout. Installing only
`SKILL.md` does not install the CLI, recorder, template, gates, image or prepared
lockfile dependencies. Keep one canonical copy; connect the agent to this folder
using its supported skill mechanism. There is no required vendor plugin.

The supported entrypoint is [bin/promo-video](../../../bin/promo-video).
Read the [walkthrough](../../../docs/pipeline-walkthrough.md) for exact commands
and the [decisions](../../../docs/implementation-decisions.md) for architecture,
acceptance limits and current evidence. Advanced scripts are optional explicit
environment adapters, not the portable quickstart.

## Workflow

Read each module before its phase. Keep the sequence intact:
scenario → authorized inputs → capture → render → measure → independent review
→ deliver. Initial scenario claims are provisional until input authorization.

| Phase | Module | Required result |
|---|---|---|
| Scenario | [01: brief and scenario](modules/01-brief-and-scenario.md) | Five scenes totaling 45 seconds; captions with observable evidence |
| Inputs | [02: inputs and forbidden content](modules/02-inputs-and-forbidden.md) | Authorized routes/assets and exclusions; synthetic-data policy |
| Capture | [03: capture](modules/03-capture.md) | Three recordings, file-relative event log and current-source receipt |
| Render | [04: assemble and render](modules/04-assemble-and-render.md) | Three full formats, repeat, media/config/proof gates |
| Measure | [05: measure and receipt](modules/05-measure-and-receipt.md) | Exact attempt, source/config/image/media SHA256 and observed outcomes |
| Independent review | [06: coordination protocol](modules/06-swarm-protocol.md) | Separate reviewer inspects all formats, captions and dangerous transitions |
| Deliver | [07: final check](modules/07-final-check.md) | Verify succeeds and coordinator reports accepted evidence and limitations |

## Operating contract

- Linux, Bash 4+, Node 20+, Docker; Remotion **4.0.529**, Playwright **1.60.0**.
  Use a provisioned compatible image selected by `PROMO_IMAGE`. Dependencies are
  prepared separately; the CLI does not install, pull or build.
- Run trusted executable configuration and recorder only. Artifacts belong in
  an owned external directory. Do not commit secrets, customer inputs, raw
  recordings, screenshots, logs or videos. No database ports, Docker socket or
  host secrets in capture/render containers.
- Accepted execution profile: CPU ≤ 2, RAM 3g, CRF 20, concurrency 1, full 45s;
  explicitly pass `--timeout 900 --attempt-timeout 4800`. One writer per checkout;
  every attempt has files, result, checks, deadline and stop conditions.
- Immediately before real browser E2E, inspect resources, active work, image and
  mounts read-only and obtain any shared-host execution lock. The shared host's
  Playwright 1.63 UI check is a separate protocol, not a portable requirement.
- Portable watchdog state is `not_applicable` with rationale. If an adapter
  requires unavailable watchdog evidence, use `unavailable` and return 2.
- **0** = the named checks completed successfully; **1** = demonstrated defect;
  **2** = required work/evidence unavailable or incomplete. Timeout is 2 and
  never a pass. In aggregated gate results, a measured defect takes precedence.
  Render exit 0 does not imply independent visual or caption acceptance.
- Coordinator, author and independent reviewer are generic roles. For this
  project's coding work use OpenAI coding models, baseline `gpt-6.1-sol high`;
  planner/reviewer differs from coder, with fresh `gpt-6-astra` review. Record
  requested model separately; actual model and usage require host evidence,
  otherwise null. A prompt or self-report is not that evidence.

Source, fonts, dependencies and asset rights remain release checks. No own
license, publication, hosted service, deployment or paid call is authorized by
this skill. The current candidate has capture evidence; full MP4 and visual
acceptance remain pending. See the walkthrough's evidence boundary.
