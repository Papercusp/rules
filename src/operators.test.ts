import { describe, it, expect } from 'vitest';
import { evaluateOperatorTest, isOperatorTest, isPlainObject } from './operators';

describe('isPlainObject', () => {
  it('true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });
  it('false for non-plain', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(5)).toBe(false);
  });
});

describe('isOperatorTest', () => {
  it('true when all keys are operators', () => {
    expect(isOperatorTest({ exists: true })).toBe(true);
    expect(isOperatorTest({ equals: 'x', exists: true })).toBe(true);
  });
  it('false for empty object (treated as bare value)', () => {
    expect(isOperatorTest({})).toBe(false);
  });
  it('false when any key is not an operator', () => {
    expect(isOperatorTest({ equals: 'x', foo: 1 })).toBe(false);
    expect(isOperatorTest({ kind: 'bug' })).toBe(false);
  });
  it('false for non-objects', () => {
    expect(isOperatorTest('x')).toBe(false);
    expect(isOperatorTest(['equals'])).toBe(false);
  });
});

describe('evaluateOperatorTest — bare value', () => {
  it('deep-equals a bare value', () => {
    expect(evaluateOperatorTest('bug', 'bug')).toBe(true);
    expect(evaluateOperatorTest('bug', 'feature')).toBe(false);
    expect(evaluateOperatorTest({ kind: 'bug' }, { kind: 'bug' })).toBe(true); // non-operator object ⇒ bare value
  });
});

describe('evaluateOperatorTest — operators', () => {
  it('equals / notEquals', () => {
    expect(evaluateOperatorTest({ equals: 5 }, 5)).toBe(true);
    expect(evaluateOperatorTest({ equals: 5 }, 6)).toBe(false);
    expect(evaluateOperatorTest({ notEquals: 5 }, 6)).toBe(true);
    expect(evaluateOperatorTest({ notEquals: 5 }, 5)).toBe(false);
  });
  it('exists', () => {
    expect(evaluateOperatorTest({ exists: true }, 0)).toBe(true);
    expect(evaluateOperatorTest({ exists: true }, '')).toBe(true);
    expect(evaluateOperatorTest({ exists: true }, undefined)).toBe(false);
    expect(evaluateOperatorTest({ exists: true }, null)).toBe(false);
    expect(evaluateOperatorTest({ exists: false }, undefined)).toBe(true);
    expect(evaluateOperatorTest({ exists: false }, 1)).toBe(false);
  });
  it('truthy', () => {
    expect(evaluateOperatorTest({ truthy: true }, 'x')).toBe(true);
    expect(evaluateOperatorTest({ truthy: true }, 0)).toBe(false);
    expect(evaluateOperatorTest({ truthy: false }, '')).toBe(true);
  });
  it('in / notIn', () => {
    expect(evaluateOperatorTest({ in: ['a', 'b'] }, 'a')).toBe(true);
    expect(evaluateOperatorTest({ in: ['a', 'b'] }, 'c')).toBe(false);
    expect(evaluateOperatorTest({ notIn: ['a', 'b'] }, 'c')).toBe(true);
    expect(evaluateOperatorTest({ in: [{ x: 1 }] }, { x: 1 })).toBe(true); // deep
  });
  it('contains / notContains', () => {
    expect(evaluateOperatorTest({ contains: 'x' }, ['x', 'y'])).toBe(true);
    expect(evaluateOperatorTest({ contains: 'z' }, ['x', 'y'])).toBe(false);
    expect(evaluateOperatorTest({ contains: 'ell' }, 'hello')).toBe(true);
    expect(evaluateOperatorTest({ notContains: 'q' }, 'hello')).toBe(true);
    expect(evaluateOperatorTest({ contains: 'x' }, 42)).toBe(false); // non-collection
  });
  it('numeric comparisons', () => {
    expect(evaluateOperatorTest({ gt: 3 }, 4)).toBe(true);
    expect(evaluateOperatorTest({ gt: 3 }, 3)).toBe(false);
    expect(evaluateOperatorTest({ gte: 3, lte: 5 }, 4)).toBe(true);
    expect(evaluateOperatorTest({ lt: 5 }, 5)).toBe(false);
    expect(evaluateOperatorTest({ gt: 3 }, 'notnum')).toBe(false);
  });
  it('matches / startsWith / endsWith', () => {
    expect(evaluateOperatorTest({ matches: '^F-\\d+$' }, 'F-123')).toBe(true);
    expect(evaluateOperatorTest({ matches: '^F-\\d+$' }, 'X-123')).toBe(false);
    expect(evaluateOperatorTest({ matches: { source: 'abc', flags: 'i' } }, 'ABC')).toBe(true);
    expect(evaluateOperatorTest({ startsWith: 'coord:' }, 'coord:handoff')).toBe(true);
    expect(evaluateOperatorTest({ endsWith: ':done' }, 'work:done')).toBe(true);
    expect(evaluateOperatorTest({ startsWith: 'x' }, 123)).toBe(false);
  });
  it('multiple operators in one leaf are ANDed', () => {
    expect(evaluateOperatorTest({ exists: true, in: ['a', 'b'] }, 'a')).toBe(true);
    expect(evaluateOperatorTest({ exists: true, in: ['a', 'b'] }, 'c')).toBe(false);
  });
});
