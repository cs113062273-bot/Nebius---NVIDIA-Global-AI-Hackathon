import { canonical } from './schema.js';

export const violationKeys = result => new Set(result.checkpoints.flatMap(c => (c.axe?.violations || []).flatMap(v => v.nodes.map(n => v.id + ':' + n.target.join('|')))));
export function verifyRepair({ before, after, functionalBefore, functionalAfter, patchChanged, build, visual, oracleHash }) {
  const reasons = [], uncertain = [];
  if (before.verdict !== 'VERIFIED_FAIL') reasons.push('Baseline did not reproduce a deterministic journey failure');
  if (after.verdict === 'INCONCLUSIVE') uncertain.push('Replay evidence incomplete');
  if (after.verdict !== 'VERIFIED_PASS') reasons.push('Exact journey did not complete after repair');
  if (!after.checks?.length || !after.functional?.length || !after.steps?.length || after.checks.some(c=>!c.pass) || after.functional.some(c=>!c.pass) || after.steps.some(s=>s.result!=='VERIFIED_PASS')) reasons.push('Task evidence is missing or contradicts the verdict');
  if (!oracleHash || before.journeyHash !== oracleHash || after.journeyHash !== oracleHash) reasons.push('Frozen journey oracle mismatch');
  if (canonical(before.environment) !== canonical(after.environment) || before.browser !== after.browser) reasons.push('Replay environment mismatch');
  if (!patchChanged) reasons.push('No source change');
  if (!build?.pass) reasons.push('Build/parse checks failed or missing');
  if (!visual?.pass) reasons.push('Initial-page visual regression check failed or missing');
  if (!functionalBefore || !functionalAfter || functionalBefore.verdict !== 'VERIFIED_PASS' || functionalAfter.verdict !== 'VERIFIED_PASS') reasons.push('Functional regression baseline/replay failed or missing');
  if (functionalBefore && functionalAfter && (functionalBefore.journeyHash !== functionalAfter.journeyHash || canonical(functionalBefore.environment) !== canonical(functionalAfter.environment) || functionalBefore.browser !== functionalAfter.browser)) reasons.push('Functional oracle/environment mismatch');
  if (functionalBefore && functionalAfter && canonical(functionalBefore.functional.map(c => c.observed)) !== canonical(functionalAfter.functional.map(c => c.observed))) reasons.push('Functional output changed');
  const oldRules = violationKeys(before), newRules = [...violationKeys(after)].filter(key => !oldRules.has(key));
  if (newRules.length) reasons.push('New automated-rule findings: ' + newRules.join(', '));
  if (after.consoleErrors.length) reasons.push('Replay has runtime/console errors');
  if (functionalAfter?.consoleErrors.length) reasons.push('Functional replay has runtime/console errors');
  if (after.networkFailures.length || functionalAfter?.networkFailures.length) uncertain.push('Network failures require review');
  return { verdict: uncertain.length ? 'INCONCLUSIVE' : reasons.length ? 'VERIFIED_FAIL' : 'VERIFIED_PASS', reasons, uncertain, newRules,
    scope: 'Verified only for frozen journey, functional assertions and recorded conditions. Manual review remains required.' };
}
