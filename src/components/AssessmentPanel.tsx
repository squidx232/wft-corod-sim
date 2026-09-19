import React, { useState } from 'react';
import { AssessmentOperator, AssessmentDifficulty } from '../types';
import { useT } from '../i18n';
import { soundManager } from '../utils/audio';
import { Play, Timer, ClipboardList, ShieldAlert, User, Briefcase, Truck, BookOpen, Brain, Trophy } from 'lucide-react';

interface AssessmentPanelProps {
  /** True while a run is in progress (disables Start). */
  running: boolean;
  onStart: (details: AssessmentOperator, durationMinutes: number, difficulty: AssessmentDifficulty) => void;
  /** Open the leaderboard view. */
  onShowLeaderboard?: () => void;
}

const DURATIONS = [5, 7, 10] as const;

/**
 * "Start Simulation" hero panel shown at the top of the Emergency Response tab.
 * Collects operator personal details and a target duration, then launches the
 * timed assessment run (sequential random emergencies with reaction scoring).
 */
export const AssessmentPanel: React.FC<AssessmentPanelProps> = ({ running, onStart, onShowLeaderboard }) => {
  const { t } = useT();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [unit, setUnit] = useState('');
  const [duration, setDuration] = useState<number>(7);
  const [difficulty, setDifficulty] = useState<AssessmentDifficulty>('guided');
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    if (!name.trim()) {
      setError(t('assessment.error.name'));
      return;
    }
    setError(null);
    soundManager.playMetalTap();
    onStart(
      { name: name.trim(), role: role.trim(), unit: unit.trim() },
      duration,
      difficulty,
    );
  };

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-red-500/50 shadow-2xl text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-600 shadow-lg">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t('assessment.title')}</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">{t('assessment.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <Timer className="w-4 h-4 text-amber-400" />
            {t('assessment.feature.timed')}
          </span>
          <span className="flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            {t('assessment.feature.scored')}
          </span>
          {onShowLeaderboard && (
            <button
              type="button"
              onClick={onShowLeaderboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold transition-colors"
            >
              <Trophy className="w-4 h-4" />
              {t('assessment.btn.leaderboard')}
            </button>
          )}
        </div>
      </div>

      {/* Difficulty selector */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(
          [
            { key: 'guided' as const, icon: <BookOpen className="w-4 h-4" />, title: t('assessment.diff.guided'), desc: t('assessment.diff.guided.desc') },
            { key: 'realistic' as const, icon: <Brain className="w-4 h-4" />, title: t('assessment.diff.realistic'), desc: t('assessment.diff.realistic.desc') },
          ]
        ).map((d) => (
          <button
            key={d.key}
            type="button"
            disabled={running}
            onClick={() => setDifficulty(d.key)}
            className={`text-left p-3 rounded-lg border-2 transition-all disabled:opacity-50 ${
              difficulty === d.key
                ? 'border-red-500 bg-red-600/15'
                : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
            }`}
          >
            <span className="flex items-center gap-2 font-bold text-sm">
              {d.icon}
              {d.title}
            </span>
            <span className="block text-[11px] text-slate-300 mt-1">{d.desc}</span>
          </button>
        ))}
      </div>

      {/* Operator details form */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {t('assessment.field.name')}
          </span>
          <input
            type="text"
            value={name}
            disabled={running}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('assessment.field.name.ph')}
            className="rounded-lg bg-slate-700/70 border border-slate-600 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-red-400 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" /> {t('assessment.field.role')}
          </span>
          <input
            type="text"
            value={role}
            disabled={running}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('assessment.field.role.ph')}
            className="rounded-lg bg-slate-700/70 border border-slate-600 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-red-400 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> {t('assessment.field.unit')}
          </span>
          <input
            type="text"
            value={unit}
            disabled={running}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('assessment.field.unit.ph')}
            className="rounded-lg bg-slate-700/70 border border-slate-600 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-red-400 disabled:opacity-50"
          />
        </label>
      </div>

      {/* Duration selector + Start */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300">{t('assessment.field.duration')}</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={running}
                onClick={() => setDuration(d)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                  duration === d
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700/70 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t('assessment.duration.min', { minutes: d })}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-xs font-semibold text-red-300">{error}</span>}
          <button
            type="button"
            disabled={running}
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm uppercase shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Play className="w-4 h-4" />
            {running ? t('assessment.btn.running') : t('assessment.btn.start')}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
        {t('assessment.hint.expect')}
      </p>
    </div>
  );
};
