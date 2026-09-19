/**
 * Type definitions for the COROD Mobile Gripper Operator Simulator
 * Based on Weatherford Continuous Rod & Well Services Operations Manual (GL-PCP-OEPS-L4-11)
 */

export type DifficultyLevel = 'trainee' | 'operator' | 'specialist';

export type SimulatorTab = 'simulator' | 'console' | 'auxiliary' | 'scenarios' | 'drills' | 'logbook' | 'manual';

export type JobType = 'install' | 'surface' | 'rerun' | 'fishing' | 'pump_change' | 'slant';

export type RodShape = 'round' | 'elliptical';

export type RodGrade = 'D' | 'DE' | 'SE' | 'DW' | 'SW';

export type RodSize = '#3' | '#4' | '#4R' | '#6' | '#6R' | '#7' | '#8' | '#8.5' | '#8.5R';

export interface HydraulicState {
  // Pressures in PSI
  chargePressure: number;     // 300-400 in neutral, 250-300 in op, <250 = CRITICAL FAIL
  systemPressure: number;     // max 2500 psi (regulated)
  pickerPressure: number;     // up to 4200 psi
  chainTensionPressure: number; // 100-200 psi standard, 400-600 psi HD
  squeezePressure: number;    // 0-2500 psi
  safetyPressure: number;     // 2500-4200 psi (accumulator circuit)
  downPressure: number;       // 0-5000 psi
  upPressure: number;         // 0-5000 psi
  bopPressure: number;        // 0-1500 psi (target 1000-1250 psi)
  
  // Settings & Adjusters (0 - 100% or absolute psi)
  // Operator-set targets; the physics loop follows these rather than ramping to
  // hardcoded values or scaling with well depth.
  chainTensionTarget: number;
  squeezePressureTarget: number;
  upPressureTarget: number;
  downPressureTarget: number;
  
  // Temperatures
  hydraulicFluidTempC: number; // Safe: 0°C to 50°C, Danger >70°C
  ambientTempC: number;
  
  // Switches & Valves
  ptoEngaged: boolean;        // Transmission in "Hydraulics"
  engineRunning: boolean;
  engineRpm: number;          // Idle: 1000-1100, Working: 1300 RPM
  chainTensionSwitch: boolean;
  squeezePressureSwitch: boolean;
  gripperBrakeSwitch: boolean;// On = locked, Off = free
  safetyClampLever: 'OFF' | 'ON'; // Lever DOWN = ON (clamps rod)
  safetyBleedValveOpen: boolean;
  safetyPressureTarget: number;   // Operator-set safety pressure (knob), nom 2800 psi
  emergencyStopTripped: boolean; // Positive air shutoff / Roda valve tripped
  rodaValveClosed: boolean;
  coolerBypassMode: 'AUTO' | 'MANUAL';
  enginePreheaterOn: boolean;
  hydraulicTankHeaterOpen: boolean;
  chainOilerOn: boolean;
  panelLightsOn: boolean;
  airRegulatorPsi: number;
  
  // Accumulators
  safetyAccumulatorCharge: number; // Nominal pre-charge: 1200 psi
  pressureBeamAccumulatorCharge: number; // Nominal pre-charge: 900 psi
}

export interface BOPState {
  reganBopClosed: boolean;
  airSupplyPsi: number;       // Truck air system: 120 psi
  bopRegulatorPsi: number;    // Regulated air/hydraulic pressure (1000-1250 psi)
  bopPumpSwitch: boolean;
  bopBleedOpen: boolean;
  handPumpStrokes: number;
  flowTeeValveOpen: boolean;  // 1" ball valve for flushing/killing
  hammerUnionTight: boolean;
  spacerPlateInstalled: boolean;
}

export interface RodStringState {
  rodGrade: RodGrade;
  rodShape: RodShape;
  rodSize: RodSize;
  totalWellDepthFt: number;
  currentDepthFt: number;     // 0 = surface/tag bar, >0 downhole
  rodSpeedFtPerMin: number;   // -100 to +100
  linearWeightLbsPerFt: number; // e.g. 2.04 for #4, 2.67 for #6, 3.57 for #8.5
  totalStringWeightLbs: number;
  calculatedSqueezeRequiredPsi: number;
  rodCenteredInGripper: boolean;
  rodGripSlipping: boolean;
  rodInTensionOrCompression: 'neutral' | 'tension' | 'compression' | 'freefall';
  isLandedOnTagBar: boolean;
  isObstructed: boolean;
  hasLeaderCable: boolean;
  hasBulletOnPin: boolean;
  hasElevatorOnString: boolean;
  mechanicalClampsInstalled: number; // 0, 1, or 2 clamps
  clampTorqueFtLbs: number;   // Target 500-600 ft-lbs
  bumpTestPassed: boolean;
  containmentDeviceAttached: boolean;
  reelSafetyForksInPlace: boolean;
  rodWearDiameterInchX: number; // e.g. 0.920"
  rodWearDiameterInchY: number; // e.g. 0.915" (<0.900" triggers alarm)
}

