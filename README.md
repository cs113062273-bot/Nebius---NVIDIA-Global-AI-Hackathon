# Tabstitch

**Don’t trust the fix. Replay the journey.**

Tabstitch repairs keyboard and form bugs in web pages with **NVIDIA Nemotron on Nebius Token Factory**, then lets a real browser decide whether the patch works. A developer freezes what must keep working: the keyboard task, the data the form must submit, an independent pointer path and regression guards. Nemotron proposes bounded source edits in a disposable copy. Chromium replays every path. Any patch that passes the task but changes the submitted data or breaks a guarded behaviour is rejected, and the concrete failure goes back to the model.

**Judge site (read-only, no setup):** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/
Start at **See the verified repair**, then **Browse all 97 recorded runs**. Every page shows recorded browser captures, assertions, diffs and the raw model request and response. Viewing makes no model call.

**Run it live yourself (GitHub account only):** every bug card on the [live page](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) has a **Run it live** button. It opens a prefilled `[live run] <bug>` issue; GitHub Actions ([`judge-live.yml`](.github/workflows/judge-live.yml)) gives Nemotron the buggy source, replays the result in Chromium, publishes the evidence and replies on the issue with the verdict, usually within 3 to 10 minutes. Each run is capped at US$0.50 of sponsor credits, with 12 requested runs a day and 3 per person.

## Real bugs, repaired blind

[**Real bugs, live**](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) lists 26 keyboard and form bugs that were reported and fixed by hand in 12 open-source libraries (Bootstrap, GOV.UK Frontend, NHS.UK frontend, focus-trap, tabbable, MicroModal, a11y-dialog, accessible-menu, Pikaday, vanillajs-datepicker, Awesomplete, autoComplete.js). Each library is pinned at the commit before the maintainers' fix, and a browser task is frozen. The maintainers' own fix must pass that task first (26/26). Nemotron then gets only the buggy source: Super first, Ultra after a rejection, at most three proposals.

**Result on the current frozen engine (v8): 22 of 26 repaired**, each verified in Chromium against the keyboard task, an independent pointer path and regression guards. The maintainers' fix is never sent. An automatic check flags any line the fix added that also appears in a request; in v8 it flagged one line on a passing run, and that line was written by Nemotron itself in its first attempt and came back as history (the other flags were on a failed run). The four failures were rejected by the browser, not left unresolved. Every engine version keeps its own score on the page (7/8, 19, 20, 22, 21, 18 and 22 of 26): changing the engine or a run limit counts as a new version, and every case is rerun, so a worse version stays visible.

**Across every version: 130 of 165 blind runs repaired (79%).** Nemotron 3 Super's first patch passed in 72 runs (44%); sending Chromium's failure report to Nemotron 3 Ultra added 58. 19 patches made the reported keyboard task pass and were still rejected, because they changed the submitted data, broke the pointer path or broke a guarded behaviour. A test of the reported bug alone would have accepted them; the scoreboard links every one. It also lists 3 Pikaday patches that engines before v9 rejected for an axe colour-contrast finding the library itself already had; they are not counted as caught ([`scripts/gate-stats.mjs`](scripts/gate-stats.mjs)).

**Bugs still open upstream:** 6 of 8 repaired and browser-verified on each library's current code; on the author's review, 3 patches are sound and 3 work with stated trade-offs. One of them, a Bootstrap 6 datepicker keyboard trap that no one had reported, was found by Tabstitch and is now [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202), labelled *confirmed* by a Bootstrap maintainer the same day.

## In a pull request

