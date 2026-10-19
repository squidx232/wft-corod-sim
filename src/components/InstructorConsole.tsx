import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { SimulatorState, EnvironmentState, DEFAULT_ENVIRONMENT, TimeOfDay, WeatherKind } from '../types';
import { EMERGENCY_SCENARIOS } from '../data/emergencyScenarios';
import type { InstructorCommand } from '../utils/simEvents';
import { Card, Button, Badge, SegmentedControl } from './ui';
import { AlertTriangle, CheckCircle, XCircle, Wind, CloudRain, Cloud, Sun, Moon, Sunrise, Sunset } from 'lucide-react';

/**
 * Instructor pop-out (`?view=instructor`). Shows the trainee's live state and
 * lets the instructor inject emergencies and change site conditions. All
 * actions are sent to the primary window as `InstructorCommand`s; this window
 * never mutates simulator state directly.
 */

const STRINGS = {
  en: {
    header: 'COROD® MG INSTRUCTOR CONSOLE',
    live: 'Live trainee status', depth: 'Depth', speed: 'Rod speed', squeeze: 'Squeeze (actual / required)',
    deficit: 'Squeeze deficit', alarm: 'Alarm tier', engine: 'Engine', running: 'RUNNING', off: 'OFF',
    assessment: 'Assessment', rih: 'RIH', pooh: 'POOH', stopped: 'STOPPED',
    faults: 'Fault injection', inject: 'Inject', active: 'Active drill', step: 'Step', elapsed: 'Elapsed',
    resolve: 'Resolve', cancel: 'Cancel', confirm: 'Confirm', confirmQ: 'Inject this emergency into the trainee session?',
    busy: 'Another drill is running — resolve or cancel it first.',
    site: 'Site conditions', time: 'Time of day', weather: 'Weather', windSpeed: 'Wind speed', windDir: 'Wind blowing toward',
    dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night', clear: 'Clear', windy: 'Windy', dust: 'Dust', rain: 'Rain',
    log: 'Session event log', noEvents: 'No events yet.', triggered: 'Triggered', resolved: 'Resolved', cancelled: 'Ended',
    alarmChange: 'Alarm', envChange: 'Conditions',
  },
  ar: {
    header: 'وحدة تحكم المدرب — COROD® MG',
    live: 'حالة المتدرب المباشرة', depth: 'العمق', speed: 'سرعة القضيب', squeeze: 'الضغط (الفعلي / المطلوب)',
    deficit: 'عجز الضغط', alarm: 'مستوى الإنذار', engine: 'المحرك', running: 'يعمل', off: 'متوقف',
    assessment: 'التقييم', rih: 'إنزال', pooh: 'سحب', stopped: 'متوقف',
    faults: 'حقن الأعطال', inject: 'حقن', active: 'التمرين النشط', step: 'الخطوة', elapsed: 'المدة',
    resolve: 'حل', cancel: 'إلغاء', confirm: 'تأكيد', confirmQ: 'هل تريد حقن حالة الطوارئ هذه في جلسة المتدرب؟',
    busy: 'يوجد تمرين قيد التشغيل — قم بحله أو إلغائه أولاً.',
    site: 'ظروف الموقع', time: 'وقت اليوم', weather: 'الطقس', windSpeed: 'سرعة الرياح', windDir: 'اتجاه هبوب الرياح',
    dawn: 'فجر', day: 'نهار', dusk: 'غروب', night: 'ليل', clear: 'صافٍ', windy: 'عاصف', dust: 'غبار', rain: 'مطر',
    log: 'سجل أحداث الجلسة', noEvents: 'لا توجد أحداث بعد.', triggered: 'بدأ', resolved: 'تم الحل', cancelled: 'انتهى',
    alarmChange: 'إنذار', envChange: 'الظروف',
  },
} as const;

type Strings = { [K in keyof typeof STRINGS.en]: string };

interface LogItem { at: number; text: string; tone: 'neutral' | 'warning' | 'danger' | 'success' }

