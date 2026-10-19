import type { EnvironmentState } from '../types';

/**
 * Lightweight window-level events so deeply nested UI (e.g. the 3D viewport
 * toolbar) can request simulator changes without prop drilling. `App`
 * listens and applies them (primary window) or forwards them to the primary
 * (pop-out windows).
 */
/** Commands an instructor pop-out window sends to the primary simulator. */
export type InstructorCommand =
  | { kind: 'trigger-emergency'; scenarioId: string }
  | { kind: 'resolve-emergency' }
  | { kind: 'cancel-emergency' }
  | { kind: 'set-environment'; patch: Partial<EnvironmentState> };

export const SET_ENVIRONMENT_EVENT = 'corod-sim:set-environment';

export function requestEnvironmentChange(patch: Partial<EnvironmentState>): void {
  window.dispatchEvent(new CustomEvent<Partial<EnvironmentState>>(SET_ENVIRONMENT_EVENT, { detail: patch }));
}

export function onEnvironmentChangeRequest(handler: (patch: Partial<EnvironmentState>) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<Partial<EnvironmentState>>).detail);
  window.addEventListener(SET_ENVIRONMENT_EVENT, listener);
  return () => window.removeEventListener(SET_ENVIRONMENT_EVENT, listener);
}
