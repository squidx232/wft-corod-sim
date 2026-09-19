import React, { useMemo, useState } from 'react';
import { LeaderboardEntry, AssessmentDifficulty } from '../types';
import { loadLeaderboard, clearLeaderboard } from '../utils/leaderboard';
import { useT } from '../i18n';
import { Trophy, X, Trash2, Medal, BookOpen, Brain } from 'lucide-react';

interface LeaderboardModalProps {
  onClose: () => void;
  /** Highlight this entry id (e.g. the run just completed). */
  highlightId?: string;
}

type Filter = 'all' | AssessmentDifficulty;

const fmtDur = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const rankColor = (i: number): string =>
  i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700' : 'text-slate-500';

/** Persistent high-score leaderboard for finished assessment runs. */
export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, highlightId }) => {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => loadLeaderboard());

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.difficulty === filter)),
    [entries, filter],
  );

  const handleClear = () => {
    clearLeaderboard();
    setEntries([]);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl sticky top-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{t('leaderboard.title')}</h3>
              <p className="text-xs text-slate-500">{t('leaderboard.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {(
            [
              { key: 'all' as const, label: t('leaderboard.filter.all') },
              { key: 'guided' as const, label: t('assessment.diff.guided') },
              { key: 'realistic' as const, label: t('assessment.diff.realistic') },
            ]
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="p-6 pt-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">#</th>
                  <th className="text-left px-3 py-2 font-semibold">{t('leaderboard.col.operator')}</th>
                  <th className="text-center px-3 py-2 font-semibold">{t('leaderboard.col.mode')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('leaderboard.col.score')}</th>
                  <th className="text-center px-3 py-2 font-semibold">{t('leaderboard.col.grade')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('leaderboard.col.resolved')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('leaderboard.col.reaction')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('leaderboard.col.date')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-t border-slate-100 ${e.id === highlightId ? 'bg-amber-50' : ''}`}
                  >
                    <td className={`px-3 py-2 font-bold ${rankColor(i)}`}>
                      {i < 3 ? <Medal className="w-4 h-4 inline" /> : i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-800">{e.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {[e.role, e.unit].filter(Boolean).join(' • ')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        {e.difficulty === 'realistic' ? <Brain className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{e.score}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold uppercase ${
                        e.score >= 90 ? 'text-emerald-600' : e.score >= 75 ? 'text-blue-600' : e.score >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>{t(`assessment.grade.${e.grade}`)}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{e.eventsResolved}/{e.eventsHandled}</td>
                    <td className="px-3 py-2 text-right font-mono">{e.avgReactionSec != null ? `${e.avgReactionSec.toFixed(1)}s` : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{new Date(e.timestamp).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                      {t('leaderboard.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs"
          >
            <Trash2 className="w-4 h-4" />
            {t('leaderboard.btn.clear')}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
          >
            {t('leaderboard.btn.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
