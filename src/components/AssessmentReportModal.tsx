import React from 'react';
import { AssessmentSession } from '../types';
import { computeAssessmentReport } from '../utils/assessmentScore';
import { printCertificate } from '../utils/printCertificate';
import { useT } from '../i18n';
import { Award, Clock, Eye, AlertTriangle, CheckCircle2, XCircle, RefreshCw, X, Printer, Trophy } from 'lucide-react';

interface AssessmentReportModalProps {
  session: AssessmentSession;
  onClose: () => void;
  onRestart: () => void;
  onShowLeaderboard?: () => void;
}

const fmtSec = (s: number | null): string => (s == null ? '—' : `${s.toFixed(1)}s`);
const fmtDur = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/** End-of-run scored report for a timed assessment. */
export const AssessmentReportModal: React.FC<AssessmentReportModalProps> = ({
  session,
  onClose,
  onRestart,
  onShowLeaderboard,
}) => {
  const { t, tData } = useT();
  const report = computeAssessmentReport(session);

  const gradeColor =
    report.grade === 'excellent'
      ? 'text-emerald-600'
      : report.grade === 'competent'
      ? 'text-blue-600'
      : report.grade === 'practice'
      ? 'text-amber-600'
      : 'text-red-600';
  const gradeLabel = t(`assessment.grade.${report.grade}`);

  const scoreRing =
    report.overallScore >= 90
      ? 'border-emerald-500'
      : report.overallScore >= 75
      ? 'border-blue-500'
      : report.overallScore >= 60
      ? 'border-amber-500'
      : 'border-red-500';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl sticky top-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{t('assessment.report.title')}</h3>
              <p className="text-xs text-slate-500">
                {session.operator.name}
                {session.operator.role ? ` • ${session.operator.role}` : ''}
                {session.operator.unit ? ` • ${session.operator.unit}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score summary */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <div className={`w-28 h-28 rounded-full border-8 ${scoreRing} flex items-center justify-center`}>
              <span className="text-3xl font-black text-slate-800">{report.overallScore}</span>
            </div>
            <span className={`mt-2 text-sm font-bold uppercase ${gradeColor}`}>{gradeLabel}</span>
          </div>

          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<Clock className="w-4 h-4 text-blue-600" />} label={t('assessment.report.avgReaction')} value={fmtSec(report.avgReactionSec)} />
            <Stat icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label={t('assessment.report.resolved')} value={`${report.eventsResolved}/${report.eventsHandled}`} />
            <Stat icon={<Eye className="w-4 h-4 text-amber-600" />} label={t('assessment.report.hints')} value={String(report.hintsUsedTotal)} />
            <Stat icon={<AlertTriangle className="w-4 h-4 text-red-600" />} label={t('assessment.report.timeouts')} value={String(report.timeoutsTotal)} />
            <Stat icon={<Clock className="w-4 h-4 text-slate-600" />} label={t('assessment.report.duration')} value={fmtDur(report.durationSec)} />
          </div>
        </div>

        {/* Per-event table */}
        <div className="px-6 pb-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('assessment.report.breakdown')}</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">#</th>
                  <th className="text-left px-3 py-2 font-semibold">{t('assessment.report.col.event')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('assessment.report.col.reaction')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('assessment.report.col.resolve')}</th>
                  <th className="text-center px-3 py-2 font-semibold">{t('assessment.report.col.hints')}</th>
                  <th className="text-center px-3 py-2 font-semibold">{t('assessment.report.col.timeouts')}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t('assessment.report.col.score')}</th>
                </tr>
              </thead>
              <tbody>
                {report.eventScores.map((e, i) => (
                  <tr key={`${e.scenarioId}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 flex items-center gap-1.5">
                      {e.resolved ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      {tData(e.title)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtSec(e.reactionSec)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtSec(e.resolveSec)}</td>
                    <td className="px-3 py-2 text-center font-mono">{e.hintsUsed}</td>
                    <td className="px-3 py-2 text-center font-mono">{e.timedOutSteps}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${e.score >= 75 ? 'text-emerald-600' : e.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{e.score}</td>
                  </tr>
                ))}
                {report.eventScores.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                      {t('assessment.report.none')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('assessment.report.logged')}
          </p>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3 bg-slate-50 rounded-b-2xl">
          {onShowLeaderboard && (
            <button
              onClick={onShowLeaderboard}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold text-xs mr-auto"
            >
              <Trophy className="w-4 h-4" />
              {t('assessment.report.btn.leaderboard')}
            </button>
          )}
          <button
            onClick={() =>
              printCertificate({
                eyebrow: t('assessment.cert.eyebrow'),
                title: t('assessment.cert.title'),
                protocol: t('assessment.cert.protocol'),
                seal: gradeLabel,
                fields: [
                  { label: t('leaderboard.col.operator'), value: session.operator.name || 'Trainee' },
                  ...(session.operator.role ? [{ label: t('assessment.field.role'), value: session.operator.role }] : []),
                  ...(session.operator.unit ? [{ label: t('assessment.field.unit'), value: session.operator.unit }] : []),
                  { label: t('assessmentHud.mode'), value: t(session.difficulty === 'realistic' ? 'assessment.diff.realistic' : 'assessment.diff.guided') },
                  { label: t('leaderboard.col.score'), value: `${report.overallScore} / 100`, accent: report.overallScore >= 75 ? '#047857' : '#b45309' },
                  { label: t('leaderboard.col.grade'), value: gradeLabel, accent: report.overallScore >= 75 ? '#047857' : '#dc2626' },
                  { label: t('assessment.report.resolved'), value: `${report.eventsResolved} / ${report.eventsHandled}` },
                  { label: t('assessment.report.avgReaction'), value: report.avgReactionSec != null ? `${report.avgReactionSec.toFixed(1)} s` : '—' },
                  { label: t('assessment.report.hints'), value: String(report.hintsUsedTotal) },
                  { label: t('assessment.report.duration'), value: fmtDur(report.durationSec) },
                  { label: t('assessment.cert.date'), value: new Date(session.endedAt ?? Date.now()).toLocaleString() },
                ],
                signatories: [
                  { name: 'Weatherford Training Authority', role: 'Certifying Body' },
                  { name: session.operator.name || 'Trainee', role: 'Assessed Operator' },
                ],
                footer: 'Weatherford Enterprise Excellence • CoRod® Mobile Gripper Emergency-Response Assessment',
                serial: `GL-PCP-OEPS-L4-11 • Rev 25 • Ref ${session.startedAt}`,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs"
          >
            <Printer className="w-4 h-4" />
            {t('assessment.report.btn.print')}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs"
          >
            {t('assessment.report.btn.close')}
          </button>
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            {t('assessment.report.btn.restart')}
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex flex-col gap-1">
    <span className="text-[10px] text-slate-500 flex items-center gap-1.5">{icon}{label}</span>
    <span className="text-lg font-bold text-slate-800 font-mono">{value}</span>
  </div>
);