export interface OutriggerState {
  leftExtended: boolean;
  rightExtended: boolean;
  leftLowered: boolean;
  rightLowered: boolean;
  woodenPadsUnderLeft: boolean;
  woodenPadsUnderRight: boolean;
  truckLeveled: boolean;
  rearWheelsOnGround: boolean; // Must remain on ground
  wheelChocksPlaced: boolean;
  outriggerLatchesEngaged: boolean;
}

export interface KnucklePickerState {
  craneLockoutValveOpen: boolean;
  telescopeLengthFt: number;  // 6 to 40 ft (safe with injector max 14 ft!)
  angleDegrees: number;
  rotationDegrees: number;
  currentLiftWeightLbs: number;
  maxRatedLoadAtReachLbs: number;
  overloaded: boolean;
}

export interface YToolState {
  poweredOn: boolean;
  nitrogenPressurePsi: number; // 55 - 65 psi
  displayMode: 'dimensions' | 'rate' | 'temperature';
  unitSystem: 'imperial' | 'metric';
  alarmSounding: boolean;
  alarmVisual: boolean;
  calibrated: boolean;
  measuredDiameterX: number;
  measuredDiameterY: number;
  depthReadingFt: number;
}

export interface ScenarioStep {
  id: string;
  title: string;
  instruction: string;
  manualSection: string;
  hint?: string;
  isCompleted: boolean;
  isCriticalSafetyStep?: boolean;
  validationFn: (state: SimulatorState) => boolean;
}

export interface TrainingScenario {
  id: string;
  title: string;
  category: 'Rig Up' | 'Operation' | 'Emergency Drill' | 'Special Procedure' | 'Maintenance';
  description: string;
  difficulty: DifficultyLevel;
  targetDurationMinutes: number;
  steps: ScenarioStep[];
  successCriteria: string[];
  manualReferences: string[];
}

export interface TelemetryPoint {
  timestamp: number;
  depthFt: number;
  speedFtMin: number;
  stringWeightLbs: number;
  squeezePressurePsi: number;
  chargePressurePsi: number;
  safetyPressurePsi: number;
  hydraulicTempC: number;
}

export interface LogbookEntry {
  id: string;
  date: string;
  wellLocation: string;
  unitNumber: string;
  operatorName: string;
  jobType: JobType;
  rodType: string;
  maxDepthFt: number;
  totalWeightLbs: number;
  inspectionsCompleted: {
    walkaround: boolean;
    positiveAirShutdown: boolean;
    rodSafetyAccumulator10MinTest: boolean;
    bopTest1250Psi: boolean;
    knucklePickerInspection: boolean;
    rodElevatorsCheck: boolean;
    hydraulicFluidUnivisN32: boolean;
    wireRopesSlings: boolean;
  };
  drillsConducted: string[];
  safetyScore: number;
  comments: string;
  certifiedStamp: boolean;
}

export interface OperatorPerformance {
  operatorName: string;
  overallScore: number;
  safetyScore: number;
  hydraulicEfficiencyScore: number;
  emergencyReactionTimeMs: number;
  completedScenarios: string[];
  completedDrills: string[];
  penalties: {
    timestamp: number;
    reason: string;
    points: number;
  }[];
  competencyPillars: {
    wellControl: number;       // 0 - 100
    rigStability: number;      // 0 - 100
    hydraulicRegulation: number; // 0 - 100
    emergencyReaction: number; // 0 - 100
    proceduralAccuracy: number; // 0 - 100
  };
}

// ---------------------------------------------------------------------------
// Timed Assessment Run ("Start Simulation")
// ---------------------------------------------------------------------------

/** Personal details entered before a timed assessment run. */
export interface AssessmentOperator {
  name: string;
  role: string;
  unit: string;
}

