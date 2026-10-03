# 05: Measure and receipt

Preserve each attempt's original JSON receipt, raw command exits and logs. Keep
measurements and iteration decisions in external Markdown; never rewrite an old
receipt to match new source or call a partial output accepted. The coordinator
will add the exact current runtime evidence summary separately.

| Evidence | Required meaning |
|---|---|
| Source | Accepted HEAD, dirty state, runtime file SHA256 inventory and config identity |
| Execution | Unique attempt/path, start/finish, selected image and observed immutable image ID |
| Inputs | SHA256 of recordings, event log, evaluated config, staged template/manifests/policy/fonts |
| Resources | CPU/RAM, operation and whole-attempt bounds, actual container/state observations |
| Outcomes | Raw exits, timeout/interruption, OOM/restarts/running state and owned-CID cleanup |
| Results | Three media hashes, probes, decoded frames/no audio, repeat/byte comparison |
| Proof | Config inspection, storyboard and transition indexes and PNG sheets |
| Models | Requested model separately; actual model/usage only from host evidence, otherwise null |

Report elapsed time from observed timestamps. Missing peak-memory, cost or token
measurements remain null; container memory limit is not measured peak usage.
Fixture or simulated Docker results cannot establish real runtime acceptance.
Dependencies/images available locally do not establish a clean build or clone.

The portable JSON branch of existing `gate-receipt.sh` checks exact finished
attempt/source/input/execution identity, required operations and cleanup. Its
optional `since` argument can reject prior attempts. Legacy text receipts retain
their separate watchdog contract; do not translate missing evidence into clean.

Immutable render artifacts include MP4s, capture logs, config inspection,
policy, proof indexes and sheets. `verdict.tsv` and `captions-proof.tsv`
(including transition verdicts) are mutable review declarations. Fill only those
review files; keep them regular files and do not edit immutable proof artifacts.
Caption declarations are bound through sealed recordings/config and the source
receipt; storyboard verdicts also carry the exact output MP4 SHA256, and
transition verdicts carry the source recording SHA256.

**Exit contract:** 0 means the specified check ran and passed; 1 means a measured
defect; 2 means incomplete/unavailable work or evidence. Unknown values and
unfilled review declarations are not success. Timeout is 2. The aggregate gives
an observed defect precedence over missing checks; missing data cannot erase a
defect. Render 0 and capture 0 do not imply visual acceptance or release readiness.

For portable runs the optional host watchdog is `not_applicable` with rationale,
while Docker lifecycle evidence remains required. `unavailable` means a required
watchdog cannot be checked and returns 2. Never fabricate `watchdog=clean`.

For every failed attempt record category (tool/environment/author), exact cause,
remaining acceptance criteria and the next bounded action/owner in Markdown.
Proceed to [independent review](06-swarm-protocol.md) with the original artifacts.
