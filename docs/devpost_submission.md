# Tabstitch — Devpost text

**Tagline:** NVIDIA Nemotron writes the keyboard fix. A real browser decides whether your form still submits the right data.

**Try it:** https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/ (read-only evidence, no setup) · Source: https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon

## Inspiration

Keyboard and form fixes often look right and are still wrong. In GOV.UK's accessible autocomplete (issue #777), clearing a saved country empties the field on screen while the hidden select still submits the old country. Scanners stay green; the user's data is wrong. AI coding tools make such plausible fixes cheap, so the question is no longer "can a model write a patch" but "which patch should I trust".

## What it does

A developer freezes a contract:
- the keyboard task, replayed with real key presses;
- the data the form must submit, read from native `FormData`;
- an independent pointer path;
- regression guards that already pass.

Nemotron on Nebius Token Factory proposes bounded source edits against hash-checked files in a disposable copy. Chromium replays every path. A patch is accepted only if the task passes, the pointer outcome is unchanged and every guard still passes. Otherwise the concrete failure goes back to the model, for up to three attempts. Every attempt, including rejected and unexecuted ones, is published with screenshots, assertions, diff and the raw model request and response.

## What the evidence shows

On the GOV.UK form, independent review strengthened the contract four times. Each stricter contract was frozen before new inference, and earlier model patches were replayed against it:

1. The first Ultra repair still submitted `gb` for an unlisted country.
2. A Super patch matched blank input to the empty option.
3. A Super component patch passed its own task but broke partial-match confirmation and crashed the library's plain usage.
4. An Ultra patch missed Enter-inside-the-field submission.
5. The next Ultra repair passed that contract by matching option text exactly. With the same options pretty-printed (text on its own indented line), saving without editing erased both saved countries.

All five were rejected with specific, inspectable reasons. The final Ultra repair passes the task on pretty-printed markup, the pointer path and three guards, including "an untouched save keeps both countries". Withheld checks on the single-line page, clear shipping and clear billing pass. One withheld check is a recorded failure: typing only spaces makes the pinned component itself show Germany, so `de` is submitted, consistent with the field but not with that check. A reviewer probe of eleven interactions found visible text and submitted data consistent 11/11 on both markups. The repair edits only the consumer's `app.js`.

On Pikaday, Super repaired closed-weekend skipping and a closed range boundary. With the runner's new declared time zones, it also fixed a London daylight-saving bug where ArrowDown landed on the wrong day. Six withheld checks passed.

## How we built it

Node.js, Playwright/Chromium, axe-core, Zod and SHA-256 manifests.

`nvidia/Nemotron-3-Ultra-550b-a55b` handles hard reasoning with a 16,000-token output budget, and `nvidia/nemotron-3-super-120b-a12b` handles the larger calendar component. Both run through Nebius Token Factory's OpenAI-compatible API. The model is checked against the authenticated catalog, and a persistent ledger reserves tokens and credit before every call.

So far: 38 requests, about 901K tokens, about US$0.94 at catalog prices, all from sponsor credits.

## Challenges

- Reasoning models sometimes spent their whole output budget thinking. Truncation is recorded and retried, never accepted.
- Models rewrote lines inside the code they claimed to replace. Exact unique preimages reject these before anything runs.
- Our own first passes were too weak. Each review gap became a frozen task or guard rather than a quiet fix.

## What we learned

A passing test is only as strong as the contract behind it. The most useful product feature turned out to be regression guards: behaviour that already works must keep working, and the model sees those failures in the loop.

## What's next

- CI integration that freezes contracts from existing end-to-end tests.
- Framework source maps.
- Firefox and WebKit replay.

## Limits

- Pinned real components inside author-built pages; not production customers.
- Post-hoc tasks are disclosed authored conditions, not a blind benchmark.
- Static HTML/CSS/JS only. Chromium only.
- No screen-reader or WCAG conformance claim.
