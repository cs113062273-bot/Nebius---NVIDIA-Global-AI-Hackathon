# Local build audit — 2026-10-20

> Historical snapshot dated 2026-10-20, kept unchanged below. Live Nemotron inference on Nebius has since been run and recorded; see README.md and the published runs in `public/evidence/`.

Status: local functionality delivered; competition submission incomplete.

Product update after this audit: added a bundled, explicitly recorded three-case presentation (scanner-clean keyboard failure, wrong functional result rejected, historical focus loss) with before/after screenshots, source changes and a presentation view. The original measured counts below are unchanged. The update added no automated test suite; a focused browser smoke check exercised case switching, presentation exit and 320-pixel layout. See `docs/competitive_landscape.md` for the competition-driven priority correction. Live inference remains untested.

Source revision tested: `eff5218` (runtime, frontend, tests and fixtures). Subsequent changes add release packaging, measured clean-copy results and audit documentation; no claim is made that a public deployment was tested. Local Git commit exists; no remote push was performed in this session.

Environment: Windows, Node v24.19.0, npm 11.17.0, Playwright 1.64.1, Chromium 156.0.8078.4, axe-core 4.14.0, Zod 4.6.7, pngjs 7.0.0. No GPU dependency. No infrastructure purchase.

| Check / metric | Observed result |
|---|---|
| Unit + HTTP/security tests | 31 passed, 0 failed |
| Browser integration / UI E2E tests | 8 passed, 0 failed |
| Adversarial tests | 5 passed, 0 failed |
| Total automated tests | 44 passed, 0 failed, 0 skipped |
| Syntax checks | 30 JavaScript modules checked before release helper; helper separately checked |
| Dependency audit | 0 reported vulnerabilities at audit time |
| Paired synthetic application cases | 7; two principal shared bug families |
| Baseline barrier reproduction | 7/7 |
| Author-reference verified recoveries | 7/7 |
| Passing independent pointer baseline + replay on reference recoveries | 7/7 |
| Reference recovery inconclusive count | 0/7 |
| Negative source-patch controls | 2/2 rejected |
| In-memory verifier mutations | 14/14 rejected |
| False verified-successes in selected negative controls | 0/16 |
| Focused broken/reference browser pairs | 120/120; 12 families × 10 correlated label variants |
| Historical reproduced defect | 1/1 included case |
| Published human-fix historical replay | 1/1 |
| Excluded historical candidate | 1 did not reproduce; not counted as recovered |
| Historical autonomous repairs | 0 |
| Genuine holdout cases | 0; NOT_TESTED |
| Reference-pipeline p50 | 6,154 ms (seven runs, nearest-rank) |
| Reference-pipeline p95 | 9,128 ms (seven runs, nearest-rank) |
| Reference repair attempts | 1 per application; median 1 |
| Live Nebius tests | NOT_TESTED; no credentials configured |
| Live NVIDIA model requests | 0 |
| Live inference input/output token usage | 0 / 0 |
| Model routing comparison | NOT_TESTED |
| Fresh-copy setup | PASS: fresh dependency cache, fresh headless Chromium binary, no credentials, syntax/tests/start/sample/historical checks |
| Public live demo | NOT_DEPLOYED |
| Container build/run | NOT_TESTED; Docker unavailable |
| Public repository publication | NOT_PERFORMED; local commit only |
| YouTube video / Devpost submission | NOT_PERFORMED; drafts only |
| Full code review passes | 2 by the same implementation agent; not external audits |

Raw results: `benchmarks/results.json`, `benchmarks/focused-results.json`, `benchmarks/historical-results.json`, `benchmarks/live-status.json`, `benchmarks/clean-room-results.json`. Full browser artifacts: the `artifactRoot` recorded in benchmark results. Latest local API demo: run `916a8ef6-348e-4465-83bc-622f13580b7e`, reference mode, VERIFIED_PASS. Its provider is explicitly not AI.

The first fresh-copy Chromium download timed out. A second fresh-copy run using the headless-only install completed: fresh dependencies 4,181 ms; fresh Chromium 129,804 ms; browser suite 41,546 ms; adversarial suite 5,274 ms. Earlier failed setup is not counted as a pass. The successful copy is recorded in `benchmarks/clean-room-results.json`.

## What works

Real keyboard task reproduction; strict authored/test-derived journey schemas; heuristic intent candidates requiring explicit oracles; separate semantic/reflow/motion/forced-color assertions; focus entry/wrap/Escape/restoration checks; AX/ARIA/DOM/screenshot/axe evidence; ranked static source localization; bounded isolated text edits; static syntax checks; exact journey replay; pointer functional control; initial-page visual change gate; four-way verdict; integrity-checked tar.gz proof; persistent API run history; responsive workbench; default-disabled live provider with budget reservations and schema validation.

## Limits and remaining work

Current source/build support is static HTML/CSS/JS. No React, Next.js, Vue, Svelte or Angular build benchmark; no AST or source-map localization. No general arbitrary-repository execution, hardened multi-tenant sandbox or public URL scanning. Browser automation is Chromium only. AX capture is not named screen-reader testing. Reflow uses viewport equivalents, and motion/forced-color checks are narrow. The visual gate compares initial-page pixels, not all UI states. Hashes do not authenticate authorship.

Reference patches and injected negative controls do not establish autonomous diagnosis/repair quality. The historical case uses a fix already known to the evaluator, so it is not blind evaluation. Benchmark families are correlated and small. No real-user review or complete WCAG conformance work occurred. The live client contract is locally tested with injected HTTP responses, but actual model schema compatibility, accuracy, latency and credit behavior are untested. Account billing/no-overage settings require human confirmation.

User selected local functionality first and has not obtained/configured sponsor credits. Remaining human/account actions: claim credits, configure server-only credentials, confirm sponsor-only billing, run the limited live suite, review/publish source, choose free judge hosting/test-build access through the end of judging, record/upload the English video, and submit Devpost. Broader historical and holdout evaluation and safe framework execution remain engineering work.

Final recommendation: **Do not submit this exact build as a finished Grand Prize contender.** The local deterministic repair/evidence path works under its tested conditions. Genuine Nebius/NVIDIA execution, autonomous repair evidence, broader evaluation and judge-access deliverables are still missing. No prize, production-readiness or accessibility-conformance claim is made.

## Reproduce

```powershell
npm ci --ignore-scripts
npx playwright install chromium
npm run check
npm run test:all
npm run benchmark
npm run clean-room
npm start
```

For one offline test: `npm run journey -- --fixture checkout --reference`. For a proof: `npm run proof:verify -- artifacts/runs/RUN_ID`. For a source bundle: `npm run release:local`. Live tests stay off until the sponsor-credit prerequisites in README are met.
