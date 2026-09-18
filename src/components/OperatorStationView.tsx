import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DynamicRigSightline } from './DynamicRigSightline';
import { Rig3DViewport } from './Rig3DViewport';
import { WeatherfordControlConsole } from './WeatherfordControlConsole';
import { OperatorHandsOverlay } from './OperatorHandsOverlay';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import { Card, Button, Badge, StatBadge, SegmentedControl, cx } from './ui';
import {
  ShieldAlert,
  Power,
  Columns,
  Maximize2,
  Minimize2,
  Activity,
  Gauge,
  Sliders,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';

interface OperatorStationViewProps {
  state: SimulatorState;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onUpdateBOP?: (updates: Partial<SimulatorState['bop']>) => void;
  onUpdateJoystick: (pos: number) => void;
  onSoundAirHorn: () => void;
  onTriggerEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
  onInstallClamp: () => void;
  onRemoveClamp?: () => void;
  onSetClampCount?: (count: number) => void;
  onEmergencyAction?: (action: 'evacuate' | 'scba') => void;
  onTapTest: () => void;
  onAttachContainment: () => void;
  onToggleReelSafetyFork: () => void;
  onStartEngine?: () => void;
  onShutdownEngine?: () => void;
  onToggleBopClosed: () => void;
  onStrokeBopHandPump: () => void;
  onSetTripMode?: (mode: 'RIH' | 'POOH' | 'FREE') => void;
  onSetDepth?: (depthFt: number) => void;
}

export type StationLayoutMode = 'cockpit' | 'split' | 'rig-focus' | 'console-focus';

export const OperatorStationView: React.FC<OperatorStationViewProps> = ({
  state,
  onUpdateHydraulics,
  onUpdateBOP,
  onUpdateJoystick,
  onSoundAirHorn,
  onTriggerEmergencyStop,
  onResetEmergencyStop,
  onInstallClamp,
  onRemoveClamp,
  onSetClampCount,
  onEmergencyAction,
  onTapTest,
  onAttachContainment,
  onToggleReelSafetyFork,
  onStartEngine,
  onShutdownEngine,
  onToggleBopClosed,
  onStrokeBopHandPump,
  onSetTripMode,
  onSetDepth,
}) => {
  const { hydraulics, rod, bop } = state;
  // Allow deep-linking / sharing a specific station layout via the URL hash,
  // e.g. #console, #split, #rig, #cockpit. Falls back to the cockpit view.
  const initialLayout: StationLayoutMode = (() => {
    if (typeof window === 'undefined') return 'split';
    const h = window.location.hash.replace('#', '').toLowerCase();
    if (h === 'console' || h === 'console-focus') return 'console-focus';
    if (h === 'split') return 'split';
    if (h === 'rig' || h === 'rig-focus') return 'rig-focus';
    // 'cockpit' (Operator Cab) view has been retired — default to split.
    return 'split';
  })();
  const [layoutMode, setLayoutMode] = useState<StationLayoutMode>(initialLayout);
  const [showHands, setShowHands] = useState(false);
  const [gloveStyle, setGloveStyle] = useState<'hivis' | 'leather' | 'tactical'>('hivis');
  const [activeControlTarget, setActiveControlTarget] = useState<string | null>(null);

  // Cab (L-shaped) per-area maximize: 'none' shows the L-layout, 'operation'
  // expands the 3D rig to fill the cab, 'control' expands the console to fill it.
  const [cabMaximized, setCabMaximized] = useState<'none' | 'operation' | 'control'>('none');

  // --- Cockpit-cab auto-fit -------------------------------------------------
  // The full console is large; in cockpit ("cab") mode we scale it down with a
  // CSS transform so the whole panel always fits inside the lower dashboard
  // zone at any screen size, with no scrolling. We measure the dashboard slot
  // and the console's natural size and pick the largest scale that fits.
  const dashSlotRef = useRef<HTMLDivElement>(null);
  const consoleNaturalRef = useRef<HTMLDivElement>(null);
  const [consoleScale, setConsoleScale] = useState(1);

  const recomputeConsoleScale = useCallback(() => {
    const slot = dashSlotRef.current;
    const natural = consoleNaturalRef.current;
    if (!slot || !natural) return;
    const slotW = slot.clientWidth;
    const slotH = slot.clientHeight;
    // Natural (unscaled) size of the console content.
    const natW = natural.scrollWidth;
    const natH = natural.scrollHeight;
    if (natW === 0 || slotW === 0) return;
    void slotH; void natH;
    // Fit the console to the WIDTH of its cell so gauges/levers stay large and
    // readable. The cell scrolls vertically if the scaled console is taller.
    const scale = Math.min(slotW / natW, 1.15);
    setConsoleScale((prev) => (Math.abs(prev - scale) > 0.005 ? scale : prev));
  }, []);

  useLayoutEffect(() => {
    if (layoutMode !== 'cockpit') return;
    recomputeConsoleScale();
    const ro = new ResizeObserver(() => recomputeConsoleScale());
    if (dashSlotRef.current) ro.observe(dashSlotRef.current);
    if (consoleNaturalRef.current) ro.observe(consoleNaturalRef.current);
    window.addEventListener('resize', recomputeConsoleScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeConsoleScale);
    };
  }, [layoutMode, recomputeConsoleScale]);

  // Recompute shortly after mount / mode / maximize change once fonts & SVG
  // gauges settle and the grid transition finishes.
  useEffect(() => {
    if (layoutMode !== 'cockpit') return;
    const t = setTimeout(recomputeConsoleScale, 250);
    const t2 = setTimeout(recomputeConsoleScale, 500);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [layoutMode, cabMaximized, recomputeConsoleScale]);

  const isChargePressureCritical =
    hydraulics.chargePressure < 250 && hydraulics.engineRunning;

  // Wrapped Hydraulics updater to trigger contextual left hand actuation
  const handleUpdateHydraulics = (updates: Partial<SimulatorState['hydraulics']>) => {
    if (updates.chainTensionSwitch !== undefined) {
      setActiveControlTarget('Chain Tension Lever (P)');
    } else if (updates.chainTensionTarget !== undefined) {
      setActiveControlTarget('Tension Micrometer Knob (Q)');
    } else if (updates.squeezePressureSwitch !== undefined) {
      setActiveControlTarget('Squeeze Pressure Lever (R)');
    } else if (updates.squeezePressureTarget !== undefined) {
      setActiveControlTarget('Squeeze Micrometer Knob (S)');
    } else if (updates.gripperBrakeSwitch !== undefined) {
      setActiveControlTarget('Injector Brake Lever (T)');
    } else if (updates.safetyClampLever !== undefined) {
      setActiveControlTarget('Rod Safety Clamp (V)');
    } else if (updates.downPressureTarget !== undefined) {
      setActiveControlTarget('Down Pressure Block (U)');
    } else if (updates.upPressureTarget !== undefined) {
      setActiveControlTarget('Up Pressure Block (W)');
    } else if (updates.safetyBleedValveOpen !== undefined) {
      setActiveControlTarget('Safety Bleed Valve (X)');
    } else if (updates.airRegulatorPsi !== undefined) {
      setActiveControlTarget('Air Regulator Knob (C)');
    } else if (updates.chainOilerOn !== undefined) {
      setActiveControlTarget('Chain Oiler Switch (K)');
    } else if (updates.panelLightsOn !== undefined) {
      setActiveControlTarget('Panel Lights (D)');
    }

    setTimeout(() => {
      setActiveControlTarget(null);
    }, 1200);

    onUpdateHydraulics(updates);
  };

  // Safe fallback BOP updater
  const handleUpdateBOP = (updates: Partial<SimulatorState['bop']>) => {
    setActiveControlTarget('BOP Valve / Bleed (N/O)');
    setTimeout(() => setActiveControlTarget(null), 1200);

    if (onUpdateBOP) {
      onUpdateBOP(updates);
    } else if (updates.reganBopClosed !== undefined) {
      onToggleBopClosed();
    }
  };

  // Left-column live telemetry for the L-shaped cab (Control Area). Provides
  // the primary at-a-glance operating readouts so the trainee can watch the rig
  // and the numbers together without hunting across the console.
  const renderCabTelemetry = () => {
    const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
    const stat = (
      label: string,
      value: string,
      accent: string,
    ) => (
      <div className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-2">
        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`font-mono font-black leading-tight ${accent}`}>{value}</div>
      </div>
    );
    const bar = (label: string, value: number, max: number, unit: string, color: string) => (
      <div>
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-0.5">
          <span>{label}</span>
          <span className="text-slate-200 font-bold normal-case">
            {Math.round(value).toLocaleString()} {unit}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-black/60 overflow-hidden border border-white/5">
          <div className={`h-full ${color}`} style={{ width: `${pct(value, max)}%` }} />
        </div>
      </div>
    );

    return (
      <div className="absolute inset-0 overflow-y-auto p-2.5 flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5 text-slate-200">
          <Activity className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-mono font-black uppercase tracking-widest">
            Control Area • Live Telemetry
          </span>
        </div>

        {/* Primary readouts */}
        <div className="grid grid-cols-2 gap-2">
          {stat('Depth', `${Math.round(rod.currentDepthFt)} ft`, 'text-emerald-400 text-lg')}
          {stat(
            'Rod Speed',
            `${rod.rodSpeedFtPerMin.toFixed(1)} ft/m`,
            'text-sky-400 text-lg',
          )}
          {stat(
            'Hookload',
            `${Math.round(rod.totalStringWeightLbs).toLocaleString()} lb`,
            'text-amber-400 text-base',
          )}
          {stat(
            'Trip',
            rod.currentDepthFt < 500 ? 'RIH' : rod.currentDepthFt > 4000 ? 'POOH' : 'FREE',
            'text-purple-300 text-base',
          )}
        </div>

        {/* Key pressures */}
        <div className="rounded-lg bg-black/40 border border-white/10 p-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 mb-0.5">
            <Gauge className="w-3 h-3 text-red-400" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest">Pressures</span>
          </div>
          {bar('System', hydraulics.systemPressure, 3000, 'psi', 'bg-emerald-500')}
          {bar('Down (RIH)', hydraulics.downPressure, 5000, 'psi', 'bg-blue-500')}
          {bar('Up (POOH)', hydraulics.upPressure, 5000, 'psi', 'bg-cyan-500')}
          {bar('Squeeze', hydraulics.squeezePressure, 3000, 'psi', 'bg-amber-500')}
          {bar(
            'Charge',
            hydraulics.chargePressure,
            600,
            'psi',
            isChargePressureCritical ? 'bg-red-500 animate-pulse' : 'bg-green-500',
          )}
        </div>

        {/* Status chips */}
        <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
          <div
            className={`rounded-md px-2 py-1.5 border text-center font-bold uppercase ${
              hydraulics.engineRunning
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400'
            }`}
          >
            Engine {hydraulics.engineRunning ? 'Running' : 'Off'}
          </div>
          <div
            className={`rounded-md px-2 py-1.5 border text-center font-bold uppercase ${
              bop?.reganBopClosed
                ? 'bg-red-950/60 border-red-700 text-red-300'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400'
            }`}
          >
            BOP {bop?.reganBopClosed ? 'Closed' : 'Open'}
          </div>
        </div>

        {/* Charge pressure safety note */}
        {isChargePressureCritical && (
          <div className="rounded-md bg-red-950/70 border border-red-600 px-2 py-1.5 flex items-center gap-1.5 text-red-200 text-[9px] font-mono">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>LOW CHARGE PRESSURE — freewheel risk. Reduce speed.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full relative pb-12">
      {/* ========================================================================= */}
      {/* 1. MASTER HEADER: Engine status, layout selector, engine power           */}
      {/* ========================================================================= */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'w-3 h-3 rounded-full shrink-0',
              hydraulics.engineRunning ? 'bg-emerald-500' : 'bg-red-500',
            )}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">3D Operator Station</span>
              <Badge tone="brand" className="hidden sm:inline-flex">COROD™</Badge>
            </div>
            <p className="text-2xs text-slate-400">
              {hydraulics.engineRunning ? 'Engine running' : 'Engine off'} · Depth{' '}
              {Math.round(rod.currentDepthFt).toLocaleString()} ft
            </p>
          </div>
        </div>

        {/* Layout selector + engine power */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="View"
            value={layoutMode}
            onChange={setLayoutMode}
            segments={[
              { id: 'split', label: <span className="hidden lg:inline">Side-by-Side</span>, icon: <Columns className="w-3.5 h-3.5" />, title: 'Side-by-Side Split' },
              { id: 'rig-focus', label: <span className="hidden lg:inline">Windshield</span>, icon: <Maximize2 className="w-3.5 h-3.5" />, title: '3D Windshield Focus' },
              { id: 'console-focus', label: <span className="hidden lg:inline">Console</span>, icon: <Sliders className="w-3.5 h-3.5" />, title: 'Console Focus' },
            ]}
          />

          {/* Engine power switch — RUNNING only after the full start-up sequence. */}
          <Button
            variant={state.engineStartSequenceComplete ? 'success' : 'primary'}
            icon={<Power className="w-3.5 h-3.5" />}
            onClick={() => {
              if (state.engineStartSequenceComplete) {
                soundManager.stopEngineLoop();
                onShutdownEngine?.();
              } else {
                onStartEngine?.();
              }
            }}
          >
            {state.engineStartSequenceComplete ? 'Running' : 'Start'}
          </Button>
        </div>
      </Card>

      {/* Charge Pressure Critical Warning — the ONE place a pulse is warranted. */}
      {isChargePressureCritical && (
        <div className="rounded-xl bg-red-950/90 border border-red-500 p-3 flex flex-wrap items-center justify-between gap-3 text-red-100 shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="font-semibold text-sm block text-red-200">
                Critical: charge pressure below 250 PSI
              </span>
              <p className="text-2xs text-red-300">
                Engage the rod safety clamp (V) immediately to lock the rod string.
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => handleUpdateHydraulics({ safetyClampLever: 'ON' })}
          >
            Engage Safety Clamp (V)
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZERO-SCROLL QUICK TELEMETRY & JOYSTICK DOCK (Always visible at top)      */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Real-time Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge label="Depth" tone="success" value={`${Math.round(rod.currentDepthFt)} FT`} />

          <StatBadge
            label="Speed"
            tone={rod.rodSpeedFtPerMin > 0.05 ? 'success' : rod.rodSpeedFtPerMin < -0.05 ? 'info' : 'neutral'}
            value={
              rod.rodSpeedFtPerMin > 0.05
                ? `${rod.rodSpeedFtPerMin.toFixed(1)} FT/MIN (POOH ↑)`
                : rod.rodSpeedFtPerMin < -0.05
                ? `${Math.abs(rod.rodSpeedFtPerMin).toFixed(1)} FT/MIN (RIH ↓)`
                : '0.0 FT/MIN'
            }
          />

          <StatBadge
            label="Weight"
            tone="warning"
            value={`${Math.round(rod.totalStringWeightLbs).toLocaleString()} LBS`}
          />

          <StatBadge
            label="Squeeze"
            className="hidden sm:flex"
            value={`${Math.round(hydraulics.squeezePressure)} PSI`}
          />

          <StatBadge
            label="Chain Tension"
            className="hidden md:flex"
            value={`${Math.round(hydraulics.chainTensionPressure)} PSI`}
          />

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px]">CLAMP (V):</span>
            <span
              className={`font-bold ${
                hydraulics.safetyClampLever === 'ON' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {hydraulics.safetyClampLever}
            </span>
          </div>
        </div>

        {/* Quick-drive buttons removed — driving is done via the joystick/console. */}
      </div>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT BODY ACCORDING TO SELECTED LAYOUT MODE                     */}
      {/* ========================================================================= */}

      {/* 1. COCKPIT MODE — L-SHAPED OPERATOR STATION                             */}
      {/* The console (Control Area) is the dominant surface: it fills the whole  */}
      {/* left column AND the bottom row, wrapping in an L around the 3D rig       */}
      {/* (Operation Area) which sits in the top-right — exactly like standing at  */}
      {/* the console watching the rig. Both are always visible, no scrolling.    */}
      {/* Each area has a maximize button to expand it to the full cab.           */}
      {layoutMode === 'cockpit' && (
        <div
          className="relative w-full rounded-xl overflow-hidden border-2 border-slate-950 shadow-2xl bg-black flex flex-row gap-1.5 p-1.5"
          style={{
            height: 'calc(100vh - 190px)',
            minHeight: '500px',
          }}
        >
          {/* ===================== LEFT COLUMN: TELEMETRY + RIG VIEWPORT ====== */}
          {/* Hidden entirely when the console is maximized. */}
          <div
            className={`flex flex-col gap-1.5 min-w-0 min-h-0 ${cabMaximized === 'control' ? 'hidden' : ''}`}
            style={{
              flex: cabMaximized === 'operation' ? '1 1 0%' : '1 1 50%',
              transition: 'flex-basis 0.35s ease',
            }}
          >
            {/* --- TOP: Live telemetry rail (part of the Control Area) --- */}
            <div
              className={`relative rounded-xl overflow-hidden border border-slate-700 bg-gradient-to-b from-slate-900 via-slate-950 to-black ${
                cabMaximized === 'operation' ? 'hidden' : ''
              }`}
              style={{ flex: '0 0 auto', maxHeight: '32%', minHeight: 0, overflowY: 'auto' }}
            >
              {renderCabTelemetry()}
            </div>

            {/* --- BOTTOM: Operation Area (3D rig sightline) --- */}
            <div className="relative min-h-0 flex-1 rounded-xl overflow-hidden border-2 border-slate-800 bg-slate-950">
              <Rig3DViewport
                state={state}
                fillHeight
                cabMode
                onInstallClamp={onInstallClamp}
                onTapTest={onTapTest}
                onToggleReelSafetyFork={onToggleReelSafetyFork}
                onToggleBopClosed={onToggleBopClosed}
                onUpdateJoystick={onUpdateJoystick}
                onUpdateHydraulics={handleUpdateHydraulics}
                onSoundAirHorn={onSoundAirHorn}
                onTriggerEmergencyStop={onTriggerEmergencyStop}
                onResetEmergencyStop={onResetEmergencyStop}
              />

              {/* Area label */}
              <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-black/50 border border-white/10 text-[9px] font-mono uppercase tracking-widest text-slate-300">
                Operation Area • Rig Sightline
              </div>

              {/* Maximize / restore toggle */}
              <button
                type="button"
                onClick={() => setCabMaximized(cabMaximized === 'operation' ? 'none' : 'operation')}
                className="absolute top-2 left-2 z-30 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/15 text-slate-200 transition-all"
                title={cabMaximized === 'operation' ? 'Restore L-layout' : 'Maximize Operation Area'}
              >
                {cabMaximized === 'operation' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Compact TRIP MODE + DEPTH strip (setup actions). */}
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-white/10 rounded-lg p-1">
                {([
                  { id: 'RIH' as const, label: 'RIH', cls: 'emerald' },
                  { id: 'POOH' as const, label: 'POOH', cls: 'blue' },
                  { id: 'FREE' as const, label: 'FREE', cls: 'purple' },
                ]).map((m) => {
                  const active =
                    (m.id === 'RIH' && rod.currentDepthFt < 500 && rod.rodSpeedFtPerMin <= 0.3) ||
                    (m.id === 'POOH' && rod.currentDepthFt > 4000) ||
                    (m.id === 'FREE' && rod.currentDepthFt >= 500 && rod.currentDepthFt <= 4000);
                  const color =
                    m.cls === 'emerald'
                      ? active
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-400 hover:bg-emerald-950/60'
                      : m.cls === 'blue'
                      ? active
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-400 hover:bg-blue-950/60'
                      : active
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-400 hover:bg-purple-950/60';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSetTripMode && onSetTripMode(m.id)}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all ${color}`}
                      title={`Set trip mode: ${m.label}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
                {onSetDepth && (
                  <select
                    value={[0, 1000, 2250, 3500, 4500].reduce((prev, curr) =>
                      Math.abs(curr - rod.currentDepthFt) < Math.abs(prev - rod.currentDepthFt) ? curr : prev,
                    )}
                    onChange={(e) => onSetDepth(Number(e.target.value))}
                    className="ml-0.5 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-md border border-slate-700 px-1 py-1 outline-none"
                    title="Jump to depth"
                  >
                    <option value={0}>0' Surface</option>
                    <option value={1000}>1,000'</option>
                    <option value={2250}>2,250' Mid</option>
                    <option value={3500}>3,500'</option>
                    <option value={4500}>4,500' Btm</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ===================== RIGHT COLUMN: CONSOLE ======================== */}
          <div
            ref={dashSlotRef}
            className={`relative min-w-0 min-h-0 rounded-xl overflow-hidden border border-slate-700 bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-y-auto overflow-x-hidden ${
              cabMaximized === 'operation' ? 'hidden' : ''
            }`}
            style={{
              flex: cabMaximized === 'control' ? '1 1 0%' : '1 1 50%',
              transition: 'flex-basis 0.35s ease',
            }}
          >
            {/* Maximize / restore toggle */}
            <button
              type="button"
              onClick={() => setCabMaximized(cabMaximized === 'control' ? 'none' : 'control')}
              className="absolute top-2 right-2 z-30 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/15 text-slate-200 transition-all"
              title={cabMaximized === 'control' ? 'Restore layout' : 'Maximize Control Area'}
            >
              {cabMaximized === 'control' ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <div className="flex justify-center">
              <div style={{ transform: `scale(${consoleScale})`, transformOrigin: 'top center' }}>
                <div ref={consoleNaturalRef} className="relative w-[1240px] max-w-none px-2 pt-2 pb-4">
                  <WeatherfordControlConsole
                    state={state}
                    embedded
                    onUpdateHydraulics={handleUpdateHydraulics}
                    onUpdateBOP={handleUpdateBOP}
                    onUpdateJoystick={onUpdateJoystick}
                    onSoundAirHorn={onSoundAirHorn}
                    onTriggerEmergencyStop={onTriggerEmergencyStop}
                    onResetEmergencyStop={onResetEmergencyStop}
                  />

                  {/* Realistic Hands Overlay (scales with the console) */}
                  <OperatorHandsOverlay
                    state={state}
                    activeControlTarget={activeControlTarget}
                    showHands={showHands}
                    onToggleShowHands={() => setShowHands(!showHands)}
                    gloveStyle={gloveStyle}
                    onChangeGloveStyle={setGloveStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SPLIT SCREEN MODE (Side-by-Side 50/50 Zero-Scroll) */}
      {layoutMode === 'split' && (
        <div className="flex flex-row gap-4" style={{ height: 'calc(100vh - 190px)', minHeight: '500px' }}>
          {/* Left: 3D Rig Sightline Viewport */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden rounded-xl">
            <DynamicRigSightline
              state={state}
              onInstallClamp={onInstallClamp}
              onRemoveClamp={onRemoveClamp}
              onSetClampCount={onSetClampCount}
            onEmergencyAction={onEmergencyAction}
              onTapTest={onTapTest}
              onAttachContainment={onAttachContainment}
              onToggleReelSafetyFork={onToggleReelSafetyFork}
              onToggleBopClosed={onToggleBopClosed}
              onStrokeBopHandPump={onStrokeBopHandPump}
              onSetTripMode={onSetTripMode}
              onSetDepth={onSetDepth}
              onUpdateJoystick={onUpdateJoystick}
              onUpdateHydraulics={handleUpdateHydraulics}
              onSoundAirHorn={onSoundAirHorn}
              onTriggerEmergencyStop={onTriggerEmergencyStop}
              onResetEmergencyStop={onResetEmergencyStop}
            />
          </div>

          {/* Right: Full Weatherford Console + Hands */}
          <div className="flex-1 min-w-0 min-h-0 relative overflow-y-auto overflow-x-hidden rounded-xl">
            <WeatherfordControlConsole
              state={state}
              onUpdateHydraulics={handleUpdateHydraulics}
              onUpdateBOP={handleUpdateBOP}
              onUpdateJoystick={onUpdateJoystick}
              onSoundAirHorn={onSoundAirHorn}
              onTriggerEmergencyStop={onTriggerEmergencyStop}
              onResetEmergencyStop={onResetEmergencyStop}
            />

            <OperatorHandsOverlay
              state={state}
              activeControlTarget={activeControlTarget}
              showHands={showHands}
              onToggleShowHands={() => setShowHands(!showHands)}
              gloveStyle={gloveStyle}
              onChangeGloveStyle={setGloveStyle}
            />
          </div>
        </div>
      )}

      {/* 3. RIG FOCUS MODE (Expanded 3D Viewport) */}
      {layoutMode === 'rig-focus' && (
        <div className="w-full">
          <DynamicRigSightline
            state={state}
            onInstallClamp={onInstallClamp}
            onRemoveClamp={onRemoveClamp}
            onSetClampCount={onSetClampCount}
            onEmergencyAction={onEmergencyAction}
            onTapTest={onTapTest}
            onAttachContainment={onAttachContainment}
            onToggleReelSafetyFork={onToggleReelSafetyFork}
            onToggleBopClosed={onToggleBopClosed}
            onStrokeBopHandPump={onStrokeBopHandPump}
            onSetTripMode={onSetTripMode}
            onSetDepth={onSetDepth}
            onUpdateJoystick={onUpdateJoystick}
            onUpdateHydraulics={handleUpdateHydraulics}
            onSoundAirHorn={onSoundAirHorn}
            onTriggerEmergencyStop={onTriggerEmergencyStop}
            onResetEmergencyStop={onResetEmergencyStop}
          />
        </div>
      )}

      {/* 4. CONSOLE FOCUS MODE (Expanded Brushed Steel Console) */}
      {layoutMode === 'console-focus' && (
        <div className="relative w-full">
          <WeatherfordControlConsole
            state={state}
            onUpdateHydraulics={handleUpdateHydraulics}
            onUpdateBOP={handleUpdateBOP}
            onUpdateJoystick={onUpdateJoystick}
            onSoundAirHorn={onSoundAirHorn}
            onTriggerEmergencyStop={onTriggerEmergencyStop}
            onResetEmergencyStop={onResetEmergencyStop}
          />

          <OperatorHandsOverlay
            state={state}
            activeControlTarget={activeControlTarget}
            showHands={showHands}
            onToggleShowHands={() => setShowHands(!showHands)}
            gloveStyle={gloveStyle}
            onChangeGloveStyle={setGloveStyle}
          />
        </div>
      )}
    </div>
  );
};

