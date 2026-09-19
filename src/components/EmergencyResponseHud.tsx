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
  /**
   * Fired the moment the operator turns ON the "Show me" hint for a step
   * (once per activation). Used by the timed assessment to count hint usage
   * and apply a small scoring penalty. Optional / backwards-compatible.
   */
  onHintUsed?: () => void;
  /**
   * Realistic difficulty: hide the ordered step list, the current-step detail
   * and the "Show me" hint. The operator only sees the emergency + severity and
   * must perform the correct response from memory. Progress is still shown.
   */
  hideSteps?: boolean;
  /**
   * Assessment react-time deadline (epoch ms). When set, a prominent countdown
   * is shown; if it hits 0 the run engine fails the event. null = practice mode.
   */
  reactDeadline?: number | null;
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
  onHintUsed,
  hideSteps = false,
  reactDeadline = null,
}) => {
  const { t, tData } = useT();
  const [showHint, setShowHint] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Tick a clock for the react-time countdown (only when a deadline is set).
  useEffect(() => {
    if (reactDeadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [reactDeadline]);
  const reactLeft = reactDeadline != null ? Math.max(0, (reactDeadline - now) / 1000) : null;
  const reactCritical = reactLeft != null && reactLeft <= 10;

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
      ? 'border-red-400'
      : scenario.severity === 'high'
      ? 'border-orange-400'
      : 'border-amber-400';
  const headerBg =
    scenario.severity === 'critical'
      ? 'bg-red-50'
      : scenario.severity === 'high'
      ? 'bg-orange-50'
      : 'bg-amber-50';

  return (
    <div className="fixed top-20 right-4 z-[90] w-[420px] max-w-[calc(100vw-2rem)] select-none">
      {/* Consequence toast */}
      {toast && (
        <div className="mb-2 rounded-lg bg-red-600 text-white text-[13px] font-bold px-3 py-2.5 shadow-xl border border-red-300 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      )}

      <div
        className={`rounded-xl border-4 ${severityColor} bg-white shadow-2xl overflow-hidden ${
          scenario.severity === 'critical' ? 'ring-2 ring-red-400/60 emg-hud-pulse' : ''
        }`}
      >
        {/* React-time countdown banner (assessment only) */}
        {reactLeft != null && (
          <div
            className={`flex items-center justify-between px-3 py-2 text-white ${
              reactCritical ? 'bg-red-600 animate-pulse' : 'bg-slate-800'
            }`}
          >
            <span className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {t('emergencyHud.reactLeft')}
            </span>
            <span className="text-2xl font-black font-mono tabular-nums">
              {Math.ceil(reactLeft)}s
            </span>
          </div>
        )}

        {/* Header */}
        <div className={`flex items-center justify-between gap-2 px-3 py-2.5 ${headerBg} border-b border-slate-200`}>
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle
              className={`w-6 h-6 flex-shrink-0 ${
                scenario.severity === 'critical' ? 'text-red-700 animate-pulse' : 'text-orange-700'
              }`}
            />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-slate-800 truncate">
                {t('emergencyHud.title', { scenario: tData(scenario.title) })}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {t('emergencyHud.manual', { section: scenario.manualSection })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 rounded hover:bg-black/5 text-slate-600"
              title={collapsed ? t('emergencyHud.btn.expand') : t('emergencyHud.btn.collapse')}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded hover:bg-black/5 text-slate-600"
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
                {hideSteps
                  ? t('emergencyHud.realistic.progress')
                  : t('emergencyHud.step', { current: stepIndex + 1, total })}
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
            {!hideSteps && (
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                  style={{ width: `${(stepIndex / total) * 100}%` }}
                />
              </div>
            )}

            {/* Realistic mode: no steps shown — diagnose & respond from memory. */}
            {hideSteps && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 mb-1">
                <div className="text-[13px] font-semibold text-slate-800 mb-1">
                  {t('emergencyHud.realistic.title')}
                </div>
                <p className="text-2xs text-slate-600 leading-snug">
                  {t('emergencyHud.realistic.instruction')}
                </p>
              </div>
            )}

            {/* Current step (guided mode only) */}
            {!hideSteps && step && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 mb-3">
                <div className="text-[13px] font-semibold text-slate-800 mb-1">{t('emergencyHud.step.title', { title: tData(step.title) })}</div>
                <p className="text-2xs text-slate-600 leading-snug">{t('emergencyHud.step.instruction', { instruction: tData(step.instruction) })}</p>
                <div className="text-eyebrow text-amber-700 font-mono mt-1.5">{t('emergencyHud.step.reference', { reference: step.manualRef })}</div>

                {/* Toggle-able "Show me" control hint */}
                {step.controlId && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShowHint((h) => {
                          // Count a hint only when turning it ON.
                          if (!h) onHintUsed?.();
                          return !h;
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all ${
                        showHint
                          ? 'bg-blue-700 border-blue-800 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {showHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showHint ? t('emergencyHud.btn.hide') : t('emergencyHud.btn.show')}
                    </button>
                    {showHint && step.controlName && (
                      <span className="text-2xs text-blue-700 font-mono font-semibold">
                        {t('emergencyHud.hint.control', { control: tData(step.controlName) })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Checklist (guided mode only) */}
            {!hideSteps && (
              <div className="flex flex-col gap-1">
                {scenario.steps.map((st, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div
                      key={st.id}
                      className={`flex items-center gap-2 text-2xs px-2 py-1 rounded ${
                        active ? 'bg-slate-100' : ''
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />
                      ) : active ? (
                        <Circle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 animate-pulse" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      <span
                        className={
                          done
                            ? 'text-green-700 line-through'
                            : active
                            ? 'text-slate-900 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {tData(st.title)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
