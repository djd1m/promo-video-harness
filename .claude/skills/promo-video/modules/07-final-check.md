# 07: Final check and delivery

Use the exact verify command in the
[walkthrough](../../../../docs/pipeline-walkthrough.md) against the completed
render attempt directory, with the same accepted source/config/image. A successful
capture, diagnostic, bundle or partial MP4 is insufficient.

The independent reviewer must inspect all three full videos and the generated
proof sheets. Check readability, layout, cropped elements, prices/brands/private
addresses/secrets, claimed actions, persistent demo labels and every dangerous
transition frame. Storyboard sampling is supplemented by boundary and transition
sheets; it cannot rule out every flash on its own.

Fill only the existing review declarations in `out/final/proof/`:

| File | Fields and accepted vocabulary |
|---|---|
| `verdict.tsv` | sheet, outcome `принят`/`отклонён`, defect, demo label, MP4 SHA256, observation |
| `captions-proof.tsv` | caption, recording file, file interval, visible evidence, outcome `принят`/`отклонён` |
| `transitions/verdict.tsv` | sheet, `чисто`/`полоса`/`другое:<detail>`, recording SHA256, observation |

For visual acceptance defect is `нет` and demo label is `видна` wherever the
sealed `0-45` demo policy applies. Existing other label values are `не видна`
and `нет-демо-данных`; neither accepts a demo interval. The defect vocabulary is
`нет`, `цена`, `бренд`, `ip`, `ключ`, `титр-обрезан`, `элемент-обрезан`,
`демо-пометка-пропала`, `другое:<detail>`. Leave generated hashes intact.

Each screen caption needs a real recording file, numeric interval such as
`12-23`, nonempty explanation of what is visible and an explicit verdict. Bind
caption review to the sealed recording/config hashes and exact render receipt
in the independent review Markdown. The caption TSV itself has no SHA column;
do not invent a schema extension or imply it checks semantics automatically.

The storyboard index and verdict must match current MP4 SHA256. Transition
index/verdict must match current recording SHA256. If transition `make` finds
no matching events, retain its explicit empty index result; this is not a claim
that an uninspected transition is clean. Immutable sheets/indexes remain sealed.
An unfilled `?`, unavailable file or unknown vocabulary is incomplete (2).
A missing expected caption row, rejected verdict, changed bytes/SHA or measured
defect is 1 under the existing gates.

The CLI verifies immutable source/config/policy/media/proof binding and invokes
existing decoded-media, verdict, transition and receipt gates. Required config,
capture-log, probes and repro checks must already be evidenced by the bound
render/capture receipts. Timeout/unavailable required watchdog is 2, never pass.
Any demonstrated defect blocks delivery even when other evidence is incomplete.

Deliver external artifacts only after verify 0 and the independent review record:
three final MP4s, scenario/input authorization, config and capture logs,
measurements/iteration Markdown, original receipts, repro evidence, proof files
and reviewer verdict. Report exact source/media hashes, observed exits and
remaining limitations. Keep raw recordings, secrets and customer inputs out of
Git. Do not label this candidate publicly ready while full MP4/review, clean
build/clone, source/font/dependency rights/notices or release approval are pending.
