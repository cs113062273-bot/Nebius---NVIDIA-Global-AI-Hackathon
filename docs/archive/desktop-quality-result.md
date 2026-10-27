# Desktop product acceptance — 2026-10-21

Reviewer correction: the 90/100 self-assessment below is a historical record and is withdrawn. The first negative control failed both keyboard and functional checks, so it did **not** isolate the independent functional gate. The reviewer's provisional baseline is 85/100. [Subsequent real component recovery and isolated gate evidence](component-recovery-result.md) supersede the earlier unproven-capability statements; the original raw evidence remains unchanged.

Open http://127.0.0.1:4317/project.html (`npm start` if stopped).

The implementation now includes contextual Git diffs with independent `git apply --check` and byte comparison; model/human historical diffs without changing archived evidence; a three-proposal repair loop with categorized failure feedback; keyboard/input and pointer task capture; element-selected text, attribute and visibility assertions; server-confirmed frozen tasks; checkpoint, assertion, diff and attempt review on the project page; separate playback, fresh-browser and fresh-inference actions; and human verification of added, deleted and modified static files, including binary assets. Browser-executable built output is accepted as output, without claiming framework source compilation or repair.

The [official rules](https://nebiusglobalaihackathon.devpost.com/rules) require runtime Nebius execution with an NVIDIA open model and use four equally weighted criteria. The product makes actual repair requests to Nebius Token Factory using NVIDIA Nemotron. Research stayed bounded: [AccessPatch](https://devpost.com/software/accesspatch) publishes journey repair and proof, [AccessPilot](https://github.com/joinarun/accesspilot) publishes auditing and repair loops, and [MUTINY](https://devpost.com/software/mutiny) publishes differential execution. These establish overlap; this work claims demonstrated task capture and outcome rejection, not unique invention or superiority over those products. No competitor code was copied.

## Fixed UI acceptance

The new author-created Seatwise case was fixed after implementation, with source, task and repair-workflow hashes saved **before** inference in [commitment.json](../benchmarks/desktop-holdout/commitment.json). It was not used for implementation tuning. It is an authored case, not a production customer incident or external repository evaluation.

All setup used the product UI: folder selection, actual keyboard and pointer input, element picking for text/attribute/visible assertions, confirmation, and the repair button. No manually authored task JSON, injected model response or recorded plan replaced this run. The local browser test used Playwright because no connected interactive browser was available.

| Execution | Actual result |
|---|---|
| Original | Keyboard generated $180 instead of the community-rate $144. The separate pointer task passed. Both original and repaired keyboard runs had zero axe findings; this did not establish usability on its own. |
| Real Nemotron repair | `VERIFIED_PASS`, including independent pointer acceptance. One uncached request, 3,129 prompt + 2,704 completion tokens, 7,096 ms model latency; 13,707 ms whole run. Model added keyboard activation to the custom checkbox. |
| Deliberate bad derivative | Human-appended corruption left the visible $144 text intact but changed `data-rate` to `standard`. The **identical** frozen acceptance rejected it: `VERIFIED_FAIL`, `Functional output changed`. No inference was used for this negative control. |
| Integrity | Both proof archives verified; original files and the committed repair workflow remained unchanged. Each exported patch passed Git application checking and reproduced the verified candidate bytes. |

Inspect [passing run](http://127.0.0.1:4317/project.html?run=9557d06e-87f7-464a-8f9f-16c60b8e2347), [rejected derivative](http://127.0.0.1:4317/project.html?run=31fcf0e9-d189-436b-84ba-d43b3aaf42a6), [machine-readable acceptance](../benchmarks/desktop-acceptance.json), [positive proof](../benchmarks/desktop-holdout/positive-proof.tar.gz), and [negative proof](../benchmarks/desktop-holdout/negative-proof.tar.gz). Request ID: `chatcmpl-b8ef6b653cc33793149c022b831d1c2d`. Actual token usage at the returned catalog rates corresponds to approximately US$0.011241 of sponsor credit, not a paid purchase; the request reserved a more conservative US$0.047805. Account balance was not independently established.

Separate development checks exercised truncation → stale preimage → passing proposal, and wrong functional result → detailed feedback → passing proposal. Those used injected development plans, **not** live model inference. The final real inference passed on its first proposal and therefore does not demonstrate real multi-turn model recovery. UI verification also accepted a static candidate that renamed CSS and added JSON (file addition/deletion/modification), rechecked it in a fresh browser without inference, and rejected the version with corrupted functional text. Existing unit/security and browser checks passed. These checks support behavior; their counts are not a quality score.

## Evidence-based self-assessment

| Official criterion | /25 | Basis and limit |
|---|---:|---|
| Technological Implementation | 24 | Actual sponsor/model repair, isolated candidates, immutable acceptance, checked patches and explicit failure feedback. Live multi-turn recovery remains unproven. |
| Design / complete product | 23 | Own-project flow, task capture and result review work together; playback, recheck and inference are distinct. More complex authoring and cross-page capture need usability validation. |
| Potential Impact | 21 | The actual gate rejects an apparently correct but semantically corrupted result. Current evidence remains small, mostly authored static applications plus a known historical reconstruction. |
| Quality of the Idea | 22 | Focus, functional outcome and inspectable source evidence form a coherent developer tool. Published competitors already establish substantial conceptual overlap. |
| Total | **90/100** | A self-assessment, not an official judge score. Current evidence does not justify 95. |

Remaining limits: only independently executable static browser apps; no backend-dependent journey or framework rebuild; localized bounded model edits rather than arbitrary codebase repair; no general repair success-rate claim, full WCAG claim or real screen-reader validation. The new holdout supports one genuine repair and one genuine rejection, not production generalization. No mobile work, video, interviews, submission packaging or GitHub PR platform was added.
