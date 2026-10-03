# promo-video-harness development

Read [current delivery scope](docs/current-delivery-scope.md),
[architecture](docs/implementation-decisions.md) and
[walkthrough](docs/pipeline-walkthrough.md) before implementation.
Current delivery is the standalone Linux/Docker harness with one synthetic demo
and the existing renderer/gates. Finished MP4 samples are outside current delivery
acceptance. No hosted service or new engine.

Preserve source-bound receipts and codes 0/1/2. Historical evidence stays bound to
its exact source; changed runtime, scripts or recipe inventory cannot inherit it.
Only OpenAI coding models; baseline gpt-6.1-sol high. Planner/reviewer differs from
coder, with fresh Astra review. Actual model/usage require host evidence, else null.
One writer per checkout; root coordinator owns manifests/lockfiles. Bound every
attempt by files, result, checks, time and stop conditions. Keep each non-lockfile
under 500 lines. Product/architecture decisions and walkthrough belong in docs.

No secrets, raw recordings or customer inputs in Git. Inspect resources, active
jobs, image and mounts read-only immediately before real Docker browser E2E.
No database ports, Docker socket or host secrets in render/capture containers.
Use trusted executable configs/recorders; provision dependencies/images separately.
No remote publication, paid calls, deployment or license representation until
concrete reviewed package/release conditions are satisfied.

Autonomous work continues until the agreed result is successfully completed.
Pause only at the owner's explicit request. Time limits and handoffs are
checkpoints: inspect artifacts and delays, then launch the next bounded step.
Do not silently extend an identical attempt or weaken required checks. Record
the accepted revision, remaining criteria, next action and responsible executor;
verify continuation actually starts. Report an external blocker with evidence
and exact needed input; continue independent authorized work. Do not claim a
running background task when execution has stopped. Send the coordinator a
concise snapshot about every ten minutes without introducing a scheduler.
