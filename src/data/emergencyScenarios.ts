import { SimulatorState } from '../types';

/**
 * Interactive Emergency Response Scenarios.
 *
 * Unlike the informational drill tab, these scenarios inject a LIVE fault into
 * the running simulation and require the operator to perform the real response
 * on the physical console controls. Each step auto-validates against live state.
 *
 * All procedures are sourced from the Weatherford CoRod Mobile Gripper
 * Operation Manual (Section 4 Safety + 3.6.4). Section/page references are cited
 * per step.
 */

export type EmergencySeverity = 'critical' | 'high' | 'moderate';

/** Deep-partial patch applied to the hydraulics / rod / bop sub-states. */
export interface EmergencyInject {
  hydraulics?: Partial<SimulatorState['hydraulics']>;
  rod?: Partial<SimulatorState['rod']>;
  bop?: Partial<SimulatorState['bop']>;
}

export interface EmergencyStep {
  id: string;
  /** Short imperative title of the action. */
  title: string;
  /** Full instruction text shown in the HUD. */
  instruction: string;
  /** Manual section / page reference. */
  manualRef: string;
  /**
   * The console control the operator should use for this step. Used by the
   * toggle-able "Show me" hint to highlight the matching control element.
   * These correspond to `data-control-id` attributes on console controls.
   */
  controlId?: string;
  /** Human-readable name of the control (for the hint label). */
  controlName?: string;
  /** Returns true once the operator has completed this step on the console. */
  validationFn: (state: SimulatorState) => boolean;
  /**
   * Optional time limit (seconds) for time-critical steps. If exceeded before
   * completion, `onTimeout` consequences are applied and the step is marked
   * as a partial/failed response (but the drill continues).
   */
  timeLimitSec?: number;
  /** Consequence patch applied to state if the time limit is exceeded. */
  onTimeout?: EmergencyInject;
  /** Message shown when the time limit is exceeded. */
  timeoutMessage?: string;
}

export interface EmergencyScenario {
  id: string;
  /** Maps to SimulatorState.activeEmergency. */
  emergencyKey: SimulatorState['activeEmergency'];
  title: string;
  /** Lucide icon name used by the launcher/HUD. */
  icon: string;
  severity: EmergencySeverity;
  cause: string;
  manualSection: string;
  /** Fault applied to state the moment the emergency is triggered. */
  inject: EmergencyInject;
  steps: EmergencyStep[];
}

// ---------------------------------------------------------------------------
// Helper predicates
// ---------------------------------------------------------------------------
const safetyClampOn = (s: SimulatorState) => s.hydraulics.safetyClampLever === 'ON';
const hornSounded = (s: SimulatorState) => s.airHornSounded;
const rodStopped = (s: SimulatorState) => Math.abs(s.rod.rodSpeedFtPerMin) < 1;
const twoRodClamps = (s: SimulatorState) => s.rod.mechanicalClampsInstalled >= 2;
const oneRodClamp = (s: SimulatorState) => s.rod.mechanicalClampsInstalled >= 1;
const bopClosed = (s: SimulatorState) => s.bop.reganBopClosed || s.hydraulics.bopPressure >= 1000;
const gripperBraked = (s: SimulatorState) => s.hydraulics.gripperBrakeSwitch;
const engineOff = (s: SimulatorState) => !s.hydraulics.engineRunning;
const eStopTripped = (s: SimulatorState) => s.hydraulics.emergencyStopTripped;
const operationStopped = (s: SimulatorState) =>
  s.hydraulics.gripperBrakeSwitch || Math.abs(s.rod.rodSpeedFtPerMin) < 1;

