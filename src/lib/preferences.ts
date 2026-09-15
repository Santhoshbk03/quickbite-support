/**
 * Tiny localStorage-backed preference stores, read through useSyncExternalStore.
 *
 * Why not useState + useEffect: reading storage in an effect renders the wrong value first and then
 * flips, and it trips React's set-state-in-effect rule. An external store gives the server snapshot
 * during hydration and the stored value immediately after, with cross-tab sync for free.
 */
import { useSyncExternalStore } from "react";

export interface Preference<T extends string> {
  key: string;
  fallback: T;
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPreference<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
  options: { onChange?: (value: T) => void } = {},
): Preference<T> {
  const listeners = new Set<() => void>();

  const get = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && (allowed as readonly string[]).includes(stored)
        ? (stored as T)
        : fallback;
    } catch {
      // Private mode, blocked storage, or a thumbnail renderer: behave as unset.
      return fallback;
    }
  };

  const set = (value: T) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Still apply for this session even if it cannot persist.
    }
    options.onChange?.(value);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      options.onChange?.(get());
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { key, fallback, get, set, subscribe };
}

export function usePreference<T extends string>(
  preference: Preference<T>,
): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    preference.subscribe,
    preference.get,
    () => preference.fallback,
  );
  return [value, preference.set];
}
