import React, { useState, useEffect, useRef } from 'react';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import {
  Power,
  Droplet,
  Flame,
  Gauge,
  Thermometer,
  Cog,
  Waves,
  CheckCircle,
  Loader2,
  ChevronRight,
  X,
} from 'lucide-react';

interface EngineStartModalProps {
  state: SimulatorState;
  onClose: () => void;
  onComplete: () => void;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
}

type StepStatus = 'pending' | 'running' | 'done';

interface StartStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  instruction: string;
  manualRef: string;
  actionLabel: string;
  /** Reference photo from the operation manual. */
  image?: string;
  /** Seconds the step "runs" for after the operator triggers it (visual dwell). */
  durationSec: number;
  /** Hydraulic state applied when the step completes. */
  apply?: Partial<SimulatorState['hydraulics']>;
  /** Sound to play when the step is triggered. */
  sound?: () => void;
}

/**
 * EngineStartModal — guided daily engine start-up sequence.
 * Steps sourced from the CoRod Mobile Gripper Operation Manual Section 5.2
 * ("Rig Engine Warm Up and Walk Around", pages 151-152).
 */
export const EngineStartModal: React.FC<EngineStartModalProps> = ({
  onClose,
  onComplete,
  onUpdateHydraulics,
}) => {
  const steps: StartStep[] = [
    {
      id: 'checks',
      icon: <Droplet className="w-6 h-6" />,
      title: 'Pre-Start Fluid Checks',
      instruction:
        'Before starting, check the engine oil and coolant levels. Confirm the hydraulic reservoir level is adequate.',
      manualRef: 'Section 5.2.1 (p. 151)',
      image: '/manual/start-fluidcheck.jpg',
      actionLabel: 'Confirm Levels OK',
      durationSec: 1.2,
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'preheater',
      icon: <Flame className="w-6 h-6" />,
      title: 'Verify Engine Pre-Heater',
      instruction:
        'Confirm the Webasto / ProHeat diesel pre-heater is operational. Required below 0 °C to prevent cold-start damage; run weekly in summer to burn off soot.',
      manualRef: 'Section 5.2.1 / Fig. 124 Control Pad (p. 151)',
      image: '/manual/start-preheater.jpg',
      actionLabel: 'Verify Pre-Heater',
      durationSec: 1.2,
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'crank',
      icon: <Power className="w-6 h-6" />,
      title: 'Start the Rig Engine',
      instruction:
        'Turn the ignition and crank the diesel engine. Bring it to a low idle of 1000–1100 RPM. DO NOT elevate RPM during initial warm-up — serious engine damage can result.',
      manualRef: 'Section 5.2.1 / Cab Ignition, Clutch & Gear (p. 151)',
      image: '/manual/start-ignition.png',
      actionLabel: 'Crank & Idle @ 1050 RPM',
      durationSec: 2.5,
      apply: { engineRunning: true, engineRpm: 1050 },
      sound: () => {
        // Play the layered car-start (one-shot crank + engine idle loop). If the
        // build somehow lacks the method, fall back to a metal tap.
        if (typeof soundManager.playEngineStart === 'function') {
          soundManager.playEngineStart();
        } else {
          soundManager.playMetalTap();
        }
      },
    },
    {
      id: 'warmup',
      icon: <Thermometer className="w-6 h-6" />,
      title: 'Warm Engine to Operating Temp',
      instruction:
        'Allow the engine to warm until the cab temperature gauge reaches the normal operating range (≈15 min in summer; longer below freezing).',
      manualRef: 'Section 5.2.1 / Dash Trans-Temp Gauge (p. 151)',
      image: '/manual/start-warmtemp.jpg',
      actionLabel: 'Warm to Operating Temp',
      durationSec: 3.0,
      apply: { engineRpm: 1100, hydraulicFluidTempC: 45 },
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'pto',
      icon: <Cog className="w-6 h-6" />,
      title: 'Engage the PTO (Pump Drive)',
      instruction:
        'Engage the Power Take-Off to drive the hydraulic pumps. In cold weather, start in a lower gear and increase as fluid warms.',
      manualRef: 'Section 5.2.2 / Cab ROAD-HYDRAULIC PTO Selector (p. 152)',
      image: '/manual/start-pto.jpg',
      actionLabel: 'Engage PTO',
      durationSec: 2.0,
      apply: { ptoEngaged: true },
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'circulate',
      icon: <Waves className="w-6 h-6" />,
      title: 'Circulate & Build System Pressure',
      instruction:
        'Turn the gripper motors with minimal up-pressure to circulate fluid. Open the safety bleed valve to warm the auxiliary pump, then CLOSE it before work so the pump can build pressure.',
      manualRef: 'Section 5.2.2 / Fig. 125 Control Console (p. 152, 154)',
      image: '/manual/start-console.jpg',
      actionLabel: 'Circulate & Close Bleed',
      durationSec: 2.5,
      apply: {
        chargePressure: 360,
        systemPressure: 2450,
        safetyBleedValveOpen: false,
      },
      sound: () => soundManager.playHiss(0.6),
    },
  ];

  const [current, setCurrent] = useState(0);
  const [statuses, setStatuses] = useState<StepStatus[]>(steps.map(() => 'pending'));
  const [progress, setProgress] = useState(0); // 0..1 for the running step
  const [allDone, setAllDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runStep = (idx: number) => {
    if (statuses[idx] !== 'pending') return;
    const step = steps[idx];
    step.sound?.();

    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = 'running';
      return next;
    });
    setProgress(0);

    const start = performance.now();
    const durMs = step.durationSec * 1000;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durMs);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Apply state changes for this step
        if (step.apply) onUpdateHydraulics(step.apply);
        setStatuses((prev) => {
          const next = [...prev];
          next[idx] = 'done';
          return next;
        });
        soundManager.playSuccessChime();
        if (idx + 1 < steps.length) {
          setCurrent(idx + 1);
        } else {
          setAllDone(true);
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleFinish = () => {
    soundManager.playSuccessChime();
    onComplete();
    onClose();
  };

  const completedCount = statuses.filter((s) => s === 'done').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-600/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700 bg-gradient-to-r from-amber-950/60 to-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-400">
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-100 uppercase tracking-wide font-mono">
                Engine Start-Up Sequence
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Daily Procedure — Manual Section 5.2 (pp. 151-152)
              </p>
            </div>
          </div>
          {/* Close button only appears once the full sequence is complete —
              the operator cannot abort a partial engine start. */}
          {allDone ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <span
              className="p-1.5 rounded-lg text-slate-600 cursor-not-allowed"
              title="Complete all start-up steps before closing"
            >
              <X className="w-5 h-5" />
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Progress</span>
            <span>
              {completedCount} / {steps.length} steps
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="p-5 flex flex-col gap-3">
          {steps.map((step, idx) => {
            const status = statuses[idx];
            const isActive = idx === current && !allDone;
            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 transition-all ${
                  status === 'done'
                    ? 'border-emerald-600/50 bg-emerald-950/30'
                    : isActive
                    ? 'border-amber-500/70 bg-amber-950/20 shadow-lg'
                    : 'border-slate-700/50 bg-slate-900/40 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Step icon / status */}
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg border ${
                      status === 'done'
                        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                        : status === 'running'
                        ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-800 border-slate-600 text-slate-500'
                    }`}
                  >
                    {status === 'done' ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : status === 'running' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      step.icon
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-eyebrow font-mono text-slate-500">
                        STEP {idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100">{step.title}</h3>
                    </div>
                    <p className="text-2xs text-slate-400 mt-1 leading-snug">
                      {step.instruction}
                    </p>
                    <p className="text-eyebrow text-amber-500/70 font-mono mt-1">{step.manualRef}</p>

                    {/* Reference photo from the manual (shown for the active/running/done step) */}
                    {step.image && (status !== 'pending' || isActive) && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-slate-700 bg-black/40 max-w-[280px]">
                        <img
                          src={step.image}
                          alt={`Manual reference: ${step.title}`}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                        <div className="text-eyebrow text-slate-500 font-mono px-2 py-1 bg-slate-950/60 border-t border-slate-800">
                          Manual reference â€" {step.manualRef}
                        </div>
                      </div>
                    )}

                    {/* Running progress bar */}
                    {status === 'running' && (
                      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    )}

                    {/* Action button (only for the active pending step) */}
                    {isActive && status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => runStep(idx)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-2xs transition-colors shadow-lg"
                      >
                        {step.actionLabel}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                    {status === 'done' && (
                      <span className="mt-2 inline-flex items-center gap-1 text-eyebrow text-emerald-400 font-mono">
                        <CheckCircle className="w-3.5 h-3.5" /> COMPLETE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          {allDone ? (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Gauge className="w-5 h-5" />
              Engine Ready — Begin Operation
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 text-[12px] font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              Complete each step in sequence to bring the engine online…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
