# Runtime evidence and source boundaries

This is a public summary of coordinator-provided historical observations, not a
new runtime run or a rewritten receipt. Original logs/telemetry/receipts remain
preserved privately and are excluded from the source export.

## Accepted historical runtime source

Exact source: `c0910b4940db0ded54bf5a5b3487a718cbd37324`.

| Observation | Recorded result |
|---|---|
| Existing runtime test suite | 29 passed, exit 0 |
| Synthetic UI smoke | Three viewports, nine actions, exit 0 |
| Real capture and capture-log gate | Exit 0 |
| Doctor | Exit 0 |
| Fresh isolated `npm ci --ignore-scripts --no-audit --no-fund` | 251 packages, about 8 seconds, exit 0 |

UI smoke is historical supporting evidence, not a requirement to provision a
shared-host inspection container. Capture uses the harness's pinned Playwright
1.60.0 image; fixture tests do not attest Docker execution.

Previously supplied runtime image identity:
`sha256:57b5341dfb45b371c383fc9569a4d7ed619e612af293f2208707e9fddaff81fc`.
This identifies the supplied image; it does not by itself prove a clean build.
A separate previous real clean build of the pinned recipe completed with exit 0,
including Onest integrity verification and preservation of full notices. See
[third-party notices](../THIRD_PARTY_NOTICES.md). No new build occurs here.

## Render limitation

A historical real render reached **816/1,350 frames**, then exceeded its **300s**
limit and returned **2**. No finished MP4 or full three-format/repeat/decoded-media
or independent visual/caption acceptance is established. Raising documented
limits to 900s per operation and 4,800s per attempt is not evidence of completion.
The [owner's current scope](current-delivery-scope.md) does not require new video
samples. Future accepted videos still need all applicable gates and review.

## Final candidate changes

The candidate writer starts at `5883b27214a20ce0196395abe8b232fd43661dfe`.
Later README/docs/CI updates, an explicit `WATCHDOG_LOG` requirement and Dockerfile
comment cleanup are separate from the accepted historical source. Both the
watchdog script and Dockerfile are in the receipt's source inventory; even a
comment-only recipe edit changes that inventory. Existing capture receipts must
not be rebound or reused as evidence for this candidate's changed source.

The recipe's executable instructions and dependency pins are unchanged. This
is not a new image-build claim. Candidate checks are static/export checks and a
focused Docker-fixture regression, recorded in [export audit](export-audit.md).
No new capture, render or media is produced. Actual writer model/usage remain
null without host evidence; requested model is `gpt-6.1-sol high`.
