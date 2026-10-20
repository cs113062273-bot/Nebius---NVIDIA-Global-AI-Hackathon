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

Next highest-value dependency remains a real NVIDIA Nemotron repair through Nebius. No UI improvement substitutes for that sponsor execution. After credentials exist, spend the first limited calls on one meaningful full task and preserve the actual proposed patch and outcome; do not begin with a large routing study or additional synthetic test suite.
