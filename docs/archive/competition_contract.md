# Competition contract

Verified 2026-10-20 (Asia/Taipei). Recheck before submitting. Labels describe evidence, not eligibility advice.

| Item | Status | Requirement |
|---|---|---|
| Deadline | CONFIRMED_OFFICIAL | October 30, 2026 10:00 PDT = October 31 01:00 Taipei |
| Judging | CONFIRMED_OFFICIAL | December 1–15 Pacific; ends December 16 04:00 Taipei. Provide free unrestricted judge access until then |
| Runtime | CONFIRMED_OFFICIAL | Token Factory runtime inference or Nebius AI Cloud execution; NVIDIA open model required |
| Demo | CONFIRMED_OFFICIAL | Working demo/application/test-build URL |
| Repository | CONFIRMED_OFFICIAL | Public GitHub/GitLab/Bitbucket; source, assets, open-source license, setup README |
| Video | CONFIRMED_OFFICIAL | Public YouTube; less than three minutes |
| Testing | CONFIRMED_OFFICIAL | Judges may evaluate materials without running the project |
| Language | CONFIRMED_OFFICIAL | English or English translations |
| Feedback | CONFIRMED_OFFICIAL | Describe experiences with used Nebius and NVIDIA technologies |
| Criteria | CONFIRMED_OFFICIAL | Technology, design, impact, idea equally weighted; earlier criteria break ties |
| Track | INFERRED | Coding and Agentic Engineering is the clearest fit for an AI developer repair tool; Best Apps and Agents also fits a usable Nemotron-powered workflow. This is our track recommendation, not organizer approval. |

[Official rules](https://nebiusglobalaihackathon.devpost.com/rules).

CONFIRMED_OFFICIAL: Frontend/backend hosting outside Nebius is allowed when runtime integration qualifies. Promotional credits are Token Factory credits; no separate published Cloud grant. Other inference providers do not replace Nebius. [FAQ](https://nebiusglobalaihackathon.devpost.com/details/faqs).

CONFIRMED_OFFICIAL: [Resources](https://nebiusglobalaihackathon.devpost.com/resources) directs builders to the Builders Program. [Updates](https://nebiusglobalaihackathon.devpost.com/updates) was checked; recheck for changes.

CONFIRMED_OBSERVED: Nebius's [model page](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference) advertises Nano, Super, Ultra, Lightning and Super VL. The [quickstart](https://docs.tokenfactory.nebius.com/quickstart) documents the OpenAI-compatible API at `https://api.tokenfactory.nebius.com/v1/`.

Update, 2026-10-21: local credentials are configured in the Git-ignored `.env`. An authenticated catalog request returned HTTP 200; one authorized `nvidia/Nemotron-3-Ultra-550b-a55b` completion produced a checkout repair with `VERIFIED_PASS` and 12,971 ms model latency. See `benchmarks/live-status.json`. This establishes one runtime integration result, not organizer certification or a complete submission. Remaining credits, credit provenance/expiry and no-overage settings are not independently verified here. The user subsequently authorized further sponsor-credit inference for product usefulness and transfer checks. Historical one-call ceilings no longer describe the current authorized work; preserve the ledger and the US$0 out-of-pocket constraint.

Rechecked official rules, FAQ and gallery on 2026-10-21: deadline remains October 31 01:00 Taipei; judging is December 1–15 Pacific; winners are scheduled around January 11, 2027 Pacific. The gallery is not yet published; no official public score ranking was found. Public individual submission pages do not establish a leaderboard.


## Product purpose recheck, October 21

The [official overview](https://nebiusglobalaihackathon.devpost.com/) asks for practical AI systems on open infrastructure. The [equally weighted criteria](https://nebiusglobalaihackathon.devpost.com/rules) include a complete product experience and a demonstrated solution for a specific real audience, alongside technology and idea quality. A trace viewer or evidence count alone does not establish usefulness.

Tabstitch targets frontend developers: repair a keyboard or form interaction while preserving the user's intended submitted data. The new autocomplete case demonstrates a real reported integration problem and transfer to a precommitted second field. Its consumer is authored; time savings, customer adoption, a broad repair rate, public judge hosting and an updated submission video are not established by this experiment.
