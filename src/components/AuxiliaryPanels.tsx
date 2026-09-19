import React, { useState } from 'react';
import { useT } from '../i18n';
import { SimulatorState, YToolState } from '../types';
import { soundManager } from '../utils/audio';
import {
  Gauge,
  Sliders,
  Flame,
  Wind,
  Settings,
  Truck,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AuxiliaryPanelsProps {
  state: SimulatorState;
  onUpdateBop: (updates: Partial<SimulatorState['bop']>) => void;
  onUpdateYTool: (updates: Partial<SimulatorState['yTool']>) => void;
  onUpdateOutriggers: (updates: Partial<SimulatorState['outriggers']>) => void;
  onUpdatePicker: (updates: Partial<SimulatorState['picker']>) => void;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onSetClampCount?: (count: number) => void;
  onEmergencyAction?: (action: 'evacuate' | 'scba') => void;
  onStrokeBopHandPump: () => void;
}

export const AuxiliaryPanels: React.FC<AuxiliaryPanelsProps> = ({
  state,
  onUpdateBop,
  onUpdateYTool,
  onUpdateOutriggers,
  onUpdatePicker,
  onUpdateHydraulics,
  onSetClampCount,
  onEmergencyAction,
  onStrokeBopHandPump,
}) => {
  const { t } = useT();
  const [activeAuxTab, setActiveAuxTab] = useState<'bop' | 'ytool' | 'outriggers' | 'picker' | 'thermal' | 'cab'>('bop');
  const [calibStage, setCalibStage] = useState<number>(0);

  const { bop, yTool, outriggers, picker, hydraulics } = state;

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-white border border-slate-300 p-6 shadow-md text-slate-800 w-full">
      {/* Component Load Chart — always-visible placard at top of auxiliary area */}
      <div className="flex items-start gap-4">
        <div
          id="component-load-chart"
          className="bg-gradient-to-b from-neutral-900 to-black border-2 border-neutral-700 rounded-md shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),0_4px_10px_rgba(0,0,0,0.6)] px-4 py-3 relative overflow-hidden min-w-[240px]"
          title="Maximum component working loads"
        >
          <div className="absolute left-1 top-1 w-1.5 h-1.5 rounded-full bg-neutral-600 border border-neutral-800" />
          <div className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-neutral-600 border border-neutral-800" />
          <div className="absolute left-1 bottom-1 w-1.5 h-1.5 rounded-full bg-neutral-600 border border-neutral-800" />
          <div className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-neutral-600 border border-neutral-800" />
          <div className="text-sm font-semibold text-neutral-100 text-center mb-2 font-mono border-b border-neutral-700 pb-1">
            {t('aux.componentLoadChart')}
          </div>
          <div className="flex flex-col gap-1 font-mono">
            {[
              { name: 'SERVICE REEL', load: '1,213 LBS' },
              { name: 'SAFETY ASSY', load: '750 LBS' },
              { name: 'GUIDE RACK & SAFETY ASSY', load: '2,205 LBS' },
              { name: 'GRIPPER', load: '4,519 LBS' },
              { name: 'PORTABLE FORGE WELDER', load: '1,709 LBS' },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-4 text-2xs">
                <span className="text-neutral-300 font-bold tracking-wide">{row.name}</span>
                <span className="text-amber-300 font-semibold tabular-nums whitespace-nowrap">→ {row.load}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ROD SAFETY CLAMPS — install/remove mechanical clamps on the string.
            Always available (critical during emergency response). */}
        <div
          data-control-id="ctrl-install-clamp"
          className="flex-1 min-w-[240px] bg-slate-100 border-2 border-slate-300 rounded-lg shadow-lg px-4 py-3"
        >
          <div className="text-sm font-semibold text-slate-800 text-center mb-2 font-mono border-b border-slate-300 pb-1">
            {t('aux.rodSafetyClamps')}
          </div>
          <div className="flex items-center justify-center gap-3 my-2">
            {[0, 1].map((i) => {
              const installed = state.rod.mechanicalClampsInstalled > i;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                    installed
                      ? 'bg-amber-50 border-amber-500 text-amber-700'
                      : 'bg-slate-200/50 border-slate-400 text-slate-500'
                  }`}
                >
                  {/* Simple clamp icon: two jaws around a rod */}
                  <div className="relative w-8 h-10 flex items-center justify-center">
                    <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 rounded ${installed ? 'bg-slate-300' : 'bg-slate-600'}`} />
                    <div className={`absolute top-3 left-0 w-3 h-4 rounded-l ${installed ? 'bg-amber-500' : 'bg-slate-600'}`} />
                    <div className={`absolute top-3 right-0 w-3 h-4 rounded-r ${installed ? 'bg-amber-500' : 'bg-slate-600'}`} />
                  </div>
                  <span className="text-eyebrow font-mono font-bold">
                    CLAMP {i + 1} {installed ? '✓' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-center text-eyebrow text-slate-500 font-mono mb-2">
            {t('aux.installedCount', { count: state.rod.mechanicalClampsInstalled })}
            {state.rod.mechanicalClampsInstalled > 0 &&
              ` ${t('aux.clampTorque', { torque: state.rod.clampTorqueFtLbs })}`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                onSetClampCount?.(Math.min(2, state.rod.mechanicalClampsInstalled + 1))
              }
              disabled={state.rod.mechanicalClampsInstalled >= 2}
              className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase shadow active:scale-95"
            >
              {t('aux.installClamp')}
            </button>
            <button
              type="button"
              onClick={() =>
                onSetClampCount?.(Math.max(0, state.rod.mechanicalClampsInstalled - 1))
              }
              disabled={state.rod.mechanicalClampsInstalled <= 0}
              className="flex-1 py-2 rounded-lg bg-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase shadow active:scale-95"
            >
              {t('aux.removeClamp')}
            </button>
          </div>
        </div>

        {/* EMERGENCY RESPONSE ACTIONS — evacuate & SCBA (for H2S / weather drills) */}
        <div className="flex-1 min-w-[240px] bg-slate-100 border-2 border-slate-300 rounded-lg shadow-lg px-4 py-3">
          <div className="text-sm font-semibold text-slate-800 text-center mb-2 font-mono border-b border-slate-300 pb-1">
            {t('aux.emergencyResponseActions')}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              data-control-id="ctrl-evacuate"
              onClick={() => onEmergencyAction?.('evacuate')}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase shadow active:scale-95 border transition-all ${
                state.evacuatedToMuster
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'bg-amber-700 hover:bg-amber-600 border-amber-500 text-white'
              }`}
            >
              {state.evacuatedToMuster ? t('aux.evacuated') : t('aux.evacuateToMuster')}
            </button>
            <button
              type="button"
              data-control-id="ctrl-scba"
              onClick={() => onEmergencyAction?.('scba')}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase shadow active:scale-95 border transition-all ${
                state.scbaEquipped
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500 text-white'
              }`}
            >
              {state.scbaEquipped ? t('aux.scbaEquipped') : t('aux.equipSCBA')}
            </button>
            <p className="text-eyebrow text-slate-500 font-mono text-center mt-1">
              {t('aux.h2sEmergency')}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-300 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-amber-700" />
          <h3 className="text-base font-semibold text-slate-800">
            {t('aux.auxiliaryWellsiteSystems')}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 bg-slate-100/80 p-1.5 rounded-lg border border-slate-300">
          <button
            onClick={() => setActiveAuxTab('bop')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'bop'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('aux.tabBOP')}
          </button>

          <button
            onClick={() => setActiveAuxTab('ytool')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'ytool'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            {t('aux.tabYTool')}
          </button>

          <button
            onClick={() => setActiveAuxTab('outriggers')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'outriggers'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            {t('aux.tabOutriggers')}
          </button>

          <button
            onClick={() => setActiveAuxTab('picker')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'picker'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Gauge className="w-4 h-4" />
            {t('aux.tabPicker')}
          </button>

          <button
            onClick={() => setActiveAuxTab('thermal')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'thermal'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Flame className="w-4 h-4" />
            {t('aux.tabThermal')}
          </button>

          <button
            onClick={() => setActiveAuxTab('cab')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase transition-all flex items-center gap-2 min-h-[40px] ${
              activeAuxTab === 'cab'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            {t('aux.tabCab')}
          </button>
        </div>
      </div>

      {/* TAB 1: AUTOMATIC BOP PUMP (Figure 19) */}
      {activeAuxTab === 'bop' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-4 rounded-lg bg-slate-100/70 border border-slate-300">
          {/* BOP Status & Gauges */}
          <div className="space-y-4 rounded-lg bg-white border border-slate-300 p-4">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="text-xs font-semibold text-amber-700">
                {t('aux.bopTelemetryLabel')}
              </span>
              <span className="text-eyebrow text-slate-500 font-mono">Fig 19 / Sec 3.6.6</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300">
                <span className="text-eyebrow uppercase text-slate-500 block">{t('aux.truckAirSupplyLabel')}</span>
                <span className="text-xl font-mono font-semibold text-cyan-700">{bop.airSupplyPsi} PSI</span>
                <span className="text-eyebrow text-slate-500 block">{t('aux.nominalLabel')}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300">
                <span className="text-eyebrow uppercase text-slate-500 block">{t('aux.bopInflationPressure')}</span>
                <span
                  className={`text-xl font-mono font-semibold ${
                    hydraulics.bopPressure >= 1000 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {Math.round(hydraulics.bopPressure)} PSI
                </span>
                <span className="text-eyebrow text-slate-500 block">{t('aux.targetLabel')}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-100/60 border border-slate-300 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('aux.reganBopBagStatus')}:</span>
                <span className={`font-bold ${bop.reganBopClosed ? 'text-red-700' : 'text-emerald-700'}`}>
                  {bop.reganBopClosed ? t('aux.closedSealed') : t('aux.openFullBore')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('aux.wellboreAnnulus')}:</span>
                <span className={`font-bold ${bop.reganBopClosed ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {bop.reganBopClosed ? t('aux.contained') : t('aux.uncontained')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('aux.eubMandate')}:</span>
                <span className="text-slate-600 font-mono font-bold">{t('aux.shutIn1min')}</span>
              </div>
            </div>
          </div>

          {/* BOP Controls & Regulators */}
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4">
            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
              {t('aux.automaticPumpControls')}
            </span>

            {/* BOP Pump On/Off */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
              <div>
                <span className="text-xs font-bold block text-slate-700">{t('aux.airPumpMotor')}</span>
                <span className="text-eyebrow text-slate-500">{t('aux.pneumaticDriven')}</span>
              </div>
              <button
                id="btn-bop-pump-switch"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (!bop.bopPumpSwitch) {
                    onUpdateHydraulics({ bopPressure: Math.max(hydraulics.bopPressure, bop.bopRegulatorPsi) });
                  }
                  onUpdateBop({ bopPumpSwitch: !bop.bopPumpSwitch });
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                  bop.bopPumpSwitch ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {bop.bopPumpSwitch ? 'PUMP ON' : 'PUMP OFF'}
              </button>
            </div>

            {/* Pressure Regulator */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">{t('aux.airPressureRegulator')}</span>
                <span className="text-cyan-700 font-mono">{bop.bopRegulatorPsi} PSI</span>
              </div>
              <input
                id="slider-bop-regulator"
                type="range"
                min="0"
                max="1500"
                step="50"
                value={bop.bopRegulatorPsi}
                onChange={(e) => onUpdateBop({ bopRegulatorPsi: Number(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-eyebrow text-slate-500 block">{t('aux.bringBopTo')}</span>
            </div>

            {/* BOP Bleed Valve */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
              <div>
                <span className="text-xs font-bold block text-slate-700">BOP Bleed Valve</span>
                <span className="text-eyebrow text-slate-500">Relieve accumulator fluid</span>
              </div>
              <button
                id="btn-bop-bleed"
                onClick={() => {
                  soundManager.playHiss(0.6);
                  onUpdateBop({ bopBleedOpen: !bop.bopBleedOpen });
                  if (!bop.bopBleedOpen) {
                    onUpdateHydraulics({ bopPressure: 0 });
                    onUpdateBop({ reganBopClosed: false });
                  }
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                  bop.bopBleedOpen ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {bop.bopBleedOpen ? t('aux.bleedOpen') : t('aux.bopClosed')}
              </button>
            </div>
          </div>

          {/* Backup Manual Baker Hand Pump */}
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
                {t('aux.secondaryBakerPump')}
              </span>
              <p className="text-xs text-slate-500 my-2">
                If truck air fails or pneumatic pump cannot hold pressure, use the manual Baker hand pump lever to build BOP pressure manually.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-between">
              <span className="text-xs text-slate-500">{t('aux.totalManualStrokes')}:</span>
              <span className="font-mono font-bold text-amber-700">{bop.handPumpStrokes}</span>
            </div>

            <button
              id="btn-stroke-baker-pump"
              onClick={() => {
                soundManager.playMetalTap();
                onStrokeBopHandPump();
              }}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {t('aux.strokeBakerPump')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: OPTICAL ROD COUNTER & Y-TOOL CALIBRATION (Figure 105 & 107) */}
      {activeAuxTab === 'ytool' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 rounded-xl bg-slate-100/70 border border-slate-300">
          {/* Y-Tool Red Pelican Display Console */}
          <div className="lg:col-span-7 rounded-xl bg-gradient-to-b from-red-700 via-red-800 to-red-900 border-4 border-red-950 p-5 shadow-xl flex flex-col justify-between text-white">
            {/* Console Faceplate Header */}
            <div className="flex items-center justify-between border-b-2 border-red-950/40 pb-2">
              <span className="font-semibold text-xs uppercase tracking-widest text-white">
                {t('aux.yToolCalibrator')}
              </span>
              <div className="flex items-center gap-2">
                {yTool.alarmSounding && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-red-900 text-eyebrow font-semibold uppercase animate-ping">
                    {t('aux.audibleAlarmLabel')}
                  </span>
                )}
                <div
                  className={`w-4 h-4 rounded-full border-2 border-black ${
                    yTool.alarmVisual ? 'bg-red-500 animate-pulse shadow-lg' : 'bg-red-950'
                  }`}
                  title="Visual Limit Alarm"
                />
              </div>
            </div>

            {/* LCD Screen Display (2-Line Authentic Display) — dark LCD, light text */}
            <div className="my-4 p-4 rounded-xl bg-emerald-950 border-4 border-black shadow-inner font-mono text-emerald-300">
              {yTool.poweredOn ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm md:text-base font-bold tracking-wider">
                    <span>
                      {yTool.displayMode === 'dimensions' && (
                        <>X={yTool.measuredDiameterX.toFixed(3)}" Y={yTool.measuredDiameterY.toFixed(3)}"</>
                      )}
                      {yTool.displayMode === 'rate' && (
                        <>RATE: {Math.abs(Math.round(state.rod.rodSpeedFtPerMin))} {yTool.unitSystem === 'imperial' ? 'FT/MIN' : 'M/MIN'}</>
                      )}
                      {yTool.displayMode === 'temperature' && (
                        <>HYD TEMP: {Math.round(hydraulics.hydraulicFluidTempC)}°C</>
                      )}
                    </span>
                    <span className="text-eyebrow px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">
                      {yTool.unitSystem.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs md:text-sm text-emerald-300/90 border-t border-emerald-700/60 pt-1.5">
                    <span>
                      DEPTH: {yTool.unitSystem === 'imperial' ? `${Math.round(state.rod.currentDepthFt)} FT` : `${Math.round(state.rod.currentDepthFt * 0.3048)} M`}
                    </span>
                    <span className="text-eyebrow text-emerald-400">
                      {yTool.calibrated ? t('aux.calibrated') : t('aux.uncalibrated')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-emerald-500 text-xs font-bold uppercase">
                  {t('aux.yToolPowerOffLabel')}
                </div>
              )}
            </div>

            {/* 4 Rubber Tactile Buttons (Figure 107) */}
            <div className="grid grid-cols-4 gap-2">
              <button
                id="btn-ytool-1"
                onClick={() => {
                  soundManager.playMetalTap();
                  const modes: YToolState['displayMode'][] = ['dimensions', 'rate', 'temperature'];
                  const nextMode = modes[(modes.indexOf(yTool.displayMode) + 1) % modes.length];
                  onUpdateYTool({ displayMode: nextMode });
                }}
                className="py-2.5 rounded bg-white hover:bg-slate-200 active:scale-95 text-slate-800 font-mono font-bold text-xs shadow-md border border-slate-300"
              >
                {t('aux.key1Mode')}
              </button>

              <button
                id="btn-ytool-2"
                onClick={() => {
                  soundManager.playMetalTap();
                  onUpdateYTool({ unitSystem: yTool.unitSystem === 'imperial' ? 'metric' : 'imperial' });
                }}
                className="py-2.5 rounded bg-white hover:bg-slate-200 active:scale-95 text-slate-800 font-mono font-bold text-xs shadow-md border border-slate-300"
              >
                {t('aux.key2Unit')}
              </button>

              <button
                id="btn-ytool-3"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (yTool.measuredDiameterX >= 0.900 && yTool.measuredDiameterY >= 0.900) {
                    onUpdateYTool({ alarmSounding: false, alarmVisual: false });
                  } else {
                    soundManager.playBuzzerAlert();
                  }
                }}
                className="py-2.5 rounded bg-white hover:bg-slate-200 active:scale-95 text-slate-800 font-mono font-bold text-xs shadow-md border border-slate-300"
              >
                {t('aux.key3Reset')}
              </button>

              <button
                id="btn-ytool-4"
                onClick={() => {
                  soundManager.playMetalTap();
                  // Zero depth if 1+4
                  onUpdateYTool({ depthReadingFt: 0 });
                }}
                className="py-2.5 rounded bg-white hover:bg-slate-200 active:scale-95 text-slate-800 font-mono font-bold text-xs shadow-md border border-slate-300"
              >
                {t('aux.key4Contrast')}
              </button>
            </div>
          </div>

          {/* Nitrogen Regulator & 2-Point Calibration Bar Tool */}
          <div className="lg:col-span-5 space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-amber-700 tracking-wider block border-b border-slate-300 pb-2">
                Nitrogen Gas & Calibrator Head (4.27.11.4)
              </span>

              {/* Nitrogen Gas Pressure */}
              <div className="my-3 p-3 rounded-lg bg-slate-100 border border-slate-300">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500">Nitrogen Regulator:</span>
                  <span className="font-mono font-bold text-cyan-700">{yTool.nitrogenPressurePsi} PSI</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="80"
                  value={yTool.nitrogenPressurePsi}
                  onChange={(e) => onUpdateYTool({ nitrogenPressurePsi: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <span className="text-eyebrow text-slate-500 block mt-1">Normal target: 55 - 65 psi</span>
              </div>

              {/* Calibration Workflow */}
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">2-Point Reference Bar Test (4.27.11.8)</span>
                {calibStage === 0 && (
                  <p className="text-2xs text-slate-500">
                    Press below to begin guided calibration with 0.750" & 1.160" test bars.
                  </p>
                )}
                {calibStage === 1 && (
                  <p className="text-2xs text-amber-700">
                    Step 1: Clamped 0.750" Small End into Y-Tool head. Press Key 1 to calibrate low offset.
                  </p>
                )}
                {calibStage === 2 && (
                  <p className="text-2xs text-amber-700">
                    Step 2: Clamped 1.160" Large End into Y-Tool head. Press Key 1 to calibrate span.
                  </p>
                )}
                {calibStage === 3 && (
                  <p className="text-2xs text-emerald-700 font-bold">
                    ✓ Calibration Complete! Go/No-Go verified at 0.900" limit.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                id="btn-ytool-power"
                onClick={() => onUpdateYTool({ poweredOn: !yTool.poweredOn })}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  yTool.poweredOn ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {yTool.poweredOn ? 'Y-Tool ON' : 'Turn Y-Tool ON'}
              </button>

              <button
                id="btn-run-calibration"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (calibStage < 3) {
                    setCalibStage((prev) => prev + 1);
                    if (calibStage === 2) {
                      onUpdateYTool({ calibrated: true });
                      soundManager.playSuccessChime();
                    }
                  } else {
                    setCalibStage(0);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase transition-all"
              >
                {calibStage === 0
                  ? 'Start Calibration'
                  : calibStage === 3
                  ? 'Reset Calib'
                  : `Next Step (${calibStage}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OUTRIGGERS & TRUCK LEVELING (Figure 11 & 150) */}
      {activeAuxTab === 'outriggers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-100/70 border border-slate-300">
          {/* Outrigger 6-Spool Directional Levers */}
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4">
            <span className="text-xs font-bold uppercase text-amber-700 tracking-wider block border-b border-slate-300 pb-2">
              Outrigger Directional Valve Bank (3.6.1)
            </span>

            <div className="space-y-2">
              {/* Left In/Out */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <span className="text-xs font-bold text-slate-700">2. Left Outrigger In/Out</span>
                <button
                  id="btn-outrigger-left-ext"
                  onClick={() => {
                    soundManager.playHiss(0.3);
                    onUpdateOutriggers({ leftExtended: !outriggers.leftExtended });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    outriggers.leftExtended ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {outriggers.leftExtended ? 'EXTENDED' : 'RETRACTED'}
                </button>
              </div>

              {/* Right In/Out */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <span className="text-xs font-bold text-slate-700">{t('aux.rightOutrigger')}</span>
                <button
                  id="btn-outrigger-right-ext"
                  onClick={() => {
                    soundManager.playHiss(0.3);
                    onUpdateOutriggers({ rightExtended: !outriggers.rightExtended });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    outriggers.rightExtended ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {outriggers.rightExtended ? 'EXTENDED' : 'RETRACTED'}
                </button>
              </div>

              {/* Left Up/Down */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <span className="text-xs font-bold text-slate-700">{t('aux.leftJack')}</span>
                <button
                  id="btn-outrigger-left-down"
                  onClick={() => {
                    soundManager.playHiss(0.4);
                    onUpdateOutriggers({ leftLowered: !outriggers.leftLowered });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    outriggers.leftLowered ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {outriggers.leftLowered ? t('aux.loweredGround') : t('aux.raised')}
                </button>
              </div>

              {/* Right Up/Down */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <span className="text-xs font-bold text-slate-700">{t('aux.rightJack')}</span>
                <button
                  id="btn-outrigger-right-down"
                  onClick={() => {
                    soundManager.playHiss(0.4);
                    onUpdateOutriggers({ rightLowered: !outriggers.rightLowered });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    outriggers.rightLowered ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {outriggers.rightLowered ? t('aux.loweredGround') : t('aux.raised')}
                </button>
              </div>

              {/* 1. Chain Oiler */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <span className="text-xs font-bold text-slate-700">{t('aux.gripperChainOiler')}</span>
                <button
                  onClick={() => {
                    soundManager.playHiss(0.3);
                  }}
                  className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold uppercase active:scale-95"
                >
                  {t('aux.dispenseLubeOil')}
                </button>
              </div>
            </div>
          </div>

          {/* Ground Footing, Pads & Spirit Bubble Level */}
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
                Rig Leveling & Pad Safety (Section 5.6)
              </span>

              {/* Spirit Bubble */}
              <div className="my-4 flex items-center justify-center">
                <div className="relative w-28 h-28 rounded-full bg-slate-100 border-4 border-slate-300 flex items-center justify-center shadow-inner">
                  {/* Crosshairs */}
                  <div className="absolute w-full h-0.5 bg-slate-300" />
                  <div className="absolute h-full w-0.5 bg-slate-300" />
                  <div className="w-12 h-12 rounded-full border border-slate-400" />

                  {/* Level bubble */}
                  <div
                    style={{
                      transform: outriggers.truckLeveled ? 'translate(0px, 0px)' : 'translate(18px, -12px)',
                      transition: 'transform 0.3s ease',
                    }}
                    className={`w-6 h-6 rounded-full border-2 border-black ${
                      outriggers.truckLeveled ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  id="btn-toggle-wooden-pads"
                  onClick={() => {
                    soundManager.playMetalTap();
                    onUpdateOutriggers({
                      woodenPadsUnderLeft: !outriggers.woodenPadsUnderLeft,
                      woodenPadsUnderRight: !outriggers.woodenPadsUnderRight,
                    });
                  }}
                  className={`p-2 rounded border text-left font-bold ${
                    outriggers.woodenPadsUnderLeft && outriggers.woodenPadsUnderRight
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                      : 'bg-slate-100 border-slate-300 text-slate-500'
                  }`}
                >
                  {t('aux.woodenPads')}: {outriggers.woodenPadsUnderLeft ? t('aux.placed') : t('aux.missing')}
                </button>

                <button
                  id="btn-toggle-wheel-chocks"
                  onClick={() => {
                    soundManager.playMetalTap();
                    onUpdateOutriggers({ wheelChocksPlaced: !outriggers.wheelChocksPlaced });
                  }}
                  className={`p-2 rounded border text-left font-bold ${
                    outriggers.wheelChocksPlaced
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                      : 'bg-slate-100 border-slate-300 text-slate-500'
                  }`}
                >
                  {t('aux.wheelChocks')}: {outriggers.wheelChocksPlaced ? t('aux.secure') : t('aux.unset')}
                </button>
              </div>
            </div>

            <button
              id="btn-auto-level"
              onClick={() => {
                soundManager.playHiss(0.6);
                onUpdateOutriggers({
                  leftExtended: true,
                  rightExtended: true,
                  leftLowered: true,
                  rightLowered: true,
                  woodenPadsUnderLeft: true,
                  woodenPadsUnderRight: true,
                  wheelChocksPlaced: true,
                  truckLeveled: true,
                  rearWheelsOnGround: true,
                });
              }}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase shadow-md active:scale-95"
            >
              {t('aux.performFullRigLeveling')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: KNUCKLE PICKER CRANE (Figure 10, 12, 13) */}
      {activeAuxTab === 'picker' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-100/70 border border-slate-300">
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">
                Fassi F150A Knuckle Crane Controls
              </span>
              <span className="text-eyebrow text-slate-500 font-mono">4.5 Metric Tonne</span>
            </div>

            {/* Lockout Valve */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
              <div>
                <span className="text-xs font-bold block text-slate-700">{t('aux.craneLockoutValve')}</span>
                <span className="text-eyebrow text-slate-500">{t('aux.quarterTurnBallValve')}</span>
              </div>
              <button
                id="btn-crane-lockout"
                onClick={() => {
                  soundManager.playMetalTap();
                  onUpdatePicker({ craneLockoutValveOpen: !picker.craneLockoutValveOpen });
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                  picker.craneLockoutValveOpen
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-red-700 text-white'
                }`}
              >
                {picker.craneLockoutValveOpen ? t('aux.valveOpenLive') : t('aux.lockedSafe')}
              </button>
            </div>

            {/* Reach & Telescope Sliders */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('aux.telescopeReach')}</span>
                  <span className="text-cyan-700 font-mono">{picker.telescopeLengthFt.toFixed(1)} FT</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="40"
                  step="0.5"
                  value={picker.telescopeLengthFt}
                  onChange={(e) => onUpdatePicker({ telescopeLengthFt: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('aux.knuckleBoomArticulation')}</span>
                  <span className="text-cyan-700 font-mono">{picker.angleDegrees}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={picker.angleDegrees}
                  onChange={(e) => onUpdatePicker({ angleDegrees: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('aux.baseRotation')}</span>
                  <span className="text-cyan-700 font-mono">{picker.rotationDegrees}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={picker.rotationDegrees}
                  onChange={(e) => onUpdatePicker({ rotationDegrees: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Fassi F150A Load Capacity Chart Envelope (Figure 13) */}
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
                Fassi F150A Load Envelope (Figure 13)
              </span>

              <div className="my-3 space-y-2 font-mono text-xs">
                <div className="p-2.5 rounded bg-slate-100 border border-slate-300 flex justify-between">
                  <span className="text-slate-500">{t('aux.currentLiftLoad')}</span>
                  <span className="font-bold text-amber-700">{picker.currentLiftWeightLbs} LBS</span>
                </div>
                <div className="p-2.5 rounded bg-slate-100 border border-slate-300 flex justify-between">
                  <span className="text-slate-500">{t('aux.capacityAtReach', { reach: picker.telescopeLengthFt.toFixed(0) })}</span>
                  <span className="font-bold text-emerald-700">
                    {picker.telescopeLengthFt <= 14 ? `4993 LBS (${t('aux.safe')})` : `2381 LBS (${t('aux.overloadExclaim')})`}
                  </span>
                </div>
              </div>

              {picker.telescopeLengthFt > 14.5 && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-500 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
                  <span>
                    WARNING: Injector weighs ~4200 lbs! Lifting beyond 14'1" exceeds crane capacity chart!
                  </span>
                </div>
              )}
            </div>

            <div className="text-eyebrow text-slate-500 italic">
              {t('aux.craneTagLines')}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: THERMAL MANAGEMENT (Figure 20-27) */}
      {activeAuxTab === 'thermal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-100/70 border border-slate-300">
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4">
            <span className="text-xs font-bold uppercase text-amber-700 tracking-wider block border-b border-slate-300 pb-2">
              ProHeat / Engine Coolant Heater (3.6.8)
            </span>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold block text-slate-700">{t('aux.dieselPreheater')}</span>
                  <span className="text-eyebrow text-slate-500">{t('aux.warmsInWinter')}</span>
                </div>
                <button
                  id="btn-toggle-preheater"
                  onClick={() => {
                    soundManager.playHiss(0.3);
                    onUpdateHydraulics({ enginePreheaterOn: !hydraulics.enginePreheaterOn });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    hydraulics.enginePreheaterOn ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {hydraulics.enginePreheaterOn ? t('aux.heaterOn') : t('aux.heaterOff')}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold block text-slate-700">Hydraulic Reservoir Heating Valve</span>
                  <span className="text-eyebrow text-slate-500">Valve C - circulate hot coolant to oil tank</span>
                </div>
                <button
                  id="btn-toggle-tank-heating"
                  onClick={() => {
                    soundManager.playMetalTap();
                    onUpdateHydraulics({ hydraulicTankHeaterOpen: !hydraulics.hydraulicTankHeaterOpen });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    hydraulics.hydraulicTankHeaterOpen ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {hydraulics.hydraulicTankHeaterOpen ? 'VALVE OPEN' : 'CLOSED'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
                Hydraulic Cooler Bypass Switch (3.6.7)
              </span>

              <div className="my-3 p-3 rounded-lg bg-slate-100 border border-slate-300 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold block text-slate-700">Cooler Fan Bypass Mode</span>
                  <span className="text-eyebrow text-slate-500">Auto (Thermostat) vs Manual (Constant)</span>
                </div>
                <button
                  id="btn-cooler-bypass"
                  onClick={() => {
                    soundManager.playMetalTap();
                    onUpdateHydraulics({
                      coolerBypassMode: hydraulics.coolerBypassMode === 'AUTO' ? 'MANUAL' : 'AUTO',
                    });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    hydraulics.coolerBypassMode === 'MANUAL' ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {hydraulics.coolerBypassMode}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 flex justify-between items-center text-xs">
                <span className="text-slate-500">Hydraulic Fluid Temp:</span>
                <span
                  className={`font-mono font-bold ${
                    hydraulics.hydraulicFluidTempC > 70
                      ? 'text-red-700 font-semibold animate-pulse'
                      : hydraulics.hydraulicFluidTempC < 0
                      ? 'text-cyan-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {Math.round(hydraulics.hydraulicFluidTempC)}°C ({Math.round((hydraulics.hydraulicFluidTempC * 9) / 5 + 32)}°F)
                </span>
              </div>
            </div>

            <span className="text-eyebrow text-slate-500 italic">
              {t('aux.tempWarning')}
            </span>
          </div>
        </div>
      )}

      {/* TAB 6: CAB / PTO DRIVE (Figure 28-30 & 149) */}
      {activeAuxTab === 'cab' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-100/70 border border-slate-300">
          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4">
            <span className="text-xs font-bold uppercase text-amber-700 tracking-wider block border-b border-slate-300 pb-2">
              Transfer Case & PTO Engagement (3.6.10 / 5.4)
            </span>

            <div className="space-y-3">
              {/* Engine On/Off */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <div>
                  <span className="text-xs font-bold block text-slate-700">{t('aux.rigDieselEngine')}</span>
                  <span className="text-eyebrow text-slate-500">{t('aux.carrierPrimeMover')}</span>
                </div>
                <button
                  id="btn-engine-toggle"
                  onClick={() => {
                    soundManager.playMetalTap();
                    const nextRunning = !hydraulics.engineRunning;
                    onUpdateHydraulics({
                      engineRunning: nextRunning,
                      engineRpm: nextRunning ? 1100 : 0,
                      chargePressure: nextRunning ? 350 : 0,
                    });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    hydraulics.engineRunning ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {hydraulics.engineRunning ? t('aux.engineRunning') : t('aux.engineOff')}
                </button>
              </div>

              {/* PTO Hydraulic Drive Switch */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-300">
                <div>
                  <span className="text-xs font-bold block text-slate-700">{t('aux.hydraulicSelector')}</span>
                  <span className="text-eyebrow text-slate-500">{t('aux.pneumaticTransferCase')}</span>
                </div>
                <button
                  id="btn-pto-switch"
                  onClick={() => {
                    soundManager.playHiss(0.4);
                    onUpdateHydraulics({ ptoEngaged: !hydraulics.ptoEngaged });
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${
                    hydraulics.ptoEngaged
                      ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {hydraulics.ptoEngaged ? t('aux.hydraulicsPTOOn') : t('aux.roadTravel')}
                </button>
              </div>

              {/* Engine Working RPM (Cruise Control) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Engine Speed (Cruise Control)</span>
                  <span className="text-emerald-700 font-mono">{hydraulics.engineRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="800"
                  max="1800"
                  step="50"
                  value={hydraulics.engineRpm}
                  onChange={(e) => onUpdateHydraulics({ engineRpm: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-eyebrow text-slate-500 block">
                  Label: RUN HYDRAULICS: 8th GEAR HIGH RANGE LOW SPLIT @ 1300 RPM
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider block border-b border-slate-300 pb-2">
                Cab Dash Emergency Cutoff & Manual Override (Figure 126, 30)
              </span>

              <div className="my-3 space-y-2">
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Roda Intake Valve:</span>
                  <span className={`font-bold ${hydraulics.rodaValveClosed ? 'text-red-700' : 'text-emerald-700'}`}>
                    {hydraulics.rodaValveClosed ? 'CHOKED / CLOSED' : 'OPEN / OPERATIONAL'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-500">
                  Manual bypass dial behind driver's seat: Allows transfer case pneumatic cylinder to be engaged manually by turning 180°.
                </div>
              </div>
            </div>

            {hydraulics.rodaValveClosed && (
              <button
                id="btn-cab-reset-roda"
                onClick={() => {
                  soundManager.playMetalTap();
                  onUpdateHydraulics({ rodaValveClosed: false, emergencyStopTripped: false });
                }}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase"
              >
                Reset Roda Valve Under Hood
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
