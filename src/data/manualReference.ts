import { TrainingScenario, RodSize, RodGrade } from '../types';

export interface SqueezeRefPoint {
  weightLbs: number;
  minSqueezePsi: number;
}

// Data extracted from Figure 248 & 277-282 (Squeeze pressure vs rod weight)
export const SQUEEZE_PRESSURE_CURVES: SqueezeRefPoint[] = [
  { weightLbs: 0, minSqueezePsi: 400 }, // Warning: never move COROD with < 400 psi squeeze
  { weightLbs: 1000, minSqueezePsi: 550 },
  { weightLbs: 2000, minSqueezePsi: 700 },
  { weightLbs: 3000, minSqueezePsi: 850 },
  { weightLbs: 4000, minSqueezePsi: 1000 },
  { weightLbs: 5000, minSqueezePsi: 1180 },
  { weightLbs: 6000, minSqueezePsi: 1350 },
  { weightLbs: 7000, minSqueezePsi: 1520 },
  { weightLbs: 8000, minSqueezePsi: 1700 },
  { weightLbs: 9000, minSqueezePsi: 1880 },
  { weightLbs: 10000, minSqueezePsi: 2050 },
  { weightLbs: 11000, minSqueezePsi: 2200 },
  { weightLbs: 12000, minSqueezePsi: 2350 },
  { weightLbs: 13000, minSqueezePsi: 2500 }, // Max standard mobile injector dynamic load
];

export const ROD_SPECIFICATIONS: Record<RodSize, { nominalOd: string; weightLbsPerFt: number; areaSqIn: number; shape: 'round' | 'elliptical' }> = {
  '#3': { nominalOd: '13/16" (20.6mm)', weightLbsPerFt: 1.76, areaSqIn: 0.518, shape: 'elliptical' },
  '#4': { nominalOd: '14/16" (22.2mm)', weightLbsPerFt: 2.04, areaSqIn: 0.601, shape: 'elliptical' },
  '#4R': { nominalOd: '14/16" (22.2mm)', weightLbsPerFt: 2.04, areaSqIn: 0.601, shape: 'round' },
  '#6': { nominalOd: '16/16" (25.4mm)', weightLbsPerFt: 2.67, areaSqIn: 0.785, shape: 'elliptical' },
  '#6R': { nominalOd: '16/16" (25.4mm)', weightLbsPerFt: 2.67, areaSqIn: 0.785, shape: 'round' },
  '#7': { nominalOd: '17/16" (27.0mm)', weightLbsPerFt: 3.01, areaSqIn: 0.886, shape: 'elliptical' },
  '#8': { nominalOd: '18/16" (28.6mm)', weightLbsPerFt: 3.38, areaSqIn: 0.994, shape: 'elliptical' },
  '#8.5': { nominalOd: '18.5/16" (29.4mm)', weightLbsPerFt: 3.57, areaSqIn: 1.050, shape: 'elliptical' },
  '#8.5R': { nominalOd: '1 5/32" (29.4mm)', weightLbsPerFt: 3.57, areaSqIn: 1.050, shape: 'round' },
};

// Table 11: Rod Straightening Pressures for Round COROD (psi)
export const ROD_STRAIGHTENING_TABLE = [
  { grade: 'DR' as RodGrade, reel: 'Service Reel', p4: 700, p6: 750, p85: 1150 },
  { grade: 'DR' as RodGrade, reel: 'Transport Reel', p4: 700, p6: 750, p85: 1150 },
  { grade: 'DER' as RodGrade, reel: 'Service Reel', p4: 700, p6: 875, p85: 1300 },
  { grade: 'DER' as RodGrade, reel: 'Transport Reel', p4: 700, p6: 875, p85: 1300 },
  { grade: 'SER' as RodGrade, reel: 'Service Reel', p4: 0, p6: 0, p85: 1450 },
  { grade: 'SER' as RodGrade, reel: 'Transport Reel', p4: 0, p6: 1000, p85: 1450 },
  { grade: 'SWR' as RodGrade, reel: 'Service Reel', p4: 0, p6: 0, p85: 1600 },
  { grade: 'SWR' as RodGrade, reel: 'Transport Reel', p4: 0, p6: 1200, p85: 1600 },
];

