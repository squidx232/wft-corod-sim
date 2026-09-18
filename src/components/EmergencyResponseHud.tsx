import React, { useState, useEffect } from 'react';
import { SimulatorState } from '../types';
import { getEmergencyScenario } from '../data/emergencyScenarios';
import { useT } from '../i18n';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface EmergencyResponseHudProps {
  state: SimulatorState;
  /** Consequence/timeout message to flash, or null. */
  toast: string | null;
  /** Abort the drill entirely. */
  onCancel: () => void;
}

/**
 * Floating, non-blocking Emergency Response HUD.
 *
 * Sits in the corner so the console stays fully usable underneath. Shows the
 * active emergency, the current step the operator must perform ON THE CONSOLE,
 * a live checklist, a countdown for time-critical steps, and a toggle-able
 * "Show me" hint that highlights the target control.
 */
export const EmergencyResponseHud: React.FC<EmergencyResponseHudProps> = ({
  state,
  toast,
  onCancel,
}) => {
  const { t } = useT();
  const [showHint, setShowHint] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const scenario = state.emergencyScenarioId
    ? getEmergencyScenario(state.emergencyScenarioId)
    : undefined;
  const stepIndex = state.emergencyStepIndex;

  // Per-step elapsed timer (for the countdown display).
  useEffect(() => {
    setElapsed(0);
    setShowHint(false);
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => clearInterval(t);
  }, [state.emergencyScenarioId, stepIndex]);

  // Toggle the control highlight on the console: find the element(s) carrying the
  // matching data-control-id and add the pulsing highlight class directly.
  useEffect(() => {
    const step = scenario?.steps[stepIndex];
    const targetId = showHint ? step?.controlId : undefined;
    const clearAll = () => {
      document
        .querySelectorAll('.emg-highlight-target')
        .forEach((el) => el.classList.remove('emg-highlight-target'));
    };
    clearAll();
    if (targetId) {
      // Re-scan periodically in case the control mounts after the hint is shown
      // (e.g. switching console tabs). Cheap: a couple of retries.
      let tries = 0;
      const apply = () => {
        document
          .querySelectorAll(`[data-control-id="${targetId}"]`)
          .forEach((el) => el.classList.add('emg-highlight-target'));
      };
      apply();
      const retry = setInterval(() => {
        tries += 1;
        apply();
        if (tries >= 6) clearInterval(retry);
      }, 400);
      return () => {
        clearInterval(retry);
        clearAll();
      };
    }
    return clearAll;
  }, [showHint, scenario, stepIndex]);

  if (!scenario) return null;

  const step = scenario.steps[stepIndex];
  const total = scenario.steps.length;
  const timeLeft = step?.timeLimitSec ? Math.max(0, step.timeLimitSec - elapsed) : null;
  const timeCritical = timeLeft !== null && timeLeft <= 5;

  const severityColor =
    scenario.severity === 'critical'
      ? 'border-red-500 from-red-950/95'
      : scenario.severity === 'high'
      ? 'border-orange-500 from-orange-950/95'
      : 'border-yellow-500 from-yellow-900/95';

  return (
    <div className="fixed top-20 right-4 z-[90] w-[340px] max-w-[calc(100vw-2rem)] select-none">
      {/* Consequence toast */}
      {toast && (
        <div className="mb-2 rounded-lg bg-red-600 text-white text-[12px] font-bold px-3 py-2 shadow-xl border border-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      )}

      <div
        className={`rounded-xl border-2 ${severityColor} bg-slate-100 shadow-xl overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/40 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 ${
                scenario.severity === 'critical' ? 'text-red-400 animate-pulse' : 'text-orange-400'
              }`}
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">
                {t('emergencyHud.title', { scenario: scenario.title })}
              </div>
              <div className="text-eyebrow text-slate-500 font-mono truncate">
                {t('emergencyHud.manual', { section: scenario.manualSection })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 rounded hover:bg-white/10 text-slate-600"
              title={collapsed ? t('emergencyHud.btn.expand') : t('emergencyHud.btn.collapse')}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded hover:bg-white/10 text-slate-600"
              title={t('emergencyHud.btn.abort')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="p-3">
            {/* Progress */}
            <div className="flex items-center justify-between text-eyebrow font-mono text-slate-500 mb-1">
              <span>
                {t('emergencyHud.step', { current: stepIndex + 1, total })}
              </span>
              {timeLeft !== null && (
                <span
                  className={`flex items-center gap-1 font-bold ${
                    timeCritical ? 'text-red-400 animate-pulse' : 'text-amber-400'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {t('emergencyHud.timeout', { seconds: timeLeft.toFixed(0) })}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                style={{ width: `${(stepIndex / total) * 100}%` }}
              />
            </div>

            {/* Current step */}
            {step && (
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 mb-3">
                <div className="text-[13px] font-semibold text-white mb-1">{t('emergencyHud.step.title', { title: step.title })}</div>
                <p className="text-2xs text-slate-600 leading-snug">{t('emergencyHud.step.instruction', { instruction: step.instruction })}</p>
                <div className="text-eyebrow text-amber-500/70 font-mono mt-1.5">{t('emergencyHud.step.reference', { reference: step.manualRef })}</div>

                {/* Toggle-able "Show me" control hint */}
                {step.controlId && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all ${
                        showHint
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-slate-200 border-slate-400 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {showHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showHint ? t('emergencyHud.btn.hide') : t('emergencyHud.btn.show')}
                    </button>
                    {showHint && step.controlName && (
                      <span className="text-2xs text-cyan-300 font-mono">
                        {t('emergencyHud.hint.control', { control: step.controlName })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Checklist */}
            <div className="flex flex-col gap-1">
              {scenario.steps.map((st, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div
                    key={st.id}
                    className={`flex items-center gap-2 text-2xs px-2 py-1 rounded ${
                      active ? 'bg-white/5' : ''
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : active ? (
                      <Circle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    )}
                    <span
                      className={
                        done
                          ? 'text-emerald-400 line-through'
                          : active
                          ? 'text-white font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {st.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
