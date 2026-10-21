import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { BaseLocationHook } from 'wouter';

const indexKey = '__yhub_navigation_index';
type Guard = () => boolean;

/** One browser-history owner. Denied POPs restore the previous entry before publishing
 * a route update, so the editor is never unmounted during Back/Forward cancellation. */
export function createGuardedHistory(browser: Window) {
  const listeners = new Set<() => void>();
  const guards = new Set<Guard>();
  let index: number = browser.history.state?.[indexKey] ?? 0;
  let path = browser.location.pathname;
  let url = browser.location.href;
  let restoring = false;
  browser.history.replaceState({ ...browser.history.state, [indexKey]: index }, '', url);
  const publish = () => {
    path = browser.location.pathname;
    url = browser.location.href;
    listeners.forEach(fn => fn());
  };
  const allowed = () => [...guards].every(guard => guard());
  const pop = () => {
    if (restoring) { restoring = false; return; }
    const targetIndex: unknown = browser.history.state?.[indexKey];
    if (!allowed()) {
      if (typeof targetIndex === 'number' && targetIndex !== index) {
        restoring = true;
        browser.history.go(index - targetIndex);
      } else {
        // An entry made outside this router cannot be traversed by a known delta.
        // Retain the editor and restore its URL without guessing a history offset.
        browser.history.pushState({ [indexKey]: index }, '', url);
      }
      return;
    }
    index = typeof targetIndex === 'number' ? targetIndex : index + 1;
    browser.history.replaceState({ ...browser.history.state, [indexKey]: index }, '', browser.location.href);
    publish();
  };
  browser.addEventListener('popstate', pop);
  return {
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    snapshot: () => path,
    navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => {
      if (restoring || !allowed()) return;
      const target = new URL(to, browser.location.href);
      if (target.origin !== browser.location.origin) throw Error('Internal navigation must be same-origin');
      if (!options?.replace) index++;
      const state = typeof options?.state === 'object' && options.state !== null ? options.state : {};
      browser.history[options?.replace ? 'replaceState' : 'pushState']({ ...state, [indexKey]: index }, '', to);
      publish();
    },
    guard: (fn: Guard) => { guards.add(fn); return () => { guards.delete(fn); }; },
    dispose: () => browser.removeEventListener('popstate', pop),
  };
}
let browserHistory: ReturnType<typeof createGuardedHistory> | undefined;
const getHistory = () => browserHistory ??= createGuardedHistory(window);
export const useGuardedLocation: BaseLocationHook = () => {
  const history = getHistory();
  return [useSyncExternalStore(history.subscribe, history.snapshot), history.navigate];
};
/** Guards are synchronous: preserve local recovery before allowing a route change.
 * Remote saves remain owned by the editor's existing save coordinator. */
export function useNavigationGuard(guard: Guard) {
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => getHistory().guard(() => latest.current()), []);
}
