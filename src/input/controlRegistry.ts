/**
 * Control Registry — the single source of truth for EVERY operator control that
 * can be bound to a keyboard key or gamepad button/axis.
 *
 * Three control kinds:
 *  - 'action'  : momentary trigger (fires once per press). e.g. Air Horn, E-Stop.
 *  - 'toggle'  : boolean flip (or on/off). Bound to a single press.
 *  - 'analog'  : continuous value with min/max. Can be driven by a gamepad AXIS
 *                (mapped across the range) OR by +/- step buttons/keys.
 *
 * The dispatcher in App.tsx receives (controlId, value?) and applies the change.
 */

export type ControlKind = 'action' | 'toggle' | 'analog';

/**
 * Shared-axis groups for the "selector + axis" scheme:
 *  - 'movement' : driven by the shared MOVEMENT axis (default left-stick Y)
 *  - 'value'    : driven by the shared VALUE axis (default right-stick Y)
 *  - undefined  : not part of the selector scheme
 */
export type AxisGroup = 'movement' | 'value';

/** How the shared axis maps onto the control while it's the active selector. */
export type AxisMode = 'rate' | 'absolute';

export interface ControlDef {
  id: string;
  label: string;
  category: string;
  kind: ControlKind;
  /** For analog controls: value range + a keyboard/button step increment. */
  min?: number;
  max?: number;
  step?: number;
  /** Optional: analog controls that are symmetric around 0 (e.g. joystick). */
  centered?: boolean;
  /** Human hint shown in the bindings panel. */
  hint?: string;
  /** Which shared axis this control is driven by when it is the active selector. */
  axisGroup?: AxisGroup;
  /** Default axis mapping mode (user-overridable). */
  axisMode?: AxisMode;
}

export const CONTROL_CATEGORIES = [
  'Drive & Trip',
  'Engine & Power',
  'Gripper / Clamp',
  'BOP & Well Control',
  'Pressures (Analog)',
  'Switches',
  'Rig-Up / Safety',
  'Emergency',
  'Misc',
] as const;

