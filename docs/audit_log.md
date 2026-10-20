# Local engineering audits

The reviews below are two separate full-flow passes by the same implementation agent, not an independent human accessibility/security audit. Automated checks do not establish WCAG conformance.

## First pass and red team — 2026-10-20

Traced author input → schema → baseline → localization → provider → isolated patch → parse → replay → functional control → verdict → proof → UI. Searched first-party code for unfinished stubs, disabled tests, command execution, unsafe paths, unrestricted requests, swallowed critical failures and unsupported success claims. Preserved upstream code and licenses separately.

Findings fixed:

- The expanded dialog oracle revealed that native dialog behavior alone did not guarantee our required keyboard wrap path. Added explicit reference focus management; the oracle stayed unchanged.
- A cosmetic-control preimage matched twice and was correctly rejected before replay. Made the negative test target a unique actual source span so it exercises replay rather than patch rejection.
- UI tests caught label-in-name mismatch, weak decorative text contrast, an unfocusable scroll region and 320-pixel navigation overflow. Corrected names, contrast, focusable evidence regions and narrow navigation wrapping.
- Frontend could stop polling after completion time but before the manifest existed. It now waits for finalized proof or an explicit fatal status.
- Console/CSP/network errors could coexist with a passing task verdict. They now make the run inconclusive; repair gate still rejects runtime/functional errors.
- Added a coarse initial-image regression gate, separately scoped from task/semantic assertions.
- A 25 ms deadline exposed a Chromium context-creation/close race. Replaced the timer-only close with an independent deadline race, bounded cleanup and browser-close escalation. Targeted timeout test passed after the fix.

## Second full-flow review — 2026-10-20

Reread trust boundaries and all result-producing paths from input to downloaded proof, including startup, pre-baseline failure, model rejection, malformed completion, exhausted budget, build failure, missing target, replay timeout, server restart and finalization. Reviewed local-only and public-mode restrictions against documentation. Checked artifact integrity and dependency audit output; no secrets are intentionally included in exports.

Additional findings fixed:

- Static fixture serving could address arbitrary extension/dot files inside an explicitly selected local source root. Restricted it to browser asset types, with no dot paths or data/secret files; added a negative request test.
- Scope copy claimed AX/axe/postconditions were tested even if a hard deadline occurred before capture. Scope now derives from actual collected checkpoints and evaluated assertions.
- A failed provider request could lose its provenance and appear as zero model calls in a proof. Completion failures now attach attempted-request/unknown-usage provenance to the run; budget reservations stay charged. No such live request occurred in this session.
- Added stage durations, explicit source/static limitations and a fresh-copy setup harness. Future model routing, arbitrary framework execution, genuine holdout evaluation and screen-reader/user testing remain unimplemented/untested and are disclosed as gaps.

Final pass/fail counts and clean-copy status are generated in `FINAL_AUDIT.md` after the post-review suites. No external audit or production readiness is claimed.