// Table 9 & 10: Rod Clamp Guidelines
export function getRecommendedClamp(rodSize: RodSize, stringWeightLbs: number): { type: string; bolts: number; maxWeight: number } {
  if (rodSize === '#6R' || rodSize === '#8.5R') {
    if (stringWeightLbs <= 9800 && rodSize === '#6R') {
      return { type: 'Single Bolt Round (0.59" Radius)', bolts: 1, maxWeight: 9800 };
    }
    if (stringWeightLbs <= 13000 && rodSize === '#8.5R') {
      return { type: 'Single Bolt Round (0.59" Radius)', bolts: 1, maxWeight: 13000 };
    }
    if (stringWeightLbs <= 27600 && rodSize === '#6R') {
      return { type: 'Two Bolt Round (0.59" Radius)', bolts: 2, maxWeight: 27600 };
    }
    if (stringWeightLbs <= 31400 && rodSize === '#8.5R') {
      return { type: 'Two Bolt Round (0.59" Radius)', bolts: 2, maxWeight: 31400 };
    }
    return { type: '(2) Two Bolt Round Clamps (Stacked)', bolts: 4, maxWeight: 62800 };
  } else {
    // Elliptical & other sizes (2.5" radius modified)
    if (stringWeightLbs <= 9000) {
      return { type: 'Single Bolt Elliptical (2.5" Radius)', bolts: 1, maxWeight: 9000 };
    }
    if (stringWeightLbs <= 20300) {
      return { type: 'Two Bolt Elliptical (2.5" Radius)', bolts: 2, maxWeight: 20300 };
    }
    return { type: '(2) Two Bolt Elliptical Clamps (Stacked)', bolts: 4, maxWeight: 40600 };
  }
}

// Table 5: Hydraulic Systems and Correct Operating Pressures
export const HYDRAULIC_OPERATING_LIMITS = {
  chargePressureNeutral: { min: 300, max: 400, unit: 'psi', description: 'With Up/Down joystick in neutral' },
  chargePressureActive: { min: 250, max: 300, unit: 'psi', description: 'When Up/Down joystick is active (>250 psi required)' },
  chargePressureCriticalMin: 250, // Below 250 psi motors freewheel!
  systemPressureRelieved: { min: 2300, max: 2500, unit: 'psi', description: 'Non-adjustable relief valve limit' },
  pickerPressure: { min: 3800, max: 4200, unit: 'psi', description: 'Full output of auxiliary pump for crane' },
  chainTensionPressure: { min: 100, max: 200, unit: 'psi', description: 'Standard injector (HD: 400-600 psi)' },
  squeezePressure: { min: 400, max: 2500, unit: 'psi', description: 'Never move COROD with < 400 psi' },
  safetyPressure: { min: 2500, max: 4200, unit: 'psi', description: 'Emergency backup holding pressure' },
  downPressureMax: 5000,
  upPressureMax: 5000,
  hydraulicTempMax: 70, // Celsius. Shut down above 70°C!
  hydraulicTempMinSafe: 0, // Celsius. Do not operate functions below 0°C.
};

