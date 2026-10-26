import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

// Records the demo video: a scripted walk through the judge site and the public GitHub pages, with a
// caption per scene and narration from docs/demo/scenes.json (synthesised to artifacts/demo/<id>.wav
// beforehand with Windows text-to-speech). Everything shown is the published site; nothing is
// re-run and no model is called. Usage: node scripts/record-demo.mjs [site-origin]
const SITE = process.argv[2] || 'http://localhost:4173';
const REPO = 'https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon';
const out = path.resolve('artifacts', 'demo'), scenes = JSON.parse(await fs.readFile('docs/demo/scenes.json', 'utf8'));
const seconds = id => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(out, `${id}.wav`)], { encoding: 'utf8' }).stdout);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } }, colorScheme: 'light' });
const page = await context.newPage(), t0 = Date.now(), starts = [];
const wait = ms => page.waitForTimeout(ms);
async function caption(text) {
  await page.evaluate(t => {
    let el = document.getElementById('__demo_caption');
    if (!el) { el = document.createElement('div'); el.id = '__demo_caption'; document.body.append(el); }
    Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: 2147483647, maxWidth: '1100px', padding: '12px 22px', borderRadius: '8px',
      background: 'rgba(20,32,26,.88)', color: '#fff', font: '600 22px/1.35 system-ui, sans-serif', textAlign: 'center', boxShadow: '0 6px 24px rgba(0,0,0,.25)' });
    el.textContent = t;
  }, text);
}
// Jumps instead of smooth scrolling: the screencast tears frames captured mid-scroll.
async function scrollTo(target) {
  await page.evaluate(target => { const el = typeof target === 'string' ? document.querySelector(target) : null; scrollTo(0, el ? el.getBoundingClientRect().top + scrollY - 90 : target); }, target);
  await wait(300);
}
async function scene(i, run) {
  const s = scenes[i], started = Date.now(); starts.push({ id: s.id, at: (started - t0) / 1000 });
  await run(); await caption(s.caption).catch(() => {});
  const left = seconds(s.id) * 1000 + 700 - (Date.now() - started); if (left > 0) await wait(left);
}
const goto = async url => { await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {}); await wait(600); };

await scene(0, async () => { await goto(`https://github.com/twbs/bootstrap/issues/43202`); await caption(scenes[0].caption); await wait(4000); await scrollTo(260, 2000); });
await scene(1, async () => { await goto(`${SITE}/`); await caption(scenes[1].caption); });
await scene(2, async () => {
  await caption(scenes[2].caption); await page.click('#watch-repair'); await wait(11000);
  // Stay inside the run viewer: the rejected attempt, the accepted one, then the verdict.
  await scrollTo('#attempts > :nth-child(1)', 1500); await wait(4500);
  await scrollTo('#attempts > :nth-child(2)', 1500); await wait(4500);
  await scrollTo('#verdict', 1500);
});
await scene(3, async () => { await page.evaluate(() => { const d = document.querySelector('#human'); if (d) d.open = true; }); await scrollTo('#human', 1200); });
await scene(4, async () => {
  await goto(`${SITE}/live.html`); await page.evaluate(() => document.querySelectorAll('#gates details').forEach((d, i) => { if (i === 0) d.open = true; }));
  await caption(scenes[4].caption); await scrollTo('#gates', 1500); await wait(3500);
  await page.evaluate(() => { const li = [...document.querySelectorAll('#gates li')].find(l => /vanillajs-datepicker-invalid-date-blur/.test(l.textContent)); li?.scrollIntoView({ block: 'center' }); li && (li.style.outline = '3px solid #c58b00'); });
});
await scene(5, async () => { await scrollTo('#versions', 1500); });
await scene(6, async () => {
  await scrollTo('#open', 1500); await wait(2500);
  await page.evaluate(() => { const card = [...document.querySelectorAll('#open-list article')].find(a => /default dialog must still close/.test(a.textContent)); card?.scrollIntoView({ block: 'center' }); card && (card.style.outline = '3px solid #c58b00'); });
});
await scene(7, async () => { await goto(`${REPO}/issues/2`); await caption(scenes[7].caption); await wait(3000); await scrollTo(700, 2500); });
await scene(8, async () => { await goto(`${REPO}/pull/1`); await caption(scenes[8].caption); await wait(2500); await scrollTo(900, 2500); });
await wait(1500);
const video = await page.video().path(); await context.close(); await browser.close();
await fs.writeFile(path.join(out, 'starts.json'), JSON.stringify(starts, null, 1));

// Narration laid at each scene's recorded start; H.264 + AAC for YouTube.
const inputs = scenes.flatMap(s => ['-i', path.join(out, `${s.id}.wav`)]);
const delays = starts.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s.at * 1000)}|${Math.round(s.at * 1000)}[a${i}]`).join(';');
const mix = `${delays};${starts.map((_, i) => `[a${i}]`).join('')}amix=inputs=${starts.length}:normalize=0[a]`;
const mp4 = path.join(out, 'tabstitch-demo.mp4');
const r = spawnSync('ffmpeg', ['-y', '-i', video, ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4], { encoding: 'utf8' });
if (r.status) throw new Error(r.stderr.slice(-800));
console.log(JSON.stringify({ video: mp4, seconds: Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout), starts }));
