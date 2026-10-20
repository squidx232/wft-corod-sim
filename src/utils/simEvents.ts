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

/** Runtime guard for commands received over BroadcastChannel. */
export function isInstructorCommand(v: unknown): v is InstructorCommand {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  switch (c.kind) {
    case 'trigger-emergency':
      return typeof c.scenarioId === 'string' && c.scenarioId.length > 0 && c.scenarioId.length < 100;
    case 'resolve-emergency':
    case 'cancel-emergency':
      return true;
    case 'set-environment':
      return typeof c.patch === 'object' && c.patch !== null && !Array.isArray(c.patch);
    default:
      return false;
  }
}

export const SET_ENVIRONMENT_EVENT = 'corod-sim:set-environment';

export function requestEnvironmentChange(patch: Partial<EnvironmentState>): void {
  window.dispatchEvent(new CustomEvent<Partial<EnvironmentState>>(SET_ENVIRONMENT_EVENT, { detail: patch }));
}

export function onEnvironmentChangeRequest(handler: (patch: Partial<EnvironmentState>) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<Partial<EnvironmentState>>).detail);
  window.addEventListener(SET_ENVIRONMENT_EVENT, listener);
  return () => window.removeEventListener(SET_ENVIRONMENT_EVENT, listener);
}
