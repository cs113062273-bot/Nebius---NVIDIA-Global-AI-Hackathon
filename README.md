# Tabstitch

Tabstitch uses NVIDIA Nemotron on Nebius Token Factory to propose fixes for keyboard and form bugs. It replays predefined tasks in Chromium and rejects patches that break the keyboard task, submitted data, mouse interaction or regression checks. It produces a patch and the evidence for its verdict.

[Try the recorded repair](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/) · [Cases and results](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) · [Example pull request](https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/pull/1)

## How it works

1. Define the keyboard task, expected form data, an independent mouse path and any regression checks. Freeze these before repair.
2. Nemotron 3 Super proposes source edits in a disposable copy.
3. Chromium replays the tasks. The gate also checks file permissions and hashes, patch application, syntax, new axe findings and visual changes.
4. If rejected, Nemotron 3 Ultra receives the failure report and retries. Live runs allow three proposals total. An accepted patch is saved with its diff, browser captures and raw model requests and responses.

The public site replays recorded runs without making model calls. **Run it live** on a case opens a GitHub issue and requires a GitHub account. GitHub Actions runs a fresh repair, publishes the evidence and replies on the issue. Limits: US$0.50 in sponsor credits per run, 12 runs per day, 3 per requester.

## Run locally

Requires Node.js 24.19 or later and npm.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm start
```

Open http://127.0.0.1:4317. No API key is needed to inspect recorded runs or verify an edited folder. Use `project.html` to load a static app, define tasks and verify or repair it.

For model repairs, copy `.env.example` to `.env`, set `NEBIUS_API_KEY`, `LIVE_NEBIUS_TESTS=true` and `NEBIUS_SPONSOR_CREDITS_CONFIRMED=true` after confirming sponsor/free credits. Run `npm run live:catalog` and set `NEBIUS_MODEL` to an available Nemotron model. Configure the call, token and dollar ceilings in `.env`; costs are reserved before requests in `artifacts/inference/budget.json`.

To check a build without inference:

```sh
node src/cli.js check dist --tasks .tabstitch/tasks.json
```

See the [example task file](examples/checkout/.tabstitch/tasks.json).

## GitHub Action

Commit a task file and build your site to `dist` before the action runs.

```yaml
# .github/workflows/keyboard.yml
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  keyboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Add your install/build step here.
      - uses: cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon@main
        with:
          site: dist
          tasks: .tabstitch/tasks.json
          nebius-api-key: ${{ secrets.NEBIUS_API_KEY }}
          max-usd: '0.5'
```

Without a key, the action only checks. With a key, it can post a browser-verified patch on the pull request and attach the evidence archive. The check still fails until the broken build is fixed; generating a patch does not make it pass. Fork pull requests do not receive repository secrets.

Nemotron 3 Nano can draft a task file:

```sh
node --env-file-if-exists=.env src/cli.js draft dist --describe "Open checkout, enter a delivery note and place the order" --tasks .tabstitch/tasks.json
```

A draft is saved only when its paths pass on the current build. Review it and change `"source": "model"` to `"authored"` before using it for checks or repairs.

## Recorded results

Engine v13, recorded October 26, 2026. A run allows up to five proposals: Super first, then up to four Ultra retries. Each case has three runs.

| Cases | Passing first run | Passing runs, all three runs included |
|---|---:|---:|
| 26 previously fixed upstream bugs, 12 libraries | 25/26 | 71/78 |

All 71 passing runs changed library code. The maintainers' fixes pass the frozen tasks (26/26) and are excluded from model requests. Public fixes may still be in model training data. The libraries run inside author-built pages.

For seven bugs open upstream at the time of recording, four passed their first run and six passed at least once across three runs. Patch review found four earlier passes with missed regressions; stricter tasks were added before rerunning. A pass covers the recorded checks, not every possible use of the component.

Across recorded engine versions, 61 patches passed the keyboard task but failed the mouse path or a regression check. The record also includes our errors: 35 early passes changed only the test page, and three patches were wrongly rejected for pre-existing colour contrast. [Gate records](public/gate-stats.json) and the [scoreboard](https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/live.html) retain these outcomes.

Tabstitch also found a Bootstrap datepicker keyboard trap, reported as [twbs/bootstrap#43202](https://github.com/twbs/bootstrap/issues/43202) and confirmed by a maintainer. Model patch reviews are written with Claude Code after the browser verdict; they are separate from browser verification.

## Nebius and NVIDIA integration

Repair proposals use Token Factory's `chat/completions` API with Nemotron 3 Super and Ultra; Nano drafts tasks. One endpoint serves all three models, and catalog prices provide the cost ceilings. Raw requests, responses, usage and latency are published under `public/evidence/runs/`.

[Call statistics](public/inference-stats.json) · [NVIDIA feedback](docs/nvidia_feedback.md) · [Nebius feedback](docs/nebius_feedback.md) · [Architecture](docs/architecture.md)

## Limits

- Static HTML, CSS, JavaScript and TypeScript. Framework builds are checked as built output; framework source is not repaired.
- Chromium only. No screen-reader testing or WCAG conformance claim.
- Verification depends on the frozen tasks. Earlier patches passed weaker tasks before review exposed gaps.

## License

[MIT](LICENSE) for our code. Pinned upstream components retain their licenses in each `original/LICENSE.txt`.
