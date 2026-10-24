import { chromium } from 'playwright';
import axe from 'axe-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Journey, digest } from './schema.js';
import { json } from './files.js';

export class Barrier extends Error { constructor(message, category = 'BROWSER_ACTION') { super(message); this.category = category; } }
const environment = (profile, timezoneId = 'UTC') => ({
  viewport: { width: profile === 'reflow-400' ? 320 : profile === 'reflow-200' ? 640 : 1280, height: 800 },
  locale: 'en-US', timezoneId, colorScheme: 'light',
  reducedMotion: profile === 'reduced-motion' ? 'reduce' : 'no-preference', forcedColors: profile === 'forced-colors' ? 'active' : 'none',
  serviceWorkers: 'block', acceptDownloads: false, deviceScaleFactor: 1
});
export function browserEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|COMSPEC|HOME|DISPLAY|XDG_RUNTIME_DIR|LD_LIBRARY_PATH)$/i.test(key)));
}
export async function launchBrowser() { return chromium.launch({ headless: true, env: browserEnv() }); }
async function bounded(promise, milliseconds) {
  let timer;
  try { return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Resource deadline exceeded')),milliseconds);})]); }
  finally { clearTimeout(timer); }
}
async function closeContext(context,browser) {
  try { await bounded(context.close(),2000); }
  catch { await bounded(browser.close(),3000).catch(()=>{}); }
}

export async function assertPage(page, assertion) {
  try {
    const loc = assertion.selector ? page.locator(assertion.selector) : null;
    if (loc && await loc.count() !== 1) return { assertion, pass: false, observed: `Selector matches ${await loc.count()} elements` };
    let pass = false, observed;
    switch (assertion.kind) {
      case 'visible': observed = await loc.isVisible(); pass = observed === assertion.value; break;
      case 'text': observed = (await loc.textContent())?.trim(); pass = observed === assertion.value; break;
      case 'attribute': observed = await loc.getAttribute(assertion.name); pass = observed === assertion.value; break;
      case 'form-data':
        observed = await loc.evaluate((el, name) => {
          if (!(el instanceof HTMLFormElement)) throw new Error('Form-data assertions require a form element');
          const values = new FormData(el).getAll(name);
          if (values.some(value => typeof value !== 'string')) throw new Error('File fields require a separate file assertion');
          return values;
        }, assertion.name);
        pass = JSON.stringify(observed) === JSON.stringify(assertion.value); break;
      case 'focus': observed = await loc.evaluate(el => el === document.activeElement); pass = observed; break;
      case 'ax': observed = await page.getByRole(assertion.role, { name: assertion.name, exact: true }).count(); pass = observed === 1 && await page.getByRole(assertion.role, { name: assertion.name, exact: true }).isVisible(); break;
      case 'overflow': observed = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); pass = observed <= assertion.maximum; break;
      case 'motion': observed = await page.evaluate(() => Math.max(0, ...document.getAnimations().filter(a => a.playState === 'running').map(a => Number(a.effect.getComputedTiming().duration)))); pass = observed <= assertion.maximumMs; break;
      case 'forced-colors': observed = await loc.evaluate(el => ({ active: matchMedia('(forced-colors: active)').matches, adjust: getComputedStyle(el).forcedColorAdjust })); pass = observed.active && observed.adjust !== 'none'; break;
      default: throw new Error('Unsupported assertion');
    }
    return { assertion, pass, observed };
  } catch (error) { return { assertion, pass: false, observed: error.message, incomplete: true }; }
}
async function checkAssertions(page, assertions) {
  const results = [];
  for (const assertion of assertions) {
    let result;
    const deadline = Date.now() + 600;
    do { result = await assertPage(page, assertion); if (result.pass || result.incomplete) break; await page.waitForTimeout(40); } while (Date.now() < deadline);
    results.push(result);
  }
  return results;
}
async function inspect(page) {
  return page.evaluate(() => {
    const info = el => {
      if (!(el instanceof HTMLElement)) return null;
      const b = el.getBoundingClientRect(), s = getComputedStyle(el);
      const centerX = Math.max(0, Math.min(innerWidth - 1, b.x + b.width / 2)), centerY = Math.max(0, Math.min(innerHeight - 1, b.y + b.height / 2));
      const top = document.elementFromPoint(centerX, centerY);
      const selector = el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase() + (el.getAttribute('data-testid') ? '[data-testid="' + CSS.escape(el.getAttribute('data-testid')) + '"]' : '');
      return { selector, tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), nameHint: (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.innerText || '').trim().slice(0, 200),
        bbox: { x: b.x, y: b.y, width: b.width, height: b.height }, visible: b.width > 0 && b.height > 0 && s.visibility === 'visible' && s.display !== 'none',
        inViewport: b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, obscuredAtCenter: !!top && top !== el && !el.contains(top),
        modal: el.closest('dialog[open], [role="dialog"][aria-modal="true"]')?.id || null, disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', inert: !!el.closest('[inert]'),
        outline: { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }, html: el.outerHTML.slice(0, 1800) };
    };
    return { focus: info(document.activeElement), nodes: [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex],[role="button"],[role="checkbox"]')].slice(0, 250).map(info),
      focusEvents: window.__focusEvents || [], overflow: document.documentElement.scrollWidth - innerWidth,
      dialogs: [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].filter(el => el.getBoundingClientRect().width > 0).map(el => ({ id: el.id, containsFocus: el.contains(document.activeElement) })) };
  });
}
async function checkpoint(page, dir, id, withAxe) {
  const state = await inspect(page);
  const ax = await page.locator('body').ariaSnapshot({ timeout: 3000 });
  const cdp = await page.context().newCDPSession(page);
  let axTree;
  try { axTree = await cdp.send('Accessibility.getFullAXTree'); } finally { await cdp.detach(); }
  await page.screenshot({ path: path.join(dir, `${id}.png`), animations: 'disabled', timeout: 4000 });
  await fs.writeFile(path.join(dir, `${id}.aria.yml`), ax);
  await json(path.join(dir, `${id}.ax.json`), axTree);
  // DOM is a local artifact; it is never sent wholesale to the model.
  await fs.writeFile(path.join(dir, `${id}.dom.html`), await page.content());
  let axeResults = null;
  if (withAxe) {
    await page.evaluate(axe.source);
    axeResults = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }));
    await json(path.join(dir, `${id}.axe.json`), axeResults);
  }
  await json(path.join(dir, `${id}.focus.json`), state);
  return { id, screenshot: `${id}.png`, aria: `${id}.aria.yml`, ax: `${id}.ax.json`, dom: `${id}.dom.html`, state,
    axe: axeResults ? { violations: axeResults.violations, incomplete: axeResults.incomplete, passes: axeResults.passes.map(r => r.id), inapplicable: axeResults.inapplicable.map(r => r.id) } : null };
}
export function focusGraph(checkpoints) {
  const nodes = new Map(), edges = [], findings = [];
  for (const cp of checkpoints) {
    for (const node of cp.state.nodes) nodes.set(node.selector, node);
    for (const event of cp.state.focusEvents) {
      const previous = edges.at(-1);
      if (!previous || previous.sequence < event.sequence) edges.push(event);
    }
    const f = cp.state.focus;
    if (f && f.tag !== 'body' && !f.inViewport) findings.push({ checkpoint: cp.id, kind: 'OFFSCREEN_FOCUS', selector: f.selector });
    if (f?.obscuredAtCenter) findings.push({ checkpoint: cp.id, kind: 'POSSIBLY_OBSCURED_FOCUS', selector: f.selector });
    for (const dialog of cp.state.dialogs) if (!dialog.containsFocus) findings.push({ checkpoint: cp.id, kind: 'FOCUS_OUTSIDE_MODAL', selector: '#' + dialog.id });
  }
  return { nodes: [...nodes.values()], edges, findings, note: 'Observed transitions only. Name hints are DOM-derived; authoritative semantics are in AX artifacts. Center-point obstruction is a heuristic.' };
}
export async function executeJourney({ browser, origin, journey: input, dir, deadlineMs = 45000 }) {
  const journey = Journey.parse(input), env = environment(journey.profile, journey.timezone);
  await fs.mkdir(dir, { recursive: true });
  const result = { verdict: 'INCONCLUSIVE', journeyHash: digest(journey), environment: env, browser: browser.version(), steps: [], checkpoints: [], consoleErrors: [], networkFailures: [], checks: [], functional: [], forbidden: [], failure: null };
  const context = await browser.newContext(env);
  let timer, timedOut=false;
  let page;
  const work=(async()=>{
  try {
    const allowedOrigin = new URL(origin).origin;
    await context.route('**/*', async route => {
      const req = route.request();
      if (new URL(req.url()).origin !== allowedOrigin || !['GET','HEAD'].includes(req.method())) { result.networkFailures.push({ reason: 'BLOCKED_EXTERNAL_OR_WRITE_REQUEST', url: req.url().slice(0, 200) }); await route.abort('blockedbyclient'); }
      else await route.continue();
    });
    await context.addInitScript(() => {
      window.__focusEvents = [];
      document.addEventListener('focusin', e => {
        const el = e.target;
        const from = window.__focusEvents.at(-1)?.to || 'body';
        const to = el.id ? '#' + el.id : el.tagName.toLowerCase();
        window.__focusEvents.push({ sequence: window.__focusEvents.length, from, to, tag: el.tagName.toLowerCase() });
      });
    });
    page = await context.newPage(); page.setDefaultTimeout(2500); page.setDefaultNavigationTimeout(8000);
    page.on('pageerror', e => result.consoleErrors.push(e.message.slice(0, 1000)));
    page.on('console', msg => { if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 1000)); });
    page.on('requestfailed', req => result.networkFailures.push({ url: req.url().replace(origin, '{origin}').slice(0, 200), reason: req.failure()?.errorText }));
    page.on('dialog', dialog => void dialog.dismiss());
    await page.goto(origin + journey.path, { waitUntil: 'load' });
    result.checkpoints.push(await checkpoint(page, dir, 'initial', true));
    for (let i = 0; i < journey.steps.length; i++) {
      const step = journey.steps[i];
      const entry = { index: i, title: step.title, action: step.action, before: (await inspect(page)).focus, after: null, assertions: [], result: 'INCONCLUSIVE' };
      result.steps.push(entry);
      try {
        const a = step.action;
        if (a.kind === 'seek') {
          const loc = page.locator(a.selector);
          if (await loc.count() !== 1) throw new Error('Ambiguous or stale journey target: ' + a.selector);
          let found = false;
          for (let n = 0; n <= a.maxTabs; n++) {
            if (await loc.evaluate(el => el === document.activeElement)) { found = true; break; }
            if (n < a.maxTabs) await page.keyboard.press('Tab');
          }
          if (!found) throw new Barrier(`Cannot reach ${a.selector} within ${a.maxTabs} Tab transitions`, 'FOCUS');
        } else if (a.kind === 'press') await page.keyboard.press(a.key);
        else if (a.kind === 'type') {
          if (!await page.evaluate(() => document.activeElement?.matches('input:not([disabled]),textarea:not([disabled]),[contenteditable="true"]'))) throw new Barrier('Typing target is not an editable focused element', 'FOCUS');
          if(a.replace){await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Backspace');}
          await page.keyboard.type(a.text);
        } else if (a.kind === 'click') await page.locator(a.selector).click();
        entry.assertions = await checkAssertions(page, step.assertions);
        entry.after = (await inspect(page)).focus;
        if (entry.assertions.some(a => a.incomplete)) throw new Error('Assertion could not be evaluated');
        if (entry.assertions.some(a => !a.pass)) throw new Barrier('Expected state did not occur after action', 'REPLAY');
        entry.result = 'VERIFIED_PASS';
      } catch (error) {
        entry.result = error instanceof Barrier ? 'VERIFIED_FAIL' : 'INCONCLUSIVE';
        result.failure = { step: i, category: error.category || 'INFRA', message: error.message.slice(0, 1000) };
      }
      result.checkpoints.push(await checkpoint(page, dir, `step-${i}`, !!result.failure || i === journey.steps.length - 1));
      if (result.failure) break;
    }
    result.checks = await checkAssertions(page, journey.success);
    result.functional = await checkAssertions(page, journey.functional);
    result.forbidden = await checkAssertions(page, journey.forbidden);
    const incomplete = [...result.checks, ...result.functional, ...result.forbidden].some(a => a.incomplete);
    if (incomplete || (result.failure && result.steps.at(-1).result === 'INCONCLUSIVE')) result.verdict = 'INCONCLUSIVE';
    else if (result.failure || result.checks.some(a => !a.pass) || result.functional.some(a => !a.pass) || result.forbidden.some(a => a.pass)) result.verdict = 'VERIFIED_FAIL';
    else result.verdict = 'VERIFIED_PASS';
    if (!result.failure && result.verdict === 'VERIFIED_FAIL') result.failure = { step: journey.steps.length, category: 'VERIFICATION', message: 'Final postcondition failed or forbidden state occurred' };
    if (result.networkFailures.some(f => f.reason === 'BLOCKED_EXTERNAL_OR_WRITE_REQUEST')) { result.verdict = 'INCONCLUSIVE'; result.failure = { category: 'UNSUPPORTED', message: 'Journey requires blocked external resource or write request' }; }
    if (result.consoleErrors.length || result.networkFailures.length) { result.verdict='INCONCLUSIVE';result.failure={category:'INFRA',message:'Browser runtime/console/network errors require review'}; }
  } catch (error) {
    result.verdict = 'INCONCLUSIVE'; result.failure = { category: 'INFRA', message: error.message.slice(0, 1000) };
  }
  })();
  await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{timedOut=true;resolve();},deadlineMs);})]);
  clearTimeout(timer);
  await closeContext(context,browser);
  await bounded(work,200).catch(()=>{});
  if(timedOut){result.verdict='INCONCLUSIVE';result.failure={category:'TIMEOUT',message:'Hard journey deadline exceeded; browser context terminated'};}
  result.focusGraph = focusGraph(result.checkpoints);
  result.scope = { tested: [journey.profile+' interaction attempted', ...(result.checkpoints.length?['AX semantics captured']:[]),...(result.checkpoints.some(c=>c.axe)?['axe WCAG A/AA rules executed']:[]),...(result.functional.length?['explicit functional postconditions evaluated']:[])], untested: ['real screen readers', 'all WCAG criteria', 'cognitive usability', 'platform assistive technology', 'unlisted journeys'], note: 'Zero axe violations does not mean full accessibility. Reflow profiles use equivalent CSS viewport widths, not actual browser zoom.' };
  await json(path.join(dir, 'result.json'), result);
  return result;
}
