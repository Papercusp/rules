import { describe, it, expect } from 'vitest';
import { getPath, hasPath, splitPath } from './path';

describe('splitPath', () => {
  it('returns [] for the root', () => {
    expect(splitPath('')).toEqual([]);
  });
  it('splits on dots', () => {
    expect(splitPath('a.b.c')).toEqual(['a', 'b', 'c']);
  });
});

describe('getPath', () => {
  const obj = { args: { item: { id: 'x1' }, list: [{ name: 'a' }, { name: 'b' }] }, result: { ok: true } };

  it('returns the root for empty path', () => {
    expect(getPath(obj, '')).toBe(obj);
  });
  it('resolves nested object paths', () => {
    expect(getPath(obj, 'args.item.id')).toBe('x1');
    expect(getPath(obj, 'result.ok')).toBe(true);
  });
  it('indexes into arrays with numeric segments', () => {
    expect(getPath(obj, 'args.list.0.name')).toBe('a');
    expect(getPath(obj, 'args.list.1.name')).toBe('b');
  });
  it('returns undefined for a missing segment', () => {
    expect(getPath(obj, 'args.nope')).toBeUndefined();
    expect(getPath(obj, 'args.item.id.deeper')).toBeUndefined();
  });
  it('never throws on null/undefined intermediates', () => {
    expect(getPath({ a: null }, 'a.b.c')).toBeUndefined();
    expect(getPath(undefined, 'a')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
  });
  it('returns undefined when descending into a primitive', () => {
    expect(getPath({ a: 5 }, 'a.b')).toBeUndefined();
  });
});

describe('hasPath', () => {
  it('is true for present non-null values', () => {
    expect(hasPath({ a: { b: 0 } }, 'a.b')).toBe(true);
    expect(hasPath({ a: { b: false } }, 'a.b')).toBe(true);
  });
  it('is false for missing or null', () => {
    expect(hasPath({ a: { b: null } }, 'a.b')).toBe(false);
    expect(hasPath({}, 'x')).toBe(false);
  });
});
