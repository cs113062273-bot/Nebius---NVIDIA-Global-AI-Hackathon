# Nebius feedback — observation status

2026-10-20: No sponsor account credentials or credits have been configured. Live inference calls: zero. The user chose to complete local functionality first. No onboarding, real latency, reliability, structured-output compatibility or quota observations are available. Do not describe this as experience using the service.

Documentation research: the official quickstart specifies an OpenAI-compatible API; the official model page advertises Nemotron variants. We chose authenticated catalog discovery rather than hard-coding a possibly unavailable model. The client fails closed, keeps server-only credentials and reserves token budget before completions.

Questions to evaluate after actual onboarding: account model availability, sponsor-credit expiry and no-overage settings, HTTP behavior, schema support by model, request usage reporting and latency at bounded output sizes. Log observations from actual runs and include specific tool/version details. Would we use it again? Not enough runtime evidence yet.
