---
title: Tabstitch live repair
emoji: ⌨️
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Nemotron repairs real keyboard bugs; Chromium decides.
---

# Tabstitch · live repair

Pick a real keyboard or form bug that open-source maintainers fixed by hand. NVIDIA Nemotron on Nebius Token Factory repairs the buggy source without seeing the fix. Nemotron 3 Super tries first, and Nemotron 3 Ultra gets the browser's exact failure if Super's patch is rejected. Chromium replays the frozen task and gives the verdict.

Open **/live.html**. Live runs use sponsor credits, capped at US$1 per day and US$10 in total. The cap is enforced from provider-reported usage and kept in a ledger that survives restarts. Recorded runs are available when the cap is reached.

Source: https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon (this Space builds the commit in `TABSTITCH_COMMIT`).
