# Third-party notices

On 2026-10-03 the owner created the public repository and explicitly authorized
uploading the reviewed source package. A license for the harness's own code has
not been chosen. No own LICENSE or additional license grant is supplied;
publication authorization does not license dependency code. Dependency terms
remain separate from the harness's own-code decision.

This candidate exports source only: no font binaries, installed Node dependencies,
container image, recordings or generated media. The preserved manifests/lockfile
and build recipe describe separately provisioned dependencies. Users must check
current upstream terms and applicable notices for their use and any redistribution.

Official sources checked on 2026-10-03:

- Remotion **4.0.529** has separate Free and Company licenses. Consult the
  [official license FAQ](https://www.remotion.dev/docs/license/faq) and applicable
  terms; this document makes no eligibility or price determination.
- Playwright **1.60.0** uses the
  [Apache License 2.0](https://raw.githubusercontent.com/microsoft/playwright/v1.60.0/LICENSE).
  Browser/base-image components have their own applicable notices.
- The recipe pins FFmpeg `7:6.1.1-3ubuntu5`. Its LGPL/GPL obligations depend on
  build configuration and components; see [FFmpeg legal information](https://ffmpeg.org/legal.html).
  No specific binary compliance conclusion is asserted here.
- The recipe pins DejaVu **2.37-8**; consult the
  [DejaVu font license](https://dejavu-fonts.github.io/License.html) for font terms.
- Onest **5.3.1** (`@fontsource-variable/onest`) passed the recipe's SHA512
  integrity check in the previous clean image build. The builder produced four
  static fonts and preserved full package notice/license text inside the image.
  Observed SHA256 for `Onest-LICENSE` and `Onest-OFL-LICENSE.txt`:
  `a2a09da98a3d0d1ec79fc2d6deeac748b20a8153e26699552e7b59b5a40b63a3`.
  This historical notice evidence does not grant font redistribution rights or
  establish compliance for a future package.

Any future licensed distribution or binary/media package needs its own
license decision and review of dependency/font/codec/base-image obligations. No license for third-party assets, interfaces or trademarks is implied.
See [publication status](docs/publication-status.md).
