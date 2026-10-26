# Demo script: 2 minutes 45 seconds

Record at 1440×900 in a normal Chrome window, with the judge site at 110% zoom. Everything shown is recorded evidence or a real live run; say "recorded" when you play a recording. Keep under three minutes, and use no music you have no licence for.

Site: https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon/

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | `twbs/bootstrap#43202`, with the *confirmed* label visible | "This Bootstrap 6 datepicker traps keyboard users: once the calendar is open, Tab never leaves the field. Nobody had reported it. Tabstitch found it, and a Bootstrap maintainer confirmed it the same day." |
| 0:15–0:35 | Home page hero and the 22/26 card (use the current number) | "AI can write a fix for this kind of bug in seconds. The hard part is knowing which fix you can merge. Tabstitch has NVIDIA Nemotron on Nebius Token Factory write the patch, and a real browser decide." |
| 0:35–1:20 | Live page → Bootstrap card *"Escape on a closed dropdown toggle inside a modal must close the modal"* → **Watch the recorded run** (run `07f338b5`, current engine) | "Bootstrap's maintainers fixed this one by hand. We pin the code from before their fix and freeze the user's task: the keys, the data the form must submit, a pointer path and guards for what already works. Nemotron 3 Super gets only the buggy source. Chromium replays its patch and rejects it at step 4. Nemotron 3 Ultra gets that exact failure and fixes `dropdown.js` itself. Every gate passes." Open the diff, then **Compare with the maintainers' own fix**. |
| 1:20–1:45 | Scoreboard → *"What the browser loop and the gates add"* → open the vanillajs-datepicker entry (run `f99d9124`, attempt 3) | "This is why we don't trust a passing test. This patch made Tab close the calendar, so the reported bug was fixed. But a user who picks 4 June with the mouse now submits 10 May. Nobody would notice that from the keyboard test. A test of the bug alone would have merged it. The submitted-data check caught it, and the gates caught 18 others like it." |
| 1:45–2:05 | Scoreboard engine versions and the all-version rate | "26 real bugs from 12 libraries. Every engine version keeps its public score, including the worse ones, and every pass says whether it fixed the library or only worked around it in the page. Every run, every rejected patch and every raw model request is published." |
| 2:05–2:30 | Any bug card → **Run it live** → the prefilled issue → a finished bot reply (issue #2) | "Judges don't have to trust recordings. Press Run it live, and GitHub Actions makes a fresh Nemotron repair, capped at fifty cents of sponsor credits, then replies on the issue with the verdict and the evidence." |
| 2:30–2:45 | PR #1, the Tabstitch check comment | "It runs as a GitHub Action on pull requests too. Nemotron writes the fix; the browser keeps the outcome. Tabstitch." |

## Before recording

- Use the scoreboard numbers shown on the day, not the ones in this file.
- Start one live run about 15 minutes before recording, so a fresh bot reply is ready to show.
- Upload as a public YouTube video under three minutes, then add the link to the Devpost form and the README.
