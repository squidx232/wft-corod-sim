import React, { useState } from 'react';
import { AnalogGauge } from './AnalogGauge';
import { PhysicalBallLever } from './PhysicalBallLever';
import { PhysicalMicrometerKnob } from './PhysicalMicrometerKnob';
import { PhysicalEmergencyShutdown } from './PhysicalEmergencyShutdown';
import { PhysicalJoystick } from './PhysicalJoystick';
import { PhysicalWingBleedValve } from './PhysicalWingBleedValve';
import { PhysicalBopValve } from './PhysicalBopValve';
import { PhysicalPanelLightsSwitch } from './PhysicalPanelLightsSwitch';
import { PhysicalChainOilerSwitch } from './PhysicalChainOilerSwitch';
import { SimulatorState } from '../types';
import {
  ShieldAlert,
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface WeatherfordControlConsoleProps {
  state: SimulatorState;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onUpdateBOP: (updates: Partial<SimulatorState['bop']>) => void;
  onUpdateJoystick: (pos: number) => void;
  onSoundAirHorn: () => void;
  onTriggerEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
  /** Embedded/dashboard mode (used inside the Operator Cab). Strips the heavy
      outer enclosure frame, width cap and the tall nameplate header so the
      actual gauges and controls get maximum room and read as a built-in dash. */
  embedded?: boolean;
}

export const WeatherfordControlConsole: React.FC<WeatherfordControlConsoleProps> = ({
  state,
  onUpdateHydraulics,
  onUpdateBOP,
  onUpdateJoystick,
  onSoundAirHorn,
  onTriggerEmergencyStop,
  onResetEmergencyStop,
  embedded = false,
}) => {
  const { hydraulics, bop, joystickPosition } = state;
  const [showAuxiliary, setShowAuxiliary] = useState(false);
  const [safetyReliefWheelRot, setSafetyReliefWheelRot] = useState(0);
  const [controlsOnTop, setControlsOnTop] = useState(false);

  const isChargePressureCritical =
    hydraulics.chargePressure < 250 && hydraulics.engineRunning;
  const isSafetyEngaged = hydraulics.safetyClampLever === 'ON';
  // Rod running (RIH/POOH/any operation) → gauges vibrate harder.
  const operationActive =
    Math.abs(state.rod.rodSpeedFtPerMin) > 0.5 || Math.abs(joystickPosition) > 0.05;

  const handleSafetyReliefClick = () => {
    soundManager.playMetalTap();
    setSafetyReliefWheelRot((prev) => prev + 72);
    onUpdateHydraulics({
      safetyBleedValveOpen: !hydraulics.safetyBleedValveOpen,
    });
  };

  return (
    <div className={`flex flex-col gap-4 w-full select-none font-sans ${embedded ? '' : 'max-w-7xl mx-auto'}`}>
      {/* Critical Safety Alert Banner if Charge Pressure fails */}
      {isChargePressureCritical && (
        <div className="rounded-xl bg-red-950/95 border-2 border-red-500 p-4 flex flex-wrap items-center justify-between gap-3 text-red-100 shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
            <div>
              <span className="font-bold text-sm block text-red-200 uppercase tracking-wide">
                CRITICAL SAFETY WARNING: CHARGE PRESSURE &lt; 250 PSI
              </span>
              <p className="text-xs text-red-300">
                Hydraulic drive motor freewheel hazard. Continuous rod string can drop freely downhole.
                Lock string with Rod Safety Clamp (V) immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateHydraulics({ safetyClampLever: 'ON' })}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg transition-all"
          >
            ENGAGE SAFETY CLAMP NOW
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTHENTIC WEATHERFORD INDUSTRIAL CONTROL CONSOLE ENCLOSURE                */}
      {/* Dark Graphite Outer Frame with Bold Crimson Red Instrument Faceplates    */}
      {/* ========================================================================= */}
      <div className={`rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] relative overflow-hidden flex flex-col ${embedded ? 'border-2 border-neutral-800 p-0' : 'border-[6px] border-red-800 p-0'}`}>
        {/* Red frame border like the real truck body */}
        <div className="absolute inset-0 bg-red-900/20 pointer-events-none" />
        
        {/* Top Console Header Bar with Stamped Weatherford Nameplate.
            Hidden in embedded/cab mode to save vertical room (air-horn &
            E-stop are available from the rig HUD). */}
        <div className={`order-first items-center justify-between px-4 py-2.5 bg-gradient-to-b from-[#c0c8d0] to-[#b0b8c4] border-b-2 border-slate-500 relative z-10 ${embedded ? 'hidden' : 'flex'}`}>
          <div className="flex items-center gap-2">
            {/* Hex socket bolt */}
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-inner">
              <div className="w-1.5 h-1.5 bg-neutral-950 rounded-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest font-mono text-slate-800">
                WEATHERFORD COROD® MOBILE GRIPPER™ CONSOLE
              </span>
              <span className="text-[9px] font-mono text-slate-600 font-bold tracking-wider">
                MG-093 OPERATOR WORKSTATION • REAR PLATFORM CONTROLS
              </span>
            </div>
          </div>

            {/* Unified panel — no need for order toggle anymore */}
            {/* (Header 'Rig Air Horn' button removed — the HORN button in the
                console body is the single air-horn control.) */}

            {hydraulics.emergencyStopTripped && (
              <button
                type="button"
                onClick={onResetEmergencyStop}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-md animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Air Cutoff</span>
              </button>
            )}

            {/* Hex socket bolt */}
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-inner">
              <div className="w-1.5 h-1.5 bg-neutral-950 rounded-sm" />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* UNIFIED CONSOLE PANEL — Brushed Aluminum, Single Screen       */}
        {/* Gauges directly above their controls, no scrolling needed      */}
        {/* Matches real Weatherford console photo layout exactly          */}
        {/* ================================================================= */}
        <div className="bg-gradient-to-b from-[#b8bfca] via-[#a8b0bc] to-[#9aa3af] p-3 sm:p-4 relative overflow-hidden">
          
          {/* Brushed metal texture overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-black/15 pointer-events-none" />
          {/* Corner mounting screws */}
          <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600 shadow-inner" />
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600 shadow-inner" />
          <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600 shadow-inner" />
          <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600 shadow-inner" />

          {/* ============================================================= */}
          {/* SINGLE UNIFIED GRID — everything visible at once              */}
          {/* Left 7 cols: gauges + controls, Right 5 cols: large gauges    */}
          {/* ============================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 relative z-10">
            
            {/* ----------------------------------------------------------- */}
            {/* LEFT AREA: GAUGES + THEIR CONTROLS IN VERTICAL COLUMNS      */}
            {/* ----------------------------------------------------------- */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              
              {/* -------- UPPER GAUGES ROW 1: Charge, System, Picker -------- */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center">
                {/* 1. CHARGE PRESSURE — hydraulic charge/freewheel circuit (0-600) */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-charge-press"
                  letterLabel="E"
                  title="CHARGE PRESSURE"
                  subtitle="0 - 600 PSI"
                  value={hydraulics.chargePressure}
                  min={0}
                  max={600}
                  unit="PSI"
                  bezelStyle="chrome"
                  size="md"
                  silverPlacard={true}
                  criticalLow={250}
                  zones={[
                    { from: 0, to: 250, color: '#ef4444' },
                    { from: 250, to: 350, color: '#22c55e' },
                    { from: 350, to: 600, color: '#3b82f6' },
                  ]}
                />

                {/* 2. SYSTEM PRESSURE — main regulated circuit, max 2500 PSI       */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-system-press"
                  letterLabel="F"
                  title="SYSTEM PRESSURE"
                  subtitle="0 - 3000 PSI"
                  value={hydraulics.systemPressure}
                  min={0}
                  max={3000}
                  unit="PSI"
                  bezelStyle="chrome-red-ring"
                  size="md"
                  silverPlacard={true}
                  criticalHigh={2600}
                  zones={[
                    { from: 0, to: 2000, color: '#3b82f6' },
                    { from: 2000, to: 2500, color: '#22c55e' },
                    { from: 2500, to: 3000, color: '#ef4444' },
                  ]}
                />

                {/* 3. PICKER PRESSURE — picker/crane hydraulic circuit (0-5000)     */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-picker-press"
                  title="PICKER PRESSURE"
                  subtitle="0 - 5000 PSI"
                  value={hydraulics.pickerPressure}
                  min={0}
                  max={5000}
                  unit="PSI"
                  bezelStyle="chrome"
                  size="md"
                  silverPlacard={true}
                  zones={[
                    { from: 0, to: 3500, color: '#3b82f6' },
                    { from: 3500, to: 4500, color: '#22c55e' },
                    { from: 4500, to: 5000, color: '#ef4444' },
                  ]}
                />
              </div>

              {/* ROW 2 (BOTTOM): Chain Tension, Squeeze Pressure, Safety Pressure */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-center">
                {/* 4. CHAIN TENSION — 100-200 PSI standard, 400-600 PSI heavy-duty */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-chain-tension"
                  letterLabel="G"
                  title="CHAIN TENSION"
                  subtitle="0 - 600 PSI"
                  value={hydraulics.chainTensionPressure}
                  min={0}
                  max={600}
                  unit="PSI"
                  bezelStyle="chrome"
                  size="md"
                  silverPlacard={true}
                  hasSideHandle={true}
                  zones={[
                    { from: 0, to: 100, color: '#eab308' },
                    { from: 100, to: 200, color: '#22c55e' },
                    { from: 200, to: 600, color: '#3b82f6' },
                  ]}
                />

                {/* 5. SQUEEZE PRESSURE — gripper block clamp, 0-2500 PSI           */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-squeeze-press"
                  letterLabel="I"
                  title="SQUEEZE PRESSURE"
                  subtitle="0 - 3000 PSI"
                  value={hydraulics.squeezePressure}
                  min={0}
                  max={3000}
                  unit="PSI"
                  bezelStyle="chrome-red-ring"
                  size="md"
                  silverPlacard={true}
                  hasSideHandle={true}
                  criticalLow={
                    hydraulics.squeezePressureSwitch && state.rod.totalStringWeightLbs > 1000
                      ? 400
                      : undefined
                  }
                  zones={[
                    { from: 0, to: 400, color: '#ef4444' },
                    { from: 400, to: 2500, color: '#22c55e' },
                    { from: 2500, to: 3000, color: '#eab308' },
                  ]}
                />

                {/* 6. SAFETY PRESSURE — accumulator/safety-clamp circuit (nom 2800) */}
                <AnalogGauge
                  operationActive={operationActive}
                  id="gauge-safety-press"
                  letterLabel="H"
                  title="SAFETY PRESSURE"
                  subtitle="0 - 5000 PSI"
                  value={hydraulics.safetyPressure}
                  min={0}
                  max={5000}
                  unit="PSI"
                  bezelStyle="chrome"
                  size="md"
                  silverPlacard={true}
                  zones={[
                    { from: 0, to: 2000, color: '#ef4444' },
                    { from: 2000, to: 2800, color: '#eab308' },
                    { from: 2800, to: 4500, color: '#22c55e' },
                    { from: 4500, to: 5000, color: '#ef4444' },
                  ]}
                />

              </div>

            </div>

            {/* ------------------------------------------------------------------- */}
            {/* RIGHT AREA: 2 LARGE DIALS (DOWN / UP PRESSURE) + COMPONENT LOAD    */}
            {/* CHART, laid out as in Figure 16 (large gauges above, chart below). */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-around gap-3 sm:gap-6 bg-slate-950/40 p-2 sm:p-3 rounded-xl border border-slate-700/50">
                {/* Large Gauge: DOWN PRESSURE */}
                <div className="flex flex-col items-center">
                  <AnalogGauge
                    operationActive={operationActive}
                    id="gauge-down-press-large"
                    letterLabel="M"
                    title="DOWN PRESSURE"
                    subtitle="CPW • PSI / kPa"
                    value={hydraulics.downPressure}
                    min={0}
                    max={5000}
                    unit="PSI"
                    bezelStyle="heavy-black"
                    size="lg"
                    isLarge={true}
                    silverPlacard={true}
                    zones={[
                      { from: 0, to: 3000, color: '#3b82f6' },
                      { from: 3000, to: 4200, color: '#22c55e' },
                      { from: 4200, to: 5000, color: '#ef4444' },
                    ]}
                  />
                </div>

                {/* Large Gauge: UP PRESSURE */}
                <div className="flex flex-col items-center">
                  <AnalogGauge
                    operationActive={operationActive}
                    id="gauge-up-press-large"
                    letterLabel="L"
                    title="UP PRESSURE"
                    subtitle="CPW • PSI / kPa"
                    value={hydraulics.upPressure}
                    min={0}
                    max={5000}
                    unit="PSI"
                    bezelStyle="heavy-black"
                    size="lg"
                    isLarge={true}
                    silverPlacard={true}
                    zones={[
                      { from: 0, to: 3000, color: '#3b82f6' },
                      { from: 3000, to: 4200, color: '#22c55e' },
                      { from: 4200, to: 5000, color: '#ef4444' },
                    ]}
                  />
                </div>
              </div>

              {/* Down Pressure + Up Pressure KNOBS directly below the large gauges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-2 p-3 bg-gradient-to-b from-blue-950/80 via-slate-950/70 to-stone-900/90 border-2 border-blue-900/60 rounded-lg shadow-xl">
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-2 py-1 w-full text-center shadow-sm">
                    <span className="text-[12px] font-black uppercase font-mono text-slate-900 whitespace-nowrap">Down Pressure</span>
                  </div>
                  <PhysicalMicrometerKnob id="ctrl-knob-down-pressure" letterLabel="M" title="RIH DRIVE"
                    value={hydraulics.downPressureTarget} min={0} max={5000} step={100} unit="PSI"
                    onChange={(val) => onUpdateHydraulics({ downPressureTarget: val })} />
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-gradient-to-b from-blue-950/80 via-slate-950/70 to-stone-900/90 border-2 border-blue-900/60 rounded-lg shadow-xl">
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-2 py-1 w-full text-center shadow-sm">
                    <span className="text-[12px] font-black uppercase font-mono text-slate-900 whitespace-nowrap">Up Pressure</span>
                  </div>
                  <PhysicalMicrometerKnob id="ctrl-knob-up-pressure" letterLabel="L" title="POOH DRIVE"
                    value={hydraulics.upPressureTarget} min={0} max={5000} step={100} unit="PSI"
                    onChange={(val) => onUpdateHydraulics({ upPressureTarget: val })} />
                </div>
              </div>
            </div>

          </div>

          {/* -------- PANEL SEAM LINE (real console has a visible seam here) -------- */}
          <div className="border-t-2 border-slate-500/50 my-2 relative z-10" />

          {/* -------- LOWER CONTROLS: Levers + Knobs directly below gauges -------- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-stretch relative z-10">
            
            {/* ------------------------------------------------------------------- */}
            {/* LEFT AREA: 4 ACTUATOR BLOCKS & FINE REGULATOR DIALS                */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 items-stretch">
                
                {/* 1. CHAIN TENSION BLOCK (Bronze Metal Block) */}
                <div className="flex flex-col items-center gap-2 p-2 bg-slate-800/80 border border-slate-600/60 rounded-lg shadow-xl relative h-full">
                  {/* Top 4 Hex Screws */}
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />
                  
                  {/* Front Silver Placard */}
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-1.5 py-0.5 w-full text-center shadow-sm">
                    <span className="text-[13px] font-black uppercase font-mono text-slate-900 tracking-tight">
                      CHAIN TENSION
                    </span>
                  </div>

                  {/* Vertical Black Ball Lever */}
                  {/* Per real photo: ball levers have RED knobs */}
                  <PhysicalBallLever
                    id="ctrl-lever-chain-tension-p"
                    letterLabel="P"
                    title=""
                    positions="3-way"
                    position={hydraulics.chainTensionSwitch ? 'ON' : 'OFF'}
                    ballColor="red"
                    onChange={(pos) =>
                      onUpdateHydraulics({ chainTensionSwitch: pos === 'ON' })
                    }
                  />

                  {/* Micrometer Dial Knob in Front */}
                  <div className="w-full pt-1 border-t border-slate-700/60 flex flex-col items-center">
                    <PhysicalMicrometerKnob
                      id="ctrl-knob-chain-tension-q"
                      letterLabel="Q"
                      title="REGULATOR"
                      value={hydraulics.chainTensionTarget}
                      min={0}
                      max={600}
                      step={10}
                      unit="PSI"
                      onChange={(val) => onUpdateHydraulics({ chainTensionTarget: val })}
                    />
                  </div>
                </div>

                {/* 2. SQUEEZE PRESSURE BLOCK (Bronze Metal Block) */}
                <div className="flex flex-col items-center gap-2 p-2 bg-slate-800/80 border border-slate-600/60 rounded-lg shadow-xl relative h-full">
                  {/* Top 4 Hex Screws */}
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />

                  {/* Front Silver Placard */}
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-1.5 py-0.5 w-full text-center shadow-sm">
                    <span className="text-[13px] font-black uppercase font-mono text-slate-900 tracking-tight">
                      SQUEEZE PRESS.
                    </span>
                  </div>

                  {/* Vertical Black Ball Lever */}
                  <PhysicalBallLever
                    id="ctrl-lever-squeeze-r"
                    letterLabel="R"
                    title=""
                    positions="3-way"
                    position={hydraulics.squeezePressureSwitch ? 'ON' : 'OFF'}
                    ballColor="red"
                    onChange={(pos) =>
                      onUpdateHydraulics({ squeezePressureSwitch: pos === 'ON' })
                    }
                  />

                  {/* Micrometer Dial Knob in Front */}
                  <div className="w-full pt-1 border-t border-slate-700/60 flex flex-col items-center">
                    <PhysicalMicrometerKnob
                      id="ctrl-knob-squeeze-s"
                      letterLabel="S"
                      title="REGULATOR"
                      value={hydraulics.squeezePressureTarget}
                      min={0}
                      max={2500}
                      step={50}
                      unit="PSI"
                      onChange={(val) => onUpdateHydraulics({ squeezePressureTarget: val })}
                    />
                  </div>
                </div>

                {/* 3. INJECTOR BRAKE BLOCK (Bronze Metal Block) */}
                <div data-control-id="ctrl-switch-injectorbrake" className="flex flex-col items-center gap-2 p-2 bg-slate-800/80 border border-slate-600/60 rounded-lg shadow-xl relative h-full">
                  {/* Top 4 Hex Screws */}
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-neutral-900 border border-slate-600" />

                  {/* Front Silver Placard */}
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-1.5 py-0.5 w-full text-center shadow-sm">
                    <span className="text-[13px] font-black uppercase font-mono text-slate-900 tracking-tight">
                      INJECTOR BRAKE
                    </span>
                  </div>

                  {/* Vertical Black Ball Lever */}
                  <PhysicalBallLever
                    id="ctrl-lever-brake-t"
                    letterLabel="T"
                    title=""
                    positions="2-way"
                    position={hydraulics.gripperBrakeSwitch ? 'ON' : 'OFF'}
                    ballColor="red"
                    onChange={(pos) =>
                      onUpdateHydraulics({ gripperBrakeSwitch: pos === 'ON' })
                    }
                  />

                  {/* Brake Bleed / Air Knob in Front */}
                  <div className="w-full pt-1 border-t border-slate-700/60 flex flex-col items-center">
                    <PhysicalMicrometerKnob
                      id="ctrl-knob-brake-bleed"
                      letterLabel="C"
                      title="AIR REG"
                      value={hydraulics.airRegulatorPsi || 120}
                      min={0}
                      max={150}
                      step={5}
                      unit="PSI"
                      onChange={(val) => onUpdateHydraulics({ airRegulatorPsi: val })}
                    />
                  </div>
                </div>

                {/* 4. EYE-CATCHING LIME GREEN "SAFETY" BLOCK */}
                <div data-control-id="ctrl-lever-safety" className="flex flex-col items-center gap-2 p-2 bg-slate-800/80 border border-emerald-600/60 rounded-lg shadow-lg relative h-full">
                  {/* Top 4 Black Hex Screws */}
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-neutral-950 border border-neutral-800" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-neutral-950 border border-neutral-800" />

                  {/* Front Silver Placard */}
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-1.5 py-0.5 w-full text-center shadow-sm">
                    <span className="text-[13px] font-black uppercase font-mono text-slate-950 tracking-wider">
                      SAFETY
                    </span>
                  </div>

                  {/* Vertical Ball Lever */}
                  <PhysicalBallLever
                    id="ctrl-lever-safety-v"
                    letterLabel="V"
                    title=""
                    positions="2-way"
                    position={hydraulics.safetyClampLever}
                    ballColor="red"
                    isTall={false}
                    onChange={(pos) => onUpdateHydraulics({ safetyClampLever: pos })}
                  />

                  {/* Safety Pressure Target Knob — sets the safety accumulator pressure */}
                  <div className="w-full pt-1 border-t border-emerald-700/50 flex flex-col items-center">
                    <PhysicalMicrometerKnob
                      id="ctrl-knob-safety-pressure"
                      letterLabel="X"
                      title="SAFETY PRESS."
                      value={hydraulics.safetyPressureTarget}
                      min={1000}
                      max={4200}
                      step={100}
                      unit="PSI"
                      onChange={(val) => onUpdateHydraulics({ safetyPressureTarget: val })}
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* ------------------------------------------------------------------- */}
            {/* RIGHT AREA: DOWNHOLE joystick (left) + ESD/Horn/Safety (right)     */}
            {/* Matches target layout exactly:                                      */}
            {/*   [DOWNHOLE joystick]  [ESD + HORN (top)]                          */}
            {/*                        [SAFETY RELIEF (bottom)]                    */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">

              {/* BOTTOM: Joystick + ESD/Safety row */}
              <div className="flex flex-row gap-3 flex-1 min-h-0">

              {/* LEFT: DOWNHOLE Drive Joystick — fills the whole panel */}
              <div className="flex-1 flex flex-col p-2 bg-neutral-950/80 rounded-lg border border-neutral-800 shadow-xl min-h-0">
                <PhysicalJoystick
                  id="ctrl-joystick-y"
                  position={joystickPosition}
                  onChange={onUpdateJoystick}
                  disabled={hydraulics.emergencyStopTripped || !hydraulics.engineRunning}
                />
              </div>

              {/* RIGHT SUB-COLUMN: ESD+Horn on top, Safety Relief below */}
              <div className="flex-1 flex flex-col gap-3 min-h-0">

                {/* TOP: EMERGENCY SHUT-DOWN + HORN side by side */}
                <div className="flex flex-row items-stretch gap-2 bg-neutral-950/80 p-3 rounded-lg border border-neutral-800 shadow-xl flex-1">
                  {/* ESD switch */}
                  <div data-control-id="ctrl-estop-j" className="flex-1 flex flex-col items-center gap-1">
                    <PhysicalEmergencyShutdown
                      id="ctrl-estop-j"
                      letterLabel="J"
                      isTripped={hydraulics.emergencyStopTripped}
                      onTrigger={onTriggerEmergencyStop}
                      onReset={onResetEmergencyStop}
                    />
                  </div>
                  {/* HORN button */}
                  <div data-control-id="ctrl-horn" className="flex flex-col items-center justify-center gap-1.5 border-l border-neutral-700 pl-2">
                    <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-2 py-0.5 text-center shadow-sm">
                      <span className="text-[11px] font-black uppercase font-mono text-slate-900 whitespace-nowrap">HORN</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { soundManager.playAirHorn(1.2); onSoundAirHorn(); }}
                      className="w-10 h-10 rounded-full bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 border-[3px] border-neutral-700 shadow-lg active:scale-95 active:border-amber-500 flex items-center justify-center text-amber-400 transition-all"
                      title="Press to Sound Air Horn"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* BOTTOM: SAFETY RELIEF handwheel */}
                <div className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 shadow-xl flex-1">
                  <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-700 rounded-sm px-2 py-0.5 w-full text-center shadow-sm">
                    <span className="text-[11px] font-black uppercase font-mono text-slate-950 whitespace-nowrap">SAFETY RELIEF</span>
                  </div>
                  {/* 5-Spoke Chrome Handwheel */}
                  <button
                    type="button"
                    onClick={handleSafetyReliefClick}
                    className="relative w-16 h-16 rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 border-4 border-slate-700 shadow-2xl active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
                    title="Click to Vent or Close Safety Relief Valve"
                  >
                    <svg viewBox="0 0 64 64" className="w-full h-full" style={{ transform: `rotate(${safetyReliefWheelRot}deg)` }}>
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#cbd5e1" strokeWidth="4" />
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#64748b" strokeWidth="1" />
                      {[0, 72, 144, 216, 288].map((deg) => (
                        <line key={deg} x1="32" y1="32"
                          x2={32 + 27 * Math.cos((deg * Math.PI) / 180)}
                          y2={32 + 27 * Math.sin((deg * Math.PI) / 180)}
                          stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
                      ))}
                      <circle cx="32" cy="32" r="9" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                      <circle cx="32" cy="32" r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                    </svg>
                  </button>
                  <span className="text-[10px] font-mono text-neutral-400 font-bold">
                    {hydraulics.safetyBleedValveOpen ? 'OPEN (VENTED)' : 'CLOSED (NORMAL)'}
                  </span>
                </div>

              </div>
              </div>

            </div>

          </div>
        </div>

        {/* Weatherford Logo Strip at bottom of panel (per real photo — Z position) */}
        <div className="bg-gradient-to-b from-[#8a939f] to-[#7d8590] px-4 py-2 flex items-center justify-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            {/* Red chevron logo */}
            <svg width="28" height="18" viewBox="0 0 28 18" className="shrink-0">
              <path d="M2 15 L7 3 L12 11 L17 3 L22 15" fill="none" stroke="#cc2222" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-black text-slate-800 tracking-wider font-sans">Weatherford</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLLAPSIBLE AUXILIARY PANEL: WELLHEAD BOP VALVES & UTILITIES              */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-b from-[#7d8590] to-[#6b7380] rounded-b-xl border-t border-slate-500/50 p-2 sm:p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                WELLHEAD ISOLATION &amp; RIG UTILITIES
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  bop.reganBopClosed
                    ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                BOP: {bop.reganBopClosed ? 'CLOSED' : 'OPEN'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAuxiliary(!showAuxiliary)}
              className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200"
            >
              <span>{showAuxiliary ? 'Hide Details' : 'Show Utilities'}</span>
              {showAuxiliary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showAuxiliary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/80 items-center">
              {/* BOP Bleed Valve (N) */}
              <div className="flex flex-col items-center bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                <PhysicalWingBleedValve
                  id="ctrl-bop-bleed-n"
                  letterLabel="N"
                  label="BOP BLEED"
                  isOpen={bop.bopBleedOpen}
                  onToggle={() => onUpdateBOP({ bopBleedOpen: !bop.bopBleedOpen })}
                />
              </div>

              {/* BOP Valve (O) */}
              <div className="flex flex-col items-center bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                <PhysicalBopValve
                  id="ctrl-bop-valve-o"
                  letterLabel="O"
                  isClosed={bop.reganBopClosed}
                  onToggle={() => onUpdateBOP({ reganBopClosed: !bop.reganBopClosed })}
                />
              </div>

              {/* Panel Lights (D) */}
              <div className="flex flex-col items-center bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                <PhysicalPanelLightsSwitch
                  id="ctrl-panel-lights-d"
                  letterLabel="D"
                  isOn={hydraulics.panelLightsOn ?? true}
                  onToggle={() => onUpdateHydraulics({ panelLightsOn: !hydraulics.panelLightsOn })}
                />
              </div>

              {/* Chain Oiler (K) */}
              <div className="flex flex-col items-center bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                <PhysicalChainOilerSwitch
                  id="ctrl-chain-oiler-k"
                  letterLabel="K"
                  isOn={hydraulics.chainOilerOn ?? true}
                  onToggle={() => onUpdateHydraulics({ chainOilerOn: !hydraulics.chainOilerOn })}
                />
              </div>
            </div>
          )}
        </div>

      </div>
  );
};



