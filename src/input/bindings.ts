/**
 * Binding types + sensible default keyboard/gamepad bindings, plus
 * localStorage persistence.
 *
 * A control can have:
 *  - key           : a keyboard code (KeyboardEvent.code, e.g. "KeyR", "Space")
 *  - gamepadButton : a gamepad button index (standard mapping)
 *  - gamepadAxis   : a gamepad axis index (for analog controls)
 *  - axisInvert    : invert the axis direction
 *  - stepKeyUp/Dn  : for analog controls driven by +/- keys/buttons
 *
 * All fields are optional; a control may be bound to any combination.
 */

export interface Binding {
  key?: string | null;
  gamepadButton?: number | null;
  // Analog-only:
  gamepadAxis?: number | null;
  axisInvert?: boolean;
  // Analog +/- stepping (buttons/keys):
  keyInc?: string | null;
  keyDec?: string | null;
  gamepadButtonInc?: number | null;
  gamepadButtonDec?: number | null;
  // ---- Selector + shared-axis scheme ----
  /** Tap this key to make this control the ACTIVE target for its shared axis. */
  selectorKey?: string | null;
  /** Tap this gamepad button to select this control for its shared axis. */
  selectorButton?: number | null;
  /** Optional per-control override of the axis mapping mode ('rate'|'absolute'). */
  axisModeOverride?: 'rate' | 'absolute' | null;
}

export type BindingMap = Record<string, Binding>;

/** Global config for the two shared "channels" used by the selector scheme.
 * Each channel (movement / value) can be driven by:
 *   - a gamepad AXIS (proportional), and/or
 *   - INCREASE / DECREASE buttons + keys that adjust the currently-SELECTED
 *     target for that channel (e.g. tap S to select Squeeze, then RT/LT adjust).
 */
export interface SharedAxisConfig {
  movementAxis: number;   // gamepad axis index for MOVEMENT-group selectors
  movementInvert: boolean;
  valueAxis: number;      // gamepad axis index for VALUE-group selectors
  valueInvert: boolean;
  /** Keyboard up/down keys per channel. */
  movementUpKey?: string | null;
  movementDownKey?: string | null;
  valueUpKey?: string | null;
  valueDownKey?: string | null;
  /** Gamepad INC/DEC buttons that adjust the currently-selected target. */
  movementIncButton?: number | null;
  movementDecButton?: number | null;
  valueIncButton?: number | null;
  valueDecButton?: number | null;
}

export const DEFAULT_SHARED_AXES: SharedAxisConfig = {
  // The RIGHT stick (axis 3) is dedicated to gripper DRIVE (POOH/RIH), so the
  // shared VALUE channel is driven by the LEFT stick Y + the triggers instead.
  movementAxis: 1,       // left-stick Y (unused unless a movement selector is set)
  movementInvert: true,
  valueAxis: 1,          // left-stick Y drives the selected value (optional)
  valueInvert: true,     // up = increase
  valueUpKey: 'PageUp',
  valueDownKey: 'PageDown',
  // PRIMARY value adjust: triggers change the selected VALUE control (RT +, LT −).
  valueIncButton: 7,     // RT
  valueDecButton: 6,     // LT
  movementIncButton: 5,  // RB
  movementDecButton: 4,  // LB
};

const STORAGE_KEY = 'corod.inputBindings.v4';
const ENABLED_KEY = 'corod.inputEnabled.v1';
const AXES_KEY = 'corod.sharedAxes.v4';

/**
 * Standard gamepad button indices (Xbox-style layout):
 * 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
 * 10 L3, 11 R3, 12 DUp, 13 DDown, 14 DLeft, 15 DRight, 16 Guide
 * Axes: 0 LX, 1 LY, 2 RX, 3 RY
 */