// 8 In-Depth Training Scenarios
export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'scenario-1-pretrip',
    title: 'Pre-Job System Check & Daily Safety Inspections',
    category: 'Rig Up',
    description: 'Perform essential walkaround inspections, test Positive Air Shutdown (Roda valve), check hydraulic warm-up, and conduct the mandatory daily 10-minute Rod Safety Clamp Accumulator leak test.',
    difficulty: 'trainee',
    targetDurationMinutes: 6,
    manualReferences: ['Section 3.4.2', 'Section 5.2.1', 'Section 5.2.3.1', 'Section 5.2.3.2', 'Table 5'],
    successCriteria: [
      'Engine warmed at 1000-1100 RPM idle',
      'Positive Air Shutdown tested and Roda valve manually reset',
      'Hydraulic fluid temp checked (0°C - 50°C)',
      'PTO safely engaged in Hydraulics mode',
      'Safety Accumulator reaches 2500-2800 psi and drops <10% over test',
    ],
    steps: [
      {
        id: 'step-1-1',
        title: 'Start Engine & Check Low Idle RPM',
        instruction: 'Turn on the rig engine. Maintain idle speed at 1000 - 1100 RPM. Do not elevate RPM during initial warmup.',
        manualSection: 'Section 5.2.1 (p. 151)',
        hint: 'Click Engine Start on the Cab / Engine panel and set RPM to 1050.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.engineRunning && state.hydraulics.engineRpm >= 1000 && state.hydraulics.engineRpm <= 1200,
      },
      {
        id: 'step-1-2',
        title: 'Perform Positive Air Shutdown (Roda Valve) Test',
        instruction: 'Hit the Emergency Shut Down switch on the operator console to verify the Roda air solenoid chokes out the engine.',
        manualSection: 'Section 5.2.3.1 (p. 154)',
        hint: 'Click the red Emergency Shut Down switch on the upper console.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.emergencyStopTripped && state.hydraulics.rodaValveClosed,
      },
      {
        id: 'step-1-3',
        title: 'Manually Reset Roda Valve & Restart Engine',
        instruction: 'Raise the hood and turn the Roda valve handle down to re-open the air intake. Then restart the engine.',
        manualSection: 'Section 5.2.3.1 (p. 154)',
        hint: 'Click "Reset Roda Valve" under Engine Controls, then Start Engine.',
        isCompleted: false,
        validationFn: (state) => !state.hydraulics.rodaValveClosed && state.hydraulics.engineRunning,
      },
      {
        id: 'step-1-4',
        title: 'Engage Hydraulic Pump Drive (PTO)',
        instruction: 'Depress clutch 5s -> switch to "Hydraulics" -> select 8th gear high range -> release clutch slowly to 1300 RPM.',
        manualSection: 'Section 5.4 (p. 168)',
        hint: 'Toggle PTO to "Hydraulics" on the Transfer Case panel.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.ptoEngaged && state.hydraulics.chargePressure >= 300,
      },
      {
        id: 'step-1-5',
        title: 'Conduct Rod Safety Accumulator 10-Min Leak Test',
        instruction: 'Engage Safety Clamp (Lever DOWN), observe gauge reach 2500+ psi, then disengage pump and verify pressure drops <10% (250 psi).',
        manualSection: 'Section 3.4.2 & 5.2.3.2 (p. 34, 155)',
        hint: 'Switch Safety Lever to ON (Down position) and verify safety pressure.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.safetyClampLever === 'ON' && state.hydraulics.safetyPressure >= 2400,
      },
    ],
  },
  {
    id: 'scenario-2-rigup',
    title: 'Outrigger Ground Stabilization & Knuckle Picker Setup',
    category: 'Rig Up',
    description: 'Stabilize the Mobile Gripper carrier on the well pad using the 6-spool outrigger valve bank, wooden pads, wheel chocks, and operate the Fassi F150A Knuckle Crane within safe 14-foot load envelope.',
    difficulty: 'trainee',
    targetDurationMinutes: 7,
    manualReferences: ['Section 3.6.1', 'Section 3.6.2', 'Section 5.6', 'Section 5.10.1'],
    successCriteria: [
      'Wheel chocks in place at rear wheels',
      'Wooden outrigger pads centered under feet',
      'Outriggers fully extended and lowered without lifting rear drive wheels off ground',
      'Truck chassis perfectly leveled',
      'Knuckle picker operated with lockout valve open and radius <= 14 ft for injector load',
    ],
    steps: [
      {
        id: 'step-2-1',
        title: 'Deploy Wheel Chocks & Wooden Outrigger Pads',
        instruction: 'Position wheel chocks behind rear wheels and position 16x16x3/4" 4-ply wooden pads under outrigger feet.',
        manualSection: 'Section 4.16.1 & 5.6 (p. 80, 170)',
        hint: 'Toggle Wheel Chocks and Wooden Pads in the Outriggers panel.',
        isCompleted: false,
        validationFn: (state) => state.outriggers.wheelChocksPlaced && state.outriggers.woodenPadsUnderLeft && state.outriggers.woodenPadsUnderRight,
      },
      {
        id: 'step-2-2',
        title: 'Extend Outrigger Beams (Left & Right)',
        instruction: 'Disengage outrigger latches and push valve levers 2 & 3 to extend outriggers fully.',
        manualSection: 'Section 3.6.1 & 5.6 (p. 37, 170)',
        hint: 'Click "Extend Left" and "Extend Right" on Outrigger Bank.',
        isCompleted: false,
        validationFn: (state) => state.outriggers.leftExtended && state.outriggers.rightExtended,
      },
      {
        id: 'step-2-3',
        title: 'Lower Outriggers & Level Truck (Maintain Wheel Contact)',
        instruction: 'Lower outriggers simultaneously to level the rig. WARNING: Never lift rear tires off ground (front brakes do not lock!).',
        manualSection: 'Section 5.6 (p. 171)',
        hint: 'Lower both outriggers until leveled; ensure rear wheels remain on ground.',
        isCompleted: false,
        validationFn: (state) => state.outriggers.leftLowered && state.outriggers.rightLowered && state.outriggers.truckLeveled && state.outriggers.rearWheelsOnGround,
      },
      {
        id: 'step-2-4',
        title: 'Open Knuckle Picker Lockout Valve & Check Reach Limit',
        instruction: 'Open the crane lockout quarter-turn valve (Valve #5). Ensure crane radius does not exceed 14 ft when lifting the 4200 lb injector.',
        manualSection: 'Section 3.6.2 (p. 38)',
        hint: 'Open Crane Lockout Valve on the Picker Controls.',
        isCompleted: false,
        // FIX: Manual says "does not exceed 14 ft" — was checking <= 15
        validationFn: (state) => state.picker.craneLockoutValveOpen && state.picker.telescopeLengthFt <= 14,
      },
    ],
  },
  {
    id: 'scenario-3-surface',
    title: 'Surfacing COROD (Tripping Out of Hole)',
    category: 'Operation',
    description: 'Pull continuous rod string from 4,500 ft to surface onto the Service Reel. Set correct Squeeze Pressure per weight curve, monitor Charge Pressure, control motor speed, attach Rod Containment at guide mouth, and place Rod Elevator on string before bottom pin hits gripper.',
    difficulty: 'operator',
    targetDurationMinutes: 10,
    manualReferences: ['Section 3.3', 'Section 6.2', 'Section 6.3', 'Section 6.6', 'Section 6.8', 'Figure 248'],
    successCriteria: [
      'Squeeze pressure set >= required curve value for rod weight',
      'Minimum Up Pressure used to detect tubing obstructions',
      'Optical Rod Counter & Y-Tool monitored',
      'Rod Containment Device locked at guide mouth before final exit',
      'Rod elevator placed above BOP to protect bottom pin from entering injector',
    ],
    steps: [
      {
        id: 'step-3-1',
        title: 'Verify Rig Up & Set Initial Squeeze Pressure',
        instruction: 'For 4,500 ft of #6 COROD (~12,000 lbs), set Squeeze Pressure to 2350-2450 psi. Turn Squeeze Pressure Switch ON.',
        manualSection: 'Section 6.3 & Figure 248 (p. 226, 227)',
        hint: 'Rotate Squeeze Pressure knob to ~2350 psi, then flip Squeeze Switch ON.',
        isCompleted: false,
        // FIX: Instruction says "2350-2450 psi" — was accepting >= 2200 (too lenient)
        validationFn: (state) => state.hydraulics.squeezePressureSwitch && state.hydraulics.squeezePressure >= 2300,
      },
      {
        id: 'step-3-2',
        title: 'Set Chain Tension & Release Gripper Brake',
        instruction: 'Turn on Chain Tension (150-200 psi) and release the Gripper Brake switch to allow chain rotation.',
        manualSection: 'Section 6.2 (p. 225)',
        hint: 'Chain Tension ON, Gripper Brake OFF.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.chainTensionSwitch && !state.hydraulics.gripperBrakeSwitch && state.hydraulics.chainTensionPressure >= 120,
      },
      {
        id: 'step-3-3',
        title: 'Modulate Up Pressure & Engage Joystick UP',
        instruction: 'Adjust Up Pressure to ~3000 psi (just enough to pull string smoothly). Deflect Gripper Joystick UP to start surfacing.',
        manualSection: 'Section 6.4 (p. 228)',
        hint: 'Drag joystick upward to begin pulling rod string up.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.upPressure >= 2000 && state.joystickPosition > 0.2 && state.rod.rodSpeedFtPerMin > 10,
      },
      {
        id: 'step-3-4',
        title: 'Install Protective Rod Elevator Near Surface',
        instruction: 'As depth reaches <100 ft, slow speed and install a rod elevator on string above BOP to prevent the bottom pin from entering gripper!',
        manualSection: 'Section 6.2 (p. 225)',
        hint: 'When depth < 200 ft, click "Install Safety Rod Elevator" on the wellhead actions.',
        isCompleted: false,
        validationFn: (state) => state.rod.currentDepthFt <= 100 && state.rod.hasElevatorOnString,
      },
      {
        id: 'step-3-5',
        title: 'Attach Rod Containment Device at Guide Mouth',
        instruction: 'Attach the Rod Containment Device at the service reel mouth before the pin exits to contain elastic uncoiling energy.',
        manualSection: 'Section 6.6 & 6.8 (p. 238, 240)',
        hint: 'Click "Attach Rod Containment Device" on the Reel panel.',
        isCompleted: false,
        validationFn: (state) => state.rod.containmentDeviceAttached && state.rod.currentDepthFt <= 20,
      },
    ],
  },
  {
    id: 'scenario-4-install',
    title: 'Tripping In / New Install & Hydraulic Rod Straightener',
    category: 'Operation',
    description: 'Run new #6R COROD from Transport Trailer into wellbore. Engage Hydraulic Rod Straightener with correct orientation & 2500 psi pressure. Back off Down Pressure past 300m, slow down near bottom, and detect tag bar landing.',
    difficulty: 'operator',
    targetDurationMinutes: 10,
    manualReferences: ['Section 6.4', 'Section 6.9', 'Section 7.3', 'Table 11', 'Appendix A'],
    successCriteria: [
      'Transport Safety Forks managed safely',
      'Hydraulic Rod Straightener calibrated and engaged at 2500 psi',
      'Down pressure reduced as rod weight pulls itself into hole',
      'Up pressure increased as dynamic brake to prevent runaways',
      'Tag bar soft landing detected (weight drop to near zero)',
    ],
    steps: [
      {
        id: 'step-4-1',
        title: 'Engage Hydraulic Rod Straightener for #6R',
        instruction: 'Set selector lever to #6R, move straightener lever to ENGAGE, and verify gauge reads 2500 psi.',
        manualSection: 'Section 7.3.1 & 7.3.2 (p. 259, 260)',
        hint: 'In the Rod Straightener panel, select 6R and click ENGAGE.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.systemPressure >= 2300,
      },
      {
        id: 'step-4-2',
        title: 'Set Initial Down Pressure & Trip Downhole',
        instruction: 'Set Down Pressure to 1500 psi to push rod through guide. Deflect joystick DOWN to start tripping into well.',
        manualSection: 'Section 6.4 (p. 228)',
        hint: 'Drag joystick down to begin injecting rod.',
        isCompleted: false,
        validationFn: (state) => state.joystickPosition < -0.2 && state.rod.rodSpeedFtPerMin < -10,
      },
      {
        id: 'step-4-3',
        title: 'Back Off Down Pressure & Increase Up Pressure (Dynamic Brake)',
        instruction: 'As string depth passes 1,000 ft (300m), back off Down Pressure to 0 and raise Up Pressure to 3500 psi to act as dynamic brake!',
        manualSection: 'Section 6.4 (p. 228)',
        hint: 'Reduce Down Pressure knob to minimum; increase Up Pressure knob.',
        isCompleted: false,
        // FIX: Instruction says "passes 1,000 ft" and "3500 psi" — was 800 ft / 2500 psi
        validationFn: (state) => state.rod.currentDepthFt >= 1000 && state.hydraulics.downPressureTarget <= 200 && state.hydraulics.upPressureTarget >= 3200,
      },
      {
        id: 'step-4-4',
        title: 'Detect Tag Bar Landing & Mark Zero Weight',
        instruction: 'Slow decent as depth approaches 4,000 ft target. When string contacts tag bar, rod weight drops to near zero. Stop gripper and mark Zero Weight.',
        manualSection: 'Appendix A (p. 274-275)',
        hint: 'Slow speed as depth approaches 4000 ft; wait for tag bar contact, then apply Gripper Brake.',
        isCompleted: false,
        // FIX: Also verify rod has actually stopped moving (not just brake applied mid-descent)
        validationFn: (state) => state.rod.isLandedOnTagBar && state.hydraulics.gripperBrakeSwitch && Math.abs(state.rod.rodSpeedFtPerMin) < 1,
      },
    ],
  },
  {
    id: 'scenario-5-emergency-freefall',
    title: 'EMERGENCY DRILL: Loss of Charge Pressure / Freefalling String',
    category: 'Emergency Drill',
    description: 'CRITICAL FAILURE: Charge pressure drops below 250 psi causing gripper motor freewheeling risk. Execute immediate emergency response: 1. Slam Rod Safety Clamp lever DOWN; 2. Blast Rig Air Horn; 3. Evacuate if string moving; 4. Apply 2 mechanical clamps with 500 ft-lb torque; 5. Tap test 3 times.',
    difficulty: 'specialist',
    targetDurationMinutes: 4,
    manualReferences: ['Section 3.4.2', 'Section 3.6.4', 'Section 4.17', 'Section 4.18', 'Section 6.5.2'],
    successCriteria: [
      'Safety Clamp engaged (Lever DOWN) within 3.0 seconds of alarm',
      'Air Horn sounded to alert wellsite crew',
      'Two mechanical rod clamps installed',
      'Torque tightened in 3 balanced stages to 500-600 ft-lbs',
      '3-Tap bump test executed without rod slipping',
    ],
    steps: [
      {
        id: 'step-5-1',
        title: 'IMMEDIATE ACTION: Slam Rod Safety Clamp Lever DOWN',
        instruction: 'Charge pressure failed (<250 psi)! Move Safety On/Off lever DOWN immediately to clamp the rod string with accumulator power.',
        manualSection: 'Section 4.17 & 4.18 (p. 83, 84)',
        hint: 'Click the Rod Safety Clamp lever on the lower console to switch to ON (Lever DOWN).',
        isCriticalSafetyStep: true,
        isCompleted: false,
        validationFn: (state) => state.hydraulics.safetyClampLever === 'ON' && state.hydraulics.safetyPressure >= 2000,
      },
      {
        id: 'step-5-2',
        title: 'Signal Emergency: Sound One Long Air Horn Blast',
        instruction: 'Press and hold the Rig Air Horn to alert all wellsite and service rig personnel.',
        manualSection: 'Section 4.18 Step 2 (p. 84)',
        hint: 'Click the Air Horn button.',
        isCriticalSafetyStep: true,
        isCompleted: false,
        // FIX: Was always-true. Now tracks actual air horn activation.
        validationFn: (state) => state.airHornSounded,
      },
      {
        id: 'step-5-3',
        title: 'Install 2 Mechanical Rod Clamps on BOP Plate',
        instruction: 'The safety accumulator will only hold pressure for a few minutes! Clean rod with solvent, place BOP plate, and install TWO 2-bolt clamps.',
        manualSection: 'Section 4.18 & 6.5.2 (p. 84, 234-235)',
        hint: 'Click "Install Mechanical Rod Clamp" twice in the Wellhead Clamp panel.',
        isCompleted: false,
        validationFn: (state) => state.rod.mechanicalClampsInstalled >= 2 && state.rod.clampTorqueFtLbs >= 500,
      },
      {
        id: 'step-5-4',
        title: 'Perform Mandatory 3-Tap Bump Test',
        instruction: 'Raise and tap the clamp against the BOP plate 3 times to ensure zero slippage.',
        manualSection: 'Section 6.5.2 & Warning (p. 236)',
        hint: 'Click "Perform 3-Tap Bump Test" until 3 taps are registered.',
        isCompleted: false,
        validationFn: (state) => state.rod.bumpTestPassed,
      },
    ],
  },
  {
    id: 'scenario-6-blowout',
    title: 'EMERGENCY DRILL: Well Kick & Rapid BOP Shut-In',
    category: 'Emergency Drill',
    description: 'Well kick detected (pressure surge up casing). Execute rapid shut-in: Sound air horn, set gripper brake, activate Automatic BOP Pump to inflate Regan BOP to 1250 psi within 60 seconds (EUB compliance), secure mechanical rod clamp, and muster crew.',
    difficulty: 'specialist',
    targetDurationMinutes: 4,
    manualReferences: ['Section 3.2.1', 'Section 3.6.6', 'Section 4.19', 'Section 5.2.3.4'],
    successCriteria: [
      'Rig air horn sounded immediately',
      'Gripper brake applied',
      'Automatic BOP pump activated (120 psi air -> 1250 psi BOP pressure)',
      'BOP closure achieved in < 60 seconds (EUB regulation)',
      'Mechanical rod clamp installed on BOP plate',
    ],
    steps: [
      {
        id: 'step-6-1',
        title: 'Raise Alarm & Apply Gripper Brake',
        instruction: 'Sound the air horn and switch Gripper Brake ON immediately to halt rod movement.',
        manualSection: 'Section 4.19 (p. 85)',
        hint: 'Air horn blast + Gripper Brake switch ON.',
        isCompleted: false,
        validationFn: (state) => state.hydraulics.gripperBrakeSwitch,
      },
      {
        id: 'step-6-2',
        title: 'Activate Automatic BOP Pump & Inflate Regan BOP',
        instruction: 'Turn BOP Pump Switch ON. Adjust air regulator to bring BOP pressure up to 1000 - 1250 psi to seal well annulus.',
        manualSection: 'Section 3.6.6 & 5.2.3.4 (p. 45, 157)',
        hint: 'Switch BOP Pump ON and adjust regulator to 1250 psi.',
        isCompleted: false,
        validationFn: (state) => state.bop.bopPumpSwitch && state.hydraulics.bopPressure >= 1000,
      },
      {
        id: 'step-6-3',
        title: 'Install Mechanical Rod Clamp & Evacuate to Muster Point',
        instruction: 'Install rod clamp on BOP plate, bump test, and confirm all personnel at designated upwind muster point.',
        manualSection: 'Section 4.19 (p. 85)',
        hint: 'Install mechanical rod clamp and verify well secure.',
        isCompleted: false,
        validationFn: (state) => state.rod.mechanicalClampsInstalled >= 1 && state.rod.bumpTestPassed,
      },
    ],
  },
  {
    id: 'scenario-7-h2s',
    title: 'EMERGENCY DRILL: H2S Sour Gas Alarm & SCBA Rescue',
    category: 'Emergency Drill',
    description: 'Personal GasAlert monitor detects Hydrogen Sulfide (>10 ppm). A crew member falls prone near the well ("Man Down"). Follow H2S emergency procedure: Sound 1 long horn blast, evacuate upwind to muster point, account for all crew, don SCBA, perform single-man backward arm drag rescue.',
    difficulty: 'specialist',
    targetDurationMinutes: 5,
    manualReferences: ['Section 4.7', 'Section 4.20', 'Figure 50', 'Figure 51'],
    successCriteria: [
      '1 long horn blast sounded',
      'Immediate evacuation to upwind muster point',
      '100% crew head count verified before rescue entry',
      'SCBA (Self Contained Breathing Apparatus) equipped',
      'Victim dragged backwards under arms to fresh air',
    ],
    steps: [
      {
        id: 'step-7-1',
        title: 'Sound Air Horn Alert & Halt Operations',
        instruction: 'Sound 1 long air horn blast to notify the entire lease of an H2S emergency.',
        manualSection: 'Section 4.20 Step 2 (p. 86)',
        hint: 'Trigger Air Horn blast.',
        isCompleted: false,
        // FIX: Was always-true. Now validates air horn was actually sounded.
        validationFn: (state) => state.airHornSounded,
      },
      {
        id: 'step-7-2',
        title: 'Evacuate Lease to Upwind Muster Point',
        instruction: 'Evacuate all non-down personnel to the designated muster point based on windsock direction.',
        manualSection: 'Section 4.20 Step 4 (p. 86)',
        hint: 'Click "Evacuate to Muster Point" on the Emergency panel.',
        isCompleted: false,
        // FIX: Was always-true. Now validates evacuation action was taken.
        validationFn: (state) => state.evacuatedToMuster,
      },
      {
        id: 'step-7-3',
        title: 'Don SCBA Breathing Apparatus',
        instruction: 'Never attempt rescue without Self-Contained Breathing Apparatus (SCBA)! Equip SCBA before entering contaminated zone.',
        manualSection: 'Section 4.20 Step 6 (p. 86)',
        hint: 'Click "Equip SCBA Gear".',
        isCompleted: false,
        // FIX: Was always-true. Now validates SCBA was equipped.
        validationFn: (state) => state.scbaEquipped,
      },
      {
        id: 'step-7-4',
        title: 'Execute Single-Man Backward Drag Rescue',
        instruction: 'Hitch arms under victim\'s arms and drag backward out of hot zone. Never drag by feet or hoist on shoulder.',
        manualSection: 'Section 4.20 Step 7 & Figure 50 (p. 87)',
        hint: 'Click "Perform Backward Arm Drag Rescue".',
        isCompleted: false,
        validationFn: (state) => state.emergencyResolved,
      },
    ],
  },
  {
    id: 'scenario-8-fishing',
    title: 'Fishing Parted Rod & Y-Tool Wear Inspection',
    category: 'Special Procedure',
    description: 'A COROD string parted downhole. Retrieve upper fish, calibrate the Y-Tool with 0.750" & 1.160" test bar, monitor 0.900" alarm, assemble Reversible Slip-Type Sucker Rod Socket, fish lower section, and cut 10-12" sample with hacksaw (never torch!).',
    difficulty: 'specialist',
    targetDurationMinutes: 12,
    manualReferences: ['Section 4.27.11', 'Section 6.10', 'Section 6.11', 'Appendix E'],
    successCriteria: [
      'Y-Tool calibrated with 2-point reference bar (0.750" & 1.160")',
      'Reversible slip socket assembled in correct bowl with spring guide',
      'Parted rod smoothly engaged and surfaced',
      '10-12" sample cut with hacksaw and stored in padded envelope for analysis',
    ],
    steps: [
      {
        id: 'step-8-1',
        title: 'Calibrate Y-Tool Optical Caliper',
        instruction: 'Power on Y-Tool, enter calibration (hold keys 2+3 for 5s), clamp 0.750" bar, press key 1, clamp 1.160" bar, press key 1.',
        manualSection: 'Section 4.27.11.8 (p. 140-145)',
        hint: 'In the Y-Tool panel, click "Run 2-Point Calibration".',
        isCompleted: false,
        validationFn: (state) => state.yTool.calibrated,
      },
      {
        id: 'step-8-2',
        title: 'Assemble Reversible Slip-Type Fishing Socket',
        instruction: 'Assemble reversible slips into spring clip, insert into bowl, install spring guide & spring, thread top cap.',
        manualSection: 'Section 6.10 & Figures 263-268 (p. 244-246)',
        hint: 'In Fishing Tools, click "Assemble Slip Socket".',
        isCompleted: false,
        // FIX: Was always-true. Now validates fishing socket assembly action.
        validationFn: (state) => state.fishingSocketAssembled,
      },
      {
        id: 'step-8-3',
        title: 'Fish Lower String & Surface with Polished Rod Wheel',
        instruction: 'Trip fishing tool to depth, engage fish (use Polish Rod Wheel to persuade slips if needed), and surface string.',
        manualSection: 'Section 4.26.15 & Appendix E (p. 117, 308)',
        hint: 'Surface fished string into injector.',
        isCompleted: false,
        validationFn: (state) => state.rod.currentDepthFt <= 50,
      },
      {
        id: 'step-8-4',
        title: 'Cut 10-12" Sample with Hacksaw (Never Torch)',
        instruction: 'Close BOP/Rod Wiper to prevent gas sparks. Use hacksaw to cut 10-12" fracture sample. Wipe dry with rag (no chemicals) and package in padded envelope.',
        manualSection: 'Section 6.11 (p. 249, 309)',
        hint: 'Click "Cut 12-inch Parted Sample with Hacksaw".',
        isCompleted: false,
        // FIX: Was always-true. Now validates BOP closed and sample cut action.
        validationFn: (state) => state.bop.reganBopClosed && state.rodSampleCut,
      },
    ],
  },
];
