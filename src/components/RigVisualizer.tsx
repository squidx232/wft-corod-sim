import React, { useState } from 'react';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import { RealtimeRodAnimationLayer } from './RealtimeRodAnimationLayer';
import {
  ArrowDown,
  ArrowUp,
  Wrench,
  CheckCircle,
  Activity,
  Disc,
  Truck,
} from 'lucide-react';

interface RigVisualizerProps {
  state: SimulatorState;
  onInstallClamp: () => void;
  onTapTest: () => void;
  onAttachContainment: () => void;
  onToggleReelSafetyFork: () => void;
  onInstallElevator: () => void;
}

export const RigVisualizer: React.FC<RigVisualizerProps> = ({
  state,
  onInstallClamp,
  onTapTest,
  onAttachContainment,
  onToggleReelSafetyFork,
  onInstallElevator,
}) => {
  const { rod, hydraulics, outriggers, picker, bop } = state;
  const [displayMode, setDisplayMode] = useState<'schematic' | 'dynamics'>('dynamics');

  const isTripping = Math.abs(rod.rodSpeedFtPerMin) > 1;
  const isSurfacing = rod.rodSpeedFtPerMin > 1;
  const isInjecting = rod.rodSpeedFtPerMin < -1;
  const isSlipping = rod.rodGripSlipping;
  const isSafetyEngaged = hydraulics.safetyClampLever === 'ON';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Header & Telemetry Status Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-800/60 text-red-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-100">
                Wellsite Live Schematic & String Dynamics
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono font-semibold">
                {rod.rodGrade} {rod.rodSize} {rod.rodShape.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Downhole depth, load sensors, gripper grip friction, and wellhead BOP stack
            </p>
          </div>
        </div>

        {/* Live Gauges Strip */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">DEPTH:</span>
            <span className="text-emerald-400 font-bold text-sm">
              {Math.round(rod.currentDepthFt)} / {rod.totalWellDepthFt} FT
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">SPEED:</span>
            <span
              className={`font-bold text-sm flex items-center gap-1 ${
                isSurfacing
                  ? 'text-emerald-400'
                  : isInjecting
                  ? 'text-blue-400'
                  : 'text-slate-400'
              }`}
            >
              {isSurfacing && <ArrowUp className="w-4 h-4" />}
              {isInjecting && <ArrowDown className="w-4 h-4" />}
              {Math.round(rod.rodSpeedFtPerMin)} FT/MIN
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">STRING WT:</span>
            <span className="text-amber-400 font-bold text-sm">
              {Math.round(rod.totalStringWeightLbs).toLocaleString()} LBS
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">SQUEEZE:</span>
            <span
              className={`font-bold text-sm ${
                hydraulics.squeezePressure < rod.calculatedSqueezeRequiredPsi
                  ? 'text-red-400 font-black animate-pulse'
                  : 'text-emerald-400'
              }`}
            >
              {Math.round(hydraulics.squeezePressure)} /{' '}
              {Math.round(rod.calculatedSqueezeRequiredPsi)} PSI
            </span>
          </div>
        </div>
      </div>

      {/* Main Visual Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Truck, Guide Arch & Reel Visualizer */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between min-h-[420px] gap-4">
          {/* Status Indicators Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  outriggers.truckLeveled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
                }`}
              >
                {outriggers.truckLeveled ? 'Rig Leveled & Chocked' : 'Rig Unlevel'}
              </span>

              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  isSafetyEngaged
                    ? 'bg-red-950 text-red-300 border-red-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isSafetyEngaged ? 'Safety Clamp ENGAGED' : 'Safety Clamp Open'}
              </span>

              {isSlipping && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white shadow-lg animate-pulse">
                  ROD SLIPPING IN CHAINS!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-slate-400 hidden sm:block">
                Crane: {picker.telescopeLengthFt.toFixed(0)} FT • Load: {picker.currentLiftWeightLbs} LBS
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDisplayMode('dynamics')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    displayMode === 'dynamics'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span>Live Dynamics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('schematic')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    displayMode === 'schematic'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Rig Schematic</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Real-time Canvas OR SVG Stage */}
          {displayMode === 'dynamics' ? (
            <RealtimeRodAnimationLayer state={state} interactive={true} />
          ) : (
            <div className="relative w-full h-80 flex items-center justify-center bg-slate-950/60 rounded-xl p-2 border border-slate-800/60">
              <svg viewBox="0 0 800 320" className="w-full h-full select-none">
              {/* Ground line */}
              <line
                x1="20"
                y1="280"
                x2="780"
                y2="280"
                stroke="#334155"
                strokeWidth="4"
                strokeDasharray="6 4"
              />
              <rect x="20" y="280" width="760" height="30" fill="#0f172a" opacity="0.6" />

              {/* 1. Mobile Gripper Truck (Left Side) */}
              <g transform="translate(60, 160)">
                {/* Truck Chassis */}
                <rect
                  x="0"
                  y="50"
                  width="220"
                  height="50"
                  rx="6"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="2"
                />
                {/* Cab */}
                <path
                  d="M 0 50 L 0 20 Q 0 10 10 10 L 50 10 L 65 50 Z"
                  fill="#2563eb"
                  stroke="#1d4ed8"
                  strokeWidth="2"
                />
                <rect x="10" y="18" width="35" height="22" rx="3" fill="#60a5fa" opacity="0.8" />
                {/* Brand Stripe */}
                <rect x="65" y="60" width="145" height="10" fill="#dc2626" />
                <text
                  x="75"
                  y="68"
                  fill="#ffffff"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  WEATHERFORD COROD®
                </text>
                {/* Wheels */}
                <circle cx="35" cy="100" r="16" fill="#020617" stroke="#64748b" strokeWidth="3" />
                <circle cx="150" cy="100" r="16" fill="#020617" stroke="#64748b" strokeWidth="3" />
                <circle cx="185" cy="100" r="16" fill="#020617" stroke="#64748b" strokeWidth="3" />
                {/* Wheel Chocks */}
                {outriggers.wheelChocksPlaced && (
                  <polygon points="130,116 142,100 142,116" fill="#eab308" />
                )}

                {/* Outriggers */}
                <rect
                  x="80"
                  y="70"
                  width="8"
                  height={outriggers.leftLowered ? '50' : '20'}
                  fill="#eab308"
                  stroke="#713f12"
                  strokeWidth="1"
                />
                {outriggers.woodenPadsUnderLeft && (
                  <rect
                    x="70"
                    y="118"
                    width="28"
                    height="6"
                    fill="#b45309"
                    stroke="#78350f"
                    strokeWidth="1"
                  />
                )}

                {/* Knuckle Picker Crane Base */}
                <rect
                  x="195"
                  y="30"
                  width="20"
                  height="20"
                  fill="#dc2626"
                  stroke="#991b1b"
                  strokeWidth="1"
                />
                <line
                  x1="205"
                  y1="30"
                  x2="290"
                  y2={60 - picker.angleDegrees * 0.8}
                  stroke="#ef4444"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <circle cx="205" cy="30" r="5" fill="#ffffff" />
                <circle cx="290" cy={60 - picker.angleDegrees * 0.8} r="4" fill="#ffffff" />
                <line
                  x1="290"
                  y1={60 - picker.angleDegrees * 0.8}
                  x2="290"
                  y2="130"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <path
                  d="M 287 130 Q 290 138 295 133"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
              </g>

              {/* 2. Overhead Guide Arch */}
              <g transform="translate(360, 20)">
                <path
                  d="M 50 140 C 50 10, 260 10, 260 180"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <circle cx="220" cy="55" r="7" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
                <text x="232" y="58" fill="#fbbf24" fontSize="8" fontWeight="bold">
                  Swivel (#7)
                </text>

                {/* COROD string in arch */}
                <path
                  d="M 50 140 C 50 10, 260 10, 260 180"
                  fill="none"
                  stroke={isSlipping ? '#ef4444' : '#10b981'}
                  strokeWidth="3.5"
                  strokeDasharray={isTripping ? '8 4' : 'none'}
                />

                {rod.containmentDeviceAttached && (
                  <rect
                    x="250"
                    y="165"
                    width="20"
                    height="14"
                    rx="3"
                    fill="#eab308"
                    stroke="#713f12"
                    strokeWidth="1.5"
                  />
                )}
              </g>

              {/* 3. Transport Service Reel (Right) */}
              <g transform="translate(620, 150)">
                <circle cx="60" cy="60" r="55" fill="none" stroke="#64748b" strokeWidth="4" />
                <line x1="60" y1="5" x2="60" y2="115" stroke="#475569" strokeWidth="2" />
                <line x1="5" y1="60" x2="115" y2="60" stroke="#475569" strokeWidth="2" />
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray="5 3"
                  opacity="0.75"
                />
                <circle cx="60" cy="60" r="14" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                <polygon
                  points="20,130 60,60 100,130"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="3"
                />
                <line x1="5" y1="130" x2="115" y2="130" stroke="#334155" strokeWidth="5" />

                {rod.reelSafetyForksInPlace && (
                  <path
                    d="M 40 25 L 80 25 L 80 40 L 40 40 Z"
                    fill="#ef4444"
                    stroke="#7f1d1d"
                    strokeWidth="1.5"
                  />
                )}
              </g>

              {/* 4. Wellhead & Mobile Injector Stack */}
              <g transform="translate(370, 110)">
                <rect
                  x="20"
                  y="0"
                  width="80"
                  height="75"
                  rx="4"
                  fill="#1e3a8a"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                <text x="30" y="14" fill="#bfdbfe" fontSize="7.5" fontWeight="bold">
                  MG INJECTOR
                </text>

                {/* Gripper Chains */}
                <g transform="translate(30, 20)">
                  <rect
                    x="0"
                    y="0"
                    width="16"
                    height="42"
                    rx="4"
                    fill="#020617"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="8"
                    y1="0"
                    x2="8"
                    y2="42"
                    stroke="#e2e8f0"
                    strokeWidth="2"
                    strokeDasharray={isTripping ? '4 3' : 'none'}
                  />
                  <rect
                    x="44"
                    y="0"
                    width="16"
                    height="42"
                    rx="4"
                    fill="#020617"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="52"
                    y1="0"
                    x2="52"
                    y2="42"
                    stroke="#e2e8f0"
                    strokeWidth="2"
                    strokeDasharray={isTripping ? '4 3' : 'none'}
                  />

                  {/* Pressure Beams */}
                  <rect
                    x={hydraulics.squeezePressureSwitch ? '14' : '10'}
                    y="10"
                    width="6"
                    height="22"
                    fill="#ef4444"
                  />
                  <rect
                    x={hydraulics.squeezePressureSwitch ? '40' : '44'}
                    y="10"
                    width="6"
                    height="22"
                    fill="#ef4444"
                  />

                  {/* Rod String */}
                  <line
                    x1="30"
                    y1="-30"
                    x2="30"
                    y2="170"
                    stroke={isSlipping ? '#ef4444' : '#22c55e'}
                    strokeWidth="3"
                  />
                </g>

                <rect x="52" y="75" width="16" height="15" fill="#475569" stroke="#334155" />

                {/* Safety Clamp */}
                <rect
                  x="28"
                  y="90"
                  width="64"
                  height="22"
                  rx="3"
                  fill={isSafetyEngaged ? '#7f1d1d' : '#334155'}
                  stroke={isSafetyEngaged ? '#ef4444' : '#64748b'}
                  strokeWidth="2"
                />
                <text x="32" y="103" fill="#ffffff" fontSize="7" fontWeight="bold">
                  SAFETY CLAMP
                </text>

                {/* BOP Spacer Plate */}
                <rect
                  x="18"
                  y="112"
                  width="84"
                  height="6"
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />

                {/* Rod Wiper */}
                <rect
                  x="36"
                  y="118"
                  width="48"
                  height="15"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <text x="44" y="128" fill="#94a3b8" fontSize="7">
                  ROD WIPER
                </text>

                {/* Regan BOP */}
                <rect
                  x="30"
                  y="133"
                  width="60"
                  height="20"
                  fill={bop.reganBopClosed ? '#991b1b' : '#1e293b'}
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <text
                  x="35"
                  y="145"
                  fill={bop.reganBopClosed ? '#fca5a5' : '#94a3b8'}
                  fontSize="7"
                  fontWeight="bold"
                >
                  {bop.reganBopClosed ? 'REGAN CLOSED' : 'REGAN BOP'}
                </text>

                {/* Flow Tee */}
                <rect x="42" y="153" width="36" height="16" fill="#334155" stroke="#1e293b" />
                <circle cx="82" cy="161" r="5" fill="#eab308" />
                <rect x="46" y="169" width="28" height="8" fill="#020617" stroke="#64748b" />

                {/* Mechanical Clamps */}
                {rod.mechanicalClampsInstalled >= 1 && (
                  <g transform="translate(30, 80)">
                    <rect
                      x="0"
                      y="0"
                      width="60"
                      height="9"
                      rx="2"
                      fill="#dc2626"
                      stroke="#991b1b"
                      strokeWidth="1"
                    />
                    <text x="8" y="7" fill="#ffffff" fontSize="6.5" fontWeight="bold">
                      CLAMP #1 (500 FT-LB)
                    </text>
                  </g>
                )}
                {rod.mechanicalClampsInstalled >= 2 && (
                  <g transform="translate(30, 70)">
                    <rect
                      x="0"
                      y="0"
                      width="60"
                      height="9"
                      rx="2"
                      fill="#dc2626"
                      stroke="#991b1b"
                      strokeWidth="1"
                    />
                    <text x="8" y="7" fill="#ffffff" fontSize="6.5" fontWeight="bold">
                      CLAMP #2 (STACKED)
                    </text>
                  </g>
                )}
              </g>
            </svg>
          </div>
        )}

          {/* Quick Wellsite Actions Bar */}
          <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-800 gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                id="btn-rig-install-clamp"
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  onInstallClamp();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2 min-h-[44px]"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                Install Mech Clamp ({rod.mechanicalClampsInstalled})
              </button>

              <button
                id="btn-rig-tap-test"
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  onTapTest();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2 min-h-[44px]"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                3-Tap Bump Test
              </button>

              <button
                id="btn-rig-containment"
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  onAttachContainment();
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                  rod.containmentDeviceAttached
                    ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Containment: {rod.containmentDeviceAttached ? 'ATTACHED' : 'UNSET'}
              </button>

              <button
                id="btn-rig-safety-fork"
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  onToggleReelSafetyFork();
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                  rod.reelSafetyForksInPlace
                    ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Reel Safety Fork: {rod.reelSafetyForksInPlace ? 'IN PLACE' : 'REMOVED'}
              </button>
            </div>

            <button
              id="btn-install-rod-elevator"
              type="button"
              onClick={() => {
                soundManager.playMetalTap();
                onInstallElevator();
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition-all min-h-[44px] ${
                rod.hasElevatorOnString
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : 'bg-purple-700 hover:bg-purple-600 text-white shadow-md'
              }`}
            >
              {rod.hasElevatorOnString
                ? 'Elevator on String'
                : 'Attach Rod Elevator'}
            </button>
          </div>
        </div>

        {/* Right Side: Downhole Wellbore & String Status */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-sm font-bold uppercase text-amber-400 tracking-wide">
                Downhole Dynamics
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {rod.currentDepthFt > 0
                  ? `${((rod.currentDepthFt / rod.totalWellDepthFt) * 100).toFixed(0)}% Depth`
                  : 'SURFACED'}
              </span>
            </div>

            <div className="space-y-4">
              {/* Depth Visualizer Gauge */}
              <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 flex flex-col justify-between gap-3">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>0 FT (SURFACE)</span>
                  <span>BOP LEVEL</span>
                </div>

                <div className="w-full h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (rod.currentDepthFt / rod.totalWellDepthFt) * 100
                      )}%`,
                    }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500 transition-all duration-100"
                  />
                </div>

                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>TOTAL DEPTH: {rod.totalWellDepthFt} FT</span>
                  <span
                    className={`font-bold ${
                      rod.isLandedOnTagBar
                        ? 'text-amber-400 font-black'
                        : 'text-slate-400'
                    }`}
                  >
                    {rod.isLandedOnTagBar ? 'ON TAG BAR (0 WT)' : 'OFF TAG BAR'}
                  </span>
                </div>
              </div>

              {/* Critical Downhole Parameters */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Unit Linear Weight:</span>
                  <span className="text-slate-200 font-semibold">
                    {rod.linearWeightLbsPerFt.toFixed(2)} lbs/ft
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total String Weight:</span>
                  <span className="text-amber-400 font-bold">
                    {Math.round(rod.totalStringWeightLbs).toLocaleString()} lbs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Min Squeeze Required:</span>
                  <span className="text-emerald-400 font-bold">
                    {Math.round(rod.calculatedSqueezeRequiredPsi)} psi
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Optical Diameter (X/Y):</span>
                  <span
                    className={
                      rod.rodWearDiameterInchX < 0.9 || rod.rodWearDiameterInchY < 0.9
                        ? 'text-red-400 font-bold animate-pulse'
                        : 'text-slate-200'
                    }
                  >
                    {rod.rodWearDiameterInchX.toFixed(3)}" /{' '}
                    {rod.rodWearDiameterInchY.toFixed(3)}"
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">String Motion State:</span>
                  <span
                    className={`font-bold uppercase ${
                      rod.rodInTensionOrCompression === 'freefall'
                        ? 'text-red-500 animate-bounce'
                        : rod.rodInTensionOrCompression === 'compression'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {rod.rodInTensionOrCompression}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 italic">
            "Maintain safety forks in place on the transport reel and attach containment device before guide exit."
          </div>
        </div>
      </div>
    </div>
  );
};
