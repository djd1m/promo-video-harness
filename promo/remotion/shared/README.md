# Shared Remotion template

The portable harness preserves this renderer and its existing gates. Use
[bin/promo-video](../../../bin/promo-video), following the
[walkthrough](../../../docs/pipeline-walkthrough.md), rather than the legacy
shell branch. Remotion and related packages are pinned to **4.0.529** in the
[manifest](../package.json) and [lockfile](../package-lock.json).

## Configuration

The supported example is [synthetic config](../../../demo/synthetic/config.mjs).
The CLI evaluates this trusted executable input and stages a `demo/project.config.ts`
for the existing [ProjectConfig](src/project.ts) schema. Selecting `--config`
changes trusted demo configuration; it does not create a general remote recorder.

| Field | Contract |
|---|---|
| `id`, `name`, `tagline`, `url` | Demo identity and truthful final label |
| `tokens` | `paper`, `ink`, `accent` in `#rrggbb` |
| `font` | Family and regular files relative to staged `public/`, weights 400/600/700 |
| `scenes` | Five scenes, exactly 45 seconds; title, three screens, one final outro |
| `screen.tracks` | Recording file, source dimensions and `{from,to,seconds,caption,crop?}` segments |
| `screen.use` | Track mapping for `wide`, `tall`, `square`, with optional supported crop |
| `footnote` | Persistent synthetic-data label; nonempty, ≤40 characters, readable contrast |

Each track's segment durations equal its scene duration. Source intervals and
crop rectangles must be valid. A crop is an intended visible region, not a mask;
check actual `VISIBLE` rows in config inspection. Tall cropping is forbidden
unless explicitly allowed by the trusted config. Title color and footnotes use
the existing 4.5:1 contrast checks; visual review still verifies actual rendering.

The synthetic example uses 6 + 11 + 11 + 11 + 6 seconds. Output compositions are
`promo-16x9` 1920×1080, `promo-9x16` 1080×1920 and `promo-1x1` 1080×1080, each
30 fps / 1,350 frames. Caption bands are separate from recordings: bottom in
wide, top in tall and square. Inspect all formats for actual wrapping/occlusion.

## Execution and acceptance

Prepare dependencies separately with
`npm ci --ignore-scripts --no-audit --no-fund` in `promo/remotion`, using the
reviewed lockfile. The portable CLI requires this tree and mounts it read-only
at `/deps/node_modules`; it neither installs nor fetches hidden assets. Fonts
come from the selected provisioned image; demo uses DejaVu regular/bold.

The portable branch of [render.sh](render.sh) calls the existing bundle/render
helper, each [probe](scripts/probe.sh), all three full formats and a full wide
repeat with identical settings and byte comparison. Settings: H.264 High,
CRF 20, yuv420p, bt709, concurrency 1, CPU ≤2/RAM 3g, operation timeout 900s and
whole-command timeout 4,800s, explicitly set through the CLI.

Existing gates check config/capture log, decoded frames/no audio, receipt/source
identity, reproducibility, storyboard SHA declarations, captions and transition
SHA declarations. A render receipt records successful generation separately from
independent review. The reviewer fills existing TSVs only after inspecting exact
source-bound outputs; `?` is incomplete. See
[final check](../../../.claude/skills/promo-video/modules/07-final-check.md).

Exit 0 means named checks ran and passed; 1 is a demonstrated defect; 2 means
unavailable/incomplete work. Timeout is 2. Portable watchdog is explicitly
`not_applicable`; a required but unavailable watchdog gives 2. No fabricated
clean host-watchdog result. A defect wins over incomplete aggregate evidence.

Legacy direct rendering is an optional explicit environment adapter requiring
`PROMO_ASSETS`, `PROMO_LOCK`, selected `PROMO_IMAGE` and its host-watchdog contract;
its resource/default/install behavior differs from portable execution. Do not
use historical branches or single-format drafts as portable acceptance evidence.
Full current MP4/repeat and independent review are pending; no release or license
readiness is asserted. Rights for source, fonts, dependencies and assets need review.
