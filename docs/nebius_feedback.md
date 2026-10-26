# Nebius Token Factory: what we observed

All inference in Tabstitch runs on Nebius Token Factory through its OpenAI-compatible API: 1,248 calls from the development machine between 2026-10-21 and 2026-10-27, plus the live runs that GitHub Actions makes on request and once a day. At catalog prices that is about US$30.30, paid from sponsor credits. Aggregates are in [`public/inference-stats.json`](../public/inference-stats.json).

## What worked

- **OpenAI-compatible chat completions.** One `fetch` client, with no SDK, covers Nemotron 3 Super, Ultra and Nano. Model choice is configuration.
- **The catalog carries prices.** `GET /v1/models?verbose=true` returns per-token prices, so every call reserves its worst-case cost before it is sent. Each benchmark scope has a US$ ceiling, and the GitHub Actions live runs cap each run at US$0.50. We never had to estimate prices by hand.
- **Usage includes reasoning tokens**, and every response has a request id. Both go into each run's provenance, so every published repair links to the exact request and response.
- **Reliability.** No call returned an HTTP error or needed a retry. The failures were our own limits or the model's output: truncation at our `max_tokens`, and output that did not parse. Three calls have no recorded outcome: two on 2026-10-25, and one in a run we stopped ourselves. One run records our five-minute client timeout.
- **It works from CI.** The same key, held as a GitHub secret, lets judges start a real Nemotron run by opening an issue. The run is replayed in Chromium and the verdict is posted back within minutes.

## What could be better

- **Structured outputs corrupt code strings.** The catalog does not list `structured_outputs` for the Nemotron 3 models, and 95 of our completions did not parse into the schema we sent in the prompt. Token Factory does accept `response_format` with a strict JSON schema for Super and Ultra, and every reply parsed. But the code inside the strings came back damaged: newlines as a bare `n`, `%n` or nothing, and quotes as guillemets. Engine v10 used it and was stopped after 2 runs, because none of its 6 patches could be applied. We went back to the prompt-only schema and repair only bracket structure. Either a fix or a documented limitation would help.
- **Latency varies widely for long prompts.** At a p50 prompt of about 14,000 tokens, Super's p90 latency was 71 s. Ultra was steadier. A published expected-latency figure per model would help set timeouts.
- **Cost in the response.** The response reports tokens, not cost. We compute cost from catalog prices. A per-request cost field would make sponsor-credit accounting exact.

## Would we use it again

Yes. Price-aware model discovery and an OpenAI-compatible API made it practical to cap every call, publish every request and let strangers trigger live runs safely.
