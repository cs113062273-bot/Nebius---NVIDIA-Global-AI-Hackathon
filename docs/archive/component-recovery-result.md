# Evidence upgrade after the 85/100 review

The earlier 90/100 self-assessment is withdrawn. The reviewer's provisional 85/100 is the baseline; this delivery supplies inspectable evidence for the three identified gaps rather than declaring an automatic 95.

## Actual component, different root cause

[MicroModal issue #295](https://github.com/micromodal/Micromodal/issues/295) reports focus escaping when hidden interactive controls are included in the focus-trap boundary list. This is a visibility/filtering and focus-order defect, not missing Enter/Space handling. The component source is byte-for-byte pinned to revision `777dbcbeaf6314da0a3669f2b5ed9cdd66e6fc8a`; the MIT license is retained. The booking consumer is author-created and includes a visible fixed-position Cancel button. This is a nonblind historical reconstruction, not a new upstream discovery or a production customer result. The model received neither the published fix nor fixed upstream source.

The [commitment](../benchmarks/component-recovery/commitment.json) froze source and both tasks before inference. All runs used the same task hash `6e9a37e7988924c03c39c1254eee75b8f0c1cb0d45a9e743b7f5bc956bb26abc`. Setup, confirmation and execution ran through the desktop product UI.

## Genuine model recovery

[Open the two-attempt run](http://127.0.0.1:4317/project.html?run=99e589ff-42bc-4bd0-b9f9-0b66aa1432db). Select Attempt 1 and checkpoint 4 to inspect the rejected focus assertion.

| Actual inference | What happened |
|---|---|
| First proposal | Nemotron filtered with `offsetParent !== null`. This excluded the visible fixed Cancel control. Shift+Tab expected `#close` but failed; independent functional acceptance passed. Request `chatcmpl-d1a9fd999c69b8c0d7e5419eabc86a6d`, 15,745 ms, 12,494 tokens, uncached. |
| Automatic second proposal | The next real request contained the exact first plan, failed focus assertion and observed state. Nemotron replaced its filtering approach with a hidden-ancestor check. The unchanged frozen keyboard and independent functional tasks passed. Request `chatcmpl-2494f341c10cde2d0dc04eb2b2dd5257`, 9,913 ms, 9,904 tokens, uncached. |

The agent did not write, replace or edit either model plan. The audit compares parsed raw model responses against saved plans, checks request prompt hashes, verifies that the second request contains the actual first failure, and confirms every edit targets only `micromodal.js`. Both candidates start from the same original snapshot. See [audit and results](../benchmarks/component-recovery/acceptance.json) and [complete proof including both requests/responses](../benchmarks/component-recovery/live-proof.tar.gz).

## Check the remaining visibility case

The second proposal was not treated as a general fix: a separately frozen CSS-only `display:none` variation still failed. Its component source was copied unmodified from the second actual model candidate; only the consumer's hiding mechanism changed. The same tasks stayed frozen.

[The real follow-up](http://127.0.0.1:4317/project.html?run=2d7de911-90df-47ae-a9dd-4e0a36d2c206) made Nemotron add a rendered-dimensions check. It passed CSS-hidden controls while preserving the fixed Cancel button. Request `chatcmpl-fc88699796e66fac2bc60d424e0f123e`, 15,203 ms, 9,726 tokens, uncached. Its component patch was then copied byte-for-byte into the original hidden-attribute consumer and passed a fresh browser verification too. This follow-up is a separate call, not a third automatic attempt in the earlier run.

## Independent functional rejection, isolated

[Open the final rejected candidate](http://127.0.0.1:4317/project.html?run=cc7af68a-ac2e-46cc-bf1d-04f48978a521). This uses the final model component patch plus an explicitly human-authored negative control that corrupts the reservation workspace ID to `studio-b`. The displayed `Reserved: Studio A` text, email, focus behavior and keyboard completion remain correct.

| Gate | Observed verdict |
|---|---|
| Frozen keyboard task | **VERIFIED_PASS** |
| Separate functional task | **VERIFIED_FAIL** — expected workspace `studio-a`, observed `studio-b` |
| Overall repair | **VERIFIED_FAIL** — functional output changed |

The model repair and negative control use identical task hashes. No inference is attributed to the human negative control. See [final validation](../benchmarks/component-css-followup/final-validation.json), [final real-model proof](../benchmarks/component-css-followup/live-proof.tar.gz), and [isolated rejection proof](../benchmarks/component-css-followup/final-rejection-proof.tar.gz). All exported patches passed Git application checking and candidate byte comparison; all listed proof archives passed integrity verification.

## Product changes and verification

Source localization now follows local runtime imports so a reusable component can be found even when its source contains none of the consumer's selectors. Task authoring can scope an element-picked assertion to the keyboard task, independent functional path, or both. The result page displays the two gate verdicts separately, and requests as well as responses are retained in proof bundles. These are product capabilities, not evidence-count targets.

UI checks covered task capture, separate assertion scopes, task confirmation, real repair execution, attempt/checkpoint selection, pointer replay, rejected-result display, and proof export. Browser errors and automated axe findings on the inspected result page were absent. Existing unit/security and browser checks passed. This is an agent-performed walkthrough, not an independent usability study.

Under the [official equally weighted criteria](https://nebiusglobalaihackathon.devpost.com/rules), the new evidence supports technical recovery, a coherent inspectable desktop flow, a concrete business-result rejection, and source-grounded repair beyond keyboard activation. These are grounds for reassessment, not an official numerical score. Evidence remains scoped to the frozen reconstructions: arbitrary component combinations, `visibility:hidden`, browser differences, full WCAG compliance, real screen readers and production repair success rates are not established. Existing competitors' published journey-repair and differential-testing capabilities remain acknowledged; no novelty or general superiority claim is added.
