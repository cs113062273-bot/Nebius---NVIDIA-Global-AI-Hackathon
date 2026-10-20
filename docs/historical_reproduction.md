# Historical source reproduction

Included upstream code is evaluation material with original MIT licenses, not competitor repair code.

The reproducible case uses [a11y-dialog's focus restoration ordering fix](https://github.com/KittyGiraudel/a11y-dialog/commit/6367c03a9a6dfd1edffe9f8132142f61ad0ad9c9), dated June 30, 2025. Broken parent: `a7718bca32ede3c01c93a67da12f45a274011c4c`. Human fix: `6367c03a9a6dfd1edffe9f8132142f61ad0ad9c9`. The published change removes the focus/keyboard listeners before restoring previous focus.

The harness leaves an opacity-hidden dialog in the document, representing an animation-style hide. Before the fix, the focus listener can pull restored focus back into the now-hidden dialog; after the fix, Escape returns focus to the opener. The exact same journey checks that observable focus and `aria-hidden` state. Original source bytes, revisions and SHA-256 values are retained in each case's `provenance.json`. `focusable-selectors@0.8.0` is pinned for the compatible dependency range of that revision. Only TypeScript type stripping, relative import extensions and a CommonJS export-to-ESM adapter are applied; original sources are also included. No upstream project install/lifecycle script is run.

This is a **nonblind historical test of a published human fix**. The evaluator has read the fix, and no model repaired this case. It is not holdout evaluation, a broad real-repository benchmark or autonomous historical recovery.

An earlier candidate, the [2023 empty-dialog Tab fix](https://github.com/KittyGiraudel/a11y-dialog/commit/79151d8c355dd7c7396014c6889c6189700aad97), did not reproduce under the current headless browser with this harness. Those snapshots remain for traceability, and the candidate is excluded from the reproduced count. Do not silently report its successful after-state as a recovered defect.
