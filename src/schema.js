import { z } from 'zod';
import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const selector = z.string().min(1).max(250);
export const Assertion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('visible'), selector, value: z.boolean().default(true) }).strict(),
  z.object({ kind: z.literal('text'), selector, value: z.string().max(1000) }).strict(),
  z.object({ kind: z.literal('attribute'), selector, name: z.string().max(80), value: z.string().max(1000).nullable() }).strict(),
  z.object({ kind: z.literal('form-data'), selector, name: z.string().min(1).max(80), value: z.array(z.string().max(1000)).max(20) }).strict(),
  z.object({ kind: z.literal('focus'), selector }).strict(),
  z.object({ kind: z.literal('ax'), role: z.string().max(80), name: z.string().min(1).max(200) }).strict(),
  z.object({ kind: z.literal('overflow'), maximum: z.number().min(0).max(100).default(2) }).strict(),
  z.object({ kind: z.literal('motion'), maximumMs: z.number().min(0).max(10000).default(100) }).strict(),
  z.object({ kind: z.literal('forced-colors'), selector }).strict()
]);
const keys = z.enum(['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
const Action = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('seek'), selector, maxTabs: z.number().int().min(1).max(40).default(24) }).strict(),
  z.object({ kind: z.literal('press'), key: keys }).strict(),
  z.object({ kind: z.literal('type'), text: z.string().max(500),replace:z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('click'), selector }).strict()
]);
export const Journey = z.object({
  version: z.literal(1), id: z.string().regex(/^[a-z0-9-]{1,80}$/), title: z.string().min(1).max(200),
  goal: z.string().min(1).max(500), source: z.enum(['authored', 'benchmark', 'test-derived', 'heuristic', 'model']),
  profile: z.enum(['keyboard', 'pointer', 'semantics', 'reflow-200', 'reflow-400', 'reduced-motion', 'forced-colors']),
  path: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_?.=&%-]*$/).max(200).default('/'),
  // Optional IANA zone for date logic; omitted journeys keep the historical UTC environment and hash.
  timezone: z.string().regex(/^(?:UTC|[A-Z][A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/).max(64).optional(),
  steps: z.array(z.object({ title: z.string().min(1).max(200), action: Action, assertions: z.array(Assertion).max(12).default([]) }).strict()).min(1).max(40),
  success: z.array(Assertion).min(1).max(20), functional: z.array(Assertion).min(1).max(20),
  forbidden: z.array(Assertion).max(20).default([])
}).strict().superRefine((j, ctx) => {
  if (j.profile === 'keyboard' && j.steps.some(s => s.action.kind === 'click')) ctx.addIssue({code:'custom', message:'Keyboard journeys cannot dispatch pointer actions'});
  if ((j.source === 'heuristic' || j.source === 'model')) ctx.addIssue({code:'custom', message:'Discovered candidates need authored postconditions before execution'});
});
export const Edit = z.object({ path: z.string().min(1).max(180), sha256: z.string().regex(/^[a-f0-9]{64}$/), before: z.string().min(1).max(12000), after: z.string().max(16000) }).strict();
export const RepairPlan = z.object({
  root_cause: z.string().min(1).max(2000), repair_strategy: z.string().min(1).max(2000),
  edits: z.array(Edit).min(1).max(10), expected_accessibility_effect: z.string().min(1).max(2000),
  functional_risks: z.array(z.string().max(500)).max(10), verification_requirements: z.array(z.string().max(500)).min(1).max(10)
}).strict();
export const VERDICTS = ['VERIFIED_PASS', 'VERIFIED_FAIL', 'INCONCLUSIVE', 'NOT_TESTED'];
export const transitions = {
  CREATED: ['PREPARING'], PREPARING: ['BASELINE_RUNNING', 'INCONCLUSIVE'],
  BASELINE_RUNNING: ['FAILURE_CONFIRMED', 'FAILED', 'INCONCLUSIVE'],
  FAILURE_CONFIRMED: ['LOCALIZING', 'FAILED'], LOCALIZING: ['PLANNING_REPAIR', 'INCONCLUSIVE'],
  PLANNING_REPAIR: ['PLANNING_REPAIR','PATCHING', 'INCONCLUSIVE', 'FAILED'], PATCHING: ['PLANNING_REPAIR','BUILDING', 'FAILED','INCONCLUSIVE'],
  BUILDING: ['REPLAYING', 'PLANNING_REPAIR', 'FAILED','INCONCLUSIVE'], REPLAYING: ['VERIFYING', 'INCONCLUSIVE'],
  VERIFYING: ['VERIFIED', 'PLANNING_REPAIR', 'FAILED', 'INCONCLUSIVE'], VERIFIED: [], FAILED: [], INCONCLUSIVE: []
};
export function transition(run, state, detail = '') {
  if (!transitions[run.state]?.includes(state)) throw new Error(`Illegal transition ${run.state} -> ${state}`);
  run.state = state; run.events.push({ state, detail, at: new Date().toISOString() });
}