export const CONTROLS: ControlDef[] = [
  // ---------------- Drive & Trip ----------------
  { id: 'trip.rih', label: 'Trip Mode: RIH (Run In Hole)', category: 'Drive & Trip', kind: 'action' },
  { id: 'trip.pooh', label: 'Trip Mode: POOH (Pull Out Of Hole)', category: 'Drive & Trip', kind: 'action' },
  { id: 'trip.free', label: 'Trip Mode: FREE (Mid-well)', category: 'Drive & Trip', kind: 'action' },
  { id: 'drive.run', label: 'Drive: RUN (RIH)', category: 'Drive & Trip', kind: 'action' },
  { id: 'drive.pull', label: 'Drive: PULL (POOH)', category: 'Drive & Trip', kind: 'action' },
  { id: 'drive.stop', label: 'Drive: STOP', category: 'Drive & Trip', kind: 'action' },
  {
    id: 'joystick', label: 'Gripper Drive (Right Stick: ↑POOH / ↓RIH)', category: 'Drive & Trip', kind: 'analog',
    min: -1, max: 1, step: 0.15, centered: true,
    hint: 'Always driven by the right stick — up = POOH, down = RIH.',
  },
  {
    id: 'depth', label: 'Depth (ft)', category: 'Drive & Trip', kind: 'analog',
    min: 0, max: 4500, step: 100, axisGroup: 'value', axisMode: 'rate',
  },

  // ---------------- Engine & Power ----------------
  { id: 'engine.toggle', label: 'Engine On/Off', category: 'Engine & Power', kind: 'toggle' },
  { id: 'pto.toggle', label: 'PTO / Transmission Engage', category: 'Engine & Power', kind: 'toggle' },
  {
    id: 'engine.rpm', label: 'Engine RPM', category: 'Engine & Power', kind: 'analog',
    min: 1000, max: 1300, step: 25, axisGroup: 'value', axisMode: 'rate',
  },

  // ---------------- Gripper / Clamp ----------------
  { id: 'clamp.install', label: 'Install Mechanical Clamp', category: 'Gripper / Clamp', kind: 'action' },
  { id: 'clamp.remove', label: 'Remove Mechanical Clamp', category: 'Gripper / Clamp', kind: 'action' },
  { id: 'gripperBrake.toggle', label: 'Gripper Brake Switch', category: 'Gripper / Clamp', kind: 'toggle' },
  { id: 'squeezeSwitch.toggle', label: 'Squeeze Pressure Switch', category: 'Gripper / Clamp', kind: 'toggle' },
  { id: 'chainTensionSwitch.toggle', label: 'Chain Tension Switch', category: 'Gripper / Clamp', kind: 'toggle' },
  { id: 'safetyClamp.toggle', label: 'Safety Clamp Lever', category: 'Gripper / Clamp', kind: 'toggle' },

  // ---------------- BOP & Well Control ----------------
  { id: 'bop.toggleClosed', label: 'BOP Open/Close', category: 'BOP & Well Control', kind: 'toggle' },
  { id: 'bop.handPump', label: 'Stroke BOP Hand Pump', category: 'BOP & Well Control', kind: 'action' },
  { id: 'bop.pump.toggle', label: 'BOP Pump Switch', category: 'BOP & Well Control', kind: 'toggle' },
  { id: 'bop.bleed.toggle', label: 'BOP Bleed Valve', category: 'BOP & Well Control', kind: 'toggle' },
  { id: 'flowTee.toggle', label: 'Flow Tee (Kill) Valve', category: 'BOP & Well Control', kind: 'toggle' },
  {
    id: 'bop.regulator', label: 'BOP Regulator (PSI)', category: 'BOP & Well Control', kind: 'analog',
    min: 1000, max: 1250, step: 10, axisGroup: 'value', axisMode: 'rate',
  },

  // ---------------- Pressures (Analog) ----------------
  {
    id: 'press.up', label: 'Up Pressure Target (POOH)', category: 'Pressures (Analog)', kind: 'analog',
    min: 1000, max: 3200, step: 50, axisGroup: 'value', axisMode: 'rate',
  },
  {
    id: 'press.down', label: 'Down Pressure Target (RIH)', category: 'Pressures (Analog)', kind: 'analog',
    min: 200, max: 1500, step: 50, axisGroup: 'value', axisMode: 'rate',
  },
  {
    id: 'press.squeeze', label: 'Squeeze Pressure Target', category: 'Pressures (Analog)', kind: 'analog',
    min: 400, max: 2500, step: 50, axisGroup: 'value', axisMode: 'rate',
  },
  {
    id: 'press.chainTension', label: 'Chain Tension Target', category: 'Pressures (Analog)', kind: 'analog',
    min: 100, max: 600, step: 25, axisGroup: 'value', axisMode: 'rate',
  },
  {
    id: 'press.airRegulator', label: 'Air Regulator (PSI)', category: 'Pressures (Analog)', kind: 'analog',
    min: 0, max: 200, step: 5, axisGroup: 'value', axisMode: 'rate',
  },

  // ---------------- Switches ----------------
  { id: 'safetyBleed.toggle', label: 'Safety Bleed Valve', category: 'Switches', kind: 'toggle' },
  { id: 'chainOiler.toggle', label: 'Chain Oiler', category: 'Switches', kind: 'toggle' },
  { id: 'panelLights.toggle', label: 'Panel Lights', category: 'Switches', kind: 'toggle' },
  { id: 'tankHeater.toggle', label: 'Hydraulic Tank Heater', category: 'Switches', kind: 'toggle' },

  // ---------------- Rig-Up / Safety ----------------
  { id: 'reelForks.toggle', label: 'Reel Safety Forks', category: 'Rig-Up / Safety', kind: 'toggle' },
  { id: 'containment.attach', label: 'Attach Containment Device', category: 'Rig-Up / Safety', kind: 'action' },
  { id: 'tapTest', label: 'Tap / Bump Test', category: 'Rig-Up / Safety', kind: 'action' },

  // ---------------- Emergency ----------------
  { id: 'estop.trip', label: 'EMERGENCY STOP', category: 'Emergency', kind: 'action' },
  { id: 'estop.reset', label: 'Emergency Reset', category: 'Emergency', kind: 'action' },

  // ---------------- Misc ----------------
  { id: 'airHorn', label: 'Air Horn', category: 'Misc', kind: 'action' },
  { id: 'sound.toggle', label: 'Toggle Sound', category: 'Misc', kind: 'toggle' },
];

export const CONTROLS_BY_ID: Record<string, ControlDef> = Object.fromEntries(
  CONTROLS.map((c) => [c.id, c]),
);
