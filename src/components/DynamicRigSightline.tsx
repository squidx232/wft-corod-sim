import React, { useState } from 'react';
import { SimulatorState } from '../types';
import { RealtimeRodAnimationLayer } from './RealtimeRodAnimationLayer';
import { Rig3DViewport } from './Rig3DViewport';
import {
  Wrench,
  CheckCircle,
  Plus,
  Minus,
  Eye,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Box,
  Layout,
  Layers,
} from 'lucide-react';

interface DynamicRigSightlineProps {
  state: SimulatorState;
  onInstallClamp: () => void;
  onRemoveClamp?: () => void;
  onSetClampCount?: (count: number) => void;
  onTapTest: () => void;
  onAttachContainment: () => void;
  onToggleReelSafetyFork: () => void;
  onToggleBopClosed: () => void;
  onStrokeBopHandPump: () => void;
  onSetTripMode?: (mode: 'RIH' | 'POOH' | 'FREE') => void;
  onSetDepth?: (depthFt: number) => void;
  onUpdateJoystick?: (pos: number) => void;
  onUpdateHydraulics?: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onSoundAirHorn?: () => void;
  onTriggerEmergencyStop?: () => void;
  onResetEmergencyStop?: () => void;
}

export type DisplayPerspectiveMode = '3d' | '2d-full' | '2d-gripper' | '2d-reel' | 'split';

