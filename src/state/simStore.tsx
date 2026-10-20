/**
 * Render isolation for the 10 Hz simulator state.
 *
 * App owns the authoritative `SimulatorState` (useState) and re-renders on every
 * physics tick. Heavy children that only need a few, display-rounded values
 * subscribe to this tiny external store instead, and are wrapped with
 * `isolateRenders` so App's per-tick re-render no longer cascades into them.
 */
import React, { ComponentType, useMemo, useRef, useSyncExternalStore } from 'react';
import type { SimulatorState } from '../types';

type Listener = () => void;
let current: SimulatorState | null = null;
const listeners = new Set<Listener>();

export const simStore = {
  get: (): SimulatorState | null => current,
  /** Called by App after each commit (useLayoutEffect) with the latest state. */
  publish(next: SimulatorState) {
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k)
    && Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Subscribe to a derived slice of the live simulator state. The component only
 * re-renders when the selected value changes (by `isEqual`, shallow by default).
 * `fallback` is used until App has published (e.g. isolated tests/stories).
 */
export function useSimSelector<T>(
  selector: (s: SimulatorState) => T,
  fallback: SimulatorState,
  isEqual: (a: T, b: T) => boolean = shallowEqual,
): T {
  const cache = useRef<{ src: SimulatorState; val: T } | null>(null);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSnapshot = () => {
    const src = current ?? fallback;
    const c = cache.current;
    if (c && c.src === src) return c.val;
    const val = selectorRef.current(src);
    if (c && isEqual(c.val, val)) { cache.current = { src, val: c.val }; return c.val; }
    cache.current = { src, val };
    return val;
  };
  return useSyncExternalStore(simStore.subscribe, getSnapshot, getSnapshot);
}

/** Props equality ignoring `ignore` keys (e.g. the full per-tick `state` object). */
export function propsEqualExcept<P extends object>(a: P, b: P, ignore: ReadonlyArray<keyof P>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as Array<keyof P>);
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Wrap a component so parent re-renders don't re-render it unless a non-ignored,
 * non-function prop changes. Function props are replaced by stable proxies that
 * always call the parent's LATEST callback, so inline lambdas in the parent stay
 * correct without breaking memoisation.
 */
export function isolateRenders<P extends object>(Inner: ComponentType<P>, ignore: ReadonlyArray<keyof P> = []) {
  const Memo = React.memo(Inner, (a, b) => propsEqualExcept(a, b, ignore)) as unknown as ComponentType<P>;
  const Isolated = (props: P) => {
    const latest = useRef(props);
    latest.current = props;
    const fnKeys = (Object.keys(props) as Array<keyof P & string>).filter((k) => typeof props[k] === 'function').sort();
    const signature = fnKeys.join('|');
    const stable = useMemo(() => {
      const out: Record<string, (...args: unknown[]) => unknown> = {};
      for (const k of fnKeys) {
        out[k] = (...args: unknown[]) => (latest.current[k] as unknown as ((...a: unknown[]) => unknown) | undefined)?.(...args);
      }
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);
    return <Memo {...props} {...(stable as Partial<P>)} />;
  };
  Isolated.displayName = `Isolated(${Inner.displayName ?? Inner.name ?? 'Component'})`;
  return Isolated;
}
