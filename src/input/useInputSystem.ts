/**
 * useInputSystem — global keyboard + USB gamepad input handling for the sim.
 *
 * Responsibilities:
 *  - Own the current binding map (persisted to localStorage).
 *  - Listen for keyboard keydown/keyup and translate to control dispatches.
 *  - Poll connected gamepads each frame (requestAnimationFrame), detecting
 *    button edges (press) and reading axes for analog controls.
 *  - Support REBIND CAPTURE: when capturing, the next key/button/axis is
 *    recorded for a given control+slot instead of being dispatched.
 *  - Report status (gamepad connected, last input) for the HUD.
 *
 * The consumer supplies a `dispatch(controlId, value?)` callback. For 'action'
 * and 'toggle' controls no value is passed; for 'analog' a number is passed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTROLS_BY_ID, ControlDef } from './controlRegistry';
import {
  Binding, BindingMap, loadBindings, saveBindings, resetBindings,
  loadEnabled, saveEnabled,
  SharedAxisConfig, loadSharedAxes, saveSharedAxes,
} from './bindings';

export type CaptureSlot =
  | 'key' | 'gamepadButton' | 'gamepadAxis'
  | 'keyInc' | 'keyDec' | 'gamepadButtonInc' | 'gamepadButtonDec'
  | 'selectorKey' | 'selectorButton';

export interface CaptureRequest {
  controlId: string;
  slot: CaptureSlot;
}

export interface InputStatus {
  gamepadConnected: boolean;
  gamepadId: string | null;
  lastInput: string | null; // human label of the last input seen
}

export interface UseInputSystem {
  bindings: BindingMap;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  status: InputStatus;
  capture: CaptureRequest | null;
  startCapture: (controlId: string, slot: CaptureSlot) => void;
  cancelCapture: () => void;
  clearBindingSlot: (controlId: string, slot: CaptureSlot) => void;
  resetAll: () => void;
  // Selector + shared-axis scheme
  sharedAxes: SharedAxisConfig;
  setSharedAxes: (cfg: SharedAxisConfig) => void;
  activeMovementTarget: string | null; // controlId currently driven by movement axis
  activeValueTarget: string | null;    // controlId currently driven by value axis
  setAxisModeOverride: (controlId: string, mode: 'rate' | 'absolute' | null) => void;
}

const AXIS_DEADZONE = 0.12;

export function useInputSystem(
  dispatch: (controlId: string, value?: number) => void,
  getAnalogValue: (controlId: string) => number,
): UseInputSystem {
  const [bindings, setBindings] = useState<BindingMap>(() => loadBindings());
  const [enabled, setEnabledState] = useState<boolean>(() => loadEnabled());
  const [status, setStatus] = useState<InputStatus>({
    gamepadConnected: false, gamepadId: null, lastInput: null,
  });
  const [capture, setCapture] = useState<CaptureRequest | null>(null);
  const [sharedAxes, setSharedAxesState] = useState<SharedAxisConfig>(() => loadSharedAxes());
  const [activeMovementTarget, setActiveMovementTarget] = useState<string | null>(null);
  const [activeValueTarget, setActiveValueTarget] = useState<string | null>(null);

  // Refs mirror state for use inside event handlers / rAF loop.
  const bindingsRef = useRef(bindings);
  const enabledRef = useRef(enabled);
  const captureRef = useRef(capture);
  const dispatchRef = useRef(dispatch);
  const getAnalogRef = useRef(getAnalogValue);
  const sharedAxesRef = useRef(sharedAxes);
  const activeMovementRef = useRef<string | null>(null);
  const activeValueRef = useRef<string | null>(null);
  bindingsRef.current = bindings;
  enabledRef.current = enabled;
  captureRef.current = capture;
  dispatchRef.current = dispatch;
  getAnalogRef.current = getAnalogValue;
  sharedAxesRef.current = sharedAxes;

  const setSharedAxes = useCallback((cfg: SharedAxisConfig) => {
    setSharedAxesState(cfg);
    saveSharedAxes(cfg);
  }, []);

  const selectTarget = useCallback((controlId: string) => {
    const c = CONTROLS_BY_ID[controlId];
    if (!c || !c.axisGroup) return;
    if (c.axisGroup === 'movement') {
      activeMovementRef.current = controlId;
      setActiveMovementTarget(controlId);
    } else {
      activeValueRef.current = controlId;
      setActiveValueTarget(controlId);
    }
    setStatus((s) => ({ ...s, lastInput: `Select ${c.label}` }));
  }, []);

  // Held keys (for continuous step dispatch of analog controls).
  const heldKeys = useRef<Set<string>>(new Set());

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    saveEnabled(v);
  }, []);

  const persist = useCallback((next: BindingMap) => {
    setBindings(next);
    saveBindings(next);
  }, []);

  const startCapture = useCallback((controlId: string, slot: CaptureSlot) => {
    setCapture({ controlId, slot });
  }, []);
  const cancelCapture = useCallback(() => setCapture(null), []);

  const clearBindingSlot = useCallback((controlId: string, slot: CaptureSlot) => {
    const next: BindingMap = { ...bindingsRef.current };
    next[controlId] = { ...(next[controlId] || {}), [slot]: null };
    persist(next);
  }, [persist]);

  const resetAll = useCallback(() => {
    setBindings(resetBindings());
  }, []);

  const setAxisModeOverride = useCallback((controlId: string, mode: 'rate' | 'absolute' | null) => {
    const next: BindingMap = { ...bindingsRef.current };
    next[controlId] = { ...(next[controlId] || {}), axisModeOverride: mode };
    persist(next);
  }, [persist]);

  const applyCapture = useCallback(
    (slot: CaptureSlot, value: string | number) => {
      const cap = captureRef.current;
      if (!cap) return;
      // Special pseudo-controls for the two shared channels (axis + inc/dec).
      if (cap.controlId.startsWith('__shared') && typeof value === 'number') {
        const cfg = { ...sharedAxesRef.current };
        switch (cap.controlId) {
          case '__sharedMove': cfg.movementAxis = value; break;
          case '__sharedValue': cfg.valueAxis = value; break;
          case '__sharedValueInc': cfg.valueIncButton = value; break;
          case '__sharedValueDec': cfg.valueDecButton = value; break;
          case '__sharedMoveInc': cfg.movementIncButton = value; break;
          case '__sharedMoveDec': cfg.movementDecButton = value; break;
          default: break;
        }
        setSharedAxesState(cfg); saveSharedAxes(cfg); setCapture(null); return;
      }
      const next: BindingMap = { ...bindingsRef.current };
      next[cap.controlId] = { ...(next[cap.controlId] || {}), [slot]: value };
      persist(next);
      setCapture(null);
    },
    [persist],
  );

  // Dispatch an analog step (for +/- keys/buttons).
  const stepAnalog = useCallback((c: ControlDef, dir: 1 | -1) => {
    const cur = getAnalogRef.current(c.id);
    const step = c.step ?? (c.max! - c.min!) / 20;
    let nv = cur + dir * step;
    nv = Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, nv));
    dispatchRef.current(c.id, nv);
  }, []);

  // Drive the currently-selected target control from a normalised axis value in
  // [-1, 1] (already deadzoned/inverted). Called every frame for the active
  // movement + value targets.
  const driveTarget = useCallback((controlId: string | null, axis: number, doRepeat: boolean) => {
    if (!controlId) return;
    const c = CONTROLS_BY_ID[controlId];
    if (!c) return;
    const b = bindingsRef.current[controlId] || {};
    const mode = b.axisModeOverride ?? c.axisMode ?? 'rate';

    // The shared axis / RT / LT NEVER touch toggle switches — they only adjust
    // ANALOG values. Toggles keep their own dedicated key/button. This prevents
    // adjusting a value from ever flipping a lever ON/OFF.
    if (c.kind !== 'analog') return;

    if (c.centered) {
      // Symmetric control (e.g. joystick). IMPORTANT: only drive it while the
      // stick is actually deflected. When the stick is centered (axis === 0) we
      // must NOT dispatch — otherwise we'd force the joystick back to neutral
      // every frame and stomp on keyboard R/F (run/pull) presses.
      if (axis === 0) return;
      dispatchRef.current(controlId, clamp(axis, -1, 1) * (c.max ?? 1));
      return;
    }

    if (mode === 'absolute') {
      // Axis position → value across the range. Skip when centered so we don't
      // continuously override other inputs while the stick rests.
      if (axis === 0) return;
      dispatchRef.current(controlId, mapRange(axis, -1, 1, c.min ?? 0, c.max ?? 1));
    } else {
      // Rate mode: axis = speed of change; step proportionally while held.
      if (axis === 0) return;
      if (!doRepeat) return; // throttle to the repeat cadence
      const cur = getAnalogRef.current(controlId);
      const step = (c.step ?? (c.max! - c.min!) / 20) * (Math.abs(axis) > 0.85 ? 2 : 1);
      let nv = cur + (axis > 0 ? step : -step);
      nv = Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, nv));
      dispatchRef.current(controlId, nv);
    }
  }, []);

  // ------------------------- KEYBOARD -------------------------
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Rebind capture takes priority.
      if (captureRef.current) {
        const slot = captureRef.current.slot;
        if (slot === 'gamepadButton' || slot === 'gamepadAxis'
          || slot === 'gamepadButtonInc' || slot === 'gamepadButtonDec'
          || slot === 'selectorButton') {
          // Waiting for a gamepad input; Escape cancels.
          if (e.code === 'Escape') setCapture(null);
          return;
        }
        e.preventDefault();
        if (e.code === 'Escape') { setCapture(null); return; }
        applyCapture(slot, e.code);
        return;
      }

      if (!enabledRef.current) return;
      if (isTypingTarget(e.target)) return;
      if (e.repeat) { heldKeys.current.add(e.code); return; }
      heldKeys.current.add(e.code);

      // Selector keys: tap to make a control the active target for its axis.
      const sa = sharedAxesRef.current;
      const map = bindingsRef.current;
      for (const id in map) {
        if (map[id].selectorKey === e.code) {
          e.preventDefault();
          selectTarget(id);
        }
      }
      // Keyboard-driven shared axes (arm a target, then use these keys):
      if (sa.movementUpKey === e.code || sa.movementDownKey === e.code
        || sa.valueUpKey === e.code || sa.valueDownKey === e.code) {
        // handled continuously in the rAF loop via heldKeys
        e.preventDefault();
      }

      // Find controls bound to this key (direct bindings).
      for (const id in map) {
        const b = map[id];
        const c = CONTROLS_BY_ID[id];
        if (!c) continue;
        if (c.kind === 'analog') {
          // Only handle the single-press step here; continuous handled in rAF.
          if (b.keyInc === e.code || b.keyDec === e.code) {
            e.preventDefault();
            stepAnalog(c, b.keyInc === e.code ? 1 : -1);
          }
        } else if (b.key === e.code) {
          e.preventDefault();
          dispatchRef.current(id);
          setStatus((s) => ({ ...s, lastInput: `Key ${e.code}` }));
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [applyCapture, stepAnalog, selectTarget]);

  // ------------------------- GAMEPAD LOOP -------------------------
  useEffect(() => {
    let raf = 0;
    const prevButtons = new Map<number, boolean>(); // buttonIndex -> pressed last frame
    let repeatTimer = 0;
    // For capture edge-detection: require the button to be released once after
    // a capture starts, so a button that's already held (or the same press used
    // to click) doesn't get captured instantly / spuriously.
    let captureArmed = false;
    let lastCaptureKey: string | null = null;

    const getPad = (): Gamepad | null => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p) return p;
      return null;
    };

    const loop = () => {
      const pad = getPad();
      const connected = !!pad;
      setStatus((s) =>
        s.gamepadConnected === connected && s.gamepadId === (pad?.id ?? null)
          ? s
          : { ...s, gamepadConnected: connected, gamepadId: pad?.id ?? null });

      if (pad) {
        const cap = captureRef.current;
        const capKey = cap ? cap.controlId + ':' + cap.slot : null;
        // Reset the "armed" gate whenever a new capture begins.
        if (capKey !== lastCaptureKey) {
          captureArmed = false;
          lastCaptureKey = capKey;
        }
        // ---- Rebind capture from gamepad ----
        if (cap && (cap.slot === 'gamepadButton' || cap.slot === 'gamepadButtonInc' || cap.slot === 'gamepadButtonDec' || cap.slot === 'selectorButton')) {
          const anyPressed = pad.buttons.some((b) => b.pressed);
          if (!captureArmed) {
            // Wait for all buttons released before accepting a press.
            if (!anyPressed) captureArmed = true;
          } else {
            for (let i = 0; i < pad.buttons.length; i++) {
              if (pad.buttons[i].pressed) {
                setStatus((s) => ({ ...s, lastInput: `Pad btn ${i}` }));
                applyCapture(cap.slot, i);
                break;
              }
            }
          }
        } else if (cap && cap.slot === 'gamepadAxis') {
          const anyMoved = pad.axes.some((a) => Math.abs(a) > 0.5);
          if (!captureArmed) {
            if (!anyMoved) captureArmed = true;
          } else {
            for (let i = 0; i < pad.axes.length; i++) {
              if (Math.abs(pad.axes[i]) > 0.5) {
                setStatus((s) => ({ ...s, lastInput: `Pad axis ${i}` }));
                applyCapture(cap.slot, i);
                break;
              }
            }
          }
        } else if (enabledRef.current) {
          const map = bindingsRef.current;
          repeatTimer++;
          const doRepeat = repeatTimer % 4 === 0; // ~15 steps/sec for held step buttons
          for (const id in map) {
            const b = map[id];
            const c = CONTROLS_BY_ID[id];
            if (!c) continue;

            if (c.kind === 'analog') {
              // Direct per-control axis is ONLY allowed for controls that are
              // NOT part of the selector scheme (e.g. the gripper drive on the
              // right stick). Selector-scheme knobs (axisGroup set) are adjusted
              // exclusively via the shared RT/LT on the SELECTED target, so a
              // stale per-control axis binding can never drive an unselected knob.
              if (!c.axisGroup && b.gamepadAxis != null && pad.axes[b.gamepadAxis] != null) {
                let a = pad.axes[b.gamepadAxis];
                if (Math.abs(a) < AXIS_DEADZONE) a = 0;
                if (b.axisInvert) a = -a;
                if (a !== 0) {
                  const val = c.centered
                    ? clamp(a, -1, 1) * (c.max ?? 1)
                    : mapRange(a, -1, 1, c.min ?? 0, c.max ?? 1);
                  dispatchRef.current(id, val);
                }
              }
              // Per-control gamepad step buttons are intentionally NOT handled.
            } else if (b.gamepadButton != null) {
              const pressed = !!pad.buttons[b.gamepadButton]?.pressed;
              const was = prevButtons.get(b.gamepadButton) ?? false;
              if (pressed && !was) {
                dispatchRef.current(id);
                setStatus((s) => ({ ...s, lastInput: `Pad ${b.gamepadButton}` }));
              }
            }

            // Selector button (edge): make this control the active axis target.
            if (b.selectorButton != null) {
              const p = !!pad.buttons[b.selectorButton]?.pressed;
              const w = prevButtons.get(b.selectorButton) ?? false;
              if (p && !w) selectTarget(id);
            }
          }

          // ---- Drive the ACTIVE selector targets from the shared axes ----
          const sa = sharedAxesRef.current;
          const readAxis = (idx: number, invert: boolean) => {
            let a = pad.axes[idx] ?? 0;
            if (Math.abs(a) < AXIS_DEADZONE) a = 0;
            return invert ? -a : a;
          };
          driveTarget(activeMovementRef.current, readAxis(sa.movementAxis, sa.movementInvert), doRepeat);
          driveTarget(activeValueRef.current, readAxis(sa.valueAxis, sa.valueInvert), doRepeat);

          // ---- Shared INC/DEC buttons adjust the currently-SELECTED target ----
          // (e.g. tap S to select Squeeze, then RT = increase / LT = decrease.)
          const btnDown = (i?: number | null) => i != null && !!pad.buttons[i]?.pressed;
          const adjustSelected = (target: string | null, incBtn?: number | null, decBtn?: number | null) => {
            if (!target) return;
            const c = CONTROLS_BY_ID[target];
            if (!c || c.kind !== 'analog') return;
            if (btnDown(incBtn) && doRepeat) stepAnalog(c, 1);
            if (btnDown(decBtn) && doRepeat) stepAnalog(c, -1);
          };
          adjustSelected(activeValueRef.current, sa.valueIncButton, sa.valueDecButton);
          adjustSelected(activeMovementRef.current, sa.movementIncButton, sa.movementDecButton);

          // Record button states for edge detection next frame.
          for (let i = 0; i < pad.buttons.length; i++) prevButtons.set(i, pad.buttons[i].pressed);
        }
      }

      // Continuous keyboard handling (runs even with no gamepad).
      if (enabledRef.current && !captureRef.current) {
        repeatTimer++;
        const doRepeat = repeatTimer % 4 === 0;
        const map = bindingsRef.current;
        // Direct inc/dec keys held for analog controls.
        if (heldKeys.current.size) {
          for (const id in map) {
            const c = CONTROLS_BY_ID[id];
            if (!c || c.kind !== 'analog') continue;
            const b = map[id];
            if (b.keyInc && heldKeys.current.has(b.keyInc) && doRepeat) stepAnalog(c, 1);
            if (b.keyDec && heldKeys.current.has(b.keyDec) && doRepeat) stepAnalog(c, -1);
          }
        }
        // Keyboard-driven SHARED AXES for the active selector targets.
        const sa = sharedAxesRef.current;
        const held = heldKeys.current;
        const mvAxis = (sa.movementUpKey && held.has(sa.movementUpKey) ? 1 : 0)
          + (sa.movementDownKey && held.has(sa.movementDownKey) ? -1 : 0);
        const valAxis = (sa.valueUpKey && held.has(sa.valueUpKey) ? 1 : 0)
          + (sa.valueDownKey && held.has(sa.valueDownKey) ? -1 : 0);
        if (mvAxis !== 0) driveTarget(activeMovementRef.current, mvAxis, doRepeat);
        if (valAxis !== 0) driveTarget(activeValueRef.current, valAxis, doRepeat);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [applyCapture, stepAnalog, selectTarget, driveTarget]);

  return {
    bindings, enabled, setEnabled, status, capture,
    startCapture, cancelCapture, clearBindingSlot, resetAll,
    sharedAxes, setSharedAxes, activeMovementTarget, activeValueTarget, setAxisModeOverride,
  };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function mapRange(v: number, inLo: number, inHi: number, outLo: number, outHi: number) {
  const t = (v - inLo) / (inHi - inLo);
  return outLo + clamp(t, 0, 1) * (outHi - outLo);
}

export type { Binding };
