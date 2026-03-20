import { describe, it, expect, vi } from 'vitest';
import { ConfigRegistry } from './config-registry.js';
import { ReplacementPolicy, EngineEventType, DEFAULT_CONFIG } from '../types.js';

describe('ConfigRegistry', () => {
  it('should initialize with default config', () => {
    const reg = new ConfigRegistry();
    expect(reg.get('pageSize')).toBe(DEFAULT_CONFIG.pageSize);
    expect(reg.get('bufferPoolSize')).toBe(DEFAULT_CONFIG.bufferPoolSize);
    expect(reg.get('replacementPolicy')).toBe(ReplacementPolicy.LRU);
  });

  it('should accept partial initial config', () => {
    const reg = new ConfigRegistry({ bufferPoolSize: 64 });
    expect(reg.get('bufferPoolSize')).toBe(64);
    expect(reg.get('pageSize')).toBe(DEFAULT_CONFIG.pageSize); // Others unchanged
  });

  it('should set and get individual values', () => {
    const reg = new ConfigRegistry();
    reg.set('bufferPoolSize', 32);
    expect(reg.get('bufferPoolSize')).toBe(32);
  });

  it('should not notify on same-value set', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    reg.onConfigChange('bufferPoolSize', listener);
    reg.set('bufferPoolSize', DEFAULT_CONFIG.bufferPoolSize);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify key-specific listeners on change', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    reg.onConfigChange('replacementPolicy', listener);

    reg.set('replacementPolicy', ReplacementPolicy.CLOCK);
    expect(listener).toHaveBeenCalledWith(
      'replacementPolicy',
      ReplacementPolicy.CLOCK,
      ReplacementPolicy.LRU,
    );
  });

  it('should notify wildcard listeners on any change', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    reg.onConfigChange('*', listener);

    reg.set('bufferPoolSize', 8);
    expect(listener).toHaveBeenCalledWith('bufferPoolSize', 8, DEFAULT_CONFIG.bufferPoolSize);
  });

  it('should support unsubscribe', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    const unsub = reg.onConfigChange('bufferPoolSize', listener);

    reg.set('bufferPoolSize', 8);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    reg.set('bufferPoolSize', 16);
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should update multiple values', () => {
    const reg = new ConfigRegistry();
    reg.update({ bufferPoolSize: 64, replacementPolicy: ReplacementPolicy.LRU_K });
    expect(reg.get('bufferPoolSize')).toBe(64);
    expect(reg.get('replacementPolicy')).toBe(ReplacementPolicy.LRU_K);
  });

  it('should reset to defaults', () => {
    const reg = new ConfigRegistry();
    reg.set('bufferPoolSize', 128);
    reg.reset();
    expect(reg.get('bufferPoolSize')).toBe(DEFAULT_CONFIG.bufferPoolSize);
  });

  it('should emit CONFIG_CHANGE events', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    reg.on(EngineEventType.CONFIG_CHANGE, listener);

    reg.set('bufferPoolSize', 32);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe(EngineEventType.CONFIG_CHANGE);
    expect(listener.mock.calls[0][0].data.key).toBe('bufferPoolSize');
  });

  it('should support wildcard event listeners', () => {
    const reg = new ConfigRegistry();
    const listener = vi.fn();
    reg.on('*', listener);

    reg.emitEvent({
      type: EngineEventType.PAGE_READ,
      timestamp: Date.now(),
      data: {},
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getAll returns a copy', () => {
    const reg = new ConfigRegistry();
    const all = reg.getAll();
    (all as any).bufferPoolSize = 999;
    expect(reg.get('bufferPoolSize')).toBe(DEFAULT_CONFIG.bufferPoolSize);
  });
});