[**Pull request #1**](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/pull/1) is a live run of the CI check in [`.github/workflows/tabstitch.yml`](.github/workflows/tabstitch.yml). The change replaces the example shop's native dialog with a slide-in panel that works with a mouse but no longer moves keyboard focus. The workflow replayed the frozen task in Chromium and found the failure. Nemotron 3 Super's first patch was rejected because closing the panel did not return focus; that failure went back to the model. Nemotron 3 Ultra's second patch passed the keyboard task and the pointer path, and the verified diff was posted on the pull request. Fork pull requests never receive the Nebius key, and each repair is capped at US$0.50.

## Use it in your repository

Add the action to any project that builds to static HTML, CSS and JavaScript or TypeScript. Commit a task file that describes one keyboard task, an independent pointer path and, optionally, regression guards (see [`examples/checkout/.tabstitch/tasks.json`](examples/checkout/.tabstitch/tasks.json)).

```yaml
# .github/workflows/keyboard.yml
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  keyboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # - run: npm ci && npm run build   # if the site needs a build step
      - uses: cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon@main
        with:
          site: dist
          tasks: .tabstitch/tasks.json
          nebius-api-key: ${{ secrets.NEBIUS_API_KEY }}   # omit to check without repairing
          max-usd: '0.5'
```

No task file yet? Describe the task in one sentence and let Nemotron 3 Nano draft it from the page's real controls:

```sh
node src/cli.js draft dist --describe "Open the checkout dialog with the keyboard, enter a delivery note and place the order" --tasks .tabstitch/tasks.json
```

The draft is saved only if the keyboard task, the pointer path and every guard pass on the current build; failures go back to Nano, up to three times. The draft is saved with `"source": "model"`, and `check` and `repair` refuse model-written tasks: read it, then change the source to `"authored"` to accept it as the frozen oracle that later repairs must satisfy.

Every pull request replays the frozen tasks in Chromium. If one breaks, Nemotron proposes a patch (Super first, Ultra after a rejection) and the browser-verified diff is posted on the pull request, with the proof archive as a build artifact. Pull requests from forks never receive the key, so they are only checked. The `verified-patch` output gives later steps the patch path.

## The problem

Keyboard and form fixes often look right and still submit the wrong data. In the pinned [GOV.UK accessible-autocomplete](https://github.com/alphagov/accessible-autocomplete/issues/777), clearing a saved country leaves the field empty on screen while the hidden `<select>` still submits `gb`. Accessibility scanners report nothing; the user's data is wrong.

## What the recorded runs show

The country form was strengthened four times after independent review. Each stricter contract was frozen before new inference, and earlier model patches were replayed against it without inference.

| Model-authored patch | What the browser found | Verdict |
|---|---|---|
| Ultra · first repair (clearing only) | An unlisted country (“Atlantis”) still submits `gb` | Rejected by the stricter task |
| Super · trimmed blank input | Blank text matched the empty option by value; billing still submits `de` | Rejected |
| Super · component blur handler | Passed its own task, but “Fra” + Tab no longer saves France, and the library's plain usage throws | Rejected by a withheld check, then by regression guards |
| Ultra · public `onConfirm` option | Pressing Enter inside a cleared field submits without blur; `de` is still sent | Rejected by the next contract |
| Ultra · `onConfirm` + exact-text submit sync | Passed that contract, but with the same options pretty-printed (text on its own indented line), saving without editing erased both saved countries | Rejected by the markup-independent contract |
| **Ultra · trimmed submit-time sync** | Keyboard task, pointer path and 3/3 regression guards pass on pretty-printed markup; withheld single-line page, clear shipping and clear billing pass | **VERIFIED_PASS** |

The final repair ([run `c3158127`](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/project.html?run=c3158127-dba3-43b3-8dcc-981dc00e071f&attempt=2)) edits only the consumer’s `app.js`, not the third-party library. Its first attempt also erased the saved countries and was rejected by all three guards; that failure went back to the model. A reviewer probe of eleven interactions (Enter inside the field, Escape, lowercase, trailing space, arrow selection, retyping, untouched save) found visible text and submitted form data consistent **11/11 on both markups**, against 5/11 for the original component and 0/11 for the previous final repair ([`reviewer-probes.json`](benchmarks/native-form-markup/reviewer-probes.json), reproducible with `scripts/probe-country-consistency.mjs`).

One withheld check is a recorded `VERIFIED_FAIL` and stays that way: with pretty-printed options, typing only spaces matches the whitespace inside the component’s own option text, so the pinned component confirms Germany on blur. The field shows Germany and `de` is submitted. That matches the task goal (submit what the field shows) but not that check, which was written for single-line markup.

A second component, [Pikaday](https://github.com/Pikaday/Pikaday/issues/955), shows the same loop on keyboard date navigation:

- ArrowRight could select a closed weekend. Super repaired it; a precommitted reverse task passed.
- A closed range boundary exposed a remaining flaw, and a separate Super run fixed it.
- In `Europe/London`, ArrowDown across the end of British Summer Time landed on Thursday instead of Friday. Super switched to calendar-day arithmetic, and six withheld UTC, London and closed-range checks passed.

## How NVIDIA Nemotron and Nebius are used

- Every repair proposal is a live `chat/completions` call to Nebius Token Factory with an NVIDIA Nemotron model selected from the authenticated catalog: `nvidia/Nemotron-3-Ultra-550b-a55b` or `nvidia/nemotron-3-super-120b-a12b`.
- The model receives the failing browser evidence, the frozen requirements and the full allowlisted source with SHA-256 hashes. It returns root cause, strategy and exact before/after edits as JSON.
- Ultra handled the hardest form reasoning (16,000-token output limit). Super handled the larger calendar component.
- Ledger to date: **38 requests**, 669,899 prompt and 230,964 completion tokens. That is about **US$0.94** at the catalog prices returned by the API, paid from sponsor credits. Seven requests failed, were truncated or returned invalid output; they are recorded, never counted as success.
- Raw requests and responses, including reasoning, request IDs, usage and latency, are published with each run under `public/evidence/runs/<run>/model-*.json`.

## What the gate checks

A candidate passes only when all of these hold in fresh Chromium contexts:

1. The frozen keyboard task passes, using real Tab, Enter, arrow and Escape key presses. Seeking a control never calls `focus()`.
2. The independent pointer path still passes, and its outcome is unchanged.
3. Every regression guard that passed on the original still passes, without runtime errors.
4. Assertions read native browser `FormData`, not display text.
5. The patch touches only allowlisted, hash-matched files, matches its preimage exactly once, parses, adds no new axe findings and keeps the initial page visually stable.
6. Component code is not fitted to the test page. A patch that makes a library file name one of the page's element ids (for example `querySelector('#filters-close')` inside `drawer.ts`) is rejected before the browser runs and sent back to the model. Application files that already refer to the page's ids are exempt. This gate exists because two earlier patches passed every browser check by doing exactly that.

When a key press does not do what the task expects, the model also gets the browser's key trace: which element received each key, whether a listener cancelled it, and whether a dialog's `cancel` event could be cancelled at all.

The four verdicts are `VERIFIED_PASS`, `VERIFIED_FAIL`, `INCONCLUSIVE` and `NOT_TESTED`. Timeouts, truncated or malformed output, syntax errors and patches that cannot be applied stop before the browser and are shown as **not executed**. They never inherit another attempt's pass.

## Provenance, honestly

- **Original cases.** Both components are pinned and unmodified upstream code inside author-created pages. They are real reported issues, not production customers.
- **Post-hoc strengthening.** Every stricter task was added after review. Each one was frozen in `benchmarks/<case>/commitment.json` before the next inference, together with source hashes, task hashes and repair-implementation hashes.
- **Implementation amendments.** Two changes were made after recorded failures: accepting a lone string for advisory lists, and adding optional regression guards. Both are disclosed in `amendment*.json`; source and tasks stayed frozen.
- **Withheld checks.** These were omitted from model requests, but their markup is visible in the source. This is not a blind evaluation.
- **Labels.** Browser-only rechecks, human negative controls and replays of earlier patches are labelled separately from new inference.
- **Pass scope.** A pass covers only the frozen tasks, guards and recorded browser conditions. It is not a WCAG conformance claim or screen-reader testing.

## Run locally

Requires Node 24, npm and a desktop OS supported by Playwright. No GPU, database or API key is needed to inspect evidence or verify human patches.

```powershell
npm ci --ignore-scripts
npx playwright install chromium
npm start
```

Open **http://127.0.0.1:4317**. On a fresh clone, recorded runs load from `public/evidence`.

`project.html` is the workbench:
- Load the failing form or calendar, review the frozen contract, then verify an edited folder (no AI) or choose **Nemotron on Nebius** to repair it.
- To use your own static app, select its folder, capture the keyboard and pointer paths in the embedded preview, and choose the form fields or text that must stay correct.

Each result offers playback for every path and guard, the per-attempt diff, raw model files and a proof archive.

### Live Nebius / NVIDIA mode

1. Use sponsor or free Token Factory credits. The app cannot read your billing settings.
2. Copy `.env.example` to `.env` and keep it private. Set `NEBIUS_API_KEY`, `LIVE_NEBIUS_TESTS=true` and `NEBIUS_SPONSOR_CREDITS_CONFIRMED=true`.
3. Run `npm run live:smoke` to list the Nemotron models your account can use, then set `NEBIUS_MODEL` to one of them.
4. `NEBIUS_MAX_CALLS`, `NEBIUS_MAX_TOTAL_TOKENS`, `NEBIUS_MAX_CREDIT_USD` and `NEBIUS_MAX_OUTPUT_TOKENS` are enforced before every request.

`artifacts/inference/budget.json` reserves a conservative maximum before each call and never refunds failed requests.

To reproduce an experiment, run `node scripts/evaluate-followup.mjs --prepare|--challenge|--repair|--recheck <case>`. It freezes a case, replays an earlier patch, runs bounded inference or rechecks withheld tasks. `node scripts/export-evidence.mjs` republishes the evidence bundle.

## Repository map

| Path | Purpose |
|---|---|
| `src/engine.js` | Repair loop: baseline, localization, proposals, isolated patching, replay, verdict |
| `src/nebius.js` | Token Factory client, catalog check, budget ledger, raw request/response capture |
| `src/runner.js`, `src/verifier.js` | Playwright journeys and the deterministic gate |
| `public/project.*`, `public/result-evidence.js` | Workbench and evidence viewer |
| `benchmarks/<case>/` | Frozen sources, tasks, commitments, amendments and results |
| `public/evidence/` | Published read-only runs; files match their run manifests |

## Limits

- Static HTML/CSS/JS only. Framework builds are verified as built output, not repaired at framework source.
- Chromium only. No NVDA, VoiceOver or JAWS testing.
- A pass is only as strong as the frozen tasks and guards. The recorded history shows patches that passed a weaker contract before review found the gap.
- The public site is read-only. Live repair runs locally because it executes browsers and spends credits.

MIT for our code. Pinned upstream components keep their own licenses in each `original/LICENSE.txt`. Playwright (Apache-2.0), axe-core (MPL-2.0), Zod (MIT) and pngjs (MIT) keep their licenses.
