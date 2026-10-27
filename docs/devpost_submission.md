# Tabstitch — Devpost text

**Tagline:** NVIDIA Nemotron writes the keyboard fix. A real browser decides whether it works, and whether anything else broke.

**Try it (no setup):** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/ . The first button plays a recorded blind repair of a real Bootstrap bug. **Run it live** on any bug card opens a GitHub issue; GitHub Actions then makes a fresh Nemotron repair on Nebius Token Factory and replies with the verdict in a few minutes. Source: https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon

**Track:** Coding and Agentic Engineering. **Built for accessibility:** every bug here blocks someone using only a keyboard.

**Built with:** NVIDIA Nemotron 3 Super, Nemotron 3 Ultra, Nemotron 3 Nano, Nebius Token Factory, Node.js, Playwright, Chromium, axe-core, Zod, GitHub Actions, GitHub Pages.

**Judging in 5 minutes:** (1) home page, **Watch Nemotron fix a real Bootstrap bug**; (2) **A patch you can question**, the model's diff next to the maintainers' fix; (3) the [bug page](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) for the open bugs and the scoreboard; (4) **Run it live** on any card for a fresh Nemotron repair; (5) [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202), the bug Tabstitch found.

## Inspiration

Keyboard and form bugs stop people from finishing a task: focus that never enters a dialog, Escape that closes the wrong thing, a datepicker you cannot Tab out of, a field that submits the wrong value. Scanners rarely see them, because the page looks fine. AI can now write a plausible fix in seconds. The hard question is no longer "can a model write a patch" but "which patch can I merge".

## What it does

Tabstitch is for front-end developers and component-library maintainers who want an AI keyboard fix they can merge. First, a developer writes down what must keep working:

- the keyboard task, replayed with real key presses in Chrome;
- the data the form must submit;
- the same task done with a mouse;
- behaviour that already works and must not break.

This is frozen before the model sees anything. Nemotron 3 Super then edits a copy of the source. Chrome replays every one of those checks. If any fails, Nemotron 3 Ultra gets the exact failure, such as which key went where and which check broke, and tries again. A patch is accepted only when every check passes, and every attempt, accepted or not, is published with screenshots, the diff and the raw model request and response.

It runs where developers work: a GitHub Action that posts the verified patch on the pull request ([example, PR #1](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/pull/1)), a CLI, and Nemotron 3 Nano drafting the task file from one sentence.

## What the evidence shows

**It found a real bug.** A Bootstrap 6 datepicker traps keyboard users: Tab never leaves the field. Nobody had reported it. Tabstitch found it, and it is now [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202), labelled *confirmed* by a Bootstrap maintainer the same day.

**26 real bugs, repaired blind.** Each comes from one of twelve open-source libraries (Bootstrap, GOV.UK Frontend, NHS.UK frontend, focus-trap, tabbable, MicroModal, a11y-dialog, accessible-menu, Pikaday, vanillajs-datepicker, Awesomplete, autoComplete.js), pinned just before the maintainers fixed it by hand. Their fix must pass our frozen checks first (26/26), so the test is fair, and it is never shown to the model.

- **The current engine repairs 25 of 26 on the first run, every one by changing the library's own code.** Each bug gets three runs and every run counts: 71 of 78 runs repaired (91%).
- **61 patches fixed the reported key and still broke something**, such as the submitted data or the mouse path. A test of the reported bug alone would have accepted them. Each one is linked on the scoreboard.
- Across every engine version: 389 of 479 runs repaired. Super's first patch passed in 234 of them; Ultra, given the browser's failure report, rescued 155 more. Every version keeps its public score, including the worse ones.

**7 bugs still open upstream.** 4 are repaired on the first run and 6 at least once in three runs. A browser pass is not the last word: we read every passing patch. Four times a patch passed and was still wrong (for example, a Bootstrap dialog fix that stopped Escape closing every other dialog). Each time, the gap became a stricter frozen check, and the flawed patch now fails it.

**We publish our own mistakes.** 35 early passes only worked around a bug in our demo page instead of fixing the library; they are labelled and not counted, and the page is now read-only to the model. An early file filter hid GOV.UK and NHS.UK library files from the model, and an early accessibility check wrongly rejected 3 good patches. Both are fixed and disclosed.

## How we built it

Node.js, Playwright/Chromium, axe-core, Zod and SHA-256 manifests. Nemotron runs through Nebius Token Factory's OpenAI-compatible API: Super makes the fast first attempt, Ultra the retries with the browser's evidence, and Nano drafts task files. Every call is checked against the authenticated model catalog, and its worst-case cost is reserved in a ledger before it is sent. So far: about 1,250 calls, about US$30 at catalog prices, all from sponsor credits.

Live runs need no server. An issue form starts a GitHub Actions job capped at US$0.50, which commits the evidence, redeploys the site and replies on the issue.

## Challenges

- **Models misremember the code they edit**: a dropped semicolon, `self` for `this`, an invented line. The engine shows the real lines back and applies the model's own hunks only where the lines it deletes exist verbatim. It never guesses a changed line.
- **Super's JSON breaks**: 89 of its 662 calls were not valid repair JSON, most often a missing `]`. Token Factory's `response_format` made every reply parse but corrupted the code inside the strings, so we dropped it (engine v10, stopped after 2 runs and disclosed). Instead we repair only bracket structure.
- **Models take the shortest path**: patches that fixed the test page instead of the library, or hardcoded its element ids. Each became a gate, never a quiet relabel.
- **Single runs are noisy** (18 to 25 of 26 between versions), so from v9 every bug gets three runs and all of them count.

## Accomplishments

A real upstream bug found by the tool and confirmed by Bootstrap; repairs on bugs that maintainers have not fixed yet; a verifier that rejected 61 attractive wrong fixes; and a public record of every version, run, rejected patch and our own gate errors.

## What we learned

The model is good at the fix; the contract is what makes it mergeable. Regression guards and the submitted-data check caught more wrong patches than the reported task did, and reading each passing patch found gaps that became stricter tasks.

## Feedback on Nebius and NVIDIA

Measured from our call ledger ([details](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/blob/main/docs/nvidia_feedback.md), [platform](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/blob/main/docs/nebius_feedback.md)): Ultra was faster than Super for us (p50 19 s vs 33 s) and far more often well-formed. The catalog's prices made per-call cost ceilings easy. Onboarding took one day, from credits to a browser-verified Ultra repair; the only snag was model ids cased differently per model. We did not need Nebius AI Cloud, since the site is static and live runs use GitHub Actions. We would build with Token Factory and Nemotron again for this pattern. `response_format` is accepted for Nemotron 3 but corrupts code strings; a fix or a documented limitation would help.

## What's next

- Freezing contracts from a project's existing end-to-end tests.
- Framework builds with source maps (React, Vue).
- Firefox and WebKit replay.

## Limits

- Each library runs inside an author-built page; these are not production customers.
- Public fixes may be in model training data. The request is checked for lines unique to the maintainers' fix, but that cannot prove the model never saw it.
- Chromium only; static HTML, CSS, JavaScript and TypeScript sources. No screen-reader test or WCAG conformance claim.
- Patch reviews are written with Claude Code, the AI assistant that built this project, after the browser verdict.
