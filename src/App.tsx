import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulatorState,
  SimulatorTab,
  DifficultyLevel,
  TelemetryPoint,
} from './types';
import { ROD_SPECIFICATIONS, SQUEEZE_PRESSURE_CURVES } from './data/manualReference';
import { useInputSystem } from './input/useInputSystem';
import { ControlBindingsPanel } from './components/ControlBindingsPanel';
import { InputStatusHud } from './components/InputStatusHud';
import { StatusBanner } from './components/StatusBanner';
import { GlossaryModal } from './components/GlossaryModal';
import { ControlDashboard } from './components/ControlDashboard';
import { soundManager } from './utils/audio';
import { OperatorStationView } from './components/OperatorStationView';
import { AuxiliaryPanels } from './components/AuxiliaryPanels';
import { ScenarioRunner } from './components/ScenarioRunner';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { EmergencyDrillModal } from './components/EmergencyDrillModal';
import { ManualReferenceModal } from './components/ManualReferenceModal';
import { JsaModal } from './components/JsaModal';
import { EngineStartModal } from './components/EngineStartModal';
import { Rig3DViewport } from './components/Rig3DViewport';
import { WeatherfordControlConsole } from './components/WeatherfordControlConsole';

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
} from 'lucide-react';

const INITIAL_STATE: SimulatorState = {
  hydraulics: {
    chargePressure: 350,
    systemPressure: 2450,
    pickerPressure: 4100,
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
  activeTab: 'simulator',
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

  useEffect(() => {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === 'state-update') {
        setState(e.data.state);
      } else if (e.data?.type === 'state-patch') {
        setState((prev) => ({ ...prev, ...e.data.patch }));
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

function getViewMode(): 'full' | '3d' | 'console' | 'gauges' | 'controls' {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === '3d' || view === 'console' || view === 'gauges' || view === 'controls') return view;
  return 'full';
}

export default function App() {
  const [state, setState] = useState<SimulatorState>(INITIAL_STATE);
  const viewMode = useRef(getViewMode()).current;
  const isSecondary = viewMode !== 'full';
  const { broadcastPatch } = useMultiScreenSync(state, setState, isSecondary);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showJsaModal, setShowJsaModal] = useState<boolean>(false);
  const [showEngineStartModal, setShowEngineStartModal] = useState<boolean>(false);
  const [activeDrillType, setActiveDrillType] = useState<'freefall' | 'blowout' | 'h2s' | 'overheat' | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Sound muting
  useEffect(() => {
    soundManager.setMuted(!state.soundEnabled);
  }, [state.soundEnabled]);

  // Main Physics & Hydraulic Simulation Tick (100ms interval)
  useEffect(() => {
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
          const targetCharge = prev.activeEmergency === 'charge_pressure_loss' ? 180 : joyActive ? 280 : 360;
          hyd.chargePressure = hyd.chargePressure + (targetCharge - hyd.chargePressure) * 0.2;

          // Ramp system & picker pressure dynamically (not instant)
          hyd.systemPressure = hyd.systemPressure + (2450 - hyd.systemPressure) * 0.15;
          hyd.pickerPressure = hyd.pickerPressure + (4100 - hyd.pickerPressure) * 0.12;
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
        } else if (bop.bopPumpSwitch) {
          // Per manual: "pump up the Reagan to 1250psi" — auto pump caps at 1250
          hyd.bopPressure = Math.min(1250, hyd.bopPressure + 80);
          if (hyd.bopPressure >= 1000) {
            bop.reganBopClosed = true;
          }
        } else {
          // BUG FIX: BOP pressure leaks slowly when pump is off (no perfect seal)
          hyd.bopPressure = Math.max(0, hyd.bopPressure - 2);
          if (hyd.bopPressure < 500) {
            bop.reganBopClosed = false;
          }
        }

        // 3. String Dynamics & Speed Calculations
        const spec = ROD_SPECIFICATIONS[rod.rodSize] || ROD_SPECIFICATIONS['#6R'];
        rod.linearWeightLbsPerFt = spec.weightLbsPerFt;

        // Tag bar weight: ramp gradually when lifting off bottom (per manual:
        // weight depends on "amount of COROD which is down hole at any point").
        // Avoid sudden snap from 0→full that would spike squeeze requirement.
        const calculatedWeight = rod.currentDepthFt * rod.linearWeightLbsPerFt;
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

        let targetSpeed = 0;
        if (isSafetyOn || isClampedMech) {
          targetSpeed = 0;
          rod.rodInTensionOrCompression = 'neutral';
          rod.rodGripSlipping = false;
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
        };
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Update handlers
  const updateHydraulics = (updates: Partial<SimulatorState['hydraulics']>) => {
    setState((prev) => ({
      ...prev,
      hydraulics: { ...prev.hydraulics, ...updates },
    }));
  };

  const updateBop = (updates: Partial<SimulatorState['bop']>) => {
    setState((prev) => ({
      ...prev,
      bop: { ...prev.bop, ...updates },
    }));
  };

  const updateYTool = (updates: Partial<SimulatorState['yTool']>) => {
    setState((prev) => ({
      ...prev,
      yTool: { ...prev.yTool, ...updates },
    }));
  };

  const updateOutriggers = (updates: Partial<SimulatorState['outriggers']>) => {
    setState((prev) => ({
      ...prev,
      outriggers: { ...prev.outriggers, ...updates },
    }));
  };

  const updatePicker = (updates: Partial<SimulatorState['picker']>) => {
    setState((prev) => ({
      ...prev,
      picker: { ...prev.picker, ...updates },
    }));
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
          downPressureTarget: 1500,
          downPressure: 1500,
          upPressureTarget: 1200,
          upPressure: 1200,
          squeezePressureTarget: 800,
          squeezePressure: 800,
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
          downPressureTarget: 200,
          downPressure: 200,
          upPressureTarget: 3200,
          upPressure: 3200,
          squeezePressureTarget: 2350,
          squeezePressure: 2350,
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
          downPressureTarget: 1400,
          downPressure: 1400,
          upPressureTarget: 2800,
          upPressure: 2800,
          squeezePressureTarget: 1400,
          squeezePressure: 1400,
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
          calculatedSqueezeRequiredPsi: minSqueeze,
          isLandedOnTagBar: clampedDepth >= prev.rod.totalWellDepthFt,
        },
        hydraulics: {
          ...prev.hydraulics,
          squeezePressureTarget: Math.max(prev.hydraulics.squeezePressureTarget, minSqueeze),
        },
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
        const newBopPressure = Math.min(1250, s.hydraulics.bopPressure + 50);
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
      case 'sound.toggle': setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled })); break;
      case 'evacuate.muster': setState((prev) => ({ ...prev, evacuatedToMuster: true })); break;
      case 'scba.equip': setState((prev) => ({ ...prev, scbaEquipped: true })); break;
      case 'fishing.assembleSocket': setState((prev) => ({ ...prev, fishingSocketAssembled: true })); break;
      case 'fishing.cutSample': setState((prev) => ({ ...prev, rodSampleCut: true })); break;

      default: break;
    }
  };

  const input = useInputSystem(dispatchControl, getAnalogValue);

  // Trip mode detection: use actual rod movement direction, not hardcoded depth thresholds
  const isRihActive = state.rod.rodSpeedFtPerMin < -0.5;
  const isPoohActive = state.rod.rodSpeedFtPerMin > 0.5;

  // =========================================================================
  // SECONDARY WINDOW RENDERING — pop-out views for multi-monitor setup
  // =========================================================================
  if (viewMode === '3d') {
    return (
      <div className="h-screen w-screen bg-slate-950 overflow-hidden">
        <Rig3DViewport
          state={state}
          fillHeight={true}
        />
      </div>
    );
  }

  if (viewMode === 'console') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 overflow-auto">
        <div className="text-center text-xs text-slate-500 mb-2 font-mono">
          COROD® MG CONTROL CONSOLE — SECONDARY MONITOR
        </div>
        <WeatherfordControlConsole
          state={state}
          onUpdateHydraulics={updateHydraulics}
          onUpdateBOP={updateBop}
          onUpdateJoystick={handleJoystickChange}
          onSoundAirHorn={() => soundManager.playAirHorn(1.2)}
          onTriggerEmergencyStop={handleEmergencyShutdown}
          onResetEmergencyStop={handleResetEmergencyShutdown}
        />
      </div>
    );
  }

  if (viewMode === 'gauges') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 overflow-auto">
        <div className="text-center text-xs text-slate-500 mb-2 font-mono">
          COROD® MG GAUGE PANEL — SECONDARY MONITOR
        </div>
        <WeatherfordControlConsole
          state={state}
          onUpdateHydraulics={updateHydraulics}
          onUpdateBOP={updateBop}
          onUpdateJoystick={handleJoystickChange}
          onSoundAirHorn={() => soundManager.playAirHorn(1.2)}
          onTriggerEmergencyStop={handleEmergencyShutdown}
          onResetEmergencyStop={handleResetEmergencyShutdown}
          embedded={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-red-600 selection:text-white">
      {/* Top Main App Header */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-2.5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Manual Spec Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-700 flex items-center justify-center font-bold text-lg text-white shadow">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-100 uppercase">
                  COROD® Mobile Gripper™ Simulator
                </h1>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-semibold uppercase tracking-wider">
                  REV 25
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Weatherford Continuous Sucker Rod &amp; Wellsite Operations Trainer
              </p>
            </div>
          </div>

          {/* Trip Mode & Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Trip Mode Buttons in Header */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 px-1.5">
                TRIP:
              </span>
              <button
                id="btn-header-rih"
                onClick={() => handleSetTripMode('RIH')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono uppercase transition-all flex items-center gap-1 ${
                  isRihActive
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-emerald-400 hover:text-white hover:bg-emerald-950/60'
                }`}
                title="Run In Hole (RIH): lower the rods DOWN into the well. Starts at surface (0 ft)."
              >
                <span>↓ Lower In (RIH)</span>
              </button>
              <button
                id="btn-header-pooh"
                onClick={() => handleSetTripMode('POOH')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono uppercase transition-all flex items-center gap-1 ${
                  isPoohActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-blue-400 hover:text-white hover:bg-blue-950/60'
                }`}
                title="Pull Out Of Hole (POOH): pull the rods UP out of the well. Starts at bottom (4,500 ft)."
              >
                <span>↑ Pull Out (POOH)</span>
              </button>
              <button
                id="btn-header-free"
                onClick={() => handleSetTripMode('FREE')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono uppercase transition-all ${
                  !isRihActive && !isPoohActive
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-purple-400 hover:text-white hover:bg-purple-950/60'
                }`}
                title="Free Trip: start mid-well (2,250 ft)."
              >
                <span>↕ Mid-Well (Free)</span>
              </button>
            </div>

            {/* Difficulty Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold uppercase text-slate-400 px-2">Level:</span>
              {(['trainee', 'operator', 'specialist'] as DifficultyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  id={`btn-diff-${lvl}`}
                  onClick={() => {
                    soundManager.playMetalTap();
                    setState((prev) => ({ ...prev, difficulty: lvl }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase transition-all ${
                    state.difficulty === lvl
                      ? 'bg-red-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
              className={`p-2 rounded-xl border transition-all ${
                state.soundEnabled
                  ? 'bg-slate-800 border-slate-700 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
              title="Toggle Audio Feedback"
              aria-label={state.soundEnabled ? 'Mute audio' : 'Enable audio'}
            >
              {state.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Multi-Screen Pop-Out Buttons */}
            {viewMode === 'full' && (
              <div className="hidden lg:flex items-center gap-1 ml-2 pl-2 border-l border-slate-800">
                {[
                  { view: '3d', label: '3D View', icon: '🖥️' },
                  { view: 'console', label: 'Console', icon: '🎛️' },
                  { view: 'gauges', label: 'Gauges', icon: '⏱️' },
                ].map((item) => (
                  <button
                    key={item.view}
                    onClick={() => {
                      window.open(
                        `${window.location.pathname}?view=${item.view}`,
                        `corod-${item.view}`,
                        'width=1200,height=900,menubar=no,toolbar=no'
                      );
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all"
                    title={`Pop out ${item.label} to a new window (for second monitor)`}
                  >
                    {item.icon} ↗
                  </button>
                ))}
              </div>
            )}

            {/* Engine Start Sequence Trigger */}
            <button
              id="btn-start-engine"
              onClick={() => setShowEngineStartModal(true)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-sm transition-all ${
                state.engineStartSequenceComplete
                  ? 'bg-emerald-950 hover:bg-emerald-900 border-emerald-700 text-emerald-300'
                  : 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white animate-pulse'
              }`}
              title="Run the daily engine start-up sequence (Manual §5.2)"
            >
              <Power className="w-3.5 h-3.5" />
              {state.engineStartSequenceComplete ? 'Engine Running' : 'Start Engine'}
            </button>

            {/* Pre-Job JSA Modal Trigger */}
            <button
              id="btn-open-jsa"
              onClick={() => setShowJsaModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Site JSA (4.12)
            </button>

            {/* Reference Manual Modal Trigger */}
            <button
              id="btn-open-manual"
              onClick={() => setShowManualModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              Operations Manual
            </button>

            {/* Plain-English Glossary — helps trainees decode the jargon */}
            <button
              id="btn-open-glossary"
              onClick={() => setShowGlossary(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800 text-xs font-semibold text-cyan-200 flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Look up any term in plain English"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-300" />
              What do these mean?
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-800">
          {[
            { id: 'simulator', label: 'Run the Machine', icon: Gauge },
            { id: 'console', label: '3D View (Advanced)', icon: Boxes },
            { id: 'scenarios', label: 'Step-by-Step Procedures', icon: BookOpen },
            { id: 'drills', label: 'Emergency Practice', icon: ShieldAlert },
            { id: 'logbook', label: 'Log & Scores', icon: Activity },
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 focus:outline-2 focus:outline-offset-2 focus:outline-red-500 ${
                  isActive
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
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
        {/* TAB 1: INTEGRATED SIMULATOR & CONTROLS */}
        {state.activeTab === 'simulator' && (
          <div className="space-y-4">
            {/* Plain-English "what's happening / what to do next" banner */}
            <StatusBanner state={state} />

            {/* Clean, organized main control dashboard (everything, tidy) */}
            <ControlDashboard
              state={state}
              onUpdateHydraulics={updateHydraulics}
              onUpdateBOP={updateBop}
              onSetJoystick={handleJoystickChange}
              onAirHorn={() => soundManager.playAirHorn?.()}
              onEmergencyStop={handleEmergencyShutdown}
              onEmergencyReset={handleResetEmergencyShutdown}
            />
          </div>
        )}

        {/* TAB: 3D VIEW (ADVANCED) — photoreal operator station + aux panels */}
        {state.activeTab === 'console' && (
          <div className="space-y-4">
            <StatusBanner state={state} />
            <OperatorStationView
              state={state}
              onUpdateHydraulics={updateHydraulics}
              onUpdateBOP={updateBop}
              onUpdateJoystick={handleJoystickChange}
              onSoundAirHorn={() => soundManager.playAirHorn(1.5)}
              onTriggerEmergencyStop={handleEmergencyShutdown}
              onResetEmergencyStop={handleResetEmergencyShutdown}
              onSetTripMode={handleSetTripMode}
              onSetDepth={handleSetDepth}
              onInstallClamp={() => {
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
              onToggleSound={() =>
                setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
              }
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
                    bopPressure: Math.min(1500, prev.hydraulics.bopPressure + 150),
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
                onStrokeBopHandPump={() => {
                  setState((prev) => ({
                    ...prev,
                    hydraulics: {
                      ...prev.hydraulics,
                      bopPressure: Math.min(1500, prev.hydraulics.bopPressure + 150),
                    },
                    bop: { ...prev.bop, handPumpStrokes: prev.bop.handPumpStrokes + 1 },
                  }));
                }}
              />
            </div>
          </div>
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
              onSoundAirHorn={() => soundManager.playAirHorn(1.5)}
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
              onToggleSound={() =>
                setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
              }
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
                    bopPressure: Math.min(1500, prev.hydraulics.bopPressure + 150),
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
            <div className="p-6 rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-red-600 text-white">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-slate-100">
                    High-Risk Emergency Response Drills & Reaction Timers
                  </h3>
                  <p className="text-xs text-slate-400">
                    Practice rapid reactions under simulated failure conditions with millisecond precision
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* Drill 1 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                      DRILL 1 • SECTION 4.18
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-2">
                      Loss of Charge Pressure / Freefall
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Charge &lt;250 psi triggers freewheeling. Slam Safety Lever DOWN, blast horn, install 2 clamps, tap test 3x.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDrillType('freefall');
                      setState((prev) => ({ ...prev, activeEmergency: 'charge_pressure_loss', emergencyResolved: false, emergencyTriggerTime: Date.now() }));
                    }}
                    className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase shadow-md active:scale-95"
                  >
                    Launch Freefall Drill
                  </button>
                </div>

                {/* Drill 2 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                      DRILL 2 • SECTION 4.19
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-2">
                      Well Blowout & Rapid BOP Shut-In
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Well kick detected. Inflate Regan BOP to 1250 psi under 60 seconds (EUB standard) and secure rod clamp.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDrillType('blowout');
                      setState((prev) => ({ ...prev, activeEmergency: 'well_kick', emergencyResolved: false, emergencyTriggerTime: Date.now() }));
                    }}
                    className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase shadow-md active:scale-95"
                  >
                    Launch Blowout Drill
                  </button>
                </div>

                {/* Drill 3 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                      DRILL 3 • SECTION 4.20
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-2">
                      H2S Sour Gas Release & Rescue
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      GasBadge alarm triggers. Evacuate to upwind muster, equip SCBA, execute backward arm drag rescue.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDrillType('h2s');
                      setState((prev) => ({ ...prev, activeEmergency: 'h2s_alarm', emergencyResolved: false, emergencyTriggerTime: Date.now() }));
                    }}
                    className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase shadow-md active:scale-95"
                  >
                    Launch H2S Drill
                  </button>
                </div>

                {/* Drill 4 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                      DRILL 4 • SECTION 4.23.5
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-2">
                      Hydraulic Overheat (&gt;70°C)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Fluid temp exceeds 70°C. Disengage load, clamp rod, switch cooler fan bypass to MANUAL, shut down.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDrillType('overheat');
                      setState((prev) => ({
                        ...prev,
                        activeEmergency: 'hydraulic_overheat',
                        emergencyResolved: false,
                        emergencyTriggerTime: Date.now(),
                        hydraulics: { ...prev.hydraulics, hydraulicFluidTempC: 78 }, // force overheat
                      }));
                    }}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase shadow-md active:scale-95"
                  >
                    Launch Overheat Drill
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
      <footer className="bg-slate-950 border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        Weatherford Enterprise Excellence • GL-PCP-OEPS-L4-11 • COROD® Mobile Gripper™ Operator Training System
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
