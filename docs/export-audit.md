# Public candidate export audit — 2026-10-03

Candidate base: `5883b27214a20ce0196395abe8b232fd43661dfe`, plus the fifteen
explicitly authorized working-tree files. This audit covers only the source
candidate selected by [public-export.txt](public-export.txt), not donor history.
The coordinator will independently validate and create a fresh Git snapshot.

## Checked inventory

| Check | Observed candidate result |
|---|---|
| Explicit export entries | 29 file/directory paths |
| Expanded source files | 66: 63 currently tracked, 3 new explicit files |
| Tracked source paths excluded | 35; not scanned or claimed clean here |
| Selected Markdown files / relative links | 20 / 90 |
| Missing or outside-export Markdown links | 0 |
| Selected symlinks | 0 |
| Excluded/secret filename matches | 0 |
| Recognized private host-path matches | 0 |
| Binary/media/font files | 0 |
| Private-key / selected token-format markers | 0 |
| Non-lockfiles at or above 500 lines | 0 |
| Changed/new files outside the fifteen-file edit scope | 0 |
| Largest allowed file | Tests, 476 lines |

Directory entries expand to tracked files only, never to installed dependencies
or arbitrary untracked contents. The three explicit new files are CI, the export
list and publication status. The dependency lockfile remains preserved and is
exempt from the non-lockfile line bound. All fifteen editable files are below
500 lines. Runtime identity inventory is included: CLI, libraries, demo, shared
Remotion runtime, capture helper, scripts, manifests/lockfile, render recipe and
font builder. Skill/modules, tests/fixture and curated docs are included too.

Excluded paths include telemetry, historical extraction/implementation/autonomous
plans and private analysis runs. Recordings, generated media/fonts, node_modules,
`.dz`, `.env` and all unlisted paths must remain excluded. Old history/receipts
are preserved separately; this scan does not erase or certify them. Earlier
whole-checkout missing-link/private-path counts describe a different scope and
are not relabeled zero by this candidate audit.

## Candidate validation

- Bash and Node syntax passed across the selected shell/Node source files.
  The executable Docker fixture is Node code, checked with `node --check`.
- CI YAML parsed with the already available PyYAML BaseLoader. Trigger and
  permissions assertions passed: push/pull_request/workflow_dispatch,
  contents read, cancel concurrency, Ubuntu runner and Node 22. CI executes
  syntax and `node --test tests/promo-video.test.mjs`; no install/provider/secrets,
  real Docker startup, image build or full render is part of this workflow.
- Focused command: `timeout 90 node --test --test-name-pattern='watchdog|legacy scripts|gate-git fixture|stale source-bound' tests/promo-video.test.mjs`.
  Exit **0**, **5 passed**, **25 skipped**, **0 failed**, about **5.02s**.
  This includes doctor watchdog classification, stale-source rejection, legacy
  provisioning guards, explicit fixture scanning and the new watchdog regression.
  It is not a rerun of all 29 historical tests or a real Docker claim.
- The regression checks absent `WATCHDOG_LOG` → 2 before access, explicit
  missing file → 2, readable unrelated events → 0 and container hit → 1.
- Dockerfile executable instructions are identical to the candidate base;
  only two comments changed. Manifest/lockfile/pins are unchanged.
- `git diff --check`, exact edit scope and file bounds passed.

The temporary audit script is outside Git and reads candidate content only. Its
filename/path and token-marker checks are limited pattern scans, not exhaustive
secret detection, rights review or a guarantee about excluded history. Generic
artifact-directory examples are not private host evidence. Remote URLs in
upstream documentation are not evaluated as local Markdown targets.

The candidate has no new capture/render/build evidence. The historical clean
build and accepted runtime remain bound to their own source. Publication still
needs independent validation, recorded rights, a license decision and working
transport; see [publication status](publication-status.md).
