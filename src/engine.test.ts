import { describe, it, expect, vi } from 'vitest';
import { RulesEngine } from './engine';
import { RuleValidationError } from './validate';
import type { Rule } from './types';

interface Ev {
  tool: string;
  args: Record<string, unknown>;
  result: { ok: boolean };
}

function engine() {
  return new RulesEngine<Ev>({ keyOf: (e) => e.tool });
}

const ev = (tool: string, args: Record<string, unknown> = {}, ok = true): Ev => ({ tool, args, result: { ok } });

describe('RulesEngine registration', () => {
  it('indexes by trigger key and matches O(rules-for-key)', () => {
    const e = engine();
    e.add({ id: 'r1', on: 'coord:handoff', fire: 'activity:report' });
    e.add({ id: 'r2', on: 'other:tool', fire: 'x' });
    expect(e.size()).toBe(2);
    expect(e.rulesFor('coord:handoff').map((r) => r.id)).toEqual(['r1']);
    expect(e.triggerKeys().sort()).toEqual(['coord:handoff', 'other:tool']);
  });

  it('re-adding by id replaces (idempotent)', () => {
    const e = engine();
    e.add({ id: 'r1', on: 'a', fire: 'x' });
    e.add({ id: 'r1', on: 'b', fire: 'y' });
    expect(e.size()).toBe(1);
    expect(e.rulesFor('a')).toEqual([]);
    expect(e.rulesFor('b').map((r) => r.id)).toEqual(['r1']);
    expect(e.get('r1')?.fire).toBe('y');
  });

  it('a rule on multiple keys is indexed under each and removed from all', () => {
    const e = engine();
    e.add({ id: 'r1', on: ['a', 'b'], fire: 'x' });
    expect(e.rulesFor('a').length).toBe(1);
    expect(e.rulesFor('b').length).toBe(1);
    expect(e.remove('r1')).toBe(true);
    expect(e.rulesFor('a')).toEqual([]);
    expect(e.rulesFor('b')).toEqual([]);
  });

  it('validates rule shape', () => {
    const e = engine();
    expect(() => e.add({ id: '', on: 'a', fire: 'x' } as Rule<Ev>)).toThrow(RuleValidationError);
    expect(() => e.add({ id: 'r', on: '', fire: 'x' } as Rule<Ev>)).toThrow(RuleValidationError);
    expect(() => e.add({ id: 'r', on: 'a', fire: '' } as Rule<Ev>)).toThrow(RuleValidationError);
  });

  it('clear empties the engine', () => {
    const e = engine();
    e.addAll([
      { id: 'r1', on: 'a', fire: 'x' },
      { id: 'r2', on: 'b', fire: 'y' },
    ]);
    e.clear();
    expect(e.size()).toBe(0);
    expect(e.triggerKeys()).toEqual([]);
  });
});

describe('RulesEngine.match', () => {
  it('returns nothing for an unmatched key (the common cheap path)', () => {
    const e = engine();
    e.add({ id: 'r1', on: 'coord:handoff', fire: 'x' });
    expect(e.match(ev('unrelated:tool'))).toEqual([]);
  });

  it('matches and resolves static args', () => {
    const e = engine();
    e.add({ id: 'r1', on: 'coord:handoff', when: { 'args.item': { exists: true } }, fire: 'activity:report', args: { kind: 'lifecycle' } });
    const out = e.match(ev('coord:handoff', { item: 'WI-1' }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ruleId: 'r1', fire: 'activity:report', args: { kind: 'lifecycle' } });
  });

  it('resolves function args from the event', () => {
    const e = engine();
    e.add({
      id: 'r1',
      on: 'coord:handoff',
      fire: 'activity:report',
      args: (event) => ({ summary: `deferred ${String(event.args.item)}` }),
    });
    const out = e.match(ev('coord:handoff', { item: 'WI-9' }));
    expect(out[0].args).toEqual({ summary: 'deferred WI-9' });
  });

  it('skips rules whose `when` is false', () => {
    const e = engine();
    e.add({ id: 'r1', on: 'coord:handoff', when: { 'result.ok': true }, fire: 'x' });
    expect(e.match(ev('coord:handoff', {}, false))).toEqual([]);
    expect(e.match(ev('coord:handoff', {}, true))).toHaveLength(1);
  });

  it('a rule on multiple keys fires at most once per event', () => {
    const e = engine();
    e.add({ id: 'r1', on: ['a', 'b'], fire: 'x' });
    // keyOf returns a single key per event here, so this just asserts no double-add for one key
    expect(e.match(ev('a'))).toHaveLength(1);
  });

  it('dedups when keyOf returns multiple keys hitting the same rule', () => {
    const e = new RulesEngine<Ev>({ keyOf: (ev2) => [ev2.tool, 'wildcard'] });
    e.add({ id: 'r1', on: ['coord:handoff', 'wildcard'], fire: 'x' });
    expect(e.match(ev('coord:handoff'))).toHaveLength(1);
  });

  it('catches a throwing predicate and routes to onError, skipping the rule', () => {
    const onError = vi.fn();
    const e = new RulesEngine<Ev>({ keyOf: (ev2) => ev2.tool, onError });
    e.add({ id: 'bad', on: 'a', when: () => { throw new Error('boom'); }, fire: 'x' });
    e.add({ id: 'good', on: 'a', fire: 'y' });
    const out = e.match(ev('a'));
    expect(out.map((m) => m.ruleId)).toEqual(['good']);
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('RulesEngine.describe (reactive graph)', () => {
  it('returns one edge per (key, rule)', () => {
    const e = engine();
    e.add({ id: 'r1', on: ['a', 'b'], fire: 'x' });
    e.add({ id: 'r2', on: 'a', fire: 'y' });
    const edges = e.describe();
    expect(edges).toContainEqual({ on: 'a', ruleId: 'r1', fire: 'x' });
    expect(edges).toContainEqual({ on: 'b', ruleId: 'r1', fire: 'x' });
    expect(edges).toContainEqual({ on: 'a', ruleId: 'r2', fire: 'y' });
    expect(edges).toHaveLength(3);
  });
});
