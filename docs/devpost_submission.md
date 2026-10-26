# Tabstitch — Devpost text

**Tagline:** NVIDIA Nemotron writes the keyboard fix. A real browser decides whether it works, and whether anything else broke.

**Try it (no setup):** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/ . The first button plays a recorded blind repair of a real Bootstrap bug. **Run it live** on any bug card opens a GitHub issue; GitHub Actions then makes a fresh Nemotron repair on Nebius Token Factory and replies with the verdict in a few minutes. Source: https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon

## Inspiration

Keyboard and form bugs stop people from finishing a task: focus that never enters a dialog, Escape that closes the wrong thing, a datepicker you cannot Tab out of, a field that submits the wrong value. Scanners rarely see them, because the page looks fine. AI can now write a plausible fix in seconds. The hard question is no longer "can a model write a patch" but "which patch can I merge".

## What it does

A developer freezes what must keep working:

- the keyboard task, replayed with real key presses in Chromium;
- the data the form must submit, read from native `FormData`;
- an independent pointer path;
- regression guards for behaviour that already works.

Nemotron 3 Super proposes bounded, hash-checked edits in a disposable copy. Chromium replays every path. If the patch is rejected, Nemotron 3 Ultra gets the exact failure (failed assertion, focus and key trace, guard results) and tries again, up to five proposals in the benchmark (three in live runs). A patch is accepted only if the task passes, the submitted data and pointer outcome are unchanged, every guard passes, no axe finding appears that the original never showed, and the component code was not fitted to the test page. Every attempt, accepted or not, is published with captures, assertions, the diff and the raw model request and response.

It runs where developers work: a CLI, a reusable GitHub Action that posts the verified patch on the pull request ([live example, PR #1](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/pull/1)), task drafting from one sentence with Nemotron 3 Nano, and the judge site.

## What the evidence shows

**26 real bugs, repaired blind.** Twelve open-source libraries (Bootstrap, GOV.UK Frontend, NHS.UK frontend, focus-trap, tabbable, MicroModal, a11y-dialog, accessible-menu, Pikaday, vanillajs-datepicker, Awesomplete, autoComplete.js), each pinned at the commit before a published maintainer fix. The maintainers' own fix must pass the frozen task first (26/26), and it is never sent to the model.

- **Current engine (v13): 25 of 26 repaired on the first run, all in the library's own code.** Every bug gets three blind runs, and every run counts: 71 of 78 runs repaired (91%), and 25 of 26 bugs repaired at least once. v13 allows five proposals (Super, then Ultra four times); with three, v12 repaired 64 of 78.
- Every engine version keeps its public score, including the worse ones. Any engine change reruns every bug.
- Across all versions: **389 of 479 blind runs repaired (81%)**, 354 of them in the library's own code. Super's first patch passed 49% of the time; Chromium's failure report sent to Ultra added 155 more.
- **61 patches fixed the reported key and still broke something**, such as the submitted data, the pointer path or a guarded behaviour. A test of the reported bug alone would have merged them. Each one is linked on the scoreboard.

**We report our own mistakes too.** 35 earlier passes changed only the author-built page around the library, a workaround rather than a fix. Every pass is now labelled by where it changed code, and since v11 the page is read-only context. Before v12, a file-name filter hid every library file under `packages/` from the model, so GOV.UK and NHS.UK bugs could only be worked around. Before v9, our axe gate wrongly rejected 3 patches for colour contrast the library already had. All of these are disclosed and none is counted.

**7 bugs still open upstream.** On each bug's strictest frozen task, 4 are repaired on the first v13 run and 6 at least once in three runs, browser-verified on the library's current code. A browser pass is not the last word: every patch is read after the verdict. Four reviews found a patch that passed and was wrong: a Bootstrap dialog patch that stopped Escape closing every other dialog, a Pikaday patch that hung at a date limit, a datepicker patch that ignored a configured format, and a drawer patch that handled only an autofocus field. Each gap became a stricter frozen task. Replayed without inference, the flawed patch fails it, and the pending human Bootstrap fixes pass. One bug, a Bootstrap 6 datepicker keyboard trap nobody had reported, was found by Tabstitch and is now [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202), labelled *confirmed* by a Bootstrap maintainer the same day.

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

Measured from our call ledger ([details](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/blob/main/docs/nvidia_feedback.md), [platform](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/blob/main/docs/nebius_feedback.md)): Ultra was faster than Super for us (p50 19 s vs 33 s) and far more often well-formed. The catalog's prices made per-call cost ceilings easy. `response_format` is accepted for Nemotron 3 but corrupts code strings; a fix or a documented limitation would help.

## What's next

- Freezing contracts from a project's existing end-to-end tests.
- Framework builds with source maps (React, Vue).
- Firefox and WebKit replay.

## Limits

- Each library runs inside an author-built page; these are not production customers.
- Public fixes may be in model training data. The request is checked for lines unique to the maintainers' fix, but that cannot prove the model never saw it.
- Chromium only; static HTML, CSS, JavaScript and TypeScript sources. No screen-reader test or WCAG conformance claim.
- Patch reviews are written with Claude Code, the AI assistant that built this project, after the browser verdict.
