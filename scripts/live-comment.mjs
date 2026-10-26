import fs from 'node:fs/promises';

// Turns artifacts/live-result.json (written by daily-live.mjs) into the reply posted on a live-run issue.
const SITE = 'https://cs113062273-bot.github.io/Nebius---NVIDIA-Global-AI-Hackathon';
const MODEL = { 'nemotron-3-super-120b-a12b': 'Nemotron 3 Super', 'Nemotron-3-Ultra-550b-a55b': 'Nemotron 3 Ultra' };
const r = JSON.parse(await fs.readFile(process.argv[2] || 'artifacts/live-result.json', 'utf8').catch(() => '{"status":"MISSING"}'));
const log = process.env.ACTIONS_RUN ? `\n\n[GitHub Actions log](${process.env.ACTIONS_RUN})` : '';
let body;
if (r.status === 'NO_CASE') body = `I couldn't find a bug id in this issue. Put one in the title, for example \`[live run] bootstrap-tabs-arrow-focus\`, then open a new issue.\n\nBugs: ${r.cases.map(c => `\`${c}\``).join(', ')}`;
else if (r.status === 'DAILY_CAP') body = `Today's ${r.cap} requested live runs are used up (they are capped to protect the sponsor credits). The daily scheduled run still happens, and every earlier run is on the [live page](${SITE}/live.html). Please try again tomorrow (UTC).`;
else if (r.status === 'PERSON_CAP') body = `You've requested ${r.cap} live runs today, which is the per-person limit. Earlier runs are on the [live page](${SITE}/live.html).`;
else if (r.status === 'RAN') {
  const page = `${SITE}/project.html?run=${r.run}${r.passedOn ? `&attempt=${r.passedOn}` : ''}#project-result`;
  const rows = r.models.map((m, i) => `| ${i + 1} | ${MODEL[m] || m || '—'} | ${r.passedOn === i + 1 ? '**Passed** every browser gate' : (r.failures?.[i] || 'Rejected').replace(/\|/g, '\\|').replace(/\s+/g, ' ')} |`).join('\n');
  body = [
    r.verdict === 'VERIFIED_PASS' ? `### ✅ Repaired and verified on attempt ${r.passedOn}` : `### ❌ Not repaired in ${r.models.length} attempt${r.models.length > 1 ? 's' : ''}`,
    `**${r.library} · ${r.title}** (\`${r.case}\`, ${r.kind === 'real' ? 'fixed upstream; the model never saw the maintainers’ fix' : 'still open upstream'})`,
    `| Attempt | Model | Browser verdict |\n|---|---|---|\n${rows}`,
    `${r.seconds ? `${Math.round(r.seconds / 60)} min · ` : ''}US$${r.costUsd.toFixed(3)} of sponsor credits · run \`${r.run.slice(0, 8)}\``,
    `**[Open the evidence page](${page})**: captures before and after, the diff, every assertion and the raw model request and response.`,
    r.verdict === 'VERIFIED_PASS' ? 'Verified only for the frozen keyboard task, the pointer path and the regression guards; it is not a full accessibility audit.' : 'A rejected run is a real result too: the page shows what Chromium caught.',
  ].join('\n\n');
} else body = `The run didn't finish (infrastructure or budget stop, not a verdict on the patch).`;
process.stdout.write(body + log + '\n');
