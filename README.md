# Tabstitch

**Don’t trust the fix. Replay the journey.**

Tabstitch repairs keyboard and form bugs in web pages with **NVIDIA Nemotron on Nebius Token Factory**, then lets a real browser decide whether the patch works. A developer freezes what must keep working: the keyboard task, the data the form must submit, an independent pointer path and regression guards. Nemotron proposes bounded source edits in a disposable copy. Chromium replays every path. Any patch that passes the task but changes the submitted data or breaks a guarded behaviour is rejected, and the concrete failure goes back to the model.

**Judge site (read-only, no setup):** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/
Start with **Watch Nemotron fix a real Bootstrap bug** on the home page: a recorded blind run where Chromium rejects Nemotron 3 Super's patch and Nemotron 3 Ultra then fixes the library. Then pick any bug on the [live page](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html); every published run, including the rejected ones, is listed under **All recorded runs**. Every run shows browser captures, assertions, the diff and the raw model request and response. Viewing makes no model call.

**Run it live yourself (GitHub account only):** every bug card on the [live page](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) has a **Run it live** button. It opens a prefilled `[live run] <bug>` issue; GitHub Actions ([`judge-live.yml`](.github/workflows/judge-live.yml)) gives Nemotron the buggy source, replays the result in Chromium, publishes the evidence and replies on the issue with the verdict, usually within 3 to 10 minutes. Each run is capped at US$0.50 of sponsor credits, with 12 requested runs a day and 3 per person.

## Real bugs, repaired blind

[**Real bugs, live**](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) lists 26 keyboard and form bugs that were reported and fixed by hand in 12 open-source libraries (Bootstrap, GOV.UK Frontend, NHS.UK frontend, focus-trap, tabbable, MicroModal, a11y-dialog, accessible-menu, Pikaday, vanillajs-datepicker, Awesomplete, autoComplete.js). Each library is pinned at the commit before the maintainers' fix, and a browser task is frozen. The maintainers' own fix must pass that task first (26/26). Nemotron then gets only the buggy source: Super first, then Ultra after each rejection, at most five proposals from engine v13 (three before, and in live runs).

**Current engine (v13): 25 of 26 repaired on the first run, every one by changing the library's own code**, each verified in Chromium against the keyboard task, an independent pointer path and regression guards. From engine v9, every bug gets three blind runs and every run counts: on v13, 71 of 78 runs were repaired (91%), all in the library code, and 25 of 26 bugs were repaired at least once. v13 allows up to five proposals (Super, then Ultra four times, each with the browser's failure report); v12, with three, repaired 64 of 78. The maintainers' fix is never sent. An automatic check flags any line the fix added that also appears in a request. From v9 to v13 every flag came from one of two places. On one Bootstrap bug the fix adds a new file whose license header and imports also appear in other Bootstrap files sent as source. Otherwise the line was Nemotron's own earlier attempt, coming back as history. Every engine version keeps its score on the page, including the worse ones. Changing the engine or a run limit counts as a new version, and every bug is rerun.

**Across every version: 389 of 479 blind runs repaired (81%), 354 of them in the library's own code.** Nemotron 3 Super's first patch passed in 234 runs (49%), and sending Chromium's failure report to Nemotron 3 Ultra added 155. 61 patches made the reported keyboard task pass and were still rejected, because they changed the submitted data, broke the pointer path or broke a guarded behaviour. A test of the reported bug alone would have accepted them, and the scoreboard links every one. It also lists 3 Pikaday patches that engines before v9 rejected for an axe colour-contrast finding the library itself already had; they are not counted as caught ([`scripts/gate-stats.mjs`](scripts/gate-stats.mjs)). Two engine bugs were found and fixed on the way: before v12, a name filter hid every library file under `packages/` (GOV.UK, NHS.UK) from the model, and v13 stops the local page server from picking a port Chromium refuses.