// ===========================================================================
// EMERGENCY SCENARIOS
// ===========================================================================
export const EMERGENCY_SCENARIOS: EmergencyScenario[] = [
  // -------------------------------------------------------------------------
  // 1. FREEFALLING ROD / LOSS OF GRIP
  // -------------------------------------------------------------------------
  {
    id: 'emg-freefall',
    emergencyKey: 'freefalling_rod',
    title: 'Freefalling Rod / Loss of Grip',
    icon: 'ArrowDownToLine',
    severity: 'critical',
    cause:
      'The injector has lost grip on the COROD string and it is falling downhole out of control.',
    manualSection: '§4.18 Emergency Response Procedure (p. 84)',
    inject: {
      hydraulics: { chargePressure: 180, squeezePressure: 0, squeezePressureSwitch: false },
      rod: { rodGripSlipping: true, rodInTensionOrCompression: 'freefall' },
    },
    steps: [
      {
        id: 'ff-1',
        title: 'Activate the Safety Clamp',
        instruction:
          'IMMEDIATELY move the Safety valve lever DOWN (ON) to engage the Rod Safety Clamp and arrest the falling string. Every second counts.',
        manualRef: '§4.18 Step 1 (p. 84)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: safetyClampOn,
        timeLimitSec: 8,
        onTimeout: { rod: {} },
        timeoutMessage:
          'Too slow! The rod fell further before the clamp engaged. In a real event this risks a dropped string.',
      },
      {
        id: 'ff-2',
        title: 'Signal the Emergency',
        instruction: 'Sound ONE long air horn blast to alert all personnel on the lease.',
        manualRef: '§4.18 Step 2 (p. 84)',
        controlId: 'ctrl-horn',
        controlName: 'Air Horn',
        validationFn: hornSounded,
      },
      {
        id: 'ff-3',
        title: 'Confirm Rod Has Stopped',
        instruction:
          'Wait for the rod to come to a complete stop. Do not approach the well until movement has ceased.',
        manualRef: '§4.18 Step 4 (p. 84)',
        validationFn: (s) => safetyClampOn(s) && rodStopped(s),
      },
      {
        id: 'ff-4',
        title: 'Install Two Rod Clamps',
        instruction:
          'Return to the well and install TWO COROD rod clamps. The safety accumulator only holds pressure for a limited time.',
        manualRef: '§4.18 Step 5 + WARNING (p. 84)',
        controlId: 'ctrl-install-clamp',
        controlName: 'Install Clamp',
        validationFn: twoRodClamps,
        timeLimitSec: 45,
        onTimeout: { hydraulics: { safetyPressure: 500 } },
        timeoutMessage:
          'Safety accumulator pressure is depleting — install the rod clamps before it can no longer hold!',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. LOW CHARGE PRESSURE
  // -------------------------------------------------------------------------
  {
    id: 'emg-charge',
    emergencyKey: 'charge_pressure_loss',
    title: 'Low Charge Pressure',
    icon: 'Gauge',
    severity: 'high',
    cause:
      'Charge pressure has dropped below 250 psi. The gripper motors may freewheel, risking loss of the string.',
    manualSection: '§3.6.4 WARNING (p. 40) / §4.18',
    inject: {
      hydraulics: { chargePressure: 210 },
    },
    steps: [
      {
        id: 'cp-1',
        title: 'Engage the Rod Safety Clamp',
        instruction:
          'Charge pressure has fallen below 250 psi. Move the Safety lever DOWN (ON) to engage the Rod Safety Clamp before the motors freewheel.',
        manualRef: '§3.6.4 WARNING (p. 40)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: safetyClampOn,
        timeLimitSec: 12,
        onTimeout: {
          hydraulics: { chargePressure: 150 },
          rod: { rodGripSlipping: true, rodInTensionOrCompression: 'freefall' },
        },
        timeoutMessage:
          'Charge pressure kept falling — the motors began to freewheel and the rod started to slip!',
      },
      {
        id: 'cp-2',
        title: 'Install a COROD Clamp',
        instruction:
          'Install the appropriate COROD clamp to mechanically secure the string until the cause of the pressure loss is determined.',
        manualRef: '§3.6.4 WARNING (p. 40)',
        controlId: 'ctrl-install-clamp',
        controlName: 'Install Clamp',
        validationFn: oneRodClamp,
      },
      {
        id: 'cp-3',
        title: 'Stop Operations',
        instruction:
          'Bring the joystick to neutral / apply the gripper brake. Do not resume tripping until the charge pressure fault is resolved.',
        manualRef: '§3.6.4 (p. 40)',
        controlId: 'ctrl-joystick-y',
        controlName: 'Drive Joystick',
        validationFn: operationStopped,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. WELL BLOWOUT / KICK
  // -------------------------------------------------------------------------
  {
    id: 'emg-blowout',
    emergencyKey: 'well_kick',
    title: 'Well Blowout / Kick',
    icon: 'Waves',
    severity: 'critical',
    cause: 'A well kick has been detected. The well must be shut in immediately.',
    manualSection: '§4.19 Emergency Well Blowout Drill (p. 85)',
    inject: {
      // Well kick is tracked via activeEmergency='well_kick'; no BOP field change
      // is needed at injection (the operator will close the BOP as the response).
      hydraulics: {},
    },
    steps: [
      {
        id: 'bo-1',
        title: 'Sound the Alarm',
        instruction: 'Sound one long, loud, steady air horn blast to alert the crew of the kick.',
        manualRef: '§4.19 (p. 85)',
        controlId: 'ctrl-horn',
        controlName: 'Air Horn',
        validationFn: hornSounded,
      },
      {
        id: 'bo-2',
        title: 'Apply the Brake',
        instruction:
          'If tripping, apply the gripper brake to stop the string movement immediately.',
        manualRef: '§4.19 (p. 85)',
        controlId: 'ctrl-switch-injectorbrake',
        controlName: 'Injector / Gripper Brake',
        validationFn: gripperBraked,
        timeLimitSec: 15,
        timeoutMessage: 'The string kept moving during a live kick — apply the brake!',
      },
      {
        id: 'bo-3',
        title: 'Close the BOP',
        instruction:
          'Shut in the well: pump the Regan BOP up to 1250 psi to close it and contain the kick.',
        manualRef: '§4.19 (p. 85)',
        controlId: 'ctrl-bop-pump',
        controlName: 'BOP Hand Pump / Pump Switch',
        validationFn: bopClosed,
        timeLimitSec: 40,
        timeoutMessage: 'The well is still flowing — get the BOP closed to shut it in!',
      },
      {
        id: 'bo-4',
        title: 'Install a Rod Clamp',
        instruction: 'Install a rod clamp to secure the string with the well shut in.',
        manualRef: '§4.19 (p. 85)',
        controlId: 'ctrl-install-clamp',
        controlName: 'Install Clamp',
        validationFn: oneRodClamp,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. H2S GAS RELEASE / MAN DOWN
  // -------------------------------------------------------------------------
  {
    id: 'emg-h2s',
    emergencyKey: 'h2s_alarm',
    title: 'H2S Gas Release / Man Down',
    icon: 'Skull',
    severity: 'critical',
    cause:
      'H2S gas has been detected and a worker near the well has been overcome and is down.',
    manualSection: '§4.20 H2S Emergency – Man Down Drill (p. 86)',
    inject: {
      hydraulics: {},
    },
    steps: [
      {
        id: 'h2s-1',
        title: 'Raise the Alarm',
        instruction: 'Sound one long blast on the rig air horn to signal the H2S emergency.',
        manualRef: '§4.20 Step 2 (p. 86)',
        controlId: 'ctrl-horn',
        controlName: 'Air Horn',
        validationFn: hornSounded,
      },
      {
        id: 'h2s-2',
        title: 'Secure the Well (if safe)',
        instruction:
          'If necessary and safe, activate the Safety Clamp and inflate the BOP before leaving the console.',
        manualRef: '§4.20 Step 3 (p. 86)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: (s) => safetyClampOn(s),
      },
      {
        id: 'h2s-3',
        title: 'Evacuate to Muster Point',
        instruction:
          'Evacuate upwind to the designated muster point. Account for all personnel before any rescue.',
        manualRef: '§4.20 Steps 4-5 (p. 86)',
        controlId: 'ctrl-evacuate',
        controlName: 'Evacuate to Muster',
        validationFn: (s) => s.evacuatedToMuster,
      },
      {
        id: 'h2s-4',
        title: 'Don SCBA',
        instruction:
          'Put on Self-Contained Breathing Apparatus before re-entering the contaminated area to rescue the man down.',
        manualRef: '§4.20 Step 6 (p. 86)',
        controlId: 'ctrl-scba',
        controlName: 'Equip SCBA',
        validationFn: (s) => s.scbaEquipped,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. ENGINE / POWER-TRAIN FAILURE
  // -------------------------------------------------------------------------
  {
    id: 'emg-engine',
    emergencyKey: 'freefalling_rod', // shares the freefall-risk physics
    title: 'Engine / Power-Train Failure',
    icon: 'PowerOff',
    severity: 'critical',
    cause:
      'The engine or power train has failed. Hydraulic pressure is bleeding down and the string is at risk of freefalling.',
    manualSection: '§4.18 potential-freefall causes (p. 84)',
    inject: {
      hydraulics: { engineRunning: false, engineRpm: 0, chargePressure: 200 },
      rod: { rodGripSlipping: true },
    },
    steps: [
      {
        id: 'en-1',
        title: 'Engage the Safety Clamp',
        instruction:
          'Power is lost. IMMEDIATELY move the Safety lever DOWN (ON) — the accumulator holds enough reserve to close the clamp without hydraulics.',
        manualRef: '§4.18 + WARNING (p. 84)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: safetyClampOn,
        timeLimitSec: 8,
        onTimeout: { rod: { rodInTensionOrCompression: 'freefall' } },
        timeoutMessage: 'With no hydraulics the string began to freefall — clamp it NOW!',
      },
      {
        id: 'en-2',
        title: 'Signal the Emergency',
        instruction: 'Sound one long air horn blast to alert all personnel.',
        manualRef: '§4.18 Step 2 (p. 84)',
        controlId: 'ctrl-horn',
        controlName: 'Air Horn',
        validationFn: hornSounded,
      },
      {
        id: 'en-3',
        title: 'Install Two Rod Clamps',
        instruction:
          'Install two rod clamps quickly — the safety accumulator only maintains pressure for a limited time.',
        manualRef: '§4.18 Step 5 + WARNING (p. 84)',
        controlId: 'ctrl-install-clamp',
        controlName: 'Install Clamp',
        validationFn: twoRodClamps,
        timeLimitSec: 45,
        onTimeout: { hydraulics: { safetyPressure: 500 } },
        timeoutMessage: 'Accumulator pressure depleting — install the clamps before it drops!',
      },
      {
        id: 'en-4',
        title: 'Hit the Emergency Shut Down',
        instruction:
          'With the clamp engaged and string secured, trip the Emergency Shut Down switch.',
        manualRef: '§4.18 (p. 84)',
        controlId: 'ctrl-estop-j',
        controlName: 'Emergency Shut Down',
        validationFn: eStopTripped,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. HYDRAULIC SYSTEM FAILURE
  // -------------------------------------------------------------------------
  {
    id: 'emg-hydraulic',
    emergencyKey: 'hydraulic_overheat',
    title: 'Hydraulic System Failure',
    icon: 'Droplets',
    severity: 'high',
    cause:
      'A hydraulic system/hose failure has caused a loss of system pressure. The string may lose grip.',
    manualSection: '§4.18 potential-freefall causes (p. 84)',
    inject: {
      hydraulics: { systemPressure: 400, squeezePressure: 0, hydraulicFluidTempC: 78 },
      rod: { rodGripSlipping: true },
    },
    steps: [
      {
        id: 'hy-1',
        title: 'Engage the Safety Clamp',
        instruction:
          'System pressure has collapsed. Move the Safety lever DOWN (ON) to secure the string on the accumulator reserve.',
        manualRef: '§4.18 + WARNING (p. 84)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: safetyClampOn,
        timeLimitSec: 10,
        onTimeout: { rod: { rodInTensionOrCompression: 'freefall' } },
        timeoutMessage: 'Grip lost with no system pressure — the string began to slip!',
      },
      {
        id: 'hy-2',
        title: 'Signal the Emergency',
        instruction: 'Sound one long air horn blast to alert all personnel.',
        manualRef: '§4.18 Step 2 (p. 84)',
        controlId: 'ctrl-horn',
        controlName: 'Air Horn',
        validationFn: hornSounded,
      },
      {
        id: 'hy-3',
        title: 'Install Two Rod Clamps',
        instruction: 'Install two rod clamps to mechanically secure the string.',
        manualRef: '§4.18 Step 5 (p. 84)',
        controlId: 'ctrl-install-clamp',
        controlName: 'Install Clamp',
        validationFn: twoRodClamps,
      },
      {
        id: 'hy-4',
        title: 'Emergency Shut Down',
        instruction: 'With the string secured, trip the Emergency Shut Down switch.',
        manualRef: '§4.18 (p. 84)',
        controlId: 'ctrl-estop-j',
        controlName: 'Emergency Shut Down',
        validationFn: eStopTripped,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. LIGHTNING / SEVERE WEATHER
  // -------------------------------------------------------------------------
  {
    id: 'emg-lightning',
    emergencyKey: 'lightning_warning',
    title: 'Lightning / Severe Weather',
    icon: 'CloudLightning',
    severity: 'moderate',
    cause:
      'A thunderstorm has moved in. Under the 30-30 rule (strikes < 30 s apart) the crew must leave the rig and shelter.',
    manualSection: '§4.24 Lightning Safety (p. 101)',
    inject: {
      hydraulics: {},
    },
    steps: [
      {
        id: 'lt-1',
        title: 'Stop Operations',
        instruction:
          'Stop working on the Corig. Bring the joystick to neutral / apply the gripper brake.',
        manualRef: '§4.24 (p. 101)',
        controlId: 'ctrl-switch-injectorbrake',
        controlName: 'Injector / Gripper Brake',
        validationFn: operationStopped,
      },
      {
        id: 'lt-2',
        title: 'Secure the String',
        instruction:
          'Engage the Rod Safety Clamp so the string is held while the rig is left unattended.',
        manualRef: '§4.24 (p. 101)',
        controlId: 'ctrl-lever-safety',
        controlName: 'Safety Clamp Lever',
        validationFn: safetyClampOn,
      },
      {
        id: 'lt-3',
        title: 'Shut Down the Engine',
        instruction: 'Shut down the engine before leaving the console.',
        manualRef: '§4.24 (p. 101)',
        controlId: 'ctrl-estop-j',
        controlName: 'Emergency Shut Down',
        validationFn: (s) => engineOff(s) || eStopTripped(s),
      },
      {
        id: 'lt-4',
        title: 'Seek Shelter (Evacuate)',
        instruction:
          'Leave the rig as it is and seek shelter in the crew truck or doghouse. Remain 30 minutes after the last thunder (30-30 rule).',
        manualRef: '§4.24 (p. 101)',
        controlId: 'ctrl-evacuate',
        controlName: 'Evacuate to Shelter',
        validationFn: (s) => s.evacuatedToMuster,
      },
    ],
  },
];

export const getEmergencyScenario = (id: string): EmergencyScenario | undefined =>
  EMERGENCY_SCENARIOS.find((e) => e.id === id);
