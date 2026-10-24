# Competitive landscape

Primary-source review, 2026-10-20. These are published capabilities, not independently executed evaluations. Unstated features are unknown, not absent.

| Product | Published work | Journey replay evidence | Limits / implication |
|---|---|---|---|
| [AccessPilot](https://github.com/joinarun/accesspilot) | Playwright, axe, localization, isolated repairs, bounded loop, regression checks | Before/after scans; task oracle depth unverified | Scan → model → patch → rescan is already established; framework hints are not equivalent to benchmark coverage |
| [A11yProof](https://a11yproof.talivio.com/) | Browser scans, findings, evidence, monitoring | Not established in reviewed product page | Explicitly distinguishes automation from conformance; this honesty is not unique |
| [AccessPatch, Devpost](https://devpost.com/software/accesspatch) | Keyboard checkout, bounded structured plan, isolated deterministic fixes, replay, proof bundle | Yes: controlled checkout, two seeded defects | Direct overlap with our original thesis. A journey demo and proof bundle alone are insufficient differentiation |
| [AccessPatch, commercial](https://www.accesspatch.com/) | Scan, runtime patches, guidance, manual checklist | Not established | Different product with same name; avoid both names |
| [AccessAI](https://github.com/Tarun-108/AccessAI) | Naming, ARIA, contrast, keyboard checks, generated corrections | Not established | Several unrelated products share this name |
| [axe-core](https://github.com/dequelabs/axe-core) | Deterministic automated checks; incomplete results | Rule engine, not task oracle | Preserve all four result categories |
| [MUTINY](https://devpost.com/software/mutiny) | Differential execution on real historical PRs, model generates probes not verdicts | Software behavior rather than browser accessibility | Published 49-PR evaluation sets a stronger credibility bar than a fixture demo |
| [A11YRepair](https://arxiv.org/abs/2606.21926) | Knowledge-guided localization and repair; real-project benchmark | Published abstract does not establish our specific task oracle | Review evaluation methodology before claiming novelty |

Positioning: **a falsifiable repair gate**. Freeze a user-authored journey and functional assertions before inference; fingerprint it; reject oracle drift, no-op repairs, newly introduced rule findings, lost functional outputs, environment mismatch, and incomplete replay. Ship adversarial negative controls alongside positive cases. Report task success separately from rule results and untested conditions. Prove the verifier can reject attractive but wrong fixes.

This is a product direction, not a novelty claim. Historical reproduction, framework breadth, unseen holdout results and real Nemotron repair rates remain evidence to earn.

## Competitive correction, October 20

The participant explicitly prioritized winning value over additional test suites. Preserve necessary verification, but stop presenting test counts as the main achievement.

| Strong current submission | Published evidence | Consequence for Tabstitch |
|---|---|---|
| [Mender](https://devpost.com/software/mender-kubernetes-incident-to-fix-agent) | Actual Nemotron diagnosis/patching, 23 injected incidents, measured model usage and cost | Real model-authored repair is a higher priority than another offline fixture family |
| [PortVerdict](https://devpost.com/software/portverdict) | Live sponsor executions, public immutable recordings, explicit rejected candidates | A recorded evidence viewer is useful but already exists elsewhere; it must communicate a compelling accessibility problem |
| [MUTINY](https://devpost.com/software/mutiny) | Published differential execution over historical PRs | Our single known human-fix replay is a case study, not comparable breadth |
| [AccessPatch](https://devpost.com/software/accesspatch) | Controlled journey repair and replay in React | A synthetic checkout plus a proof bundle is direct product overlap, not sufficient novelty |

These are primary-source published claims, not independently reproduced results or a ranking of likely winners.

Current product change: put three actual recorded cases before the empty workbench. Show (1) zero axe violations with a failed keyboard task, (2) zero violations after a candidate that still breaks the functional contract, and (3) a real historical focus-restoration failure. Include side-by-side screenshots, actual focus state, source change and clear provenance. Presentation view removes unrelated controls while recording the short pitch. The feature ships with its evidence assets so judges do not need to generate a benchmark before understanding the project.

Update, October 21: the first real NVIDIA Nemotron repair through Nebius is complete. The recorded checkout call passed its frozen journey and functional checks; full local proof integrity was checked with no missing, extra or changed files. It is one synthetic case, not an autonomous repair rate. This was the initial milestone; the user subsequently authorized further sponsor-credit inference on October 21.

## External review, October 21

The official [project gallery](https://nebiusglobalaihackathon.devpost.com/project-gallery) says it has not been published. Individual Devpost pages are observable, but do not establish a complete field or an official ranking.

- [MUTINY](https://devpost.com/software/mutiny) publishes a 49-merged-PR evaluation and a GitHub Action workflow. The lesson is real repository behavior and an integration developers can use, not matching its case count.
- [Mender](https://devpost.com/software/mender-kubernetes-incident-to-fix-agent) publishes results over 23 injected faults, distinguishing passing fixes (20) from matching root causes (9). These are injected faults, not 23 production incidents. The lesson is to report failure and diagnosis honestly alongside success.
- [PortVerdict](https://devpost.com/software/portverdict) links public recorded cases, a demo and a short video. Direct retrieval of its hosted app failed in this review, so hosting functionality was not independently verified. Judge access is a deliverable to earn, not a claim to copy.
- [AccessPatch](https://devpost.com/software/accesspatch) is submitted to OpenAI Build Week, not established as a participant in this Nebius event. Its React checkout, journey replay and proof bundle are direct product overlap. Its page describes model-selected strategies and deterministic templates; our recorded run contains a model-authored source patch. That is a specific demonstrated distinction, not proof of superior reliability.

Product priorities: (1) one public-source real defect repaired by the model under a frozen task, using the subsequently authorized sponsor-credit experiments; (2) a clear judge-facing flow and working submission URL/video. Keep the visual identity, expose the blocked task and restored task sooner, and make patch/evidence inspection secondary. Do not prioritize broad framework claims or another synthetic fixture collection.


## Targeted review follow-up, October 21

Rechecked published project pages; these are primary-source claims, not reproduced competitor benchmarks. No competitor code was used.

- [MUTINY](https://devpost.com/software/mutiny) presents divergent before/after values on the same input. Applied here: a passing candidate defaults to the baseline failure checkpoint when both captures exist, with baseline and candidate gates labelled separately.
- [PortVerdict](https://devpost.com/software/portverdict) publishes immutable recordings that cannot spend visitor API credits. Applied locally: inspecting evidence remains free; the separate new-inference action now asks for confirmation before any request. This confirmation is a narrower local safeguard, not the same guarantee as PortVerdict's public read-only app.
- [AccessPatch](https://devpost.com/software/accesspatch) already links findings, plans, diffs and proof. Proof export alone remains overlap; Tabstitch now also reveals original verifier wording alongside derived explanations.
- [ARCHON](https://devpost.com/software/archon-xdbj6h) publishes sandbox baseline/candidate execution and source patches. [RERUN](https://devpost.com/software/rerun-mke5uc) publishes records with explicit unsuccessful outcomes and limits. These strengthen the case for executed comparisons and honest provenance; they do not establish that Tabstitch is more reliable.

The new upstream-human-patch control is a post-review author-run experiment, not a fourth model call: run `120c8bdb-63d5-4577-aa8b-afdab144aeff`. Under the existing frozen author reconstruction, Shift+Tab expected #close and reached #confirm; the independent functional path passed. The original issue described CSS display:none; the initially committed [hidden] reconstruction and later CSS variant are now distinguished in the product.


October 21, native-form follow-up: rechecked MUTINY and AccessPatch primary pages before this change. MUTINY demonstrates specific before/after behavior; AccessPatch already covers journey repair plus proof and publishes template-based source application. Tabstitch now adds browser-native FormData assertions to its source picker and verifier, with no receipt instrumentation required. An actual Nemotron-authored integration patch passed shipping and precommitted billing tasks; a post-hoc human variant with visible France but form code gb was independently rejected. This is executed evidence on one additional public component issue, not a broad success-rate or superiority claim. The recorded source patch can be downloaded directly from the selected attempt.