/**
 * Assessment difficulty.
 * - 'guided'   : the Response HUD shows the ordered step list + hints (training).
 * - 'realistic': no steps or hints are shown — the operator must know the correct
 *                response from memory (certification-grade difficulty).
 */
export type AssessmentDifficulty = 'guided' | 'realistic';

/** Per-emergency-event record captured during an assessment run. */
export interface AssessmentEvent {
  scenarioId: string;
  /** epoch ms when the fault was injected. */
  injectedAt: number;
  /** epoch ms of the operator's first correct action (first step advance). */
  firstActionAt: number | null;
  /** epoch ms when the whole scenario was resolved. */
  resolvedAt: number | null;
  /** Number of "Show me" hints the operator used on this event. */
  hintsUsed: number;
  /** Count of time-critical steps whose limit was exceeded. */
  timedOutSteps: number;
}

/**
 * Live timed-assessment session. `null` when no run is active.
 * Drives the Start-Simulation flow: sequential random emergencies, reaction
 * timing, hint penalties, and the end-of-run scored report.
 */
export interface AssessmentSession {
  active: boolean;
  operator: AssessmentOperator;
  /** Difficulty of the run (controls whether steps/hints are shown). */
  difficulty: AssessmentDifficulty;
  /** epoch ms when the run started. */
  startedAt: number;
  /** Fixed run length in seconds — the run HARD-ENDS at this time. */
  targetDurationSec: number;
  /**
   * epoch ms at which the NEXT emergency should be injected. The orchestrator
   * sets this after each resolution (a randomized quiet gap). null = inject as
   * soon as possible (used at run start / immediately after resolution before a
   * gap is scheduled).
   */
  nextInjectAt: number | null;
  /** Timestamped event records (one per injected emergency). */
  events: AssessmentEvent[];
  /** Total hints used across the whole run. */
  hintsUsedTotal: number;
  /** True once the run has finished (report shown). */
  ended: boolean;
  /** epoch ms when the run ended. */
  endedAt: number | null;
}

/** A persisted leaderboard entry (saved to localStorage) for a finished run. */
export interface LeaderboardEntry {
  id: string;
  name: string;
  role: string;
  unit: string;
  score: number;
  grade: string;
  difficulty: AssessmentDifficulty;
  eventsResolved: number;
  eventsHandled: number;
  avgReactionSec: number | null;
  hintsUsed: number;
  durationSec: number;
  /** epoch ms when the run finished. */
  timestamp: number;
}

export interface SimulatorState {
  hydraulics: HydraulicState;
  bop: BOPState;
  rod: RodStringState;
  outriggers: OutriggerState;
  picker: KnucklePickerState;
  yTool: YToolState;
  joystickPosition: number; // -1.0 (full down) to 1.0 (full up)
  
  // Global & Simulation Meta
  activeTab: SimulatorTab;
  difficulty: DifficultyLevel;
  activeScenarioId: string | null;
  currentStepIndex: number;
  scenarioTimeElapsedSeconds: number;
  scenarioCompleted: boolean;
  isSimulating: boolean;
  simulationSpeedMultiplier: number;
  soundEnabled: boolean;

  // Engine start-up gate: operation is locked until the daily engine
  // start sequence (Section 5.2) has been completed by the operator.
  engineStartSequenceComplete: boolean;
  
  // Active Emergency/Fault Injections
  activeEmergency: 'none' | 'charge_pressure_loss' | 'freefalling_rod' | 'well_kick' | 'h2s_alarm' | 'chain_bunching' | 'hydraulic_overheat' | 'lightning_warning';
  emergencyTriggerTime: number | null;
  emergencyResolved: boolean;

  // Interactive emergency-response session (drives the Emergency Response HUD).
  // `emergencyScenarioId` matches an EMERGENCY_SCENARIOS entry id; null when idle.
  emergencyScenarioId: string | null;
  emergencyStepIndex: number;

  // Timed assessment run ("Start Simulation"). null when no run is active.
  assessment: AssessmentSession | null;

  // Emergency drill tracking flags (for scenario validation)
  airHornSounded: boolean;
  evacuatedToMuster: boolean;
  scbaEquipped: boolean;
  fishingSocketAssembled: boolean;
  rodSampleCut: boolean;
  
  // Analytics & History
  telemetry: TelemetryPoint[];
  performance: OperatorPerformance;
  logbook: LogbookEntry[];
}
