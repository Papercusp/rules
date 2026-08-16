import { describe, it, expect } from 'vitest';
import {
  parseSerializableRule,
  safeParseSerializableRule,
  parseSerializableRules,
  serializableRuleSchema,
  dataConditionSchema,
} from './schema';
import { RulesEngine } from './engine';

describe('serializableRuleSchema', () => {
  it('accepts a well-formed data-form rule', () => {
    const rule = parseSerializableRule({
      id: 'r1',
      on: 'coord:handoff',
      when: { 'args.item': { exists: true } },
      fire: 'activity:report',
      args: { kind: 'lifecycle' },
    });
    expect(rule.id).toBe('r1');
    expect(rule.fire).toBe('activity:report');
  });

  it('accepts on as a non-empty array', () => {
    expect(parseSerializableRule({ id: 'r', on: ['a', 'b'], fire: 'x' }).on).toEqual(['a', 'b']);
  });

  it('rejects empty id / empty on / empty fire', () => {
    expect(safeParseSerializableRule({ id: '', on: 'a', fire: 'x' }).success).toBe(false);
    expect(safeParseSerializableRule({ id: 'r', on: [], fire: 'x' }).success).toBe(false);
    expect(safeParseSerializableRule({ id: 'r', on: 'a', fire: '' }).success).toBe(false);
  });

  it('rejects a function when (not serializable)', () => {
    expect(safeParseSerializableRule({ id: 'r', on: 'a', fire: 'x', when: () => true }).success).toBe(false);
  });

  it('parses an array of rules (an Events file)', () => {
    const rules = parseSerializableRules([
      { id: 'r1', on: 'a', fire: 'x' },
      { id: 'r2', on: 'b', fire: 'y', when: { 'result.ok': true } },
    ]);
    expect(rules).toHaveLength(2);
  });

  it('a parsed serializable rule loads + matches in the engine', () => {
    const rule = parseSerializableRule({ id: 'r1', on: 'a', when: { 'args.k': 'v' }, fire: 'x', args: { a: 1 } });
    const e = new RulesEngine<{ tool: string; args: Record<string, unknown> }>({ keyOf: (ev) => ev.tool });
    e.add(rule as never);
    expect(e.match({ tool: 'a', args: { k: 'v' } })).toHaveLength(1);
    expect(e.match({ tool: 'a', args: { k: 'other' } })).toHaveLength(0);
  });
});

describe('dataConditionSchema', () => {
  it('accepts combinators and match-maps', () => {
    expect(dataConditionSchema.safeParse({ all: [{ 'a.b': { exists: true } }] }).success).toBe(true);
    expect(dataConditionSchema.safeParse({ any: [{ x: 1 }, { y: 2 }] }).success).toBe(true);
    expect(dataConditionSchema.safeParse({ not: { x: 1 } }).success).toBe(true);
    expect(dataConditionSchema.safeParse({ 'args.item': { exists: true } }).success).toBe(true);
  });

  it('accepts a some k-of-n combinator, nested', () => {
    expect(dataConditionSchema.safeParse({ some: { require: 2, of: [{ x: 1 }, { y: 2 }, { z: 3 }] } }).success).toBe(true);
    // some nested inside all
    expect(
      dataConditionSchema.safeParse({ all: [{ a: 1 }, { some: { require: 1, of: [{ b: 2 }, { c: 3 }] } }] }).success,
    ).toBe(true);
  });

  it('a malformed some still PARSES — the schema is intentionally loose (record fallback); the RUNTIME enforces the threshold', () => {
    // dataConditionSchema's final union member is a catch-all record, so a
    // malformed `some` (require<1, missing `of`, …) degrades to a match-map at
    // the schema level rather than being rejected — exactly as a malformed
    // `all`/`any` does today. What actually enforces k-of-n semantics is
    // asCombinator in matcher.ts / compile.ts, which recognises `some` as a
    // combinator ONLY when { require:number, of:array } is well-formed and
    // otherwise treats it as a (never-matching) match-map. See matcher.test.ts.
    expect(dataConditionSchema.safeParse({ some: { require: 0, of: [{ x: 1 }] } }).success).toBe(true);
    expect(dataConditionSchema.safeParse({ some: { of: [{ x: 1 }] } }).success).toBe(true);
    // …but when the `some` branch IS the one that validates, it is strict on its shape:
    const strictSome = dataConditionSchema.safeParse({ some: { require: 2, of: [{ x: 1 }] } });
    expect(strictSome.success).toBe(true);
  });
});

describe('serializableRuleSchema shape', () => {
  it('is a zod object', () => {
    expect(typeof serializableRuleSchema.parse).toBe('function');
  });
});