interface InstructorConsoleProps {
  state: SimulatorState;
  onSendCommand: (cmd: InstructorCommand) => void;
}

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const InstructorConsole: React.FC<InstructorConsoleProps> = ({ state, onSendCommand }) => {
  const { lang, dir, tData } = useT();
  const s: Strings = STRINGS[lang === 'ar' ? 'ar' : 'en'];
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<LogItem[]>([]);

  const env: EnvironmentState = state.environment ?? DEFAULT_ENVIRONMENT;
  const scenarioId = state.emergencyScenarioId;
  const activeScenario = scenarioId ? EMERGENCY_SCENARIOS.find((sc) => sc.id === scenarioId) ?? null : null;
  const speed = state.rod.rodSpeedFtPerMin;
  const direction = speed < -0.1 ? s.rih : speed > 0.1 ? s.pooh : s.stopped;
  const required = state.rod.calculatedSqueezeRequiredPsi;
  const actual = state.hydraulics.squeezePressure;
  const deficit = Math.max(0, required - actual);
  const assessmentActive = !!state.assessment?.active && !state.assessment?.ended;

  // 1 Hz clock for the elapsed-time readout while a drill runs.
  useEffect(() => {
    if (!scenarioId) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scenarioId]);

  // Derive a local event log from state transitions seen by this window.
  const prev = useRef({ scenarioId, alarm: state.alarmTier, env: `${env.timeOfDay}/${env.weather}/${env.windSpeedMph}` });
  useEffect(() => {
    const p = prev.current;
    const items: LogItem[] = [];
    const at = Date.now();
    const titleOf = (id: string | null) => {
      const sc = id ? EMERGENCY_SCENARIOS.find((x) => x.id === id) : null;
      return sc ? tData(sc.title) : id ?? '';
    };
    if (scenarioId !== p.scenarioId) {
      if (p.scenarioId) {
        items.push({ at, text: `${state.emergencyResolved ? s.resolved : s.cancelled}: ${titleOf(p.scenarioId)}`, tone: state.emergencyResolved ? 'success' : 'neutral' });
      }
      if (scenarioId) items.push({ at, text: `${s.triggered}: ${titleOf(scenarioId)}`, tone: 'danger' });
    }
    if (state.alarmTier !== p.alarm) {
      items.push({ at, text: `${s.alarmChange}: ${p.alarm.toUpperCase()} → ${state.alarmTier.toUpperCase()}`, tone: state.alarmTier === 'none' ? 'neutral' : 'warning' });
    }
    const envKey = `${env.timeOfDay}/${env.weather}/${env.windSpeedMph}`;
    if (envKey !== p.env) {
      items.push({ at, text: `${s.envChange}: ${s[env.timeOfDay]} · ${s[env.weather]} · ${env.windSpeedMph} mph`, tone: 'neutral' });
    }
    prev.current = { scenarioId, alarm: state.alarmTier, env: envKey };
    if (items.length) setLog((l) => [...items.reverse(), ...l].slice(0, 60));
  }, [scenarioId, state.alarmTier, state.emergencyResolved, env.timeOfDay, env.weather, env.windSpeedMph, s, tData]);

  const setEnv = (patch: Partial<EnvironmentState>) => onSendCommand({ kind: 'set-environment', patch });
  const severityTone = (sev: string) => (sev === 'critical' ? 'danger' : sev === 'high' ? 'warning' : 'neutral');

  const stat = (label: string, value: React.ReactNode, extra = '') => (
    <div className="space-y-1">
      <span className="text-slate-400">{label}</span>
      <div className={`font-mono font-semibold ${extra || 'text-slate-100'}`}>{value}</div>
    </div>
  );

  return (
    <div dir={dir} className="min-h-screen bg-slate-900 text-slate-100 p-4 overflow-auto">
      <div className="text-center text-xs text-slate-400 mb-4 font-mono">{s.header}</div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <h2 className="text-sm font-bold text-slate-200 mb-3">{s.live}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-2xs">
              {stat(s.depth, `${Math.round(state.rod.currentDepthFt).toLocaleString()} ft`)}
              {stat(s.speed, `${Math.abs(speed).toFixed(1)} ft/min (${direction})`)}
              {stat(s.squeeze, `${Math.round(actual)} / ${Math.round(required)} PSI`)}
              {stat(s.deficit, `${Math.round(deficit)} PSI`, deficit > 50 ? 'text-red-400' : '')}
              {stat(s.alarm, (
                <Badge tone={state.alarmTier === 'none' ? 'neutral' : state.alarmTier === 'emergency' ? 'danger' : 'warning'}>
                  {state.alarmTier.toUpperCase()}
                </Badge>
              ))}
              {stat(s.engine, (
                <Badge tone={state.hydraulics.engineRunning ? 'success' : 'neutral'}>
                  {state.hydraulics.engineRunning ? s.running : s.off}
                </Badge>
              ))}
              {assessmentActive && stat(s.assessment, state.assessment?.difficulty?.toUpperCase())}
            </div>
            {activeScenario && (
              <div className="mt-3 pt-3 border-t border-slate-700 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="font-bold text-red-300">{s.active}:</span>
                <span>{tData(activeScenario.title)}</span>
                <span className="font-mono">{s.step} {Math.min(state.emergencyStepIndex + 1, activeScenario.steps.length)}/{activeScenario.steps.length}</span>
                {state.emergencyTriggerTime && <span className="font-mono">{s.elapsed} {fmtElapsed(now - state.emergencyTriggerTime)}</span>}
                <div className="flex gap-1 ms-auto">
                  <Button size="sm" variant="primary" icon={<CheckCircle className="w-3 h-3" />} onClick={() => onSendCommand({ kind: 'resolve-emergency' })}>{s.resolve}</Button>
                  <Button size="sm" variant="secondary" icon={<XCircle className="w-3 h-3" />} onClick={() => onSendCommand({ kind: 'cancel-emergency' })}>{s.cancel}</Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <h2 className="text-sm font-bold text-slate-200 mb-1">{s.faults}</h2>
            {scenarioId && <p className="text-3xs text-amber-300 mb-2">{s.busy}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {EMERGENCY_SCENARIOS.map((sc) => (
                <div key={sc.id} className={`rounded-lg p-2 ${sc.id === scenarioId ? 'bg-red-900/40 ring-1 ring-red-500' : 'bg-slate-700'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-2xs font-bold text-slate-200">{tData(sc.title)}</div>
                      <Badge tone={severityTone(sc.severity)}>{sc.severity.toUpperCase()}</Badge>
                    </div>
                    {confirmId === sc.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="primary" onClick={() => { onSendCommand({ kind: 'trigger-emergency', scenarioId: sc.id }); setConfirmId(null); }}>{s.confirm}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>{s.cancel}</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="primary" disabled={!!scenarioId} icon={<AlertTriangle className="w-3 h-3" />} onClick={() => setConfirmId(sc.id)}>{s.inject}</Button>
                    )}
                  </div>
                  {confirmId === sc.id && <p className="text-3xs text-slate-300 mt-1">{s.confirmQ}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <h2 className="text-sm font-bold text-slate-200 mb-3">{s.site}</h2>
            <div className="space-y-3">
              <SegmentedControl
                label={s.time}
                value={env.timeOfDay}
                onChange={(v) => setEnv({ timeOfDay: v as TimeOfDay })}
                segments={[
                  { id: 'dawn', label: s.dawn, icon: <Sunrise className="w-4 h-4" /> },
                  { id: 'day', label: s.day, icon: <Sun className="w-4 h-4" /> },
                  { id: 'dusk', label: s.dusk, icon: <Sunset className="w-4 h-4" /> },
                  { id: 'night', label: s.night, icon: <Moon className="w-4 h-4" /> },
                ]}
              />
              <SegmentedControl
                label={s.weather}
                value={env.weather}
                onChange={(v) => setEnv({ weather: v as WeatherKind })}
                segments={[
                  { id: 'clear', label: s.clear, icon: <Sun className="w-4 h-4" /> },
                  { id: 'windy', label: s.windy, icon: <Wind className="w-4 h-4" /> },
                  { id: 'dust', label: s.dust, icon: <Cloud className="w-4 h-4" /> },
                  { id: 'rain', label: s.rain, icon: <CloudRain className="w-4 h-4" /> },
                ]}
              />
              <label className="block text-2xs font-bold text-slate-300">
                {s.windSpeed}: {env.windSpeedMph} mph
                <input type="range" min={0} max={45} value={env.windSpeedMph} onChange={(e) => setEnv({ windSpeedMph: Number(e.target.value) })} className="w-full accent-blue-500" />
              </label>
              <label className="block text-2xs font-bold text-slate-300">
                {s.windDir}: {env.windDirectionDeg}°
                <input type="range" min={0} max={359} value={env.windDirectionDeg} onChange={(e) => setEnv({ windDirectionDeg: Number(e.target.value) })} className="w-full accent-blue-500" />
              </label>
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <h2 className="text-sm font-bold text-slate-200 mb-2">{s.log}</h2>
            <ul className="space-y-1 max-h-72 overflow-y-auto text-3xs font-mono">
              {log.length === 0 && <li className="text-slate-500">{s.noEvents}</li>}
              {log.map((item, i) => (
                <li key={`${item.at}-${i}`} className={item.tone === 'danger' ? 'text-red-300' : item.tone === 'warning' ? 'text-amber-300' : item.tone === 'success' ? 'text-emerald-300' : 'text-slate-300'}>
                  {new Date(item.at).toLocaleTimeString()} — {item.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};
