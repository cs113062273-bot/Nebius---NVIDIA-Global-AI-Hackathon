# Tabstitch — Devpost text

**Tagline:** NVIDIA Nemotron writes the keyboard fix. A real browser decides whether it works, and whether anything else broke.

**Try it (no setup):** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html. Pick a real bug and watch the recorded repair, or press **Run it live**: GitHub Actions makes a fresh Nemotron repair on Nebius Token Factory and replies on a GitHub issue with the verdict in a few minutes. Source: https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon

## Inspiration

Keyboard and form bugs are the accessibility failures that stop people from finishing a task: focus that never enters a dialog, Escape that closes the wrong thing, a datepicker you cannot Tab out of, a field that submits the wrong value. Scanners rarely see them, because the page looks fine. AI coding tools now write plausible fixes for them cheaply. The hard question is no longer "can a model write a patch" but "which patch can I merge".

## What it does

A developer (or Tabstitch, from a one-sentence description with Nemotron 3 Nano) freezes what must keep working:

- the keyboard task, replayed with real key presses in Chromium;
- the data the form must submit, read from native `FormData`;
- an independent pointer path;
- regression guards for behaviour that already works.

Nemotron 3 Super proposes bounded, hash-checked edits in a disposable copy. Chromium replays every path. If the patch is rejected, Nemotron 3 Ultra gets the exact failure (focus, key trace, failed assertions, guard results) and tries again, up to three attempts. A patch is accepted only if the task passes, the submitted data and pointer outcome are unchanged, every guard passes, no new axe finding appears and the component code was not fitted to the test page. Every attempt, accepted or not, is published with captures, assertions, diff and the raw model request and response.

It runs where developers work: a CLI, a reusable GitHub Action that posts the verified patch on the pull request ([live example, PR #1](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/pull/1)), and the judge site.

## What the evidence shows

**26 real bugs, repaired blind.** Twelve open-source libraries (Bootstrap, GOV.UK Frontend, NHS.UK frontend, focus-trap, tabbable, MicroModal, a11y-dialog, accessible-menu, Pikaday, vanillajs-datepicker, Awesomplete, autoComplete.js), each pinned at the commit before a published maintainer fix. The maintainers' own fix must pass the frozen task first (26/26); Nemotron only sees the buggy source.

- Current engine (v8): **22 of 26** repaired and browser-verified.
- Every engine version keeps its own public score (7/8, 19, 20, 22, 21, 18, 22 of 26). Any engine change reruns every case, so a worse version stays visible.
- Across all versions: **130 of 165 blind runs repaired (79%)**. Super's first patch passed 44% of the time; sending Chromium's failure report to Ultra added 58 more repairs.
- **22 patches fixed the reported key and still broke something**: the submitted data, the pointer path, a guarded behaviour or a new axe finding. A test of the reported bug alone would have merged them. Each one is linked on the scoreboard.

**8 bugs still open upstream.** 6 are repaired and browser-verified on each library's current code. On review, 3 patches are sound (one matches a pending Bootstrap pull request, one matches the fix a maintainer proposed) and 3 work with stated trade-offs. One bug, a Bootstrap 6 datepicker keyboard trap that nobody had reported, was found by Tabstitch and is now [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202).

**A GOV.UK autocomplete case study** shows why the contract matters: independent review strengthened the task four times, and five plausible model patches were rejected for concrete reasons (one erased saved countries only when the options were pretty-printed) before a final repair passed every gate.

## How we built it

Node.js, Playwright/Chromium, axe-core, Zod and SHA-256 manifests. Nemotron runs through Nebius Token Factory's OpenAI-compatible API: Nano drafts tasks, Super makes the fast everyday attempt, and Ultra handles the hard retry with the browser's evidence. Every call is checked against the authenticated model catalog and reserved in a persistent ledger before it is sent. So far: about 400 calls and 8.3M tokens, about US$9 at catalog prices, all from sponsor credits.

Live runs need no server: an issue form starts a GitHub Actions job capped at US$0.50, which commits the evidence, redeploys the site and replies on the issue.

## Challenges

- Models misremember the code they are editing: a dropped semicolon, `self` for `this`, a line copied from their own rejected patch. Exact preimages reject these. The engine now shows the model the real lines and tolerates only unchanged-context differences, never an invented line.
- Our own first tasks were too weak. A reviewer found patches that hardcoded the test page's element ids; that became the overfitting gate. Each review gap became a frozen task or guard, never a quiet relabel.
- Single runs are noisy (18 to 22 of 26 between versions), so we publish every version and the all-version rate instead of the best day.

## Accomplishments

A real upstream bug report found by the tool; six repairs on bugs maintainers have not fixed yet; and a verifier that has rejected 22 attractive wrong fixes, every one of them inspectable.

## What we learned

The model is good at the fix; the contract is what makes it mergeable. Regression guards and the submitted-data check caught more wrong patches than the reported task did.

## What's next

- Freezing contracts from a project's existing end-to-end tests.
- Framework builds with source maps (React, Vue).
- Firefox and WebKit replay.

## Limits

- Each library runs inside an author-built page; these are not production customers.
- Public fixes may be in model training data; the request is checked for lines unique to the maintainers' fix, but that cannot prove the model never saw it.
- Chromium only; static HTML/CSS/JS and TypeScript sources. No screen-reader test or WCAG conformance claim.
