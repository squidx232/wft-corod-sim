import React, { useState, useEffect } from 'react';
import { SimulatorState } from '../types';
import { getEmergencyScenario } from '../data/emergencyScenarios';
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
        <div className="mb-2 rounded-lg bg-red-600 text-white text-[12px] font-bold px-3 py-2 shadow-2xl border border-red-300 animate-pulse flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      )}

      <div
        className={`rounded-2xl border-2 ${severityColor} bg-gradient-to-b to-slate-950 shadow-2xl overflow-hidden`}
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
              <div className="text-[13px] font-black text-white uppercase tracking-wide truncate">
                {scenario.title}
              </div>
              <div className="text-[9px] text-slate-400 font-mono truncate">
                {scenario.manualSection}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 rounded hover:bg-white/10 text-slate-300"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded hover:bg-white/10 text-slate-300"
              title="Abort drill"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="p-3">
            {/* Progress */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>
                STEP {stepIndex + 1} / {total}
              </span>
              {timeLeft !== null && (
                <span
                  className={`flex items-center gap-1 font-bold ${
                    timeCritical ? 'text-red-400 animate-pulse' : 'text-amber-400'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {timeLeft.toFixed(0)}s
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                style={{ width: `${(stepIndex / total) * 100}%` }}
              />
            </div>

            {/* Current step */}
            {step && (
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 mb-3">
                <div className="text-[13px] font-bold text-white mb-1">{step.title}</div>
                <p className="text-[12px] text-slate-300 leading-snug">{step.instruction}</p>
                <div className="text-[9px] text-amber-500/70 font-mono mt-1.5">{step.manualRef}</div>

                {/* Toggle-able "Show me" control hint */}
                {step.controlId && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        showHint
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {showHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showHint ? 'Hide hint' : 'Show me'}
                    </button>
                    {showHint && step.controlName && (
                      <span className="text-[11px] text-cyan-300 font-mono">
                        → {step.controlName}
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
                    className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${
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
