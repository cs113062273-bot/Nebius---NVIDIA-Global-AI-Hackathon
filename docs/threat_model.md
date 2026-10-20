# Threat model

| Threat | Implemented boundary | Remaining limitation |
|---|---|---|
| Arbitrary repo execution / supply chain | No clone/install/shell API; bundled static sources; own dependency install uses `--ignore-scripts` | A browser is not a full hostile repository sandbox; arbitrary framework execution is unsupported |
| SSRF / metadata | No external URL intake; ephemeral fixture origin only; route interception plus restrictive response CSP | Remote URL mode is intentionally unavailable; no DNS rebinding protection is claimed for a mode that does not exist |
| Secret exfiltration | Keys absent from frontend, prompt, browser environment; connect-src none; no model tools | Host compromise/browser vulnerability remains outside this lightweight isolation boundary |
| Prompt injection | Untrusted source/evidence labeling; strict bounded schema; external side effects unavailable; frozen assertions | Prompt wording alone is not a defense; semantics of generated source still require replay/review |
| Malicious source patch | Localized path allowlist, extension restrictions, no secrets/tests/config, preimage SHA, unique match, scope limits, isolated copy | Valid JS can still be malicious; only curated public fixtures are exposed and source must be reviewed |
| Traversal / symlinks / Windows ADS | Canonical containment, reject absolute paths/colon/backslashes/dot components, reject symlink descendants | Caller-chosen local roots are trusted; this is not multi-tenant filesystem isolation |
| CSRF / DNS rebinding | Loopback default, localhost Host allowlist, exact-origin POST guard; public judge bearer token | Public deployment needs a correctly configured TLS proxy; origin is not a replacement for authentication |
| Resource exhaustion | One active run, 40 steps, max 40 Tab transitions per seek, per-journey deadline, fixed context, body limits, provider timeout, max 60 stored API runs, public cooldown | Disk outside the API may grow with CLI benchmarks; operator must archive artifacts. No automatic deletion of user evidence |
| Budget exhaustion | Sponsor-only explicit guard; pessimistic persistent token/call reservation; no automatic retry after uncertain inference; current catalog check | App cannot verify account dollars/credit expiry/no-overage settings; those require account confirmation |
| Proof manipulation | Hash each artifact; verify missing/extra/changed files; frozen journey hash | Hashes do not authenticate authorship; a malicious owner can replace a whole bundle and manifest |

Public mode cannot accept local source paths, URLs, commands, user patches or repository installs. Set a strong `DEMO_TOKEN`; share it in judge testing instructions when deploying. Unfinished runs after restart remain inconclusive. Do not expose this as a general internet scanning service or run third-party package lifecycle scripts on the workstation.
