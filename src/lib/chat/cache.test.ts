import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearCache, forget, memo } from './cache';

describe('memo', () => {
  beforeEach(() => clearCache());

  it('loads once and reuses the value until it expires', async () => {
    let t = 1000;
    const load = vi.fn(async () => 'v');
    expect(await memo('a', 500, load, () => t)).toBe('v');
    t += 400; expect(await memo('a', 500, load, () => t)).toBe('v');
    expect(load).toHaveBeenCalledTimes(1);
    t += 200; await memo('a', 500, load, () => t);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('requests that arrive while a load is running share that one load', async () => {
    let release: (v: string) => void = () => {};
    const load = vi.fn(() => new Promise<string>((r) => { release = r; }));
    const a = memo('b', 1000, load); const b = memo('b', 1000, load); const c = memo('b', 1000, load);
    release('shared');
    expect(await Promise.all([a, b, c])).toEqual(['shared', 'shared', 'shared']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never keeps a failed load: the next call tries again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('ok');
    await expect(memo('c', 1000, load)).rejects.toThrow('db down');
    expect(await memo('c', 1000, load)).toBe('ok');
  });

  it('keys are separate, and forget() drops a whole prefix', async () => {
    const la = vi.fn(async () => 1); const lb = vi.fn(async () => 2);
    await memo('user:1', 1000, la); await memo('user:2', 1000, lb);
    forget('user:');
    await memo('user:1', 1000, la); await memo('user:2', 1000, lb);
    expect(la).toHaveBeenCalledTimes(2); expect(lb).toHaveBeenCalledTimes(2);
  });
});