**Bugs still open upstream:** 7 bugs, each with a strictest frozen task. On that task's first v13 run, 4 are repaired and browser-verified on the library's current code; across three runs, 6 of 7 were repaired at least once. Every passing patch is read after the verdict. Four reviews found a patch that passed and was still wrong: a Bootstrap 6 dialog patch that stopped Escape closing every other dialog, a Pikaday patch that hung at a date limit, a datepicker patch that ignored a configured date format, and a drawer patch that handled only an autofocus field. Each gap became a stricter frozen case. Replayed without inference, the flawed patch fails it, and the pending human Bootstrap fixes pass. Two of the four current patches are judged sound on review: one matches the pending Bootstrap pull request, the other the fix the autoComplete.js maintainer proposed. One bug, a Bootstrap 6 datepicker keyboard trap that no one had reported, was found by Tabstitch and is now [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202), labelled *confirmed* by a Bootstrap maintainer the same day.

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

## Earlier case studies

Before the real-bug benchmark, two reported issues were studied in author-built pages, and each contract was made stricter after review:

- **GOV.UK accessible-autocomplete (country field).** Five model patches were rejected on the way, several after passing an earlier, weaker contract, including one that erased saved countries when the options were pretty-printed. The final Ultra repair ([run `c3158127`](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/project.html?run=c3158127-dba3-43b3-8dcc-981dc00e071f&attempt=2)) passes the task, the pointer path and 3/3 guards on both markups. One withheld check stays a recorded `VERIFIED_FAIL`: typing only spaces makes the pinned component itself confirm Germany. Reviewer probes: [`reviewer-probes.json`](benchmarks/native-form-markup/reviewer-probes.json).
- **[Pikaday](https://github.com/Pikaday/Pikaday/issues/955) (keyboard date navigation).** Super repaired arrow keys selecting a closed weekend, then a closed-range flaw that review exposed, then a British Summer Time bug where ArrowDown landed on Thursday; six withheld checks pass.

## How NVIDIA Nemotron and Nebius are used

Where Token Factory sped the work up: one OpenAI-compatible endpoint serves all three Nemotron models, so routing Super, Ultra and Nano is configuration rather than code; the catalog's prices let every call be capped before it is sent; and the same key in a GitHub secret lets judges start a real run from an issue, with no server of ours.

- Every repair proposal is a live `chat/completions` call to Nebius Token Factory with an NVIDIA Nemotron model selected from the authenticated catalog: `nvidia/Nemotron-3-Ultra-550b-a55b` or `nvidia/nemotron-3-super-120b-a12b`.
- The model receives the failing browser evidence, the frozen requirements and the full allowlisted source with SHA-256 hashes. It returns root cause, strategy and exact before/after edits as JSON.
- Routing: Nemotron 3 Super makes the first attempt with no browser feedback; Nemotron 3 Ultra makes up to two retries (four in benchmark runs from engine v13), each given Chromium's exact failure report. Nemotron 3 Nano drafts task files from a one-sentence description (`tabstitch draft`). Since engine v11, a reply that is not valid JSON has only its bracket structure repaired; `response_format` was tried in v10 and dropped because it corrupted code strings.
- Every call reserves its worst-case cost from catalog prices in a local ledger before it is sent, under a US$ ceiling per benchmark scope. Per-model calls, latency, token use, failure classes and cost are aggregated in [`public/inference-stats.json`](public/inference-stats.json). Failed, truncated and unparseable calls are recorded and never counted as success. What we learned about the models and the platform is in [`docs/nvidia_feedback.md`](docs/nvidia_feedback.md) and [`docs/nebius_feedback.md`](docs/nebius_feedback.md).
- Raw requests and responses, including reasoning, request IDs, usage and latency, are published with each run under `public/evidence/runs/<run>/model-*.json`.

## What the gate checks

A candidate passes only when all of these hold in fresh Chromium contexts:

1. The frozen keyboard task passes, using real Tab, Enter, arrow and Escape key presses. Seeking a control never calls `focus()`.
2. The independent pointer path still passes, and its outcome is unchanged.
3. Every regression guard that passed on the original still passes, without runtime errors.
4. Assertions read native browser `FormData`, not display text.
5. The patch touches only allowlisted, hash-matched files, matches its preimage exactly once (or applies hunk by hunk where the lines it deletes exist verbatim), parses, adds no axe finding that no recorded path on the original showed, and keeps the initial page visually stable.
6. Component code is not fitted to the test page. A patch that makes a library file name one of the page's element ids (for example `querySelector('#filters-close')` inside `drawer.ts`) is rejected before the browser runs and sent back to the model. Application files that already refer to the page's ids are exempt. This gate exists because two earlier patches passed every browser check by doing exactly that.

When a key press does not do what the task expects, the model also gets the browser's key trace: which element received each key, whether a listener cancelled it, and whether a dialog's `cancel` event could be cancelled at all.

The four verdicts are `VERIFIED_PASS`, `VERIFIED_FAIL`, `INCONCLUSIVE` and `NOT_TESTED`. Timeouts, truncated or malformed output, syntax errors and patches that cannot be applied stop before the browser and are shown as **not executed**. They never inherit another attempt's pass.

## Provenance, honestly

- **Blind real bugs.** Each library is pinned, unmodified, at the commit before a published maintainer fix, inside an author-built page. The maintainers' fix must pass the frozen task before any inference and is never sent to the model; every request is scanned for lines unique to that fix. Public fixes may still be in model training data.
- **Every version, every run.** A change to the engine or a run limit is a new version, and every case is rerun on it; earlier scores stay on the scoreboard. From engine v9, each bug gets three blind runs and every run counts.
- **Where a pass fixed the bug.** Each pass is labelled by its diff: a change to the library's own files, or only a workaround in the author-built page. Before engine v11 the page was editable, and 35 of the 389 passing runs only worked around the bug there.
- **The gate's own errors.** Three Pikaday patches were rejected before engine v9 for colour contrast the library already had. They are listed on the scoreboard and are not counted as catches.
- **Earlier case studies.** The GOV.UK autocomplete and Pikaday studies are real reported issues in author-created pages, not production customers.
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
| `benchmarks/realbugs/`, `scripts/realbugs.mjs` | The 26 fixed upstream bugs, pinned sources, frozen tasks and per-version scores |
| `benchmarks/openbugs/`, `scripts/openbugs.mjs` | The 7 bugs still open upstream, with patch reviews |
| `action.yml`, `.github/workflows/judge-live.yml` | The GitHub Action and the judge live-run workflow |
| `src/engine.js` | Repair loop: baseline, localization, proposals, isolated patching, replay, verdict |
| `src/nebius.js` | Token Factory client, catalog check, budget ledger, raw request/response capture |
| `src/runner.js`, `src/verifier.js` | Playwright journeys and the deterministic gate |
| `public/project.*`, `public/result-evidence.js` | Workbench and evidence viewer |
| `benchmarks/<case>/` | Frozen sources, tasks, commitments, amendments and results |
| `public/evidence/` | Published read-only runs; files match their run manifests |

## Limits

- Static HTML, CSS, JavaScript and TypeScript sources. Framework builds are verified as built output, not repaired at framework source.
- Chromium only. No NVDA, VoiceOver or JAWS testing.
- A pass is only as strong as the frozen tasks and guards. The recorded history shows patches that passed a weaker contract before review found the gap.
- The public site is static. Fresh runs happen in GitHub Actions when someone opens a live-run issue (12 a day, 3 per person, US$0.50 each) or locally with your own key.

MIT for our code. Pinned upstream components keep their own licenses in each `original/LICENSE.txt`. Playwright (Apache-2.0), axe-core (MPL-2.0), Zod (MIT) and pngjs (MIT) keep their licenses.
