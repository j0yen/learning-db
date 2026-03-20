/**
 * ConfigRegistry: Central configuration management with observer pattern.
 * Allows runtime hot-swapping of algorithms and parameters.
 */

import type {
  EngineConfig,
  EngineEvent,
  EventListener,
} from '../types.js';
import { DEFAULT_CONFIG, EngineEventType } from '../types.js';

export type ConfigKey = keyof EngineConfig;
export type ConfigChangeListener<K extends ConfigKey = ConfigKey> = (
  key: K,
  newValue: EngineConfig[K],
  oldValue: EngineConfig[K],
) => void;

export class ConfigRegistry {
  private config: EngineConfig;
  private listeners: Map<ConfigKey | '*', Set<ConfigChangeListener>> = new Map();
  private eventListeners: Map<EngineEventType | '*', Set<EventListener>> = new Map();

  constructor(initial?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...initial };
  }

  /** Get the full current configuration. */
  getAll(): Readonly<EngineConfig> {
    return { ...this.config };
  }

  /** Get a single config value. */
  get<K extends ConfigKey>(key: K): EngineConfig[K] {
    return this.config[key];
  }

  /** Set a single config value and notify observers. */
  set<K extends ConfigKey>(key: K, value: EngineConfig[K]): void {
    const oldValue = this.config[key];
    if (oldValue === value) return;

    this.config[key] = value;
    this.notifyConfigChange(key, value, oldValue);
    this.emitEvent({
      type: EngineEventType.CONFIG_CHANGE,
      timestamp: Date.now(),
      data: { key, newValue: value, oldValue },
    });
  }

  /** Update multiple config values at once. */
  update(partial: Partial<EngineConfig>): void {
    for (const [key, value] of Object.entries(partial)) {
      this.set(key as ConfigKey, value as EngineConfig[ConfigKey]);
    }
  }

  /** Reset all config to defaults. */
  reset(): void {
    this.update(DEFAULT_CONFIG);
  }

  // ─── Config Observers ────────────────────────────────────────────────────

  /** Watch a specific config key for changes. Use '*' for all changes. */
  onConfigChange<K extends ConfigKey>(
    key: K | '*',
    listener: ConfigChangeListener<K>,
  ): () => void {
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener as ConfigChangeListener);
    this.listeners.set(key, set);
    return () => set.delete(listener as ConfigChangeListener);
  }

  private notifyConfigChange<K extends ConfigKey>(
    key: K,
    newValue: EngineConfig[K],
    oldValue: EngineConfig[K],
  ): void {
    // Notify key-specific listeners
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      for (const listener of keyListeners) {
        listener(key, newValue, oldValue);
      }
    }
    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        listener(key, newValue, oldValue);
      }
    }
  }

  // ─── Event Bus ───────────────────────────────────────────────────────────

  /** Subscribe to engine events. Use '*' for all events. */
  on(type: EngineEventType | '*', listener: EventListener): () => void {
    const set = this.eventListeners.get(type) ?? new Set();
    set.add(listener);
    this.eventListeners.set(type, set);
    return () => set.delete(listener);
  }

  /** Emit an engine event to all subscribers. */
  emitEvent(event: EngineEvent): void {
    // Notify type-specific listeners
    const typeListeners = this.eventListeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }
    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        listener(event);
      }
    }
  }
}