export const DynamicRigSightline: React.FC<DynamicRigSightlineProps> = ({
  state,
  onInstallClamp,
  onRemoveClamp,
  onSetClampCount,
  onTapTest,
  onAttachContainment,
  onToggleReelSafetyFork,
  onToggleBopClosed,
  onStrokeBopHandPump,
  onSetTripMode,
  onSetDepth,
  onUpdateJoystick,
  onUpdateHydraulics,
  onSoundAirHorn,
  onTriggerEmergencyStop,
  onResetEmergencyStop,
}) => {
  const { rod, hydraulics, bop } = state;
  const [displayMode, setDisplayMode] = useState<DisplayPerspectiveMode>('3d');
  const [viewMode2D, setViewMode2D] = useState<'full' | 'gripper' | 'reel'>('full');

  const isSurfacing = rod.rodSpeedFtPerMin > 0.3;
  const isInjecting = rod.rodSpeedFtPerMin < -0.3;
  const isStationary = Math.abs(rod.rodSpeedFtPerMin) <= 0.3;
  const isSlipping = rod.rodGripSlipping;
  const reelRpm = Math.abs(Math.round((rod.rodSpeedFtPerMin / 15) * 10) / 10);

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 shadow-md relative overflow-hidden flex flex-col">
      {/* 1. Live Status & Depth Selector Header Bar (trip-mode buttons removed) */}
      <div className="p-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Live Vector Indicator */}
        <div className="flex items-center gap-2">
          {isInjecting && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/90 border border-emerald-600 text-emerald-300 font-mono text-xs font-bold animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>RIH INJECTING: {Math.abs(Math.round(rod.rodSpeedFtPerMin))} FT/MIN</span>
            </div>
          )}
          {isSurfacing && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-950/90 border border-blue-600 text-blue-300 font-mono text-xs font-bold animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.3)]">
              <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
              <span>POOH SURFACING: +{Math.round(rod.rodSpeedFtPerMin)} FT/MIN</span>
            </div>
          )}
          {isStationary && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>STATIONARY: {Math.round(rod.currentDepthFt)} FT</span>
            </div>
          )}

          {rod.isLandedOnTagBar && (
            <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-600 text-amber-300 font-mono text-[11px] font-bold">
              TAG BAR LANDED
            </span>
          )}
        </div>

        {/* Quick Depth Presets & Slider */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
            Depth:
          </span>
          <div className="flex items-center gap-1">
            {[
              { label: "0' (Surface)", depth: 0 },
              { label: "1000'", depth: 1000 },
              { label: "2250' (Mid)", depth: 2250 },
              { label: "3500'", depth: 3500 },
              { label: "4500' (Bottom)", depth: 4500 },
            ].map((preset) => (
              <button
                key={preset.depth}
                type="button"
                onClick={() => onSetDepth && onSetDepth(preset.depth)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  Math.abs(rod.currentDepthFt - preset.depth) < 50
                    ? 'bg-red-700 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Depth Scrubbing Slider */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <input
              type="range"
              min={0}
              max={rod.totalWellDepthFt || 4500}
              step={25}
              value={Math.round(rod.currentDepthFt)}
              onChange={(e) => onSetDepth && onSetDepth(Number(e.target.value))}
              className="w-24 accent-red-600 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              title={`Adjust Depth: ${Math.round(rod.currentDepthFt)} ft`}
            />
            <span className="text-xs font-mono font-bold text-amber-400 min-w-[50px] text-right">
              {Math.round(rod.currentDepthFt)}'
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual Mode Selector Bar (3D Interactive vs 2D Canvas vs Split) */}
      <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            SIGHTLINE DISPLAY:
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setDisplayMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                displayMode === '3d'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Rig Viewport (WebGL)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDisplayMode('2d-full');
                setViewMode2D('full');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                displayMode === '2d-full'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>2D Schematic</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                displayMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Split (3D + 2D)</span>
            </button>
          </div>
        </div>

        {/* 2D Zoom Sub-controls if in 2D mode */}
        {displayMode.startsWith('2d') && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setDisplayMode('2d-full');
                setViewMode2D('full');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                viewMode2D === 'full' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Full Rig
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayMode('2d-gripper');
                setViewMode2D('gripper');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                viewMode2D === 'gripper' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gripper Head
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayMode('2d-reel');
                setViewMode2D('reel');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                viewMode2D === 'reel' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Service Reel
            </button>
          </div>
        )}
      </div>

      {/* 3. Main Sightline Render Area (3D, 2D, or Split) */}
      {displayMode === '3d' && (
        <Rig3DViewport
          state={state}
          onInstallClamp={onInstallClamp}
          onTapTest={onTapTest}
          onToggleReelSafetyFork={onToggleReelSafetyFork}
          onToggleBopClosed={onToggleBopClosed}
          onUpdateJoystick={onUpdateJoystick}
          onUpdateHydraulics={onUpdateHydraulics}
          onSoundAirHorn={onSoundAirHorn}
          onTriggerEmergencyStop={onTriggerEmergencyStop}
          onResetEmergencyStop={onResetEmergencyStop}
        />
      )}

      {displayMode.startsWith('2d') && (
        <RealtimeRodAnimationLayer
          state={state}
          viewMode={viewMode2D}
          onViewModeChange={setViewMode2D}
          interactive={true}
        />
      )}

      {displayMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 bg-slate-950 p-2">
          <Rig3DViewport
            state={state}
            onInstallClamp={onInstallClamp}
            onTapTest={onTapTest}
            onToggleReelSafetyFork={onToggleReelSafetyFork}
            onToggleBopClosed={onToggleBopClosed}
            onUpdateJoystick={onUpdateJoystick}
            onUpdateHydraulics={onUpdateHydraulics}
            onSoundAirHorn={onSoundAirHorn}
            onTriggerEmergencyStop={onTriggerEmergencyStop}
            onResetEmergencyStop={onResetEmergencyStop}
          />
          <div className="h-[380px] sm:h-[420px] md:h-[460px] rounded-xl overflow-hidden border border-slate-800">
            <RealtimeRodAnimationLayer
              state={state}
              viewMode="full"
              onViewModeChange={() => {}}
              interactive={true}
            />
          </div>
        </div>
      )}

      {/* Field Actions Overlay Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Mechanical Clamp Controller */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 px-2 text-slate-300 font-semibold">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">Mech Clamp:</span>
            <span className="text-[11px] font-mono text-amber-400 font-bold">
              {rod.mechanicalClampsInstalled > 0 ? `${rod.mechanicalClampsInstalled} (550 ft-lbs)` : 'None'}
            </span>
          </div>

          {/* Clamp count selector */}
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onSetClampCount ? onSetClampCount(0) : onRemoveClamp ? onRemoveClamp() : null}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                rod.mechanicalClampsInstalled === 0
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => onSetClampCount ? onSetClampCount(1) : onInstallClamp()}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                rod.mechanicalClampsInstalled === 1
                  ? 'bg-amber-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1
            </button>
            <button
              type="button"
              onClick={() => onSetClampCount ? onSetClampCount(2) : onInstallClamp()}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                rod.mechanicalClampsInstalled === 2
                  ? 'bg-amber-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2 (Stacked)
            </button>
          </div>

          {/* + Add Clamp Button */}
          <button
            id="btn-install-clamp-fps"
            type="button"
            onClick={onInstallClamp}
            disabled={rod.mechanicalClampsInstalled >= 2}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-800 text-white font-semibold text-[11px] shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>

          {/* - Remove Clamp Button */}
          <button
            id="btn-remove-clamp-fps"
            type="button"
            onClick={onRemoveClamp}
            disabled={rod.mechanicalClampsInstalled <= 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-[11px] shadow-sm active:scale-95 transition-all"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>

        {/* Safety Actions & Auxiliary Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tap Test Button */}
          <button
            id="btn-tap-test-fps"
            type="button"
            onClick={onTapTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 font-semibold text-xs transition-all active:scale-95"
            title="Acoustic Tap Test: Strike string with brass hammer to verify secure clamping (Dull thud = Loose / Sharp ping = Tight)"
          >
            <span>🔨 Hammer Tap Test</span>
          </button>

          {/* Reel Safety Fork Toggle */}
          <button
            id="btn-reel-fork-fps"
            type="button"
            onClick={onToggleReelSafetyFork}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              hydraulics.reelSafetyForkEngaged
                ? 'bg-amber-950/80 border-amber-600 text-amber-300 hover:bg-amber-900'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              Reel Fork: {hydraulics.reelSafetyForkEngaged ? 'ENGAGED (LOCKED)' : 'DISENGAGED'}
            </span>
          </button>

          {/* Containment Device */}
          <button
            id="btn-containment-fps"
            type="button"
            onClick={onAttachContainment}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              rod.containmentDeviceAttached
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>
              Containment: {rod.containmentDeviceAttached ? 'ATTACHED' : 'DETACHED'}
            </span>
          </button>

          {/* BOP Hand Pump */}
          <button
            id="btn-bop-handpump-fps"
            type="button"
            onClick={onStrokeBopHandPump}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-300 border border-slate-700 text-xs font-semibold active:scale-95 transition-all"
            title="Stroke Manual BOP Emergency Hand Pump (+250 PSI per stroke)"
          >
            <span>🚨 BOP Hand Pump ({bop.handPumpStrokes}x)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

