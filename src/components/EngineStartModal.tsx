import React, { useState, useEffect, useRef } from 'react';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import { useT } from '../i18n';
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
  const { t } = useT();
  
  const steps: StartStep[] = [
    {
      id: 'checks',
      icon: <Droplet className="w-6 h-6" />,
      title: t('engineStart.checks.title'),
      instruction: t('engineStart.checks.instruction'),
      manualRef: t('engineStart.checks.ref'),
      image: '/manual/start-fluidcheck.jpg',
      actionLabel: t('engineStart.checks.action'),
      durationSec: 1.2,
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'preheater',
      icon: <Flame className="w-6 h-6" />,
      title: t('engineStart.preheater.title'),
      instruction: t('engineStart.preheater.instruction'),
      manualRef: t('engineStart.preheater.ref'),
      image: '/manual/start-preheater.jpg',
      actionLabel: t('engineStart.preheater.action'),
      durationSec: 1.2,
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'crank',
      icon: <Power className="w-6 h-6" />,
      title: t('engineStart.crank.title'),
      instruction: t('engineStart.crank.instruction'),
      manualRef: t('engineStart.crank.ref'),
      image: '/manual/start-ignition.png',
      actionLabel: t('engineStart.crank.action'),
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
      title: t('engineStart.warmup.title'),
      instruction: t('engineStart.warmup.instruction'),
      manualRef: t('engineStart.warmup.ref'),
      image: '/manual/start-warmtemp.jpg',
      actionLabel: t('engineStart.warmup.action'),
      durationSec: 3.0,
      apply: { engineRpm: 1100, hydraulicFluidTempC: 45 },
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'pto',
      icon: <Cog className="w-6 h-6" />,
      title: t('engineStart.pto.title'),
      instruction: t('engineStart.pto.instruction'),
      manualRef: t('engineStart.pto.ref'),
      image: '/manual/start-pto.jpg',
      actionLabel: t('engineStart.pto.action'),
      durationSec: 2.0,
      apply: { ptoEngaged: true },
      sound: () => soundManager.playMetalTap(),
    },
    {
      id: 'circulate',
      icon: <Waves className="w-6 h-6" />,
      title: t('engineStart.circulate.title'),
      instruction: t('engineStart.circulate.instruction'),
      manualRef: t('engineStart.circulate.ref'),
      image: '/manual/start-console.jpg',
      actionLabel: t('engineStart.circulate.action'),
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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-300 bg-gradient-to-r from-amber-950/60 to-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-700">
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-100 uppercase tracking-wide font-mono">
                {t('engineStart.title')}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {t('engineStart.subtitle')}
              </p>
            </div>
          </div>
          {/* Close button only appears once the full sequence is complete —
              the operator cannot abort a partial engine start. */}
          {allDone ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-300 text-slate-500 hover:text-slate-900 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <span
              className="p-1.5 rounded-lg text-slate-600 cursor-not-allowed"
              title={t('engineStart.closeFull')}
            >
              <X className="w-5 h-5" />
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
            <span>{t('engineStart.progress')}</span>
            <span>
              {t('engineStart.steps', { completed: completedCount, total: steps.length })}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
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
                    ? 'border-emerald-400/50 bg-emerald-50'
                    : isActive
                    ? 'border-amber-500/70 bg-amber-50 shadow-lg'
                    : 'border-slate-300/50 bg-white/40 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Step icon / status */}
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg border ${
                      status === 'done'
                        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-700'
                        : status === 'running'
                        ? 'bg-amber-600/20 border-amber-500/50 text-amber-700'
                        : 'bg-slate-200 border-slate-400 text-slate-500'
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
                        {t('engineStart.step', { num: idx + 1 })}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1 leading-snug">
                      {step.instruction}
                    </p>
                    <p className="text-eyebrow text-amber-500/70 font-mono mt-1">{step.manualRef}</p>

                    {/* Reference photo from the manual (shown for the active/running/done step) */}
                    {step.image && (status !== 'pending' || isActive) && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-slate-300 bg-black/40 max-w-[280px]">
                        <img
                          src={step.image}
                          alt={`Manual reference: ${step.title}`}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                        <div className="text-eyebrow text-slate-500 font-mono px-2 py-1 bg-slate-100/60 border-t border-slate-300">
                          {t('engineStart.manualRef', { ref: step.manualRef })}
                        </div>
                      </div>
                    )}

                    {/* Running progress bar */}
                    {status === 'running' && (
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
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
                      <span className="mt-2 inline-flex items-center gap-1 text-eyebrow text-emerald-700 font-mono">
                        <CheckCircle className="w-3.5 h-3.5" /> {t('engineStart.complete')}
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
              {t('engineStart.readyBtn')}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-200/60 border border-slate-300 text-slate-500 text-[12px] font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              {t('engineStart.inProgress')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
