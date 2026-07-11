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

describe('evaluateDataCondition — some (k-of-n threshold)', () => {
  // of: [true, false, true] against `event` — kind bug (T), kind feature (F), ok true (T) ⇒ 2 pass.
  const of = [{ 'args.kind': 'bug' }, { 'args.kind': 'feature' }, { 'result.ok': true }];
  it('require:1 ≡ any (fires on the first pass)', () => {
    expect(evaluateDataCondition({ some: { require: 1, of } }, event)).toBe(true);
    expect(evaluateDataCondition({ some: { require: 1, of: [{ 'args.kind': 'feature' }] } }, event)).toBe(false);
  });
  it('require:2 fires when exactly two of three pass', () => {
    expect(evaluateDataCondition({ some: { require: 2, of } }, event)).toBe(true);
  });
  it('require:3 (≡ all) fails when only two of three pass', () => {
    expect(evaluateDataCondition({ some: { require: 3, of } }, event)).toBe(false);
    // all three true ⇒ require:3 passes (all-of preset)
    const allTrue = [{ 'args.kind': 'bug' }, { 'result.ok': true }, { 'args.item': { exists: true } }];
    expect(evaluateDataCondition({ some: { require: 3, of: allTrue } }, event)).toBe(true);
  });
  it('require greater than the number of sub-conditions can never fire', () => {
    expect(evaluateDataCondition({ some: { require: 4, of } }, event)).toBe(false);
  });
  it('an empty of never fires', () => {
    expect(evaluateDataCondition({ some: { require: 1, of: [] } }, event)).toBe(false);
  });
  it('nests inside and under other combinators', () => {
    const cond = { all: [{ 'args.item': { exists: true } }, { some: { require: 2, of } }] };
    expect(evaluateDataCondition(cond, event)).toBe(true);
    const nested = { some: { require: 1, of: [{ all: [{ 'args.kind': 'feature' }] }, { any: [{ 'result.ok': true }] }] } };
    expect(evaluateDataCondition(nested, event)).toBe(true);
  });
  it('a malformed some (missing require / of) is treated as a match-map, not a combinator', () => {
    // sole key `some` but the value is not { require:number, of:array } ⇒ falls through to
    // match-map semantics (path 'some' does not exist on the event ⇒ its leaf test fails).
    expect(evaluateDataCondition({ some: { of } } as Record<string, unknown>, event)).toBe(false);
    expect(evaluateDataCondition({ some: [{ 'result.ok': true }] } as Record<string, unknown>, event)).toBe(false);
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
