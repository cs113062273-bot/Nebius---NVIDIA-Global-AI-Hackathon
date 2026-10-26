# NVIDIA Nemotron: what we observed

Tabstitch used three Nemotron 3 models through Nebius Token Factory between 2026-10-21 and 2026-10-26. Every number below comes from our call ledger and run records, aggregated in [`public/inference-stats.json`](../public/inference-stats.json) by [`scripts/inference-stats.mjs`](../scripts/inference-stats.mjs). The figures are as of 2026-10-26 and the script recomputes them.

| Model | Role | Calls | p50 / p90 latency | Completion tokens p50 (of which reasoning) | Proposals that passed every browser gate |
|---|---|---|---|---|---|
| `nemotron-3-super-120b-a12b` | First repair attempt, no browser feedback | 216 | 28 s / 64 s | 5,175 (4,422) | 90 of 216 |
| `Nemotron-3-Ultra-550b-a55b` | Retries, given Chromium's failure report | 199 | 16 s / 32 s | 5,856 (4,731) | 75 of 194 |
| `NVIDIA-Nemotron-3-Nano-30B-A3B` | Drafts a keyboard task from one sentence (`tabstitch draft`) | 2 | 51 s | 5,958 | not a repair model |

## What worked

- **Super fixes most bugs alone.** On the 26 real upstream bugs, Super's first patch passed every gate in 72 of 165 blind runs (44%) before any browser feedback.
- **Ultra makes good use of a concrete failure report.** Given the failed assertion, the focus trace, the key and close-request events and the guard results, Ultra repaired 58 more runs that Super had failed. Feedback was worth more than a second guess.
- **Reasoning is visible and useful.** Most completion tokens are reasoning. The reasoning shows which file and branch the model suspects, so a reviewer can see why a patch went wrong.
- **Ultra was faster than Super in our workload** (p50 16 s vs 28 s), even though it is the larger model, and its output was more often well formed.

## What went wrong, and what we changed

- **Misremembered source is the largest failure class.** 64 proposals (32 from each model) could not be applied because the `before` text did not match the file: a dropped semicolon, `self` for `this`, an invented or omitted line, and in one case the browser's serialised DOM (`data-checkbox-exclusive=""`) copied instead of the source. Exact preimage matching made these visible. The engine now explains each mismatch with the real file lines (v4, v7), tolerates misremembered context (v8), and applies the model's own hunks to the real region when the lines it deletes exist verbatim (v9). It never guesses a changed line.
- **Super's JSON is less reliable than Ultra's.** 30 of Super's 216 calls returned output that was not valid JSON for the repair schema (unbalanced arrays, fields nested in the wrong object, strings where arrays belong), against 3 of Ultra's 199. We normalise only advisory fields (v8); the edits themselves must parse.
- **Reasoning can consume the output limit.** 10 calls stopped at `max_tokens` with the answer unfinished. Raising the limit from 12,000 to 32,000 tokens (v3) mostly removed this.
- **Models fit patches to the test page.** Two early patches made component code name the test page's element ids. That became an overfitting gate (v6), which rejects the patch and tells the model why.

## Would we use it again

Yes, for this pattern: a strong first model, and a second model with an exact, machine-checked failure report. The biggest improvement we would ask for is a documented, working structured-output mode for the Nemotron 3 reasoning models, so schema validity does not depend on the prompt.
