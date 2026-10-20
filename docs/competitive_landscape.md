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
