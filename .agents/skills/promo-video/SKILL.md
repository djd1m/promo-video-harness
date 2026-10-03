---
name: promo-video
description: >
  Create and independently review a reproducible 45-second web-product promo
  in three formats using this checkout's Linux/Docker harness, Playwright
  recordings, Remotion renderer and source-bound verification gates.
---

# promo-video for Codex

This is the Codex discovery entrypoint for the complete promo-video-harness
checkout. Resolve this file's real path when the skill folder is symlinked.
The harness root is three directories above this skill folder.

Read and follow the [canonical skill](../../../.claude/skills/promo-video/SKILL.md)
before work, then load its modules only for the current phase. Resolve the
canonical skill's relative links from its own directory, not this entrypoint.
The workflow and author/reviewer roles do not require Claude Code or a Claude
plugin. Run [bin/promo-video](../../../bin/promo-video) from the harness root,
with the [walkthrough](../../../docs/pipeline-walkthrough.md) for configuration
and evidence requirements. Keep the complete checkout available; copying this
entrypoint alone does not install the canonical modules or runtime.

Invoke as `$promo-video`. Follow the user's requested scope: using the skill
does not authorize publication, paid calls or a new video render.
