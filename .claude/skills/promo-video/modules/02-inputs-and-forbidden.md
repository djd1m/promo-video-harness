# 02: Authorized inputs and forbidden content

Authorize the scenario's inputs before [capture](03-capture.md). Record the
source, exact allowed route/file, purpose, rights status and exclusion mechanism.
The supported CLI demo reads the owned synthetic file UI and blocks non-file
requests; a custom `--config` does not grant remote capture permission or replace
the fixed demo recorder. Additional products need separately reviewed adapters.

| Class | Required handling |
|---|---|
| Prices/payment | Exclude prices, plans and checkout unless explicitly accepted in the brief |
| Third-party brands | Use authorized original material; do not borrow competitor screens |
| Accounts/fixtures | Use owned synthetic data; no customer accounts or service fixtures |
| Unfinished features | Omit unimplemented actions and claims |
| Addresses | Keep private network addresses and host paths out of frames and captions |
| Secrets/personal data | Exclude keys, cookies, environment files, private conversations and identifiers |
| Numbers | Verify displayed quantities against the demonstrated state |
| Fictional data | Keep a visible synthetic-data label throughout every applicable interval |

For each class write its exclusion or an explicit reason it is inapplicable.
Prefer selecting a safe route/state. Cropping is not a mask: the template fits a
visible window around the requested crop. Use the existing config gate's
`VISIBLE` rows to check it. Tall format shows the full recording unless a trusted
config explicitly allows tall cropping.

Optional advanced adapters use `forbidden-zones.tsv`: tab-separated recording,
x0, y0, x1, y1, from, to, reason in source pixels/file seconds. Each crop-based
exclusion needs a zone. A transition zone begins at the previous action in that
file and extends through the transition plus 0.5s; log scroll-to-top before the
scroll. Sparse sampling can miss a short flash: inspect every dangerous
transition frame with the existing transition gate.

The portable demo seals `demo-intervals.tsv` as `0-45` in staged work. Every scene
has `footnote: 'Synthetic demo data'`; independent review must confirm it is
visible in all three formats for the full interval. Do not weaken the policy to
make a failed visual declaration pass.

Do not import hidden assets from another machine. Demo fonts are copied from the
selected image, recordings from the accepted capture, and dependency files from
the prepared lockfile installation. Configs, recorders and npm manifests are
trusted executable inputs, not safe data. Keep source/font/dependency notices
and rights decisions pending until reviewed; this inventory grants no license.

Legacy `gate-forbidden.sh` can check an explicitly adapted scenario inventory;
it is not silently run by the demo CLI. Media/config/log/receipt/transition and
independent visual/caption checks remain mandatory for delivery.
