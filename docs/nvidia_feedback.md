# NVIDIA Nemotron: what we observed

Tabstitch used three Nemotron 3 models through Nebius Token Factory between 2026-10-21 and 2026-10-27. Every number below comes from our call ledger and run records, aggregated in [`public/inference-stats.json`](../public/inference-stats.json) by [`scripts/inference-stats.mjs`](../scripts/inference-stats.mjs).

| Model | Role | Calls | p50 / p90 latency | Completion tokens p50 (of which reasoning) | Proposals that passed every browser gate |
|---|---|---|---|---|---|
| `nemotron-3-super-120b-a12b` | First repair attempt, no browser feedback | 662 | 33 s / 71 s | 6,416 (5,657) | 300 of 653 |
| `Nemotron-3-Ultra-550b-a55b` | Retries, given Chromium's failure report | 584 | 19 s / 37 s | 6,893 (5,784) | 215 of 578 |
| `NVIDIA-Nemotron-3-Nano-30B-A3B` | Drafts a keyboard task from one sentence (`tabstitch draft`) | 2 | 51 s | 5,958 | not a repair model |

## What worked

- **Super fixes most bugs alone.** On the 26 real upstream bugs, Super's first patch passed every gate in 234 of 479 blind runs (49%), before any browser feedback.
- **Ultra makes good use of a concrete failure report.** Given the failed assertion, the focus trace, the key and close-request events and the guard results, Ultra repaired 155 more runs that Super had failed; allowing it four retries instead of two (engine v13) took the current engine from 64 to 71 of 78 runs. The feedback was worth more than a second guess.
- **Reasoning is visible and useful.** Most completion tokens are reasoning. The reasoning shows which file and branch the model suspects, so a reviewer can see why a patch went wrong.
- **Ultra was faster than Super in our workload** (p50 19 s vs 33 s), even though it is the larger model, and its output was almost always well formed.

## What went wrong, and what we changed

- **Misremembered source is the largest failure class.** 139 proposals could not be applied because the `before` text did not match the file: a dropped semicolon, `self` for `this`, an invented or omitted line, and once the browser's serialised DOM (`data-checkbox-exclusive=""`) copied instead of the source. Exact preimage matching made these visible. The engine now explains each mismatch with the real file lines (v4, v7), tolerates misremembered context (v8), and applies the model's own hunks to the real region when the lines it deletes exist verbatim (v9). It never guesses a changed line.
- **Super's JSON is less reliable than Ultra's.** 89 of Super's 662 calls returned output that was not valid repair JSON, against 5 of Ultra's 584. Most often Super closed an edit with `}` and never closed the `edits` array. Schema-constrained output (`response_format`) parsed every time but corrupted the code inside the strings (see the Nebius feedback). Engine v10 used it and was stopped after 2 runs; its 6 unapplied patches are counted above. Engine v11 repairs only the bracket structure of a reply that does not parse: that recovered 18 of the 30 failures recorded before it, and 5 of its own 90 Super replies.
- **Reasoning can consume the output limit.** 24 calls stopped at `max_tokens` with the answer unfinished. Raising the limit from 12,000 to 32,000 tokens (v3) mostly removed this.
- **Models fit patches to the test page.** Two early patches made component code name the test page's element ids. That became an overfitting gate (v6), which rejects the patch and tells the model why.
- **Models take the shortest path to a passing task.** 35 of 389 passing blind runs on real bugs changed only the page around the library instead of fixing the library, for example a document-level key handler that swallows ArrowDown. The browser rightly accepted them as working, so the site labels every pass by where it changed code. Since engine v11 the page is read-only context, and every passing run since then fixes the library.
- **A pass is not a review.** Four patches passed their frozen tasks and were still wrong: one stopped Escape closing every default Bootstrap dialog, one hung Pikaday at a date limit, one ignored a configured date format, and one handled only drawers with an autofocus field. Reading each patch found them, and each became a stricter frozen case.

## Would we use it again

Yes, for this pattern: a strong first model, and a second model with an exact, machine-checked failure report. The biggest improvement we would ask for is schema-constrained output that keeps code strings intact. With it, the most common Super failure would disappear.
