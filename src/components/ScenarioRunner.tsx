import React, { useEffect } from 'react';
import { SimulatorState, TrainingScenario, ScenarioStep } from '../types';
import { TRAINING_SCENARIOS } from '../data/manualReference';
import { soundManager } from '../utils/audio';
import { useT } from '../i18n';
import {
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Award,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface ScenarioRunnerProps {
  state: SimulatorState;
  onSelectScenario: (scenario: TrainingScenario) => void;
  onAdvanceStep: () => void;
  onResetScenario: () => void;
  onCompleteScenario: (scenario: TrainingScenario) => void;
}

export const ScenarioRunner: React.FC<ScenarioRunnerProps> = ({
  state,
  onSelectScenario,
  onAdvanceStep,
  onResetScenario,
  onCompleteScenario,
}) => {
  const { t, tData } = useT();
  const activeScenario = TRAINING_SCENARIOS.find((s) => s.id === state.activeScenarioId) || null;
  const currentStep = activeScenario ? activeScenario.steps[state.currentStepIndex] : null;

  // Auto-validate step continuously against simulation state
  // BUG FIX: Track which steps have been auto-advanced in THIS render cycle
  // to avoid mutating the shared TRAINING_SCENARIOS constant objects.
  // Previously `currentStep.isCompleted = true` mutated the module-level
  // constant, meaning restarting a scenario would find steps already "completed".
  const advancedRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeScenario || !currentStep || state.scenarioCompleted) return;

    const stepKey = `${activeScenario.id}:${state.currentStepIndex}`;
    const isStepSatisfied = currentStep.validationFn(state);
    if (isStepSatisfied && !advancedRef.current.has(stepKey)) {
      advancedRef.current.add(stepKey);
      soundManager.playSuccessChime();

      if (state.currentStepIndex + 1 < activeScenario.steps.length) {
        onAdvanceStep();
      } else {
        // Completed all steps!
        onCompleteScenario(activeScenario);
      }
    }
  }, [state, activeScenario, currentStep, onAdvanceStep, onCompleteScenario]);

  // Clear the advanced-steps tracker when scenario changes or resets
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isReset = state.currentStepIndex === 0 && state.scenarioTimeElapsedSeconds < 0.5;
  useEffect(() => {
    advancedRef.current.clear();
  }, [state.activeScenarioId, isReset]);

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-white border border-slate-300 p-6 shadow-md text-slate-800 max-w-7xl mx-auto w-full">
      {/* Top Scenario Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-300 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300/60 text-emerald-700">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              {t('scenario.header.title')}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('scenario.header.subtitle')}
            </p>
          </div>
        </div>

        {activeScenario && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-2xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>
                {/* BUG FIX: Floor seconds before display (was showing floating point like "12.300000001") */}
                {Math.floor(state.scenarioTimeElapsedSeconds / 60)}:
                {Math.floor(state.scenarioTimeElapsedSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <button
              onClick={onResetScenario}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 active:scale-95 text-xs text-slate-600 border border-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('scenario.btn.restart')}
            </button>
          </div>
        )}
      </div>

      {/* If No Active Scenario: Display Grid of 8 Scenarios */}
      {!activeScenario ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRAINING_SCENARIOS.map((scen) => {
            const isFinished = state.performance.completedScenarios.includes(scen.id);
            return (
              <div
                key={scen.id}
                className="flex flex-col justify-between rounded-xl bg-slate-100/80 border border-slate-300 hover:border-slate-400 p-4 transition-all duration-200 shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        scen.category === 'Emergency Drill'
                          ? 'bg-red-50 text-red-700 border border-red-300'
                          : scen.category === 'Rig Up'
                          ? 'bg-blue-50 text-blue-700 border border-blue-300'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      }`}
                    >
                      {scen.category === 'Emergency Drill' ? t('scenario.badge.emergency') : scen.category === 'Rig Up' ? t('scenario.badge.rigup') : t('scenario.badge.standard')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{t('scenario.badge.duration', { minutes: scen.targetDurationMinutes })}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-800 mb-1 leading-snug">{tData(scen.title)}</h4>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-3">{tData(scen.description)}</p>
                </div>

                <div className="pt-2 border-t border-slate-300/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">{scen.steps.length} {t('scenario.card.steps')}</span>
                  <button
                    id={`btn-start-${scen.id}`}
                    onClick={() => {
                      soundManager.playMetalTap();
                      onSelectScenario(scen);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all flex items-center gap-1 ${
                      isFinished
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-200 border border-emerald-300'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-md'
                    }`}
                  >
                    {isFinished ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        {t('scenario.btn.retrain')}
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        {t('scenario.btn.start')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Active Scenario Interactive Workflow Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Active Step Card & Instructions */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-xl bg-slate-100 border border-slate-300 p-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">
                  {t('scenario.instruction.label', { scenario: tData(activeScenario.title) })}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {t('scenario.step.of', { current: state.currentStepIndex + 1, total: activeScenario.steps.length })}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-300 mb-4">
                <div
                  style={{
                    width: `${((state.currentStepIndex + (state.scenarioCompleted ? 1 : 0)) / activeScenario.steps.length) * 100}%`,
                  }}
                  className="h-full bg-emerald-500 transition-all duration-300"
                />
              </div>

              {/* Step Card */}
              {currentStep && !state.scenarioCompleted ? (
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    currentStep.isCriticalSafetyStep
                      ? 'bg-red-50 border-red-400'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {currentStep.isCriticalSafetyStep ? (
                      <ShieldAlert className="w-5 h-5 text-red-700" />
                    ) : (
                      <Play className="w-4 h-4 text-emerald-700" />
                    )}
                    <h4 className="text-sm font-semibold text-slate-800">{tData(currentStep.title)}</h4>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed my-2">{tData(currentStep.instruction)}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-300 text-[11px]">
                    <span className="text-amber-700 font-mono font-semibold">{t('scenario.step.reference', { section: currentStep.manualSection })}</span>
                    {state.difficulty === 'trainee' && currentStep.hint && (
                      <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        {t('scenario.hint.label', { hint: currentStep.hint })}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Completed Card */
                <div className="p-5 rounded-xl bg-white border border-emerald-400/70 text-center space-y-3 shadow-md">
                  <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                  <h4 className="text-sm font-bold uppercase text-slate-800">
                    {t('scenario.completion.title')}
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    {t('scenario.completion.subtitle')}
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => onSelectScenario(null as unknown as TrainingScenario)}
                      className="px-4 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-700 text-white font-semibold text-2xs border border-emerald-400 shadow-sm"
                    >
                      {t('scenario.btn.return')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step Advance / Check Action */}
            {currentStep && !state.scenarioCompleted && (
              <div className="mt-4 pt-3 border-t border-slate-300 flex items-center justify-between">
                <span className="text-2xs text-slate-500">
                  {t('scenario.step.operate')}
                </span>

                <button
                  id="btn-validate-step"
                  onClick={() => {
                    const ok = currentStep.validationFn(state);
                    if (ok) {
                      soundManager.playSuccessChime();
                      onAdvanceStep();
                    } else {
                      soundManager.playBuzzerAlert();
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold text-2xs flex items-center gap-1.5 shadow-md"
                >
                  <span>{t('scenario.btn.validate')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Step Sequence Checklist */}
          <div className="lg:col-span-5 rounded-xl bg-slate-100 border border-slate-300 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-600 block border-b border-slate-300 pb-2 mb-3">
                {t('scenario.sequence.title')}
              </span>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeScenario.steps.map((step, idx) => {
                  const isCurrent = idx === state.currentStepIndex && !state.scenarioCompleted;
                  const isDone = idx < state.currentStepIndex || state.scenarioCompleted;

                  return (
                    <div
                      key={step.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : isCurrent
                          ? 'bg-slate-200 border-amber-500 text-amber-200 font-bold shadow-sm'
                          : 'bg-white/60 border-slate-300 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[220px]">
                          {idx + 1}. {tData(step.title)}
                        </span>
                      </div>
                      <span className="text-eyebrow font-mono text-slate-500 shrink-0">
                        {step.manualSection.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-300 flex justify-between items-center text-eyebrow text-slate-500">
              <span>{t('scenario.footer.form')}</span>
              <button
                onClick={() => onSelectScenario(null as unknown as TrainingScenario)}
                className="text-blue-700 hover:underline font-semibold"
              >
                {t('scenario.btn.change')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
