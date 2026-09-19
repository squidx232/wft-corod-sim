import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulatorState,
  SimulatorTab,
  DifficultyLevel,
  TelemetryPoint,
  AssessmentOperator,
  AssessmentSession,
  AssessmentEvent,
  AssessmentDifficulty,
  LeaderboardEntry,
  LogbookEntry,
} from './types';
import { ROD_SPECIFICATIONS, SQUEEZE_PRESSURE_CURVES } from './data/manualReference';
import { requiredSqueezeForWeight } from './data/injectorProfiles';
import {
  loadAllInjectorProfiles,
  loadEquipmentSelection,
  saveEquipmentSelection,
} from './utils/equipmentConfig';
import {
  loadAllWellDesigns,
  loadActiveWellDesignId,
  saveActiveWellDesignId,
} from './utils/wellDesigns';
import {
  wellDesignTotalDepthFt,
  weightAtDepth,
  stringWeightAtDepth,
  currentWellStage,
} from './data/wellDesigns';
import { WellSetupPanel } from './components/WellSetupPanel';
import {
  EMERGENCY_SCENARIOS,
  getEmergencyScenario,
  getRandomEmergencyQueue,
} from './data/emergencyScenarios';
import { computeAssessmentReport } from './utils/assessmentScore';
import { addLeaderboardEntry } from './utils/leaderboard';
import { AssessmentPanel } from './components/AssessmentPanel';
import { AssessmentHud } from './components/AssessmentHud';
import { AssessmentReportModal } from './components/AssessmentReportModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { IntroSplash } from './components/IntroSplash';
import { useInputSystem } from './input/useInputSystem';
import { ControlBindingsPanel } from './components/ControlBindingsPanel';
import { InputStatusHud } from './components/InputStatusHud';
import { StatusBanner } from './components/StatusBanner';
import { GlossaryModal } from './components/GlossaryModal';
import { soundManager } from './utils/audio';
import { OperatorStationView } from './components/OperatorStationView';
import { AuxiliaryPanels } from './components/AuxiliaryPanels';
import { ScenarioRunner } from './components/ScenarioRunner';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { EmergencyDrillModal } from './components/EmergencyDrillModal';
import { ManualReferenceModal } from './components/ManualReferenceModal';
import { JsaModal } from './components/JsaModal';
import { EngineStartModal } from './components/EngineStartModal';
import { EmergencyResponseHud } from './components/EmergencyResponseHud';
import { Rig3DViewport } from './components/Rig3DViewport';
import { WeatherfordControlConsole } from './components/WeatherfordControlConsole';
import { Button, Badge, SegmentedControl, cx } from './components/ui';
import { useT } from './i18n';

import {
  Gauge,
  Sliders,
  BookOpen,
  ShieldAlert,
  Activity,
  FileText,
  Volume2,
  VolumeX,
  HelpCircle,
  Boxes,
  Power,
  Globe,
} from 'lucide-react';

const INITIAL_STATE: SimulatorState = {
  hydraulics: {
    chargePressure: 0,
    systemPressure: 0,
    pickerPressure: 0,
    chainTensionPressure: 150,
    squeezePressure: 800,
    safetyPressure: 2800,
    downPressure: 1500,
    upPressure: 1200,
    bopPressure: 0,
    chainTensionTarget: 150,
    squeezePressureTarget: 800,
    upPressureTarget: 1200,
    downPressureTarget: 1500,
    hydraulicFluidTempC: 38,
    ambientTempC: 18,
    ptoEngaged: false, // PTO engaged as part of the engine start sequence
    engineRunning: false, // Engine starts OFF — operator must run the start sequence
    engineRpm: 0,
    chainTensionSwitch: true,
    squeezePressureSwitch: true,
    gripperBrakeSwitch: false,
    safetyClampLever: 'OFF',
    safetyBleedValveOpen: false,
    safetyPressureTarget: 2800, // Nominal safety pressure target (knob-adjustable)
    emergencyStopTripped: false,
    rodaValveClosed: false,
    coolerBypassMode: 'AUTO',
    enginePreheaterOn: false,
    hydraulicTankHeaterOpen: false,
    chainOilerOn: true,
    panelLightsOn: true,
    airRegulatorPsi: 120,
    safetyAccumulatorCharge: 1200,
    pressureBeamAccumulatorCharge: 900,
  },
  bop: {
    reganBopClosed: false,
    airSupplyPsi: 120,
    bopRegulatorPsi: 1250,
    bopPumpSwitch: false,
    bopBleedOpen: false,
    handPumpStrokes: 0,
    flowTeeValveOpen: false,
    hammerUnionTight: true,
    spacerPlateInstalled: true,
  },
  rod: {
    rodGrade: 'DE',
    rodShape: 'round',
    rodSize: '#6R',
    totalWellDepthFt: 4500,
    currentDepthFt: 0, // Starts at surface for RIH
    rodSpeedFtPerMin: 0,
    linearWeightLbsPerFt: 2.67,
    totalStringWeightLbs: 0,
    calculatedSqueezeRequiredPsi: 400,
    rodCenteredInGripper: true,
    rodGripSlipping: false,
    rodInTensionOrCompression: 'neutral',
    isLandedOnTagBar: false,
    isObstructed: false,
    hasLeaderCable: true,
    hasBulletOnPin: true,
    hasElevatorOnString: false,
    mechanicalClampsInstalled: 0,
    clampTorqueFtLbs: 0,
    bumpTestPassed: false,
    containmentDeviceAttached: false,
    reelSafetyForksInPlace: true,
    rodWearDiameterInchX: 0.945,
    rodWearDiameterInchY: 0.940,
  },
  outriggers: {
    leftExtended: true,
    rightExtended: true,
    leftLowered: true,
    rightLowered: true,
    woodenPadsUnderLeft: true,
    woodenPadsUnderRight: true,
    truckLeveled: true,
    rearWheelsOnGround: true,
    wheelChocksPlaced: true,
    outriggerLatchesEngaged: true,
  },
  picker: {
    craneLockoutValveOpen: true,
    telescopeLengthFt: 12,
    angleDegrees: 35,
    rotationDegrees: 15,
    currentLiftWeightLbs: 0,
    maxRatedLoadAtReachLbs: 4993,
    overloaded: false,
  },
  yTool: {
    poweredOn: true,
    nitrogenPressurePsi: 60,
    displayMode: 'dimensions',
    unitSystem: 'imperial',
    alarmSounding: false,
    alarmVisual: false,
    calibrated: true,
    measuredDiameterX: 0.945,
    measuredDiameterY: 0.940,
    depthReadingFt: 0,
  },
  joystickPosition: 0,
  equipmentConfig: {
    activeInjectorProfileId: 'preset-standard-mg',
    measurementUnits: 'imperial',
  },
  activeWellDesignId: null,
  alarmTier: 'none',
  alarmSince: null,
  alarmLockout: false,
  activeTab: 'console',
  difficulty: 'operator',
  activeScenarioId: 'scenario-4-install',
  currentStepIndex: 0,
  scenarioTimeElapsedSeconds: 0,
  scenarioCompleted: false,
  isSimulating: true,
  simulationSpeedMultiplier: 1.0,
  soundEnabled: false,
  engineStartSequenceComplete: false,
  activeEmergency: 'none',
  emergencyTriggerTime: null,
  emergencyResolved: false,
  emergencyScenarioId: null,
  emergencyStepIndex: 0,
  assessment: null,
  airHornSounded: false,
  evacuatedToMuster: false,
  scbaEquipped: false,
  fishingSocketAssembled: false,
  rodSampleCut: false,
  telemetry: [],
  performance: {
    operatorName: 'Hassan Hany',
    overallScore: 94,
    safetyScore: 98,
    hydraulicEfficiencyScore: 92,
    emergencyReactionTimeMs: 1420,
    completedScenarios: ['scenario-1-pretrip', 'scenario-2-rigup'],
    completedDrills: ['BOP Rapid Shut-In Drill'],
    penalties: [],
    competencyPillars: {
      wellControl: 95,
      rigStability: 96,
      hydraulicRegulation: 92,
      emergencyReaction: 98,
      proceduralAccuracy: 90,
    },
  },
  logbook: [
    {
      id: 'log-prev-1',
      date: '2026-08-20',
      wellLocation: 'Pembina Cardium 04-12-048-09W5',
      unitNumber: 'MG-408',
      operatorName: 'Hassan Hany',
      jobType: 'surface',
      rodType: 'DE #6R Round',
      maxDepthFt: 4500,
      totalWeightLbs: 12015,
      inspectionsCompleted: {
        walkaround: true,
        positiveAirShutdown: true,
        rodSafetyAccumulator10MinTest: true,
        bopTest1250Psi: true,
        knucklePickerInspection: true,
        rodElevatorsCheck: true,
        hydraulicFluidUnivisN32: true,
        wireRopesSlings: true,
      },
      drillsConducted: ['BOP Rapid Shut-In Drill', 'Positive Air Shutdown Check'],
      safetyScore: 98,
      comments: 'Clean job execution. Well stabilized and safety clamp tested before tripping.',
      certifiedStamp: true,
    },
  ],
};

// ======================================================================
// MULTI-SCREEN SUPPORT — BroadcastChannel state sync
// Open ?view=3d or ?view=console or ?view=gauges in a new window on
// another monitor. State is synced in real-time via BroadcastChannel.
// ======================================================================
const BROADCAST_CHANNEL_NAME = 'corod-sim-state';

function useMultiScreenSync(
  state: SimulatorState,
  setState: React.Dispatch<React.SetStateAction<SimulatorState>>,
  isSecondary: boolean,
) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastRef = useRef(0);
  const isSecondaryRef = useRef(isSecondary);
  isSecondaryRef.current = isSecondary;

  useEffect(() => {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === 'state-update') {
        // Only SECONDARY windows accept full-state snapshots (from the primary).
        // The primary must never overwrite its own authoritative state with an
        // echo (which could arrive from another window).
        if (isSecondaryRef.current) setState(e.data.state);
      } else if (e.data?.type === 'state-patch') {
        // Only the PRIMARY applies control patches sent by secondary windows.
        // It then re-broadcasts authoritative state on its next tick. Secondary
        // windows ignore patches (they never receive their own echo, and should
        // not act on other secondaries' patches).
        if (!isSecondaryRef.current) {
          setState((prev) => ({ ...prev, ...e.data.patch }));
          // Immediately re-broadcast so the originating pop-up sees the applied
          // value without waiting up to a full tick (prevents the visible
          // "snap back then apply" flicker).
          setState((prev) => {
            channelRef.current?.postMessage({ type: 'state-update', state: prev });
            return prev;
          });
        }
      }
    };
    return () => ch.close();
  }, [setState]);

  // Primary window broadcasts state changes (throttled to ~20fps)
  useEffect(() => {
    if (isSecondary) return;
    const now = Date.now();
    if (now - lastBroadcastRef.current < 50) return; // 20fps throttle
    lastBroadcastRef.current = now;
    channelRef.current?.postMessage({ type: 'state-update', state });
  }, [state, isSecondary]);

  // Secondary windows broadcast control changes back to primary
  const broadcastPatch = useCallback((patch: Partial<SimulatorState>) => {
    channelRef.current?.postMessage({ type: 'state-patch', patch });
  }, []);

  return { broadcastPatch };
}

// ---------------------------------------------------------------------------
// Assessment event helpers (pure) — patch the last/active event record on the
// live assessment session immutably. Returns input unchanged when no run is
// active or there are no events yet.
// ---------------------------------------------------------------------------
function patchLastEvent(
  events: AssessmentEvent[],
  fn: (ev: AssessmentEvent) => AssessmentEvent,
): AssessmentEvent[] {
  if (!events.length) return events;
  const copy = [...events];
  copy[copy.length - 1] = fn(copy[copy.length - 1]);
  return copy;
}

function patchActiveAssessmentEvent(
  prev: SimulatorState,
  fn: (ev: AssessmentEvent) => AssessmentEvent,
): AssessmentSession | null {
  const a = prev.assessment;
  if (!a || !a.active || a.ended || a.events.length === 0) return a;
  return { ...a, events: patchLastEvent(a.events, fn) };
}

function getViewMode(): 'full' | '3d' | 'console' | 'gauges' | 'controls' {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === '3d' || view === 'console' || view === 'gauges' || view === 'controls') return view;
  return 'full';
}

