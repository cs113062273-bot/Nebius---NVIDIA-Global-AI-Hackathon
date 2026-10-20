# Devpost draft — not ready to submit

## Inspiration

Accessibility barriers interrupt tasks, not just checklists. A developer needs to know whether a person can finish the interaction after a source repair. We built Tabstitch around replaying the exact failed task and preserving the evidence, with explicit limits on what automation establishes.

## What it does

Tabstitch freezes an accessibility journey and functional oracle, reproduces a failure in Chromium, ranks related source, applies bounded source edits in an isolated copy, replays the same task and exports a hashed proof bundle. It rejects changed test criteria, incomplete replay, no-op repairs, wrong functional output, newly introduced rule findings and large initial-page visual changes.

The current build is local and curated. Offline reference patches are labeled; they are not presented as AI-generated. Live NVIDIA Nemotron reasoning through Nebius Token Factory is implemented as an opt-in provider and remains unvalidated without sponsor credentials.

## How we built it

Node.js, Playwright/Chromium, axe-core, strict Zod schemas, SHA-256 evidence manifests, isolated static source copies and a semantic HTML workbench. Nemotron's intended role is diagnosis and constrained source proposals. The model never grants the verdict or edits assertions. Persistent inference reservations protect limited sponsor credits.

## Challenges

Native dialog behavior alone did not satisfy our explicit focus-wrap contract. We expanded replay assertions instead of weakening the oracle. We found and corrected a race where the frontend stopped polling before the proof manifest was finalized. UI axe tests caught contrast, label-in-name and scroll-region problems. A historical empty-dialog candidate failed to reproduce in current Chromium; we excluded it and documented a separate reproducible focus-restoration case.

## Accomplishments

Use exact final counts from `benchmarks/results.json` and `FINAL_AUDIT.md`. Current successful local work includes real reference replay, functional regression rejection, screenshot and AX evidence, integrity-checked bundles and an accessible responsive workbench. Do not use the reference recovery ratio as an autonomous model score.

## What we learned

The verifier needs negative controls, not just attractive before/after screenshots. A user task and its functional observations must be frozen independently of the repair proposer. Historical reproduction must be measured against the actual runtime, not assumed from a commit message.

## What is next

Validate live Nemotron repairs on sponsor credits, gather genuinely unseen tasks, expand historical cases, add safe framework build isolation, conduct named screen-reader/user review and keep a working judge build available through the judging period.

## Built With

Node.js, JavaScript, Playwright, Chromium, axe-core, Zod, pngjs, SHA-256. Add **Nebius Token Factory** and the **exact NVIDIA Nemotron model ID** to the final technologies list only after actual runtime use. Disclose Codex-assisted development.

## Judge testing instructions

Run the exact setup in README. Choose a curated journey and reference replay for a deterministic browser/evidence demonstration. Inspect the provider label: this mode makes no AI calls. A final competition build must additionally offer an authenticated genuine Nebius/NVIDIA path, a public repository URL and downloadable working test build. Judge credentials and final URLs do not yet exist.

## Nebius / NVIDIA usage and feedback

Implemented integration: authenticated model catalog, official API origin, strict structured source proposal, bounded source validation, usage provenance, persistent token/call ceiling and no paid fallback. Actual runtime use: **NOT_TESTED**. See `nebius_feedback.md` and `nvidia_feedback.md`; they intentionally do not invent hands-on experience.

## Track

Proposed: Best Apps and Agents. Recheck fit and official rules before submitting. The project still needs actual Nemotron on Token Factory, public source, judge test access and a public YouTube video under three minutes. This draft is not an eligibility or completion claim.
