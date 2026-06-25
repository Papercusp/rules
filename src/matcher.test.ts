import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateDataCondition } from './matcher';

const event = {
  tool: 'coord:handoff',
  args: { item: 'WI-001', kind: 'bug', to: ['a', 'b'] },
  result: { ok: true, data: { count: 3 } },
};

describe('evaluateDataCondition — match-map', () => {
  it('passes when every path test passes (implicit AND)', () => {
    expect(evaluateDataCondition({ 'args.item': { exists: true } }, event)).toBe(true);
    expect(evaluateDataCondition({ 'args.item': { exists: true }, 'result.ok': true }, event)).toBe(true);
  });
  it('fails when any path test fails', () => {
    expect(evaluateDataCondition({ 'args.item': { exists: true }, 'result.ok': false }, event)).toBe(false);
    expect(evaluateDataCondition({ 'args.nope': { exists: true } }, event)).toBe(false);
  });
  it('bare value means equals', () => {
    expect(evaluateDataCondition({ 'args.kind': 'bug' }, event)).toBe(true);
    expect(evaluateDataCondition({ 'args.kind': 'feature' }, event)).toBe(false);
  });
});

describe('evaluateDataCondition — combinators', () => {
  it('all', () => {
    expect(evaluateDataCondition({ all: [{ 'args.kind': 'bug' }, { 'result.ok': true }] }, event)).toBe(true);
    expect(evaluateDataCondition({ all: [{ 'args.kind': 'bug' }, { 'result.ok': false }] }, event)).toBe(false);
  });
  it('any', () => {
    expect(evaluateDataCondition({ any: [{ 'args.kind': 'feature' }, { 'result.ok': true }] }, event)).toBe(true);
    expect(evaluateDataCondition({ any: [{ 'args.kind': 'feature' }, { 'result.ok': false }] }, event)).toBe(false);
  });
  it('not', () => {
    expect(evaluateDataCondition({ not: { 'args.kind': 'feature' } }, event)).toBe(true);
    expect(evaluateDataCondition({ not: { 'args.kind': 'bug' } }, event)).toBe(false);
  });
  it('nested combinators', () => {
    const cond = { all: [{ 'args.item': { exists: true } }, { any: [{ 'args.kind': 'bug' }, { 'args.kind': 'feature' }] }] };
    expect(evaluateDataCondition(cond, event)).toBe(true);
  });
  it('an object with all + extra keys is a match-map, not a combinator', () => {
    // `all` is not the sole key ⇒ treated as a match-map with paths 'all' and 'result.ok'
    expect(evaluateDataCondition({ all: [], 'result.ok': true } as Record<string, unknown>, event)).toBe(false);
  });
});

describe('evaluateCondition', () => {
  it('undefined ⇒ always true', () => {
    expect(evaluateCondition(undefined, event)).toBe(true);
  });
  it('predicate escape-hatch', () => {
    expect(evaluateCondition((e: typeof event) => e.args.to.length === 2, event)).toBe(true);
    expect(evaluateCondition((e: typeof event) => e.args.to.length === 5, event)).toBe(false);
  });
  it('delegates to data-condition for objects', () => {
    expect(evaluateCondition({ 'args.item': { exists: true } }, event)).toBe(true);
  });
});