export default function App() {
  const { t, tData, lang, toggle: toggleLang } = useT();
  const [state, setState] = useState<SimulatorState>(INITIAL_STATE);
  const viewMode = useRef(getViewMode()).current;
  const isSecondary = viewMode !== 'full';
  const { broadcastPatch } = useMultiScreenSync(state, setState, isSecondary);

  // Per-WINDOW (local) audio enable. This is NOT synced across windows, so each
  // pop-up (3D / console / gauges) and the main dashboard can be muted
  // independently — otherwise running multiple windows plays every sound 2–3×.
  // Secondary pop-ups default to MUTED so opening them doesn't stack audio; the
  // operator can enable sound on whichever window they want to hear.
  const [localAudioOn, setLocalAudioOn] = useState<boolean>(viewMode === 'full');
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showJsaModal, setShowJsaModal] = useState<boolean>(false);
  const [showEngineStartModal, setShowEngineStartModal] = useState<boolean>(false);
  const [activeDrillType, setActiveDrillType] = useState<'freefall' | 'blowout' | 'h2s' | 'overheat' | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Available injector profiles (presets + saved custom), loaded once and kept
  // in a ref so the physics tick can read the active profile's curve without
  // re-subscribing. Refreshed when the operator saves/deletes profiles.
  const injectorProfilesRef = useRef(loadAllInjectorProfiles());
  const [injectorProfiles, setInjectorProfiles] = useState(injectorProfilesRef.current);
  injectorProfilesRef.current = injectorProfiles;

  const [wellDesigns, setWellDesigns] = useState(loadAllWellDesigns());
  // Ref mirror so the physics tick can resolve the active (possibly tapered)
  // design without re-subscribing.
  const wellDesignsRef = useRef(wellDesigns);
  wellDesignsRef.current = wellDesigns;

  // epoch ms of the operator's most recent squeeze/clamp control action, used to
  // decide whether they "engaged the controls" in time for the Tier-3 timeout.
  const lastControlActionRef = useRef<number>(0);

  // Hydrate the persisted equipment config + active well design on mount.
  useEffect(() => {
    const sel = loadEquipmentSelection();
    const activeWell = loadActiveWellDesignId();
    setState((prev) => ({
      ...prev,
      equipmentConfig: {
        activeInjectorProfileId: sel.activeInjectorProfileId,
        measurementUnits: sel.measurementUnits,
      },
      activeWellDesignId: activeWell,
    }));
  }, []);

  // Sound muting — combine the GLOBAL toggle (synced across windows) with this
  // window's LOCAL toggle. This window is audible only when both are enabled, so
  // each pop-up can be silenced independently to avoid stacked/tripled audio.
  useEffect(() => {
    soundManager.setMuted(!(state.soundEnabled && localAudioOn));
  }, [state.soundEnabled, localAudioOn]);

  // Drive the looping alarm audio from the current alarm tier. Streams the slip
  // loop for Tier 1 and the free-fall loop for Tier 2 (both at 50% volume), and
  // fires a critical lockout burst on Tier 3. Only streams while the condition
  // holds (respects global mute inside the soundManager).
  const prevAlarmTierRef = useRef(state.alarmTier);
  useEffect(() => {
    const tier = state.alarmTier;
    if (tier === 'slip') {
      soundManager.stopAlarmLoop('freefall');
      soundManager.startAlarmLoop('slip');
    } else if (tier === 'freefall' || tier === 'emergency') {
      soundManager.stopAlarmLoop('slip');
      soundManager.startAlarmLoop('freefall');
    } else {
      soundManager.stopAllAlarmLoops();
    }
    // Escalation to emergency → one-shot critical lockout burst.
    if (tier === 'emergency' && prevAlarmTierRef.current !== 'emergency') {
      soundManager.playCriticalLockoutAlarm();
    }
    prevAlarmTierRef.current = tier;
  }, [state.alarmTier]);

  // Main Physics & Hydraulic Simulation Tick (100ms interval)
  //
  // Only the PRIMARY window runs the simulation. Secondary pop-ups receive the
  // authoritative state via BroadcastChannel; running physics in a secondary too
  // would double-simulate and fight the primary's broadcasts (a cause of pop-up
  // controls appearing to "reset").
  useEffect(() => {
    if (isSecondary) return;
    const timer = setInterval(() => {
      setState((prev) => {
        if (!prev.isSimulating) return prev;

        const hyd = { ...prev.hydraulics };
        const rod = { ...prev.rod };
        const bop = { ...prev.bop };
        const yTool = { ...prev.yTool };

        // 1. Engine & PTO Pressures
        if (!hyd.engineRunning || hyd.emergencyStopTripped || hyd.rodaValveClosed) {
          hyd.engineRpm = 0;
          hyd.chargePressure = Math.max(0, hyd.chargePressure - 25);
          hyd.systemPressure = Math.max(0, hyd.systemPressure - 60);
          hyd.pickerPressure = Math.max(0, hyd.pickerPressure - 80);
          hyd.squeezePressure = Math.max(0, hyd.squeezePressure - 40);
          // Safety accumulator bleeds slowly if pump is off
          hyd.safetyPressure = Math.max(0, hyd.safetyPressure - 8);
          hyd.downPressure = 0;
          hyd.upPressure = 0;
        } else if (hyd.ptoEngaged) {
          // PTO ON — per manual: system max 2500 PSI (regulated), picker up to 4200 PSI
          const joyActive = Math.abs(prev.joystickPosition) > 0.05;
          // Active emergencies force low charge pressure until the safety clamp
          // is engaged (which resolves the freefall risk).
          const emgLowCharge =
            (prev.activeEmergency === 'charge_pressure_loss' ||
              prev.activeEmergency === 'freefalling_rod') &&
            hyd.safetyClampLever !== 'ON';
          const targetCharge = emgLowCharge ? 180 : joyActive ? 280 : 360;
          hyd.chargePressure = hyd.chargePressure + (targetCharge - hyd.chargePressure) * 0.2;

          // SYSTEM PRESSURE — the ONLY circuit that builds automatically: it is a
          // fixed regulated 2500 psi whenever the PTO is engaged AND the (wing)
          // bleed valve is CLOSED. Opening the bleed valve dumps it to 0. This is
          // gated purely by the bleed valve — it does NOT scale with depth.
          {
            const systemTarget = hyd.safetyBleedValveOpen ? 0 : 2500;
            hyd.systemPressure = hyd.systemPressure + (systemTarget - hyd.systemPressure) * 0.2;
          }
          // PICKER PRESSURE — driven by the operator's Crane Lockout Valve, NOT by
          // depth. When the operator OPENS the lockout valve the auxiliary crane
          // pump charges the picker circuit to full output (~4100 psi, manual
          // 3800-4200). Closing the valve bleeds it back to 0.
          {
            const pickerTarget = prev.picker.craneLockoutValveOpen ? 4100 : 0;
            hyd.pickerPressure = hyd.pickerPressure + (pickerTarget - hyd.pickerPressure) * 0.12;
          }
          hyd.squeezePressure = hyd.squeezePressureSwitch ? Math.min(hyd.squeezePressureTarget, hyd.systemPressure) : 0;
          // Safety pressure ramps smoothly toward operator-set target (or 150 if bleed open)
          const safetyTarget = hyd.safetyBleedValveOpen ? 150 : hyd.safetyPressureTarget;
          hyd.safetyPressure = hyd.safetyPressure + (safetyTarget - hyd.safetyPressure) * 0.15;
          hyd.chainTensionPressure = hyd.chainTensionSwitch ? hyd.chainTensionTarget : 0;
          hyd.upPressure = hyd.upPressureTarget;
          hyd.downPressure = hyd.downPressureTarget;

          // Per manual CAUTION: hydraulic temp 0°C min, 70°C max.
          // Temperature rises under load (PTO engaged, joystick active).
          const heatRate = joyActive ? 0.15 : 0.05; // °C per tick
          const coolingRate = hyd.hydraulicTankHeaterOpen ? 0.0 : 0.08; // cooler bypass
          const targetTemp = joyActive ? 55 : 40;
          hyd.hydraulicFluidTempC = hyd.hydraulicFluidTempC + (targetTemp - hyd.hydraulicFluidTempC) * heatRate * 0.1;
          // Engine preheater adds heat in cold conditions
          if (hyd.enginePreheaterOn && hyd.hydraulicFluidTempC < 20) {
            hyd.hydraulicFluidTempC += 0.3;
          }
          // Cooler (when not bypassed) brings temp down
          if (hyd.coolerBypassMode === 'AUTO' && hyd.hydraulicFluidTempC > 45) {
            hyd.hydraulicFluidTempC -= coolingRate;
          }
          // BUG FIX: Clamp temperature to physical bounds (manual: 0°C min, 70°C max)
          // and warn at critical overheat threshold
          hyd.hydraulicFluidTempC = Math.max(-10, Math.min(85, hyd.hydraulicFluidTempC));
          if (hyd.hydraulicFluidTempC >= 70 && prev.hydraulics.hydraulicFluidTempC < 70) {
            soundManager.playBuzzerAlert(2.0);
          }
        } else {
          // Engine RUNNING but PTO NOT engaged (idle). The charge pump is driven
          // directly by the engine, so charge pressure builds to a healthy idle
          // level even before the PTO/hydraulics are engaged. Drive circuits stay
          // at zero until the PTO is engaged.
          hyd.engineRpm = hyd.engineRpm || 1000;
          const idleCharge = prev.activeEmergency === 'charge_pressure_loss' ? 180 : 360;
          hyd.chargePressure = hyd.chargePressure + (idleCharge - hyd.chargePressure) * 0.2;
          hyd.systemPressure = Math.max(0, hyd.systemPressure - 60);
          hyd.pickerPressure = Math.max(0, hyd.pickerPressure - 80);
          hyd.squeezePressure = Math.max(0, hyd.squeezePressure - 40);
          hyd.safetyPressure = hyd.safetyBleedValveOpen ? 150 : Math.min(2800, hyd.safetyPressure + 40);
          hyd.upPressure = 0;
          hyd.downPressure = 0;
        }

        // 2. BOP Pressure Integration
        if (bop.bopBleedOpen) {
          // BUG FIX: Bleed valve drains BOP pressure to zero (was ignored before)
          hyd.bopPressure = Math.max(0, hyd.bopPressure - 120);
          if (hyd.bopPressure < 500) {
            bop.reganBopClosed = false;
          }
          // BUG FIX: Reset the hand-pump stroke counter once fully bled down —
          // strokes must be re-accumulated to re-pressurize the BOP.
          if (hyd.bopPressure <= 0) {
            bop.handPumpStrokes = 0;
          }
        } else if (bop.bopPumpSwitch) {
          // Auto pump ramps BOP pressure up toward the OPERATOR-SET regulator
          // target (bopRegulatorPsi), not a fixed value. The regulator is clamped
          // to the equipment ceiling (1500 psi) so it can't be driven unsafely.
          const target = Math.max(0, Math.min(1500, bop.bopRegulatorPsi));
          if (hyd.bopPressure < target) {
            hyd.bopPressure = Math.min(target, hyd.bopPressure + 80);
          } else if (hyd.bopPressure > target) {
            // If the operator lowers the regulator below current pressure, the
            // pump stops adding and pressure eases down toward the new setpoint.
            hyd.bopPressure = Math.max(target, hyd.bopPressure - 40);
          }
          // The Regan bag is considered sealed once at/above the 1000 psi minimum.
          bop.reganBopClosed = hyd.bopPressure >= 1000;
        } else {
          // BUG FIX: BOP pressure leaks slowly when pump is off (no perfect seal)
          hyd.bopPressure = Math.max(0, hyd.bopPressure - 2);
          if (hyd.bopPressure < 500) {
            bop.reganBopClosed = false;
          }
        }

        // 3. String Dynamics & Speed Calculations
        // Resolve the active well design (if any) so tapered strings compute the
        // correct per-depth linear weight and total string weight.
        const activeDesign = prev.activeWellDesignId
          ? wellDesignsRef.current.find((d) => d.id === prev.activeWellDesignId)
          : undefined;
        const isTapered = !!(activeDesign && activeDesign.segments && activeDesign.segments.length > 1);

        // Linear weight at the gripper: for a tapered string this is the section
        // currently at the surface/gripper; otherwise the single rod spec weight.
        const spec = ROD_SPECIFICATIONS[rod.rodSize] || ROD_SPECIFICATIONS['#6R'];
        rod.linearWeightLbsPerFt = activeDesign
          ? weightAtDepth(activeDesign, rod.currentDepthFt)
          : spec.weightLbsPerFt;

        // Tag bar weight: ramp gradually when lifting off bottom (per manual:
        // weight depends on "amount of COROD which is down hole at any point").
        // Avoid sudden snap from 0→full that would spike squeeze requirement.
        // For tapered strings, sum each section's contribution up to depth.
        const calculatedWeight = isTapered
          ? stringWeightAtDepth(activeDesign!, rod.currentDepthFt)
          : rod.currentDepthFt * rod.linearWeightLbsPerFt;
        if (rod.isLandedOnTagBar) {
          // While on tag bar, weight is zero (string is supported by the well)
          rod.totalStringWeightLbs = 0;
        } else {
          // Ramp toward calculated weight (smooth 30% per tick transition)
          rod.totalStringWeightLbs = rod.totalStringWeightLbs + (calculatedWeight - rod.totalStringWeightLbs) * 0.3;
        }

        // Calculate required squeeze
        const matchPoint = SQUEEZE_PRESSURE_CURVES.find((p) => p.weightLbs >= rod.totalStringWeightLbs) || SQUEEZE_PRESSURE_CURVES[SQUEEZE_PRESSURE_CURVES.length - 1];
        rod.calculatedSqueezeRequiredPsi = matchPoint.minSqueezePsi;

        // Clamp joystick to ±1 (safety: prevent raw setState from exceeding range)
        const clampedJoystick = Math.max(-1, Math.min(1, prev.joystickPosition));

        // Slippage / Gripper Grip check
        const hasGrip = hyd.squeezePressure >= rod.calculatedSqueezeRequiredPsi * 0.75 && hyd.squeezePressureSwitch;
        const isBrakeOn = hyd.gripperBrakeSwitch;
        const isSafetyOn = hyd.safetyClampLever === 'ON';
        const isClampedMech = rod.mechanicalClampsInstalled > 0 && rod.clampTorqueFtLbs >= 400;

        // SQUEEZE-ALARM CONTROL LOCK: once the string starts slipping (squeeze
        // deficit ≥ the slip threshold), the operator has LOST control of the
        // string — the reel keeps paying out and the rod keeps falling. They
        // must REGAIN control (raise squeeze back within tolerance, or engage
        // the safety/mechanical clamp) before STOP or POOH will respond again.
        // This mirrors real life: you can't just "pull out" of a live slip.
        const squeezeDeficitNow = Math.max(
          0,
          rod.calculatedSqueezeRequiredPsi - hyd.squeezePressure,
        );
        const alarmControlLost =
          hyd.squeezePressureSwitch &&
          rod.currentDepthFt > 100 &&
          rod.totalStringWeightLbs > 200 &&
          squeezeDeficitNow >= 50; // Tier-1 (slip) threshold

        let targetSpeed = 0;
        if (isSafetyOn || isClampedMech) {
          targetSpeed = 0;
          rod.rodInTensionOrCompression = 'neutral';
          rod.rodGripSlipping = false;
        } else if (alarmControlLost) {
          // Control is lost due to a slip/free-fall squeeze deficit. The string
          // freewheels downhole and STOP/POOH are ignored until squeeze recovers
          // or a clamp is engaged (handled by the branches above). Fall severity
          // scales with the deficit (worse deficit = faster fall).
          const severity = Math.min(1, squeezeDeficitNow / 200); // 50→0.25, 200+→1
          targetSpeed = -60 - 60 * severity; // ~ -75 (slip) → -120 (deep free-fall)
          rod.rodInTensionOrCompression = 'freefall';
          rod.rodGripSlipping = true;
        } else if (isBrakeOn) {
          targetSpeed = 0;
          rod.rodInTensionOrCompression = 'tension';
        } else if (!hasGrip && rod.currentDepthFt > 100) {
          // BUG FIX: Freefall occurs whenever grip is lost at depth, regardless
          // of joystick position. Previously only triggered when joystick === 0,
          // meaning pushing joystick with no grip resulted in zero speed instead
          // of freefall — a critical safety simulation hole.
          // Per manual: "gripper motors may freewheel allowing the rod string
          // to fall out of control"
          targetSpeed = -85; // Freefalling downhole!
          rod.rodInTensionOrCompression = 'freefall';
          rod.rodGripSlipping = true;
        } else if (clampedJoystick !== 0 && hasGrip) {
          if (clampedJoystick > 0) {
            // Up / Surfacing — per manual: max 5000 PSI from closed loop pump
            const powerRatio = Math.min(1.0, hyd.upPressure / 3000);
            targetSpeed = clampedJoystick * 65 * powerRatio;
            rod.rodInTensionOrCompression = 'tension';
          } else {
            // Down / Injecting — per manual: "The closed loop pump which drives
            // the gripper motors is set in the shop to deliver 5000psi" — down
            // pressure limits down speed just like up pressure limits up speed.
            const downPowerRatio = Math.min(1.0, hyd.downPressure / 3000);
            targetSpeed = clampedJoystick * 75 * downPowerRatio;
            rod.rodInTensionOrCompression = rod.currentDepthFt < 1000 ? 'compression' : 'tension';
          }
          rod.rodGripSlipping = false;
        }

        // Per manual: freefall audio alert — "Signal the emergency to personnel
        // (If possible use one long horn blast)"
        if (rod.rodInTensionOrCompression === 'freefall' && prev.rod.rodInTensionOrCompression !== 'freefall') {
          soundManager.playBuzzerAlert(2.0);
        }

        rod.rodSpeedFtPerMin = rod.rodSpeedFtPerMin + (targetSpeed - rod.rodSpeedFtPerMin) * 0.3;

        // Update Depth
        if (Math.abs(rod.rodSpeedFtPerMin) > 0.5) {
          // speed is ft/min -> per 100ms = speed / 600
          const deltaFt = (rod.rodSpeedFtPerMin / 600) * prev.simulationSpeedMultiplier;
          const nextDepth = Math.min(rod.totalWellDepthFt, Math.max(0, rod.currentDepthFt - deltaFt));

          // Tag Bar detection at bottom
          if (nextDepth >= rod.totalWellDepthFt && deltaFt < 0) {
            rod.currentDepthFt = rod.totalWellDepthFt;
            rod.isLandedOnTagBar = true;
            rod.rodSpeedFtPerMin = 0;
          } else {
            rod.currentDepthFt = nextDepth;
            rod.isLandedOnTagBar = false;
          }
        }

        // Per manual WARNING: "CHARGE PRESSURE IS CRITICAL. IF THE CHARGE
        // PRESSURE FALLS BELOW 250psi THE ROD SAFETY CLAMP SHOULD BE ENGAGED"
        if (hyd.chargePressure < 250 && prev.hydraulics.chargePressure >= 250) {
          soundManager.playBuzzerAlert(1.5);
        }

        // Y-Tool Diameter variations with depth
        if (yTool.poweredOn) {
          yTool.depthReadingFt = rod.currentDepthFt;
          // Simulate slight wear anomaly between 2800 and 2920 ft
          if (rod.currentDepthFt >= 2800 && rod.currentDepthFt <= 2920) {
            rod.rodWearDiameterInchX = 0.885;
            rod.rodWearDiameterInchY = 0.890;
            // Per manual: Y-Tool alarm at < 0.900" (types.ts line 98)
            yTool.alarmSounding = true;
            yTool.alarmVisual = true;
          } else {
            rod.rodWearDiameterInchX = 0.945;
            rod.rodWearDiameterInchY = 0.940;
            // BUG FIX: Clear alarms when rod diameter is back to normal
            yTool.alarmSounding = false;
            yTool.alarmVisual = false;
          }
          yTool.measuredDiameterX = rod.rodWearDiameterInchX;
          yTool.measuredDiameterY = rod.rodWearDiameterInchY;
        }

        // Telemetry point logging (every 10 ticks = 1 sec)
        const timeElapsed = prev.scenarioTimeElapsedSeconds + 0.1;
        let newTelemetry = prev.telemetry;
        if (Math.floor(timeElapsed * 10) % 10 === 0) {
          const pt: TelemetryPoint = {
            timestamp: Date.now(),
            depthFt: rod.currentDepthFt,
            speedFtMin: rod.rodSpeedFtPerMin,
            stringWeightLbs: rod.totalStringWeightLbs,
            squeezePressurePsi: hyd.squeezePressure,
            chargePressurePsi: hyd.chargePressure,
            safetyPressurePsi: hyd.safetyPressure,
            hydraulicTempC: hyd.hydraulicFluidTempC,
          };
          newTelemetry = [...prev.telemetry.slice(-(30 - 1)), pt];
        }

        // ---------------------------------------------------------------------
        // SQUEEZE-PRESSURE ALARM (Slip & Free-Fall detection) — Tiers 1/2/3
        // ---------------------------------------------------------------------
        // Required squeeze comes from the ACTIVE INJECTOR PROFILE when one is
        // selected (its curve + head geometry), otherwise falls back to the
        // manual reference curve already computed above.
        let requiredSqueeze = rod.calculatedSqueezeRequiredPsi;
        const activeProfile =
          prev.equipmentConfig.activeInjectorProfileId != null
            ? injectorProfilesRef.current.find(
                (p) => p.id === prev.equipmentConfig.activeInjectorProfileId,
              )
            : undefined;
        if (activeProfile) {
          requiredSqueeze = requiredSqueezeForWeight(activeProfile, rod.totalStringWeightLbs);
          rod.calculatedSqueezeRequiredPsi = requiredSqueeze;
        }

        // The alarm only makes sense while actually gripping/operating: PTO
        // engaged, squeeze circuit switched on, string under load at depth, and
        // the rod not secured by the safety clamp / mechanical clamps.
        const alarmArmed =
          hyd.ptoEngaged &&
          hyd.squeezePressureSwitch &&
          !hyd.emergencyStopTripped &&
          rod.currentDepthFt > 100 &&
          rod.totalStringWeightLbs > 200 &&
          !(hyd.safetyClampLever === 'ON') &&
          !(rod.mechanicalClampsInstalled > 0 && rod.clampTorqueFtLbs >= 400);

        const discrepancy = alarmArmed
          ? Math.max(0, requiredSqueeze - hyd.squeezePressure)
          : 0;

        // Hitting the safety relief (bleeding hydraulic pressure) DURING an
        // operation dumps the squeeze circuit → immediate free-fall condition.
        // This forces the free-fall tier regardless of the measured discrepancy.
        const safetyReliefDuringOp =
          hyd.ptoEngaged &&
          hyd.safetyBleedValveOpen &&
          rod.currentDepthFt > 100 &&
          rod.totalStringWeightLbs > 200 &&
          !(hyd.safetyClampLever === 'ON') &&
          !(rod.mechanicalClampsInstalled > 0 && rod.clampTorqueFtLbs >= 400);
        // Effective discrepancy used for tiering: at least 100 (free-fall) if the
        // relief was hit during an operation.
        const effectiveDiscrepancy = safetyReliefDuringOp
          ? Math.max(discrepancy, 100)
          : discrepancy;

        const now = Date.now();
        let alarmTier = prev.alarmTier;
        let alarmSince = prev.alarmSince;
        // Whether the alarm is currently "active" (a discrepancy exists).
        const alarmActive = effectiveDiscrepancy >= 50;

        if (alarmActive) {
          // Record when this alarm episode began (for the Tier-3 20s timeout).
          if (prev.alarmTier === 'none' || alarmSince == null) alarmSince = now;

          // Base tier from the discrepancy magnitude (both slip & free-fall are
          // shown in red to match the rod/guide highlight ranges).
          const baseTier: 'slip' | 'freefall' = effectiveDiscrepancy >= 100 ? 'freefall' : 'slip';
          alarmTier = baseTier;

          // Tier 3 — Emergency timeout: operator failed to engage controls within
          // 20 s of the trigger. "Engaging controls" = raising the squeeze target
          // or moving the safety clamp since the alarm began. This is NON-BLOCKING
          // and auto-clears the instant the squeeze is corrected below.
          const reacted = lastControlActionRef.current > (alarmSince ?? now);
          if (!reacted && now - alarmSince >= 20000) {
            alarmTier = 'emergency';
          }
        } else {
          // Within tolerance — operator has corrected. Clear everything.
          alarmTier = 'none';
          alarmSince = null;
        }
        const alarmLockout = false;

        // Audio updates
        soundManager.updateEngineSound(hyd.engineRunning, hyd.engineRpm, hyd.ptoEngaged);
        soundManager.updateHydraulicSound(hyd.ptoEngaged, hyd.systemPressure);

        return {
          ...prev,
          hydraulics: hyd,
          rod,
          bop,
          yTool,
          telemetry: newTelemetry,
          scenarioTimeElapsedSeconds: timeElapsed,
          alarmTier,
          alarmSince,
          alarmLockout,
        };
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // =========================================================================
  // EMERGENCY STEP AUTO-VALIDATION
  // Watches the active emergency scenario, validates the current step against
  // live console state, auto-advances, applies time-limit consequences, and
  // resolves the emergency when the final step passes.
  // =========================================================================
  const emgStepStartRef = useRef<number>(0);
  const emgTimedOutRef = useRef<Set<string>>(new Set());
  const [emergencyToast, setEmergencyToast] = useState<string | null>(null);
  // Snapshot of the sim state captured the moment a DRILL is injected, so the
  // simulation can be restored to normal operating conditions once the drill
  // is completed or aborted.
  const preDrillSnapshotRef = useRef<{
    hydraulics: SimulatorState['hydraulics'];
    rod: SimulatorState['rod'];
    bop: SimulatorState['bop'];
    joystickPosition: number;
  } | null>(null);

  // Reset the per-step timer whenever the active step changes.
  useEffect(() => {
    emgStepStartRef.current = Date.now();
  }, [state.emergencyScenarioId, state.emergencyStepIndex]);

  useEffect(() => {
    if (!state.emergencyScenarioId) return;
    const scenario = getEmergencyScenario(state.emergencyScenarioId);
    if (!scenario) return;

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.emergencyScenarioId) return;
      const sc = getEmergencyScenario(s.emergencyScenarioId);
      if (!sc) return;
      const idx = s.emergencyStepIndex;
      const step = sc.steps[idx];
      if (!step) return;

      // Time-limit consequence handling (fires once per step)
      if (step.timeLimitSec && !emgTimedOutRef.current.has(step.id)) {
        const elapsed = (Date.now() - emgStepStartRef.current) / 1000;
        if (elapsed > step.timeLimitSec && !step.validationFn(s)) {
          emgTimedOutRef.current.add(step.id);
          setState((prev) => ({
            ...prev,
            hydraulics: step.onTimeout
              ? { ...prev.hydraulics, ...(step.onTimeout.hydraulics || {}) }
              : prev.hydraulics,
            rod: step.onTimeout ? { ...prev.rod, ...(step.onTimeout.rod || {}) } : prev.rod,
            bop: step.onTimeout ? { ...prev.bop, ...(step.onTimeout.bop || {}) } : prev.bop,
            // Record the timeout against the active assessment event.
            assessment: patchActiveAssessmentEvent(prev, (ev) => ({
              ...ev,
              timedOutSteps: ev.timedOutSteps + 1,
            })),
          }));
          if (step.timeoutMessage) {
            soundManager.playBuzzerAlert(1.5);
            setEmergencyToast(step.timeoutMessage);
            setTimeout(() => setEmergencyToast(null), 5000);
          }
        }
      }

      // Step completion → advance or resolve
      if (step.validationFn(s)) {
        soundManager.playSuccessChime();
        if (idx + 1 < sc.steps.length) {
          setState((prev) => ({
            ...prev,
            emergencyStepIndex: prev.emergencyStepIndex + 1,
            // First correct action on this event → stamp reaction time.
            assessment: patchActiveAssessmentEvent(prev, (ev) =>
              ev.firstActionAt == null ? { ...ev, firstActionAt: Date.now() } : ev,
            ),
          }));
        } else {
          // Final step complete — emergency resolved. Restore the pre-drill
          // simulation state so normal operation resumes cleanly.
          const snap = preDrillSnapshotRef.current;
          const now = Date.now();
          setState((prev) => ({
            ...prev,
            activeEmergency: 'none',
            emergencyScenarioId: null,
            emergencyStepIndex: 0,
            emergencyResolved: true,
            airHornSounded: false,
            evacuatedToMuster: false,
            scbaEquipped: false,
            joystickPosition: snap ? snap.joystickPosition : prev.joystickPosition,
            hydraulics: snap ? { ...snap.hydraulics } : prev.hydraulics,
            rod: snap ? { ...snap.rod } : prev.rod,
            bop: snap ? { ...snap.bop } : prev.bop,
            // Stamp firstAction (if somehow unset) + resolvedAt on the event,
            // and schedule the NEXT injection after a randomized quiet gap
            // (5–13s). The continuous orchestrator will fire it when due, unless
            // the run's hard time limit intervenes first.
            assessment:
              prev.assessment && prev.assessment.active && !prev.assessment.ended
                ? {
                    ...prev.assessment,
                    nextInjectAt: now + 5000 + Math.floor(Math.random() * 8000),
                    events: patchLastEvent(prev.assessment.events, (ev) => ({
                      ...ev,
                      firstActionAt: ev.firstActionAt ?? now,
                      resolvedAt: now,
                    })),
                  }
                : prev.assessment,
          }));
          preDrillSnapshotRef.current = null;
          emgTimedOutRef.current.clear();
          soundManager.playSuccessChime();
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [state.emergencyScenarioId]);

  // ---------------------------------------------------------------------------
  // Equipment configuration & Well design handlers
  // ---------------------------------------------------------------------------
  const handleSelectInjectorProfile = (id: string) => {
    setState((prev) => ({
      ...prev,
      equipmentConfig: { ...prev.equipmentConfig, activeInjectorProfileId: id },
    }));
    saveEquipmentSelection({
      activeInjectorProfileId: id,
      measurementUnits: stateRef.current.equipmentConfig.measurementUnits,
    });
  };

  const handleSetMeasurementUnits = (units: 'imperial' | 'metric') => {
    setState((prev) => ({
      ...prev,
      equipmentConfig: { ...prev.equipmentConfig, measurementUnits: units },
    }));
    saveEquipmentSelection({
      activeInjectorProfileId: stateRef.current.equipmentConfig.activeInjectorProfileId,
      measurementUnits: units,
    });
  };

  // Apply a well design to the live simulation: set total (possibly tapered)
  // depth, and the rod size / linear weight for the section currently at the
  // gripper. For tapered strings these track depth in the physics loop.
  const handleApplyWellDesign = (design: import('./data/wellDesigns').WellDesign) => {
    saveActiveWellDesignId(design.id);
    const totalDepth = wellDesignTotalDepthFt(design);
    setState((prev) => {
      const depth = Math.min(prev.rod.currentDepthFt, totalDepth);
      return {
        ...prev,
        activeWellDesignId: design.id,
        rod: {
          ...prev.rod,
          totalWellDepthFt: totalDepth,
          currentDepthFt: depth,
          rodSize: design.activeRodSize,
          linearWeightLbsPerFt: weightAtDepth(design, depth),
        },
      };
    });
    soundManager.playSuccessChime();
  };

  // Safety interlock: mechanical clamps may ONLY be installed to secure the well
  // when the string is held (gripper brake OR safety clamp engaged) AND the reel
  // is 100% stationary (no rod movement). Installing clamps while the injector /
  // operation is running is unsafe and is blocked.
  const canInstallMechanicalClamp = (s: SimulatorState): boolean => {
    const held = s.hydraulics.gripperBrakeSwitch || s.hydraulics.safetyClampLever === 'ON';
    const reelStationary = Math.abs(s.rod.rodSpeedFtPerMin) < 0.01;
    return held && reelStationary;
  };

  // Update handlers
  //
  // MULTI-WINDOW SYNC: the PRIMARY window runs the physics tick and broadcasts
  // the full state ~20fps. SECONDARY pop-ups (?view=console etc.) must NOT rely
  // on their own local setState for sub-object edits, because the next primary
  // broadcast would immediately overwrite them (this caused pop-up controls to
  // "reset" — e.g. squeeze 800→850 snapping back to 800). Instead, a secondary
  // window sends a merged PATCH of the whole sub-object to the primary, which
  // applies it and re-broadcasts it as authoritative state. We also apply it
  // locally for instant feedback.
  const applySubUpdate = <K extends keyof SimulatorState>(
    key: K,
    updates: Partial<SimulatorState[K]>,
  ) => {
    if (isSecondary) {
      // Secondary windows are NOT authoritative: send a merged patch to the
      // primary and let its immediate re-broadcast update us. Applying locally
      // here too would cause a visible "snap back then re-apply" as the primary's
      // in-flight full-state broadcast (with the old value) races the patch.
      const merged = {
        ...(stateRef.current[key] as object),
        ...(updates as object),
      } as SimulatorState[K];
      broadcastPatch({ [key]: merged } as Partial<SimulatorState>);
      return;
    }
    setState((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...(updates as object) } }));
  };

  const updateHydraulics = (updates: Partial<SimulatorState['hydraulics']>) => {
    // Track corrective control actions for the Tier-3 squeeze-alarm timeout:
    // raising the squeeze target or engaging the safety clamp counts as the
    // operator "engaging the controls" in response to a slip / free-fall alarm.
    const prevHyd = stateRef.current.hydraulics;
    const raisedSqueeze =
      updates.squeezePressureTarget != null &&
      updates.squeezePressureTarget > prevHyd.squeezePressureTarget;
    const engagedSafety =
      updates.safetyClampLever === 'ON' && prevHyd.safetyClampLever !== 'ON';
    if (raisedSqueeze || engagedSafety) {
      lastControlActionRef.current = Date.now();
    }
    applySubUpdate('hydraulics', updates);
  };

  const updateBop = (updates: Partial<SimulatorState['bop']>) => {
    applySubUpdate('bop', updates);
  };

  const updateYTool = (updates: Partial<SimulatorState['yTool']>) => {
    applySubUpdate('yTool', updates);
  };

  const updateOutriggers = (updates: Partial<SimulatorState['outriggers']>) => {
    applySubUpdate('outriggers', updates);
  };

  const updatePicker = (updates: Partial<SimulatorState['picker']>) => {
    applySubUpdate('picker', updates);
  };

  const handleJoystickChange = (pos: number) => {
    // SAFETY INTERLOCKS per manual:
    // 1. Never move COROD with < 400 psi squeeze (HYDRAULIC_OPERATING_LIMITS)
    // 2. Block joystick when safety clamp is engaged
    // 3. Block joystick when gripper brake is on
    const s = stateRef.current;
    if (pos !== 0) {
      // GATE: operation is locked until the engine start sequence is complete
      if (!s.engineStartSequenceComplete || !s.hydraulics.engineRunning) {
        soundManager.playBuzzerAlert(0.4);
        setShowEngineStartModal(true);
        return; // Must start the engine first
      }
      if (s.hydraulics.safetyClampLever === 'ON') {
        soundManager.playBuzzerAlert(0.3);
        return; // Safety clamp blocks all rod movement
      }
      if (s.hydraulics.gripperBrakeSwitch) {
        soundManager.playBuzzerAlert(0.3);
        return; // Gripper brake blocks rod movement
      }
      if (s.hydraulics.squeezePressure < 400 && s.hydraulics.squeezePressureSwitch) {
        soundManager.playBuzzerAlert(0.5);
        // Allow but warn — per manual: "NEVER move COROD with < 400 psi squeeze"
      }
    }

    // CONTROL LOCK during a live slip / free-fall: the operator cannot STOP
    // (pos === 0) or POOH / pull up (pos > 0) until they REGAIN control by
    // raising the squeeze pressure back within tolerance (or engaging a clamp).
    // RUN/RIH (pos < 0) is still allowed. This matches the physics: the string
    // freewheels downhole regardless of the drive stick until control returns.
    const alarmActiveNow = s.alarmTier === 'slip' || s.alarmTier === 'freefall' || s.alarmTier === 'emergency';
    const secured = s.hydraulics.safetyClampLever === 'ON' ||
      (s.rod.mechanicalClampsInstalled > 0 && s.rod.clampTorqueFtLbs >= 400);
    if (alarmActiveNow && !secured && pos >= 0) {
      soundManager.playBuzzerAlert(0.5);
      return; // STOP / POOH ignored — regain control first (raise squeeze / clamp)
    }

    if (isSecondary) {
      broadcastPatch({ joystickPosition: pos });
      return;
    }
    setState((prev) => ({ ...prev, joystickPosition: pos }));
  };

  const handleEmergencyShutdown = () => {
    // Per manual: "Before activating the Emergency Shut Down, the Rod Safety
    // Clamp must be activated first." Warn if safety clamp is not engaged.
    if (stateRef.current.hydraulics.safetyClampLever !== 'ON') {
      soundManager.playBuzzerAlert(0.5);
    }
    soundManager.playHiss(0.8);
    // BUG FIX: Emergency shutdown must also zero the joystick and engage
    // safety clamp to actually stop the rod (was only killing the engine,
    // letting the rod coast on momentum for several ticks)
    setState((prev) => ({
      ...prev,
      joystickPosition: 0,
      hydraulics: {
        ...prev.hydraulics,
        emergencyStopTripped: true,
        rodaValveClosed: true,
        engineRunning: false,
        engineRpm: 0,
        safetyClampLever: 'ON' as const,
      },
    }));
  };

  const handleResetEmergencyShutdown = () => {
    soundManager.playMetalTap();
    // Reset all ESD-engaged states (including safety clamp which is now
    // auto-engaged during emergency shutdown)
    updateHydraulics({
      emergencyStopTripped: false,
      rodaValveClosed: false,
      engineRunning: true,
      engineRpm: 1100,
    });
  };

  // =========================================================================
  // INTERACTIVE EMERGENCY RESPONSE
  // Triggering an emergency injects a live fault and starts the Response HUD.
  // The operator must respond on the real console; steps auto-validate in the
  // physics/validation tick below.
  // =========================================================================
  const triggerEmergencyScenario = (scenarioId: string, opts: { assessment?: boolean } = {}) => {
    const scenario = getEmergencyScenario(scenarioId);
    if (!scenario) return;
    soundManager.playBuzzerAlert(2.0);
    // Capture pre-drill conditions for restoration on completion.
    preDrillSnapshotRef.current = {
      hydraulics: { ...stateRef.current.hydraulics },
      rod: { ...stateRef.current.rod },
      bop: { ...stateRef.current.bop },
      joystickPosition: stateRef.current.joystickPosition,
    };
    const injectedAt = Date.now();
    setState((prev) => {
      const inj = scenario.inject;
      // If this injection is part of a live assessment run, append a new event
      // record and advance the queue pointer.
      const assessment =
        opts.assessment && prev.assessment && prev.assessment.active && !prev.assessment.ended
          ? {
              ...prev.assessment,
              // Clear the pending-injection marker now that this one has fired.
              nextInjectAt: null,
              events: [
                ...prev.assessment.events,
                {
                  scenarioId: scenario.id,
                  injectedAt,
                  firstActionAt: null,
                  resolvedAt: null,
                  hintsUsed: 0,
                  timedOutSteps: 0,
                } as AssessmentEvent,
              ],
            }
          : prev.assessment;
      return {
        ...prev,
        activeEmergency: scenario.emergencyKey,
        emergencyScenarioId: scenario.id,
        emergencyStepIndex: 0,
        emergencyTriggerTime: injectedAt,
        emergencyResolved: false,
        // Reset drill flags so a fresh response is required each time
        airHornSounded: false,
        evacuatedToMuster: false,
        scbaEquipped: false,
        hydraulics: { ...prev.hydraulics, ...(inj.hydraulics || {}) },
        rod: { ...prev.rod, ...(inj.rod || {}) },
        bop: { ...prev.bop, ...(inj.bop || {}) },
        assessment,
      };
    });
  };

  const resolveEmergencyScenario = () => {
    soundManager.playSuccessChime();
    setState((prev) => ({
      ...prev,
      activeEmergency: 'none',
      emergencyScenarioId: null,
      emergencyStepIndex: 0,
      emergencyResolved: true,
    }));
  };

  const cancelEmergencyScenario = () => {
    // Aborting a drill also restores the pre-drill simulation state so the
    // injected fault (freefall, low charge, etc.) is cleared and normal
    // operation resumes — same as completing it.
    const snap = preDrillSnapshotRef.current;
    setState((prev) => ({
      ...prev,
      activeEmergency: 'none',
      emergencyScenarioId: null,
      emergencyStepIndex: 0,
      emergencyResolved: false,
      airHornSounded: false,
      evacuatedToMuster: false,
      scbaEquipped: false,
      joystickPosition: snap ? snap.joystickPosition : prev.joystickPosition,
      hydraulics: snap ? { ...snap.hydraulics } : prev.hydraulics,
      rod: snap ? { ...snap.rod } : prev.rod,
      bop: snap ? { ...snap.bop } : prev.bop,
    }));
    preDrillSnapshotRef.current = null;
    emgTimedOutRef.current.clear();
  };

  const advanceEmergencyStep = () => {
    setState((prev) => ({ ...prev, emergencyStepIndex: prev.emergencyStepIndex + 1 }));
  };

  // Increment the hint counter on the active assessment event + run total.
  const handleAssessmentHintUsed = () => {
    setState((prev) => {
      if (!prev.assessment || !prev.assessment.active || prev.assessment.ended) return prev;
      return {
        ...prev,
        assessment: {
          ...prev.assessment,
          hintsUsedTotal: prev.assessment.hintsUsedTotal + 1,
          events: patchLastEvent(prev.assessment.events, (ev) => ({
            ...ev,
            hintsUsed: ev.hintsUsed + 1,
          })),
        },
      };
    });
  };

  // =========================================================================
  // TIMED ASSESSMENT RUN ("Start Simulation")
  // Builds a randomized queue of emergencies sized to the target duration,
  // injects them one at a time with quiet monitoring gaps between events, and
  // finalizes with a scored report + auto logbook entry once the queue is done
  // and the minimum duration has elapsed.
  // =========================================================================
  // Recently-injected scenario ids (to avoid back-to-back repeats during a run).
  const assessmentRecentRef = useRef<string[]>([]);

  // Pick a random emergency that isn't one of the last couple injected.
  const pickNextAssessmentScenario = (): string => {
    const recent = assessmentRecentRef.current;
    const [id] = getRandomEmergencyQueue(1, { excludeIds: recent.slice(-2) });
    const chosen = id ?? getRandomEmergencyQueue(1)[0];
    assessmentRecentRef.current = [...recent, chosen].slice(-4);
    return chosen;
  };

  const startAssessment = (
    operator: AssessmentOperator,
    durationMinutes: number,
    difficulty: AssessmentDifficulty,
  ) => {
    // Gate on engine start like normal operation.
    if (!stateRef.current.engineStartSequenceComplete || !stateRef.current.hydraulics.engineRunning) {
      soundManager.playBuzzerAlert(0.5);
      setShowEngineStartModal(true);
      return;
    }
    const now = Date.now();
    const targetSec = Math.max(300, durationMinutes * 60); // ≥ 5 minutes
    assessmentRecentRef.current = [];

    const session: AssessmentSession = {
      active: true,
      operator,
      difficulty,
      startedAt: now,
      targetDurationSec: targetSec,
      // First emergency injects ~3s after the run begins.
      nextInjectAt: now + 3000,
      events: [],
      hintsUsedTotal: 0,
      ended: false,
      endedAt: null,
    };
    soundManager.playMetalTap();
    setState((prev) => ({ ...prev, assessment: session, activeTab: 'console' }));
    // The continuous orchestration effect (below) drives all injections + the
    // hard end-of-run cutoff from here — no per-event timers required.
  };

  // Ref guard so the finalize side-effects (leaderboard/logbook writes) run
  // EXACTLY once even under React StrictMode's double-invoked updaters or a
  // hard-timer/End-Run race. This was the cause of duplicate leaderboard rows.
  const assessmentFinalizedRef = useRef<number | null>(null);

  const endAssessment = () => {
    const cur = stateRef.current.assessment;
    // Guard against double-finalization (hard timer + manual End Run racing, or
    // StrictMode re-invocation).
    if (!cur || cur.ended || !cur.active) return;
    if (assessmentFinalizedRef.current === cur.startedAt) return;
    assessmentFinalizedRef.current = cur.startedAt;

    const snap = preDrillSnapshotRef.current;
    const now = Date.now();

    // --- Compute EVERYTHING once, OUTSIDE setState, so persistence side effects
    //     (localStorage leaderboard write) never run twice. ---
    const finishedSession: AssessmentSession = {
      ...cur,
      active: false,
      ended: true,
      endedAt: now,
      nextInjectAt: null,
    };
    const report = computeAssessmentReport(finishedSession);

    const lbEntry: LeaderboardEntry = {
      id: `lb-${finishedSession.startedAt}`,
      name: finishedSession.operator.name || 'Trainee',
      role: finishedSession.operator.role || '',
      unit: finishedSession.operator.unit || '',
      score: report.overallScore,
      grade: report.grade,
      difficulty: finishedSession.difficulty,
      eventsResolved: report.eventsResolved,
      eventsHandled: report.eventsHandled,
      avgReactionSec: report.avgReactionSec,
      hintsUsed: report.hintsUsedTotal,
      durationSec: report.durationSec,
      timestamp: now,
    };
    addLeaderboardEntry(lbEntry); // single call — the only side effect

    const drills = Array.from(
      new Set(
        finishedSession.events
          .map((e) => getEmergencyScenario(e.scenarioId)?.title)
          .filter((x): x is string => !!x),
      ),
    );
    const logEntry: LogbookEntry = {
      id: `log-assess-${finishedSession.startedAt}`,
      date: new Date(now).toISOString().slice(0, 10),
      wellLocation: 'Assessment Simulation',
      unitNumber: finishedSession.operator.unit || 'N/A',
      operatorName: finishedSession.operator.name || 'Trainee',
      jobType: 'surface',
      rodType: stateRef.current.rod.rodShape
        ? `${stateRef.current.rod.rodSize} ${stateRef.current.rod.rodShape}`
        : 'N/A',
      maxDepthFt: Math.round(stateRef.current.rod.currentDepthFt),
      totalWeightLbs: Math.round(stateRef.current.rod.totalStringWeightLbs),
      inspectionsCompleted: {
        walkaround: false,
        positiveAirShutdown: false,
        rodSafetyAccumulator10MinTest: false,
        bopTest1250Psi: false,
        knucklePickerInspection: false,
        rodElevatorsCheck: false,
        hydraulicFluidUnivisN32: false,
        wireRopesSlings: false,
      },
      drillsConducted: drills,
      safetyScore: report.overallScore,
      comments: `Timed assessment (${finishedSession.operator.role || 'operator'}, ${finishedSession.difficulty}): ${report.eventsResolved}/${report.eventsHandled} events resolved, ${report.hintsUsedTotal} hints used, avg reaction ${report.avgReactionSec ? report.avgReactionSec.toFixed(1) : '—'}s. Grade: ${report.grade}.`,
      certifiedStamp: report.overallScore >= 75,
    };

    // Updater is now PURE (idempotent) — safe under StrictMode double-invoke,
    // and de-dupes the logbook by id in case it does run twice.
    setState((prev) => {
      if (!prev.assessment || prev.assessment.ended) return prev;
      const logbook = prev.logbook.some((l) => l.id === logEntry.id)
        ? prev.logbook
        : [logEntry, ...prev.logbook];
      return {
        ...prev,
        assessment: finishedSession,
        activeEmergency: 'none',
        emergencyScenarioId: null,
        emergencyStepIndex: 0,
        airHornSounded: false,
        evacuatedToMuster: false,
        scbaEquipped: false,
        joystickPosition: snap ? snap.joystickPosition : prev.joystickPosition,
        hydraulics: snap ? { ...snap.hydraulics } : prev.hydraulics,
        rod: snap ? { ...snap.rod } : prev.rod,
        bop: snap ? { ...snap.bop } : prev.bop,
        logbook,
        performance: {
          ...prev.performance,
          emergencyReactionTimeMs: report.avgReactionSec
            ? Math.round(report.avgReactionSec * 1000)
            : prev.performance.emergencyReactionTimeMs,
        },
      };
    });
    preDrillSnapshotRef.current = null;
    emgTimedOutRef.current.clear();
    soundManager.playSuccessChime();
  };

  const dismissAssessmentReport = () => {
    setState((prev) => ({ ...prev, assessment: null, activeTab: 'drills' }));
  };

  // React-time timeout: the operator failed to resolve the active emergency in
  // time. Abort it (restoring sim state), mark the event as FAILED (unresolved +
  // a timeout strike so it scores 0-ish), flash a message, and schedule the next.
  const failActiveAssessmentEmergency = () => {
    const snap = preDrillSnapshotRef.current;
    const now = Date.now();
    soundManager.playBuzzerAlert(1.8);
    setEmergencyToast(t('emergencyHud.reactFail'));
    setTimeout(() => setEmergencyToast(null), 4000);
    setState((prev) => {
      if (!prev.assessment || !prev.assessment.active || prev.assessment.ended) return prev;
      return {
        ...prev,
        // Abort the emergency & restore the pre-drill snapshot.
        activeEmergency: 'none',
        emergencyScenarioId: null,
        emergencyStepIndex: 0,
        airHornSounded: false,
        evacuatedToMuster: false,
        scbaEquipped: false,
        joystickPosition: snap ? snap.joystickPosition : prev.joystickPosition,
        hydraulics: snap ? { ...snap.hydraulics } : prev.hydraulics,
        rod: snap ? { ...snap.rod } : prev.rod,
        bop: snap ? { ...snap.bop } : prev.bop,
        assessment: {
          ...prev.assessment,
          // Schedule the next after a short gap; mark this event failed.
          nextInjectAt: now + 3000 + Math.floor(Math.random() * 5000),
          events: patchLastEvent(prev.assessment.events, (ev) => ({
            ...ev,
            resolvedAt: null,
            timedOutSteps: ev.timedOutSteps + 1,
          })),
        },
      };
    });
    preDrillSnapshotRef.current = null;
    emgTimedOutRef.current.clear();
  };

  // Continuous assessment orchestrator (single master tick @ 1s).
  // Responsibilities while a run is active:
  //   1. HARD-END the run the instant the target duration is reached — even if
  //      an emergency is still in progress (fixes "7 min passed, never ended").
  //   2. Inject a fresh RANDOM emergency whenever `nextInjectAt` is due AND no
  //      emergency is currently active — an endless stream at random intervals
  //      (fixes "only 4 emergencies then it stopped").
  // Emergencies keep coming right up until the cutoff; the last one may be
  // interrupted by the end-of-run, which is expected certification behaviour.
  // Per-difficulty maximum reaction time (seconds) to FULLY resolve an emergency
  // before it is counted as a failure and the run moves on.
  const MAX_REACT_SEC = { guided: 60, realistic: 30 } as const;
  // Stop injecting NEW emergencies once fewer than this many seconds remain, so a
  // late emergency isn't unfairly cut off by the hard end-of-run.
  const NO_INJECT_TAIL_SEC = 20;

  const isAssessmentRunning = !!state.assessment && state.assessment.active && !state.assessment.ended;
  useEffect(() => {
    if (!isAssessmentRunning) return;
    const tick = () => {
      const a = stateRef.current.assessment;
      if (!a || !a.active || a.ended) return;
      const now = Date.now();
      const remainingSec = a.targetDurationSec - (now - a.startedAt) / 1000;

      // 1. Hard time-limit cutoff.
      if (remainingSec <= 0) {
        endAssessment();
        return;
      }

      const emergencyActive = !!stateRef.current.emergencyScenarioId;

      // 2. React-time FAIL: if an emergency has been active longer than the
      //    difficulty's max reaction window without being resolved, fail it and
      //    move on (records timedOutSteps + resolvedAt=null so it scores as failed).
      if (emergencyActive) {
        const maxReact = MAX_REACT_SEC[a.difficulty];
        const activeEv = a.events[a.events.length - 1];
        if (activeEv && !activeEv.resolvedAt && (now - activeEv.injectedAt) / 1000 > maxReact) {
          failActiveAssessmentEmergency();
          return;
        }
      }

      // 3. Inject the next emergency when due, the console is clear, and there is
      //    enough time left for a fair attempt (skip the final tail seconds).
      if (
        !emergencyActive &&
        a.nextInjectAt != null &&
        now >= a.nextInjectAt &&
        remainingSec > NO_INJECT_TAIL_SEC
      ) {
        triggerEmergencyScenario(pickNextAssessmentScenario(), { assessment: true });
      }
    };
    const id = setInterval(tick, 1000);
    tick(); // run once immediately so the first injection isn't delayed a full second
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssessmentRunning]);

  // Air horn: play the sound AND record that the horn was sounded (so emergency
  // response steps that require an air-horn blast are satisfied).
  const handleAirHorn = (durationSec = 1.2) => {
    soundManager.playAirHorn?.(durationSec);
    setState((prev) => ({ ...prev, airHornSounded: true }));
  };

  // Trip Mode handler: RIH (Run In Hole from surface), POOH (Pull Out Of Hole from bottom), or FREE (Mid-well)
  const handleSetTripMode = (mode: 'RIH' | 'POOH' | 'FREE') => {
    soundManager.playMetalTap();
    // Reset drill tracking flags on trip mode change (prevent carry-over)
    const drillReset = {
      airHornSounded: false,
      evacuatedToMuster: false,
      scbaEquipped: false,
      fishingSocketAssembled: false,
      rodSampleCut: false,
      emergencyResolved: false,
    };
    if (mode === 'RIH') {
      setState((prev) => ({
        ...prev,
        ...drillReset,
        activeScenarioId: 'scenario-4-install',
        currentStepIndex: 0,
        scenarioTimeElapsedSeconds: 0,
        scenarioCompleted: false,
        rod: {
          ...prev.rod,
          currentDepthFt: 0,
          totalStringWeightLbs: 0,
          calculatedSqueezeRequiredPsi: 400,
          isLandedOnTagBar: false,
          hasLeaderCable: true,
          hasBulletOnPin: true,
          hasElevatorOnString: false,
          containmentDeviceAttached: false,
          rodSpeedFtPerMin: 0,
        },
        hydraulics: {
          ...prev.hydraulics,
          // Trip mode no longer forces drive/squeeze pressures — the operator
          // sets these via the knobs. Only the brake is released for tripping.
          gripperBrakeSwitch: false,
        },
        yTool: {
          ...prev.yTool,
          depthReadingFt: 0,
        },
      }));
    } else if (mode === 'POOH') {
      setState((prev) => ({
        ...prev,
        ...drillReset,
        activeScenarioId: 'scenario-3-surface',
        currentStepIndex: 0,
        scenarioTimeElapsedSeconds: 0,
        scenarioCompleted: false,
        rod: {
          ...prev.rod,
          currentDepthFt: 4500,
          totalStringWeightLbs: 4500 * prev.rod.linearWeightLbsPerFt,
          calculatedSqueezeRequiredPsi: 2350,
          isLandedOnTagBar: false,
          hasLeaderCable: false,
          hasBulletOnPin: true,
          hasElevatorOnString: false,
          containmentDeviceAttached: false,
          rodSpeedFtPerMin: 0,
        },
        hydraulics: {
          ...prev.hydraulics,
          // Operator sets drive/squeeze pressures via the knobs (not trip mode).
          gripperBrakeSwitch: false,
        },
        yTool: {
          ...prev.yTool,
          depthReadingFt: 4500,
        },
      }));
    } else {
      // FREE TRIP / MID-WELL (2,250 ft)
      setState((prev) => ({
        ...prev,
        ...drillReset,
        rod: {
          ...prev.rod,
          currentDepthFt: 2250,
          totalStringWeightLbs: 2250 * prev.rod.linearWeightLbsPerFt,
          calculatedSqueezeRequiredPsi: 1350,
          isLandedOnTagBar: false,
          rodSpeedFtPerMin: 0,
        },
        hydraulics: {
          ...prev.hydraulics,
          // Operator sets drive/squeeze pressures via the knobs (not trip mode).
          gripperBrakeSwitch: false,
        },
        yTool: {
          ...prev.yTool,
          depthReadingFt: 2250,
        },
      }));
    }
  };

  // Direct Depth adjustment handler
  const handleSetDepth = (targetDepthFt: number) => {
    // PREREQUISITE: the engine must be running (and the start sequence complete)
    // before the string can be positioned. Block + warn otherwise. This backs up
    // the UI-level disabling so keybinds / other entry points can't bypass it.
    const s = stateRef.current;
    if (!s.hydraulics.engineRunning || !s.engineStartSequenceComplete) {
      soundManager.playBuzzerAlert(0.4);
      setShowEngineStartModal(true);
      return;
    }
    setState((prev) => {
      const clampedDepth = Math.max(0, Math.min(prev.rod.totalWellDepthFt, targetDepthFt));
      const stringWeight = clampedDepth * prev.rod.linearWeightLbsPerFt;
      const matchPoint =
        SQUEEZE_PRESSURE_CURVES.find((p) => p.weightLbs >= stringWeight) ||
        SQUEEZE_PRESSURE_CURVES[SQUEEZE_PRESSURE_CURVES.length - 1];
      const minSqueeze = matchPoint.minSqueezePsi;

      return {
        ...prev,
        rod: {
          ...prev.rod,
          currentDepthFt: clampedDepth,
          totalStringWeightLbs: stringWeight,
          // `calculatedSqueezeRequiredPsi` is only a REFERENCE readout of the
          // squeeze the operator SHOULD dial in for this depth — it does NOT set
          // the actual squeeze pressure. The operator controls squeeze via the knob.
          calculatedSqueezeRequiredPsi: minSqueeze,
          isLandedOnTagBar: clampedDepth >= prev.rod.totalWellDepthFt,
        },
        // NOTE: squeezePressureTarget is intentionally NOT changed here — pressure
        // is operator-set only and must not rise automatically with depth.
        yTool: {
          ...prev.yTool,
          depthReadingFt: clampedDepth,
        },
      };
    });
  };

  // =========================================================================
  // INPUT SYSTEM (keyboard + USB gamepad) — maps every bound control id to the
  // appropriate handler / state update. See src/input/ for the registry, the
  // default bindings, and the polling hook.
  // =========================================================================
  const [showBindings, setShowBindings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Intro/buffer splash — shown once on the primary window before the dashboard.
  const [showIntro, setShowIntro] = useState(viewMode === 'full');
  const [showGlossary, setShowGlossary] = useState(false);

  // Read the current value of an analog control (for +/- stepping & axis base).
  const getAnalogValue = (id: string): number => {
    const s = stateRef.current;
    switch (id) {
      case 'joystick': return s.joystickPosition;
      case 'depth': return s.rod.currentDepthFt;
      case 'engine.rpm': return s.hydraulics.engineRpm;
      case 'bop.regulator': return s.bop.bopRegulatorPsi;
      case 'press.up': return s.hydraulics.upPressureTarget;
      case 'press.down': return s.hydraulics.downPressureTarget;
      case 'press.squeeze': return s.hydraulics.squeezePressureTarget;
      case 'press.chainTension': return s.hydraulics.chainTensionTarget;
      case 'press.airRegulator': return s.hydraulics.airRegulatorPsi;
      default: return 0;
    }
  };

  // Apply a control by id. `value` is provided for analog controls.
  const dispatchControl = (id: string, value?: number) => {
    const s = stateRef.current;
    const h = s.hydraulics;
    switch (id) {
      // ----- Drive & Trip -----
      case 'trip.rih': handleSetTripMode('RIH'); break;
      case 'trip.pooh': handleSetTripMode('POOH'); break;
      case 'trip.free': handleSetTripMode('FREE'); break;
      // NOTE on sign: in the physics, joystick > 0 moves the string UP/OUT
      // (depth decreases → POOH) and joystick < 0 moves it DOWN/IN (RIH).
      case 'drive.run': handleJoystickChange(-1); break;  // RIH = run IN (down)
      case 'drive.pull': handleJoystickChange(1); break;  // POOH = pull OUT (up)
      case 'drive.stop': handleJoystickChange(0); break;
      case 'joystick': handleJoystickChange(Math.max(-1, Math.min(1, value ?? 0))); break;
      case 'depth': handleSetDepth(value ?? s.rod.currentDepthFt); break;

      // ----- Engine & Power -----
      // BUG FIX: When toggling engine on, set RPM to idle (was staying at 0)
      case 'engine.toggle': updateHydraulics({ engineRunning: !h.engineRunning, engineRpm: !h.engineRunning ? 1100 : 0 }); break;
      // SAFETY INTERLOCK: PTO cannot engage while engine is off (per manual Section 5.4)
      case 'pto.toggle': {
        if (!h.engineRunning && !h.ptoEngaged) {
          soundManager.playBuzzerAlert(0.5);
          break; // Block PTO engage when engine off
        }
        updateHydraulics({ ptoEngaged: !h.ptoEngaged });
        break;
      }
      case 'engine.rpm': updateHydraulics({ engineRpm: Math.round(value ?? h.engineRpm) }); break;

      // ----- Gripper / Clamp -----
      case 'clamp.install': {
        if (!canInstallMechanicalClamp(s)) {
          soundManager.playBuzzerAlert(0.5);
          break;
        }
        const count = Math.min(2, s.rod.mechanicalClampsInstalled + 1);
        setState((prev) => ({ ...prev, rod: { ...prev.rod, mechanicalClampsInstalled: count, clampTorqueFtLbs: count > 0 ? 550 : 0 } }));
        break;
      }
      case 'clamp.remove': {
        const count = Math.max(0, s.rod.mechanicalClampsInstalled - 1);
        setState((prev) => ({ ...prev, rod: { ...prev.rod, mechanicalClampsInstalled: count, clampTorqueFtLbs: count > 0 ? 550 : 0 } }));
        break;
      }
      case 'gripperBrake.toggle': updateHydraulics({ gripperBrakeSwitch: !h.gripperBrakeSwitch }); break;
      case 'squeezeSwitch.toggle': updateHydraulics({ squeezePressureSwitch: !h.squeezePressureSwitch }); break;
      case 'chainTensionSwitch.toggle': updateHydraulics({ chainTensionSwitch: !h.chainTensionSwitch }); break;
      case 'safetyClamp.toggle': updateHydraulics({ safetyClampLever: h.safetyClampLever === 'ON' ? 'OFF' : 'ON' }); break;

      // ----- BOP & Well Control -----
      case 'bop.toggleClosed': updateBop({ reganBopClosed: !s.bop.reganBopClosed }); break;
      case 'bop.handPump': {
        // BUG FIX: Hand pump now caps at 1250 PSI (was 1500, exceeding manual spec).
        // Per manual: "pump up the Reagan to 1250psi"
        const newBopPressure = Math.min(1250, s.hydraulics.bopPressure + 150);
        updateBop({ handPumpStrokes: s.bop.handPumpStrokes + 1 });
        updateHydraulics({ bopPressure: newBopPressure });
        if (newBopPressure >= 1000) updateBop({ reganBopClosed: true });
        soundManager.playMetalTap();
        break;
      }
      case 'bop.pump.toggle': updateBop({ bopPumpSwitch: !s.bop.bopPumpSwitch }); break;
      case 'bop.bleed.toggle': updateBop({ bopBleedOpen: !s.bop.bopBleedOpen }); break;
      case 'flowTee.toggle': updateBop({ flowTeeValveOpen: !s.bop.flowTeeValveOpen }); break;
      case 'bop.regulator': updateBop({ bopRegulatorPsi: Math.round(value ?? s.bop.bopRegulatorPsi) }); break;

      // ----- Pressures (analog) -----
      // Adjusting a pressure also auto-ENABLES its circuit switch, so the change
      // takes effect immediately (no separate "switch" step needed by the user).
      case 'press.up': updateHydraulics({ upPressureTarget: Math.round(value ?? h.upPressureTarget) }); break;
      case 'press.down': updateHydraulics({ downPressureTarget: Math.round(value ?? h.downPressureTarget) }); break;
      case 'press.squeeze': updateHydraulics({ squeezePressureTarget: Math.round(value ?? h.squeezePressureTarget), squeezePressureSwitch: true }); break;
      case 'press.chainTension': updateHydraulics({ chainTensionTarget: Math.round(value ?? h.chainTensionTarget), chainTensionSwitch: true }); break;
      case 'press.airRegulator': updateHydraulics({ airRegulatorPsi: Math.round(value ?? h.airRegulatorPsi) }); break;

      // ----- Switches -----
      case 'safetyBleed.toggle': updateHydraulics({ safetyBleedValveOpen: !h.safetyBleedValveOpen }); break;
      case 'chainOiler.toggle': updateHydraulics({ chainOilerOn: !h.chainOilerOn }); break;
      case 'panelLights.toggle': updateHydraulics({ panelLightsOn: !h.panelLightsOn }); break;
      case 'tankHeater.toggle': updateHydraulics({ hydraulicTankHeaterOpen: !h.hydraulicTankHeaterOpen }); break;

      // ----- Rig-Up / Safety -----
      case 'reelForks.toggle': setState((prev) => ({ ...prev, rod: { ...prev.rod, reelSafetyForksInPlace: !prev.rod.reelSafetyForksInPlace } })); break;
      case 'containment.attach': setState((prev) => ({ ...prev, rod: { ...prev.rod, containmentDeviceAttached: !prev.rod.containmentDeviceAttached } })); break;
      case 'tapTest': setState((prev) => ({ ...prev, rod: { ...prev.rod, bumpTestPassed: true } })); break;

      // ----- Emergency -----
      case 'estop.trip': handleEmergencyShutdown(); break;
      case 'estop.reset': handleResetEmergencyShutdown(); break;

      // ----- Misc & Emergency Drill Actions -----
      case 'airHorn': soundManager.playAirHorn?.(); setState((prev) => ({ ...prev, airHornSounded: true })); break;
      case 'sound.toggle':
        // Toggle THIS window's local audio (enabling also flips global master on).
        setLocalAudioOn((v) => {
          const next = !v;
          if (next && !stateRef.current.soundEnabled) {
            setState((prev) => ({ ...prev, soundEnabled: true }));
          }
          return next;
        });
        break;
      case 'evacuate.muster': setState((prev) => ({ ...prev, evacuatedToMuster: true })); break;
      case 'scba.equip': setState((prev) => ({ ...prev, scbaEquipped: true })); break;
      case 'fishing.assembleSocket': setState((prev) => ({ ...prev, fishingSocketAssembled: true })); break;
      case 'fishing.cutSample': setState((prev) => ({ ...prev, rodSampleCut: true })); break;

      default: break;
    }
  };

  const input = useInputSystem(dispatchControl, getAnalogValue);

  // React-time deadline (epoch ms) for the currently-active assessment emergency,
  // shown as a countdown in the HUD. null outside an assessment / when idle.
  const assessmentReactDeadline: number | null = (() => {
    const a = state.assessment;
    if (!a || !a.active || a.ended || !state.emergencyScenarioId) return null;
    const ev = a.events[a.events.length - 1];
    if (!ev || ev.resolvedAt) return null;
    const maxReact = a.difficulty === 'realistic' ? 30 : 60;
    return ev.injectedAt + maxReact * 1000;
  })();

  // Whether an emergency is currently active (drives the full-screen red alert
  // overlay + looping alert tone).
  const emergencyOverlayActive = !!state.emergencyScenarioId;

  // Slight, non-annoying looping alert tone while an emergency is unhandled.
  useEffect(() => {
    if (!emergencyOverlayActive) return;
    let cancelled = false;
    const beep = () => {
      if (cancelled) return;
      // Short, quiet warning blip (soundManager respects the global mute).
      soundManager.playBuzzerAlert(0.25);
    };
    beep();
    const id = setInterval(beep, 2600);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [emergencyOverlayActive]);

  // =========================================================================
  // SECONDARY WINDOW RENDERING — pop-out views for multi-monitor setup
  // =========================================================================
  // Floating per-window audio toggle for the secondary pop-ups. Controls ONLY
  // this window's sound so each pop-up can be muted independently.
  const localAudioToggle = (
    <button
      onClick={() => setLocalAudioOn((v) => !v)}
      className={cx(
        'fixed top-3 right-3 z-[200] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border shadow-lg transition-colors text-xs font-semibold',
        localAudioOn
          ? 'bg-green-700 border-green-300 text-white'
          : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50',
      )}
      title={localAudioOn ? 'Mute this window' : 'Unmute this window'}
      aria-label={localAudioOn ? 'Mute this window' : 'Unmute this window'}
    >
      {localAudioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      <span>{localAudioOn ? 'Sound: This window' : 'Muted'}</span>
    </button>
  );

  if (viewMode === '3d') {
    return (
      <div className="h-screen w-screen bg-slate-100 overflow-hidden">
        {localAudioToggle}
        <Rig3DViewport
          state={state}
          fillHeight={true}
        />
      </div>
    );
  }

  if (viewMode === 'console') {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 p-4 overflow-auto">
        {localAudioToggle}
        <div className="text-center text-xs text-slate-500 mb-2 font-mono">
          COROD® MG CONTROL CONSOLE — SECONDARY MONITOR
        </div>
        <WeatherfordControlConsole
          state={state}
          onUpdateHydraulics={updateHydraulics}
          onUpdateBOP={updateBop}
          onUpdateJoystick={handleJoystickChange}
          onSoundAirHorn={() => handleAirHorn(1.2)}
          onTriggerEmergencyStop={handleEmergencyShutdown}
          onResetEmergencyStop={handleResetEmergencyShutdown}
        />
      </div>
    );
  }

  if (viewMode === 'gauges') {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 p-4 overflow-auto">
        {localAudioToggle}
        <div className="text-center text-xs text-slate-500 mb-2 font-mono">
          COROD® MG GAUGE PANEL — SECONDARY MONITOR
        </div>
        <WeatherfordControlConsole
          state={state}
          onUpdateHydraulics={updateHydraulics}
          onUpdateBOP={updateBop}
          onUpdateJoystick={handleJoystickChange}
          onSoundAirHorn={() => handleAirHorn(1.2)}
          onTriggerEmergencyStop={handleEmergencyShutdown}
          onResetEmergencyStop={handleResetEmergencyShutdown}
          embedded={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between font-sans selection:bg-red-600 selection:text-white">
      {/* Intro / buffer splash (primary window only) */}
      {showIntro && <IntroSplash onEnter={() => setShowIntro(false)} />}

      {/* Top Main App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-300 px-4 py-2.5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Manual Spec Title */}
          <div className="flex items-center gap-3">
            <img
              src="/branding/wft-logo.jfif"
              alt="Weatherford"
              className="h-9 w-9 rounded-lg object-cover shadow bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-slate-800">
                  {t('header.title')}
                </h1>
                <Badge tone="neutral">{t('header.rev')}</Badge>
              </div>
              <p className="text-2xs text-slate-500">
                {t('header.subtitle')}
              </p>
            </div>
          </div>

          {/* App-level Controls Bar (reference, help, global settings) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Difficulty Selector */}
            <SegmentedControl
              label={t('header.level')}
              value={state.difficulty}
              onChange={(lvl) => {
                soundManager.playMetalTap();
                setState((prev) => ({ ...prev, difficulty: lvl }));
              }}
              segments={(['trainee', 'operator', 'specialist'] as DifficultyLevel[]).map((lvl) => ({
                id: lvl,
                label: <span>{t(`header.level.${lvl}`)}</span>,
              }))}
            />

            {/* Language Switcher (Earth/Globe) — EN ⇄ Egyptian Arabic */}
            <button
              onClick={() => { soundManager.playMetalTap(); toggleLang(); }}
              className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors font-semibold text-2xs"
              title={t('lang.switch')}
              aria-label={t('lang.switch')}
            >
              <Globe className="w-4 h-4 text-blue-700" />
              <span>{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* Sound Toggle — controls THIS window's audio only (local), so the
                main dashboard can be muted independently of the pop-outs. The
                first time it is enabled it also flips the global master on. */}
            <button
              onClick={() =>
                setLocalAudioOn((v) => {
                  const next = !v;
                  // Enabling local audio also ensures the global master is on so
                  // sound can actually play in this window.
                  if (next && !stateRef.current.soundEnabled) {
                    setState((prev) => ({ ...prev, soundEnabled: true }));
                  }
                  return next;
                })
              }
              className={cx(
                'p-2 rounded-lg border transition-colors',
                localAudioOn && state.soundEnabled
                  ? 'bg-green-700 border-green-300 text-white'
                  : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50',
              )}
              title={localAudioOn ? t('header.sound.on') : t('header.sound.off')}
              aria-label={localAudioOn ? t('header.sound.on') : t('header.sound.off')}
            >
              {localAudioOn && state.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <Button
              variant="ghost"
              icon={<FileText className="w-3.5 h-3.5 text-amber-600" />}
              onClick={() => setShowJsaModal(true)}
            >
              {t('header.jsa')}
            </Button>

            <Button
              variant="ghost"
              icon={<BookOpen className="w-3.5 h-3.5 text-blue-700" />}
              onClick={() => setShowManualModal(true)}
            >
              {t('header.manual')}
            </Button>

            <Button
              variant="ghost"
              icon={<HelpCircle className="w-3.5 h-3.5 text-blue-700" />}
              onClick={() => setShowGlossary(true)}
              title={t('header.glossary')}
            >
              {t('header.glossary')}
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-300">
          {[
            { id: 'console', label: t('tabs.3dview'), icon: Boxes },
            { id: 'setup', label: t('tabs.setup'), icon: Sliders },
            { id: 'scenarios', label: t('tabs.procedures'), icon: BookOpen },
            { id: 'drills', label: t('tabs.emergency'), icon: ShieldAlert },
            { id: 'logbook', label: t('tabs.logbook'), icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = state.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => {
                  soundManager.playMetalTap();
                  setState((prev) => ({ ...prev, activeTab: tab.id as SimulatorTab }));
                }}
                className={cx(
                  'px-3.5 py-2 rounded-lg text-2xs font-semibold transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600',
                  isActive
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 p-4 md:p-6 space-y-6 w-full">
        {/* TAB: 3D VIEW — photoreal operator station + aux panels */}
        {state.activeTab === 'console' && (
          <div className="space-y-4">
            <StatusBanner state={state} />
            {(() => {
              // Well-design stage banner above the 3D view: shows total string
              // weight and, for tapered designs, which segment is being run.
              const design = state.activeWellDesignId
                ? wellDesigns.find((d) => d.id === state.activeWellDesignId)
                : undefined;
              if (!design) return null;
              const stage = currentWellStage(design, state.rod.currentDepthFt);
              const pct = stage && stage.segmentLengthFt > 0
                ? Math.round((stage.runInSegmentFt / stage.segmentLengthFt) * 100)
                : 0;
              return (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border hairline surface-2 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold text-slate-700">{design.name}</span>
                  </div>
                  {stage && stage.segmentCount > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Stage:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        Segment {stage.segmentIndex + 1} / {stage.segmentCount} ({stage.rodSize})
                      </span>
                      <span className="text-slate-500 font-mono text-xs">
                        {Math.round(stage.runInSegmentFt).toLocaleString()} / {Math.round(stage.segmentLengthFt).toLocaleString()} ft ({pct}%)
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-slate-500">String weight:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {Math.round(stringWeightAtDepth(design, state.rod.currentDepthFt)).toLocaleString()} lbs
                    </span>
                    <span className="text-slate-400 text-xs">
                      / {Math.round(stringWeightAtDepth(design, wellDesignTotalDepthFt(design))).toLocaleString()} lbs @ TD
                    </span>
                  </div>
                </div>
              );
            })()}
            <OperatorStationView
              state={state}
              onUpdateHydraulics={updateHydraulics}
              onUpdateBOP={updateBop}
              onUpdateJoystick={handleJoystickChange}
              onSoundAirHorn={() => handleAirHorn(1.5)}
              onTriggerEmergencyStop={handleEmergencyShutdown}
              onResetEmergencyStop={handleResetEmergencyShutdown}
              onSetTripMode={handleSetTripMode}
              onSetDepth={handleSetDepth}
              onInstallClamp={() => {
                if (!canInstallMechanicalClamp(state)) {
                  soundManager.playBuzzerAlert(0.5);
                  return;
                }
                const count = Math.min(2, state.rod.mechanicalClampsInstalled + 1);
                soundManager.playMetalTap();
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, mechanicalClampsInstalled: count, clampTorqueFtLbs: count > 0 ? 550 : 0 },
                }));
              }}
              onRemoveClamp={() => {
                const count = Math.max(0, state.rod.mechanicalClampsInstalled - 1);
                soundManager.playMetalTap();
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, mechanicalClampsInstalled: count, clampTorqueFtLbs: count > 0 ? 550 : 0 },
                }));
              }}
              onEmergencyAction={(action) => {
                if (action === 'evacuate') setState((prev) => ({ ...prev, evacuatedToMuster: true }));
                else if (action === 'scba') setState((prev) => ({ ...prev, scbaEquipped: true }));
              }}
              onSetClampCount={(count: number) => {
                soundManager.playMetalTap();
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, mechanicalClampsInstalled: Math.min(2, Math.max(0, count)), clampTorqueFtLbs: count > 0 ? 550 : 0 },
                }));
              }}
              onTapTest={() => {
                soundManager.playMetalTap();
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, bumpTestPassed: true },
                }));
              }}
              onAttachContainment={() => {
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, containmentDeviceAttached: !prev.rod.containmentDeviceAttached },
                }));
              }}
              onToggleReelSafetyFork={() => {
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, reelSafetyForksInPlace: !prev.rod.reelSafetyForksInPlace },
                }));
              }}
              onStartEngine={() => setShowEngineStartModal(true)}
              onShutdownEngine={() =>
                setState((prev) => ({
                  ...prev,
                  engineStartSequenceComplete: false,
                  hydraulics: { ...prev.hydraulics, engineRunning: false, engineRpm: 0, chargePressure: 0, ptoEngaged: false },
                }))
              }
              onToggleBopClosed={() =>
                setState((prev) => ({
                  ...prev,
                  bop: { ...prev.bop, reganBopClosed: !prev.bop.reganBopClosed },
                }))
              }
              onStrokeBopHandPump={() => {
                setState((prev) => ({
                  ...prev,
                  hydraulics: {
                    ...prev.hydraulics,
                    bopPressure: Math.min(1250, prev.hydraulics.bopPressure + 150),
                  },
                  bop: { ...prev.bop, handPumpStrokes: prev.bop.handPumpStrokes + 1 },
                }));
              }}
            />

            {/* Auxiliary Systems Sub-panel Collapsible */}
            <div className="mt-4">
              <AuxiliaryPanels
                state={state}
                onUpdateBop={updateBop}
                onUpdateYTool={updateYTool}
                onUpdateOutriggers={updateOutriggers}
                onUpdatePicker={updatePicker}
                onUpdateHydraulics={updateHydraulics}
                onSetClampCount={(count: number) => {
                  soundManager.playMetalTap();
                  setState((prev) => ({
                    ...prev,
                    rod: {
                      ...prev.rod,
                      mechanicalClampsInstalled: count,
                      clampTorqueFtLbs: count > 0 ? 550 : 0,
                    },
                  }));
                }}
                onEmergencyAction={(action) => {
                  if (action === 'evacuate') setState((prev) => ({ ...prev, evacuatedToMuster: true }));
                  else if (action === 'scba') setState((prev) => ({ ...prev, scbaEquipped: true }));
                }}
                onStrokeBopHandPump={() => {
                  setState((prev) => ({
                    ...prev,
                    hydraulics: {
                      ...prev.hydraulics,
                      bopPressure: Math.min(1250, prev.hydraulics.bopPressure + 150),
                    },
                    bop: { ...prev.bop, handPumpStrokes: prev.bop.handPumpStrokes + 1 },
                  }));
                }}
              />
            </div>
          </div>
        )}

        {/* TAB: WELL SETUP — equipment config (injector profiles) + well design */}
        {state.activeTab === 'setup' && (
          <WellSetupPanel
            state={state}
            injectorProfiles={injectorProfiles}
            wellDesigns={wellDesigns}
            onSelectInjectorProfile={handleSelectInjectorProfile}
            onSetMeasurementUnits={handleSetMeasurementUnits}
            onInjectorProfilesChanged={setInjectorProfiles}
            onWellDesignsChanged={setWellDesigns}
            onApplyWellDesign={handleApplyWellDesign}
          />
        )}

        {/* TAB 2: STRUCTURED SCENARIOS (8 IN-DEPTH MODULES) */}
        {state.activeTab === 'scenarios' && (
          <div className="space-y-6">
            <ScenarioRunner
              state={state}
              onSelectScenario={(scen) => {
                setState((prev) => ({
                  ...prev,
                  activeScenarioId: scen ? scen.id : null,
                  currentStepIndex: 0,
                  scenarioTimeElapsedSeconds: 0,
                  scenarioCompleted: false,
                }));
              }}
              onAdvanceStep={() => {
                setState((prev) => ({
                  ...prev,
                  currentStepIndex: prev.currentStepIndex + 1,
                }));
              }}
              onResetScenario={() => {
                setState((prev) => ({
                  ...prev,
                  currentStepIndex: 0,
                  scenarioTimeElapsedSeconds: 0,
                  scenarioCompleted: false,
                }));
              }}
              onCompleteScenario={(scen) => {
                setState((prev) => ({
                  ...prev,
                  scenarioCompleted: true,
                  performance: {
                    ...prev.performance,
                    completedScenarios: Array.from(new Set([...prev.performance.completedScenarios, scen.id])),
                    overallScore: Math.min(100, prev.performance.overallScore + 2),
                  },
                }));
              }}
            />

            {/* Realistic Physical Operator Station during Scenario */}
            <OperatorStationView
              state={state}
              onUpdateHydraulics={updateHydraulics}
              onUpdateJoystick={handleJoystickChange}
              onSoundAirHorn={() => handleAirHorn(1.5)}
              onTriggerEmergencyStop={handleEmergencyShutdown}
              onResetEmergencyStop={handleResetEmergencyShutdown}
              onInstallClamp={() => {
                const count = Math.min(2, state.rod.mechanicalClampsInstalled + 1);
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, mechanicalClampsInstalled: count, clampTorqueFtLbs: 550 },
                }));
              }}
              onTapTest={() => {
                soundManager.playMetalTap();
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, bumpTestPassed: true },
                }));
              }}
              onAttachContainment={() => {
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, containmentDeviceAttached: !prev.rod.containmentDeviceAttached },
                }));
              }}
              onToggleReelSafetyFork={() => {
                setState((prev) => ({
                  ...prev,
                  rod: { ...prev.rod, reelSafetyForksInPlace: !prev.rod.reelSafetyForksInPlace },
                }));
              }}
              onStartEngine={() => setShowEngineStartModal(true)}
              onShutdownEngine={() =>
                setState((prev) => ({
                  ...prev,
                  engineStartSequenceComplete: false,
                  hydraulics: { ...prev.hydraulics, engineRunning: false, engineRpm: 0, chargePressure: 0, ptoEngaged: false },
                }))
              }
              onToggleBopClosed={() =>
                setState((prev) => ({
                  ...prev,
                  bop: { ...prev.bop, reganBopClosed: !prev.bop.reganBopClosed },
                }))
              }
              onStrokeBopHandPump={() => {
                setState((prev) => ({
                  ...prev,
                  hydraulics: {
                    ...prev.hydraulics,
                    bopPressure: Math.min(1250, prev.hydraulics.bopPressure + 150),
                  },
                  bop: { ...prev.bop, handPumpStrokes: prev.bop.handPumpStrokes + 1 },
                }));
              }}
            />
          </div>
        )}

        {/* TAB 3: EMERGENCY RESPONSE DRILLS */}
        {state.activeTab === 'drills' && (
          <div className="space-y-6">
            {/* Timed "Start Simulation" assessment run */}
            <AssessmentPanel
              running={!!state.assessment && state.assessment.active && !state.assessment.ended}
              onStart={startAssessment}
              onShowLeaderboard={() => setShowLeaderboard(true)}
            />

            <div className="p-6 rounded-xl bg-white border-2 border-slate-300 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-300 pb-3">
                <div className="p-2 rounded-xl bg-red-600 text-white">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {t('drillsTab.title')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('drillsTab.subtitle')}
                  </p>
                </div>
              </div>

              {state.emergencyScenarioId && (
                <div className="rounded-xl bg-red-50 border border-red-300 p-3 text-sm text-red-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-700 animate-pulse" />
                  {t('drillsTab.active')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
                {EMERGENCY_SCENARIOS.map((emg) => {
                  const sevStyle =
                    emg.severity === 'critical'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : emg.severity === 'high'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-300';
                  const btnStyle =
                    emg.severity === 'critical'
                      ? 'bg-red-700 hover:bg-red-800'
                      : emg.severity === 'high'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-yellow-600 hover:bg-yellow-700';
                  const sevLabel =
                    emg.severity === 'critical'
                      ? t('drillsTab.sev.critical')
                      : emg.severity === 'high'
                      ? t('drillsTab.sev.high')
                      : t('drillsTab.sev.moderate');
                  return (
                    <div
                      key={emg.id}
                      className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${sevStyle}`}
                        >
                          {sevLabel} • {emg.manualSection}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 mt-2">{tData(emg.title)}</h4>
                        <p className="text-xs text-slate-500 mt-1">{tData(emg.cause)}</p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {t('drillsTab.responseSteps', { count: emg.steps.length })}
                        </p>
                      </div>
                      <button
                        disabled={!!state.emergencyScenarioId}
                        onClick={() => {
                          triggerEmergencyScenario(emg.id);
                          setState((prev) => ({ ...prev, activeTab: 'console' }));
                        }}
                        className={`w-full py-2 rounded-lg text-white font-semibold text-xs uppercase shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnStyle}`}
                      >
                        {state.emergencyScenarioId ? t('drillsTab.active.short') : t('drillsTab.inject', { title: tData(emg.title) })}
                      </button>
                    </div>
                  );
                })}

                {/* Random surprise drill */}
                <div className="p-4 rounded-xl bg-white border-2 border-dashed border-slate-400 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border bg-slate-200 text-slate-600 border-slate-400">
                      {t('drillsTab.surprise')}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 mt-2">{t('drillsTab.random.title')}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('drillsTab.random.desc')}
                    </p>
                  </div>
                  <button
                    disabled={!!state.emergencyScenarioId}
                    onClick={() => {
                      const pick =
                        EMERGENCY_SCENARIOS[Math.floor(Math.random() * EMERGENCY_SCENARIOS.length)];
                      triggerEmergencyScenario(pick.id);
                      setState((prev) => ({ ...prev, activeTab: 'console' }));
                    }}
                    className="w-full py-2 rounded-lg bg-slate-500 hover:bg-slate-600 text-white font-semibold text-xs uppercase shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('drillsTab.random.btn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PERFORMANCE ANALYTICS & LOGBOOK */}
        {state.activeTab === 'logbook' && (
          <PerformanceAnalytics
            state={state}
            onAddLogbookEntry={(entry) => {
              setState((prev) => ({
                ...prev,
                logbook: [entry, ...prev.logbook],
              }));
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-300 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        <div>
          Weatherford Enterprise Excellence • GL-PCP-OEPS-L4-11 • COROD® Mobile Gripper™ Operator Training System
        </div>
        <div className="mt-1 text-slate-400">
          Developed by{' '}
          <a
            href="https://linkedin.com/in/whereishassan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:text-red-700 hover:underline font-semibold"
          >
            @whereishassan
          </a>{' '}
          — ALS Egypt Team
        </div>
      </footer>

      {/* Emergency Drill Modal */}
      {activeDrillType && (
        <EmergencyDrillModal
          state={state}
          drillType={activeDrillType}
          onClose={() => {
            setActiveDrillType(null);
            // Clear emergency state when drill modal closes
            setState((prev) => ({
              ...prev,
              activeEmergency: 'none',
              emergencyResolved: false,
            }));
          }}
          onResolveEmergency={() => {
            setState((prev) => ({
              ...prev,
              activeEmergency: 'none',
              emergencyResolved: true,
              performance: {
                ...prev.performance,
                safetyScore: 100,
                emergencyReactionTimeMs: Math.round(1200 + Math.random() * 800),
              },
            }));
          }}
          onUpdateHydraulics={updateHydraulics}
          onUpdateBop={updateBop}
        />
      )}

      {/* Reference Manual Modal */}
      {showManualModal && <ManualReferenceModal onClose={() => setShowManualModal(false)} />}

      {/* Full-screen EMERGENCY alert overlay — a pulsing red vignette + banner so
          it's unmistakable an emergency is active. pointer-events-none keeps the
          console fully usable underneath. */}
      {emergencyOverlayActive && (
        <div className="fixed inset-0 z-[80] pointer-events-none emg-screen-alert">
          <div className="emg-screen-vignette" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-bold uppercase tracking-widest shadow-lg">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            {t('emergencyHud.alertBanner')}
          </div>
        </div>
      )}

      {/* Squeeze-pressure alarm — NON-BLOCKING. All three tiers render as a
          subtle pulsing screen-edge highlight plus a small corner pill that
          shows the live squeeze discrepancy. No acknowledgement required: it
          clears automatically the moment the operator corrects the squeeze. */}
      {state.alarmTier !== 'none' && (() => {
        const psi = Math.round(
          Math.max(0, state.rod.calculatedSqueezeRequiredPsi - state.hydraulics.squeezePressure),
        );
        // Slip & Free-Fall both use RED to match the rod/guide highlight ranges;
        // Tier 3 (emergency) is a deeper red and pulses faster.
        const isEmergency = state.alarmTier === 'emergency';
        const title =
          state.alarmTier === 'slip'
            ? t('alarm.slip.title')
            : state.alarmTier === 'freefall'
            ? t('alarm.freefall.title')
            : t('alarm.lockout.title');
        return (
          <>
            {/* Pulsing red screen-edge vignette (non-interactive). */}
            <div
              className={cx(
                'fixed inset-0 z-[80] pointer-events-none alarm-screen-highlight',
                isEmergency ? 'alarm-screen-highlight--critical' : '',
              )}
            />
            {/* Small pill with the live discrepancy (no ack button). Anchored at
                bottom-CENTER and above the input-status HUD (z-150) so it is never
                hidden behind the bindings indicator in the bottom-right corner. */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[160] pointer-events-none">
              <div
                className={cx(
                  'flex items-center gap-2.5 px-3.5 py-2 rounded-lg shadow-xl text-white',
                  isEmergency ? 'bg-red-800 animate-pulse' : 'bg-red-700',
                )}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <div className="leading-tight">
                  <div className="text-[11px] font-bold uppercase tracking-wide">{title}</div>
                  <div className="text-[10px] font-mono opacity-90">
                    {t('alarm.discrepancy', { psi })}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Interactive Emergency Response HUD (floating, non-blocking) */}
      {state.emergencyScenarioId && (
        <EmergencyResponseHud
          state={state}
          toast={emergencyToast}
          onCancel={cancelEmergencyScenario}
          onHintUsed={handleAssessmentHintUsed}
          hideSteps={state.assessment?.active && state.assessment.difficulty === 'realistic'}
          reactDeadline={assessmentReactDeadline}
        />
      )}

      {/* Timed Assessment status HUD (floating, top-left) */}
      {state.assessment && state.assessment.active && !state.assessment.ended && (
        <AssessmentHud state={state} onEnd={endAssessment} />
      )}

      {/* End-of-run scored report */}
      {state.assessment && state.assessment.ended && (
        <AssessmentReportModal
          session={state.assessment}
          onClose={dismissAssessmentReport}
          onShowLeaderboard={() => setShowLeaderboard(true)}
          onRestart={() => {
            const op = state.assessment!.operator;
            const mins = Math.round(state.assessment!.targetDurationSec / 60);
            const diff = state.assessment!.difficulty;
            dismissAssessmentReport();
            // Re-arm on the next tick so state.assessment is cleared first.
            setTimeout(() => startAssessment(op, mins, diff), 50);
          }}
        />
      )}

      {/* Assessment leaderboard */}
      {showLeaderboard && (
        <LeaderboardModal
          onClose={() => setShowLeaderboard(false)}
          highlightId={state.assessment?.ended ? `lb-${state.assessment.endedAt}` : undefined}
        />
      )}

      {/* Engine Start-Up Sequence Modal */}
      {showEngineStartModal && (
        <EngineStartModal
          state={state}
          onClose={() => setShowEngineStartModal(false)}
          onComplete={() => setState((prev) => ({ ...prev, engineStartSequenceComplete: true }))}
          onUpdateHydraulics={updateHydraulics}
        />
      )}

      {/* Pre-Job JSA Modal */}
      {showJsaModal && (
        <JsaModal
          onClose={() => setShowJsaModal(false)}
          onApproveJsa={() => {
            setShowJsaModal(false);
            setState((prev) => ({
              ...prev,
              performance: {
                ...prev.performance,
                safetyScore: Math.min(100, prev.performance.safetyScore + 5),
              },
            }));
          }}
        />
      )}

      {/* Input status HUD (gamepad/keyboard) + bindings settings modal */}
      <InputStatusHud input={input} onOpenPanel={() => setShowBindings(true)} />
      {showBindings && (
        <ControlBindingsPanel input={input} onClose={() => setShowBindings(false)} />
      )}

      {/* Plain-English glossary */}
      {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}
    </div>
  );
}
