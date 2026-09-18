import React, { useState } from 'react';
import { SimulatorState, LogbookEntry } from '../types';
import { soundManager } from '../utils/audio';
import { useT } from '../i18n';
import {
  Award,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Download,
  Printer,
  Stamp,
  User,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface PerformanceAnalyticsProps {
  state: SimulatorState;
  onAddLogbookEntry: (entry: LogbookEntry) => void;
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  state,
  onAddLogbookEntry,
}) => {
  const { t } = useT();
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'logbook' | 'certificate'>('analytics');
  const { performance, telemetry, logbook, rod } = state;

  // New Logbook Form State
  const [wellLocation, setWellLocation] = useState('Pembina Cardium 102/04-12-048-09W5');
  const [unitNumber, setUnitNumber] = useState('MG-408');
  const [operatorName, setOperatorName] = useState(performance.operatorName || 'Hassan Hany');
  const [inspections, setInspections] = useState({
    walkaround: true,
    positiveAirShutdown: true,
    rodSafetyAccumulator10MinTest: true,
    bopTest1250Psi: true,
    knucklePickerInspection: true,
    rodElevatorsCheck: true,
    hydraulicFluidUnivisN32: true,
    wireRopesSlings: true,
  });

  const handleSignLogbook = () => {
    soundManager.playMetalTap();
    const newEntry: LogbookEntry = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      wellLocation,
      unitNumber,
      operatorName,
      jobType: 'surface',
      rodType: `${rod.rodGrade} ${rod.rodSize} ${rod.rodShape}`,
      maxDepthFt: Math.round(rod.totalWellDepthFt),
      totalWeightLbs: Math.round(rod.totalStringWeightLbs),
      inspectionsCompleted: inspections,
      drillsConducted: ['BOP Rapid Shut-In Drill', 'Safety Accumulator 10-Min Leak Check'],
      safetyScore: performance.safetyScore,
      comments: 'Daily inspection and tripping operations completed per GL-PCP-OEPS-L4-11 procedures.',
      certifiedStamp: true,
    };
    onAddLogbookEntry(newEntry);
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-white border border-slate-300 p-6 shadow-md text-slate-800 max-w-7xl mx-auto w-full">
      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-300 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-50 border border-red-300/60 text-red-700">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {t('analytics.header.title')}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('analytics.header.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-300">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-4 py-2.5 rounded-lg text-2xs font-semibold transition-all flex items-center gap-2 min-h-[40px] ${
              activeSubTab === 'analytics'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            {t('analytics.tab.dashboard')}
          </button>

          <button
            onClick={() => setActiveSubTab('logbook')}
            className={`px-4 py-2.5 rounded-lg text-2xs font-semibold transition-all flex items-center gap-2 min-h-[40px] ${
              activeSubTab === 'logbook'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t('analytics.tab.logbook')}{t('analytics.tab.logbook.version')}
          </button>

          <button
            onClick={() => setActiveSubTab('certificate')}
            className={`px-4 py-2.5 rounded-lg text-2xs font-semibold transition-all flex items-center gap-2 min-h-[40px] ${
              activeSubTab === 'certificate'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Award className="w-4 h-4" />
            {t('analytics.tab.certificate')}
          </button>
        </div>
      </div>

      {/* TAB 1: PERFORMANCE ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-5">
          {/* Top Scorecards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center">
              <span className="text-eyebrow font-semibold text-slate-500 block mb-1">
                {t('analytics.score.competency')}
              </span>
              <span className="text-3xl font-mono font-bold text-emerald-700">
                {performance.overallScore}%
              </span>
              <span className="text-eyebrow text-slate-500 block mt-1">{t('analytics.score.competency.grade')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center">
              <span className="text-eyebrow font-semibold text-slate-500 block mb-1">
                {t('analytics.score.safety')}
              </span>
              <span className="text-3xl font-mono font-bold text-emerald-700">
                {performance.safetyScore}%
              </span>
              <span className="text-eyebrow text-slate-500 block mt-1">{t('analytics.score.safety.subtitle')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center">
              <span className="text-eyebrow font-semibold text-slate-500 block mb-1">
                {t('analytics.score.reaction')}
              </span>
              <span className="text-3xl font-mono font-bold text-amber-700">
                {(performance.emergencyReactionTimeMs / 1000).toFixed(2)}s
              </span>
              <span className="text-eyebrow text-slate-500 block mt-1">{t('analytics.score.reaction.target')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center">
              <span className="text-eyebrow font-semibold text-slate-500 block mb-1">
                {t('analytics.score.completed')}
              </span>
              <span className="text-3xl font-mono font-bold text-blue-700">
                {performance.completedScenarios.length} / 8
              </span>
              <span className="text-eyebrow text-slate-500 block mt-1">{t('analytics.score.completed.subtitle')}</span>
            </div>
          </div>

          {/* 5-Pillar Competency Matrix */}
          <div className="p-5 rounded-xl bg-slate-100 border border-slate-300 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="text-xs font-semibold text-slate-700">
                {t('analytics.matrix.title')}
              </span>
              <span className="text-xs text-slate-500 font-mono">{t('analytics.matrix.eval')}</span>
            </div>

            <div className="space-y-3 pt-2">
              {/* 1. Well Control & BOP */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('analytics.pillar.wellcontrol')}</span>
                  <span className="text-emerald-700 font-mono">{performance.competencyPillars.wellControl}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-300">
                  <div
                    style={{ width: `${performance.competencyPillars.wellControl}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>

              {/* 2. Rig Stability */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('analytics.pillar.rigstability')}</span>
                  <span className="text-emerald-700 font-mono">{performance.competencyPillars.rigStability}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-300">
                  <div
                    style={{ width: `${performance.competencyPillars.rigStability}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>

              {/* 3. Hydraulic Regulation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('analytics.pillar.hydraulic')}</span>
                  <span className="text-blue-700 font-mono">{performance.competencyPillars.hydraulicRegulation}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-300">
                  <div
                    style={{ width: `${performance.competencyPillars.hydraulicRegulation}%` }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
              </div>

              {/* 4. Emergency Action */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('analytics.pillar.emergency')}</span>
                  <span className="text-amber-700 font-mono">{performance.competencyPillars.emergencyReaction}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-300">
                  <div
                    style={{ width: `${performance.competencyPillars.emergencyReaction}%` }}
                    className="h-full bg-amber-500 rounded-full"
                  />
                </div>
              </div>

              {/* 5. Procedural Accuracy */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{t('analytics.pillar.procedural')}</span>
                  <span className="text-purple-700 font-mono">{performance.competencyPillars.proceduralAccuracy}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-300">
                  <div
                    style={{ width: `${performance.competencyPillars.proceduralAccuracy}%` }}
                    className="h-full bg-purple-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Stream */}
          <div className="p-5 rounded-xl bg-slate-100 border border-slate-300">
            <span className="text-xs font-semibold text-slate-600 block border-b border-slate-300 pb-2 mb-3">
              {t('analytics.telemetry.title')}
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500">
                    <th className="py-2">{t('analytics.telemetry.time')}</th>
                    <th>{t('analytics.telemetry.depth')}</th>
                    <th>{t('analytics.telemetry.speed')}</th>
                    <th>{t('analytics.telemetry.weight')}</th>
                    <th>{t('analytics.telemetry.squeeze')}</th>
                    <th>{t('analytics.telemetry.charge')}</th>
                    <th>{t('analytics.telemetry.safety')}</th>
                    <th>{t('analytics.telemetry.temp')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-600">
                  {telemetry.slice(-6).map((t, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-slate-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                      <td className="text-emerald-700 font-semibold">{Math.round(t.depthFt)}</td>
                      <td>{Math.round(t.speedFtMin)}</td>
                      <td className="text-amber-700">{Math.round(t.stringWeightLbs)}</td>
                      <td>{Math.round(t.squeezePressurePsi)}</td>
                      <td className={t.chargePressurePsi < 250 ? 'text-red-700 font-semibold' : ''}>
                        {Math.round(t.chargePressurePsi)}
                      </td>
                      <td>{Math.round(t.safetyPressurePsi)}</td>
                      <td>{Math.round(t.hydraulicTempC)}</td>
                    </tr>
                  ))}
                  {telemetry.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-500 italic">
                        {t('analytics.telemetry.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEATHERFORD MG OPERATIONS LOGBOOK (Section 3.9 & 4.3) */}
      {activeSubTab === 'logbook' && (
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-slate-100 border border-slate-300">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-300 pb-3 gap-2">
              <div>
                <span className="eyebrow px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-300">
                  FORM NUMBER: GL-PCP-OEPS-L4-11
                </span>
                <h4 className="text-base font-semibold text-slate-800 mt-1">
                  Weatherford COROD® MG Operations Logbook (Daily Sheet)
                </h4>
              </div>
              <button
                onClick={handleSignLogbook}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-2xs flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Stamp className="w-4 h-4" />
                Sign & Certify Daily Sheet
              </button>
            </div>

            {/* Daily Information Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <div>
                <label className="text-eyebrow font-semibold text-slate-500 block mb-1">
                  Wellsite Location
                </label>
                <input
                  type="text"
                  value={wellLocation}
                  onChange={(e) => setWellLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs font-mono text-slate-700"
                />
              </div>

              <div>
                <label className="text-eyebrow font-semibold text-slate-500 block mb-1">
                  Mobile Gripper Unit #
                </label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs font-mono text-slate-700"
                />
              </div>

              <div>
                <label className="text-eyebrow font-semibold text-slate-500 block mb-1">
                  Operator Name / Badge #
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs font-mono text-slate-700"
                />
              </div>
            </div>

            {/* Level I Daily Inspection Checklist (Table 13 / Section 5.2.3) */}
            <div className="space-y-2 pt-2 border-t border-slate-300">
              <span className="text-xs font-semibold text-amber-700 block mb-2">
                Mandatory Level I Daily Inspection Checklist (Table 13)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(inspections).map(([key, val]) => {
                  const labels: Record<string, string> = {
                    walkaround: '1. Daily Pre-Job Walkaround & Obstacle Assessment (4.2 / 5.2.3)',
                    positiveAirShutdown: '2. Positive Air Shutdowns & Roda Valve Test (5.2.3.1)',
                    rodSafetyAccumulator10MinTest: '3. Rod Safety Clamp Accumulator 10-Min Leak Check (5.2.3.2)',
                    bopTest1250Psi: '4. Regan BOP 1250 PSI Function & Pressure Test (5.2.3.4)',
                    knucklePickerInspection: '5. Knuckle Picker Base Bolts & Storage Roller (5.2.3.5)',
                    rodElevatorsCheck: '6. Rod Elevators & 1/8" Bail Wear Inspection (5.2.3.6)',
                    hydraulicFluidUnivisN32: '7. Hydraulic Reservoir Fluid Level (Univis N32) (5.2.3.11)',
                    wireRopesSlings: '8. Wire Ropes, 3-Legged Slings & Shackles (5.2.3.7)',
                  };

                  return (
                    <label
                      key={key}
                      className="p-2 rounded bg-white border border-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-850"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setInspections({ ...inspections, [key]: e.target.checked })}
                        className="rounded bg-slate-200 border-slate-400 text-red-600 accent-red-600 w-4 h-4"
                      />
                      <span className="text-slate-600 font-medium">{labels[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Past Log Entries */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-600 block">
              Certified Operations Logbook History
            </span>

            {logbook.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-mono text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{entry.date}</span>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">{entry.wellLocation}</span>
                  </div>
                  <div className="text-slate-600 font-semibold mt-1">
                    Operator: {entry.operatorName} • Unit: {entry.unitNumber} • Rod: {entry.rodType}
                  </div>
                  <div className="text-2xs text-slate-500 mt-0.5">{entry.comments}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 font-black font-mono">
                    SAFETY SCORE: {entry.safetyScore}%
                  </span>
                  {entry.certifiedStamp && (
                    <div className="px-2 py-1 rounded bg-red-50 border border-red-300 text-red-700 font-semibold eyebrow flex items-center gap-1">
                      <Stamp className="w-3 h-3" />
                      WFT AUDITED
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: OPERATOR CERTIFICATION BADGE */}
      {activeSubTab === 'certificate' && (
        <div className="p-8 rounded-xl bg-slate-100 border-2 border-amber-400 text-center max-w-2xl mx-auto shadow-xl space-y-5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-red-600 border-2 border-white flex items-center justify-center font-black text-3xl text-white shadow-xl">
              W
            </div>
          </div>

          <div>
            <span className="eyebrow font-semibold text-amber-700">
              CERTIFICATE OF OPERATIONAL COMPETENCY
            </span>
            <h3 className="text-2xl font-semibold text-slate-800 mt-1">
              Weatherford COROD® Mobile Gripper Operator
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Awarded under standard operating protocol GL-PCP-OEPS-L4-11 (Rev 25)
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/80 border border-slate-300 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Certified Operator:</span>
              <span className="font-semibold text-slate-800">{operatorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rating:</span>
              <span className="font-semibold text-emerald-700">
                Continuous Sucker Rod & 4.5T Knuckle Picker Level II
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Safety & Emergency Reaction:</span>
              <span className="font-semibold text-amber-700 font-mono">
                {performance.safetyScore}% ({performance.emergencyReactionTimeMs} ms)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date of Validation:</span>
              <span className="font-mono text-slate-600">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-2xs flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Certificate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