export const DEFAULT_BINDINGS: BindingMap = {
  // Drive & Trip
  'trip.rih': { key: 'Digit1', gamepadButton: 14 },
  'trip.pooh': { key: 'Digit2', gamepadButton: 15 },
  'trip.free': { key: 'Digit3', gamepadButton: 16 },
  'drive.run': { key: 'KeyR', gamepadButton: 0 },
  'drive.pull': { key: 'KeyF', gamepadButton: 3 },
  'drive.stop': { key: 'Space', gamepadButton: 1 },
  // Gripper drive joystick is ALWAYS driven by the RIGHT STICK Y directly.
  // Browser sticks read UP as negative, so we invert: UP → joystick +1 → POOH
  // (pull out), DOWN → joystick −1 → RIH (run in). Matches the requested layout.
  'joystick': { gamepadAxis: 3, axisInvert: true, keyDec: 'ArrowLeft', keyInc: 'ArrowRight' },
  'depth': {}, // selector-only: select then use shared VALUE inc/dec

  // Engine & Power
  'engine.toggle': { key: 'KeyE', gamepadButton: 9 },
  'pto.toggle': { key: 'KeyP', gamepadButton: 8 },
  'engine.rpm': {}, // selector-only

  // Gripper / Clamp
  'clamp.install': { key: 'KeyC', gamepadButton: 4 },
  'clamp.remove': { key: 'KeyV', gamepadButton: 5 },
  'gripperBrake.toggle': { key: 'KeyB' },
  // NOTE: the squeeze/chain SWITCHES no longer steal S/T. Those keys are now the
  // SELECTORS on the analog targets below (selecting a knob auto-enables its
  // circuit — see dispatchControl). The switches keep their own separate keys.
  'squeezeSwitch.toggle': { key: 'Semicolon' },
  'chainTensionSwitch.toggle': { key: 'Quote' },
  'safetyClamp.toggle': { key: 'KeyL' },

  // BOP & Well Control
  'bop.toggleClosed': { key: 'KeyO', gamepadButton: 2 },
  'bop.handPump': { key: 'KeyH' },
  'bop.pump.toggle': { key: 'KeyU' },
  'bop.bleed.toggle': { key: 'KeyJ' },
  'flowTee.toggle': { key: 'KeyK' },
  // BOP regulator: tap G to select, then RT/LT (or PageUp/Dn) adjust.
  'bop.regulator': { selectorKey: 'KeyG' },

  // Pressures / analog knobs — each has a SELECTOR key so it works out of the
  // box: tap the key to make it the active knob, then RT/LT (gamepad) or
  // PageUp/PageDown (keyboard) increase/decrease it.
  'press.up': { selectorKey: 'KeyI' },          // I = Up pressure (POOH drive)
  'press.down': { selectorKey: 'KeyD' },        // D = Down pressure (RIH drive)
  'press.squeeze': { selectorKey: 'KeyS' },     // S = Squeeze
  'press.chainTension': { selectorKey: 'KeyT' },// T = chain Tension
  'press.airRegulator': { selectorKey: 'KeyQ' },// Q = air pressure regulator

  // Switches
  'safetyBleed.toggle': {},
  'chainOiler.toggle': {},
  'panelLights.toggle': {},
  'tankHeater.toggle': {},

  // Rig-Up / Safety
  'reelForks.toggle': {},
  'containment.attach': {},
  'tapTest': {},

  // Emergency
  'estop.trip': { key: 'Escape', gamepadButton: 6 },
  'estop.reset': { key: 'Backspace' },

  // Misc
  'airHorn': { key: 'KeyA', gamepadButton: 7 },
  'sound.toggle': { key: 'KeyM' },
};

// In-memory fallback used if localStorage is unavailable (private mode, etc.)
// so bindings at least survive within the session.
let memoryBindings: BindingMap | null = null;

export function loadBindings(): BindingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (memoryBindings) return memoryBindings;
      return structuredCloneSafe(DEFAULT_BINDINGS);
    }
    const parsed = JSON.parse(raw) as BindingMap;
    // Merge with defaults so newly-added controls always have an entry.
    const merged = { ...structuredCloneSafe(DEFAULT_BINDINGS), ...parsed };
    if (import.meta.env?.DEV) console.info('[input] loaded bindings from localStorage');
    return merged;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[input] loadBindings failed, using defaults', err);
    return memoryBindings ?? structuredCloneSafe(DEFAULT_BINDINGS);
  }
}

export function saveBindings(map: BindingMap) {
  // Always keep an in-memory copy so binds persist for the session even if
  // localStorage is blocked.
  memoryBindings = structuredCloneSafe(map);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    if (import.meta.env?.DEV) console.info('[input] saved bindings ✓');
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[input] saveBindings failed (localStorage blocked?)', err);
  }
}

export function resetBindings(): BindingMap {
  const d = structuredCloneSafe(DEFAULT_BINDINGS);
  saveBindings(d);
  return d;
}

export function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveEnabled(enabled: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

let memoryAxes: SharedAxisConfig | null = null;

export function loadSharedAxes(): SharedAxisConfig {
  try {
    const raw = localStorage.getItem(AXES_KEY);
    if (!raw) return memoryAxes ?? { ...DEFAULT_SHARED_AXES };
    return { ...DEFAULT_SHARED_AXES, ...(JSON.parse(raw) as Partial<SharedAxisConfig>) };
  } catch {
    return memoryAxes ?? { ...DEFAULT_SHARED_AXES };
  }
}

export function saveSharedAxes(cfg: SharedAxisConfig) {
  memoryAxes = { ...cfg };
  try {
    localStorage.setItem(AXES_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Human-readable label for a keyboard code. */
export function keyLabel(code?: string | null): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
  const map: Record<string, string> = {
    Space: 'Space', Escape: 'Esc', Backspace: 'Bksp', Enter: 'Enter',
    Minus: '−', Equal: '=', Comma: ',', Period: '.',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl',
  };
  return map[code] || code;
}

/** Human-readable label for a gamepad button index (Xbox layout). */
export function padButtonLabel(idx?: number | null): string {
  if (idx == null) return '—';
  const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start',
    'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Guide'];
  return names[idx] ?? `Btn${idx}`;
}

export function padAxisLabel(idx?: number | null): string {
  if (idx == null) return '—';
  const names = ['L-Stick X', 'L-Stick Y', 'R-Stick X', 'R-Stick Y'];
  return names[idx] ?? `Axis${idx}`;
}
