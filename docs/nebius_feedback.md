# Nebius Token Factory: what we observed

All inference in Tabstitch runs on Nebius Token Factory through its OpenAI-compatible API: 417 calls from the development machine between 2026-10-21 and 2026-10-26, plus the live runs that GitHub Actions makes on request and once a day. At catalog prices that is about US$8.80, paid from sponsor credits. Aggregates are in [`public/inference-stats.json`](../public/inference-stats.json).

## What worked

- **OpenAI-compatible chat completions.** One `fetch` client, with no SDK, covers Nemotron 3 Super, Ultra and Nano. Model choice is configuration.
- **The catalog carries prices.** `GET /v1/models?verbose=true` returns per-token prices, so every call reserves its worst-case cost before it is sent. Each benchmark scope has a US$ ceiling, and the GitHub Actions live runs cap each run at US$0.50. We never had to estimate prices by hand.
- **Usage includes reasoning tokens**, and every response has a request id. Both go into each run's provenance, so every published repair links to the exact request and response.
- **Reliability.** No call returned an HTTP error or needed a retry. The failures were our own limits or the model's output: truncation at our `max_tokens`, and output that did not parse. Two calls on 2026-10-25 have no recorded outcome, and one run records our five-minute client timeout.
- **It works from CI.** The same key, held as a GitHub secret, lets judges start a real Nemotron run by opening an issue. The run is replayed in Chromium and the verdict is posted back within minutes.

## What could be better

- **Advertise structured outputs for Nemotron.** The catalog does not list `structured_outputs` for the Nemotron 3 models, so until engine v10 we sent the schema only in the prompt, and 34 completions did not parse into it. A recorded probe on 2026-10-26 showed that `response_format` with a strict JSON schema in fact works for Super and Ultra: all 5 structured replies parsed, while the same requests sent plain failed once. Listing the feature in the catalog would have saved those failed calls.
- **Latency varies widely for long prompts.** At a p50 prompt of about 14,000 tokens, Super's p90 latency was 64 s and its maximum 139 s. Ultra was steadier. A published expected-latency figure per model would help set timeouts.
- **Cost in the response.** The response reports tokens, not cost. We compute cost from catalog prices. A per-request cost field would make sponsor-credit accounting exact.

## Would we use it again

Yes. Price-aware model discovery and an OpenAI-compatible API made it practical to cap every call, publish every request and let strangers trigger live runs safely.
