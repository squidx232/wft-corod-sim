import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { craneStore, CRANE_KEYS } from '../crane/craneStore';
import { CRANE_JOINTS, CraneJoint, ratedCapacityAt } from '../crane/craneSim';
import { CRANE_TASKS, CraneCheckId } from '../data/craneTasks';
import type { SimulatorState } from '../types';

/**
 * Fassi-style crane control station (matches the MG unit: yellow FX display
 * with LEDs + STOP button above a bank of four proportional levers with yellow
 * pictogram labels). Drives `craneStore`; the 3D viewport steps the sim.
 */

const STR = {
  en: {
    title: 'FASSI F215C — Crane control station', power: 'MG power pack', engine: 'Engine', pto: 'PTO / Hydraulics',
    on: 'ON', off: 'OFF', stab: 'Stabilizers', deploy: 'Deploy', stow: 'Stow', hookOn: 'Hook on', release: 'Release load',
    reset: 'Reset task', task: 'Training task', checklist: 'Checklist', metrics: 'Performance', time: 'Time', maxLmi: 'Max LMI',
    limitHits: 'LMI cut-outs', hard: 'Hard landings', swing: 'Max swing', accuracy: 'Landing error', score: 'Score', done: 'Task complete',
    estop: 'STOP', estopOn: 'E-STOP ENGAGED — twist to release', radius: 'Radius', load: 'Load', cap: 'Rated', page: 'Page',
    keys: 'Keys', levers: ['Slewing', 'Main boom', 'Outer boom', 'Extensions'], plus: ['Left', 'Up', 'Up', 'Out'], minus: ['Right', 'Down', 'Down', 'In'],
    blocked: { lmi: 'Load-moment limiter cut-out: only moment-reducing motions allowed (boom up / extensions in).', stabilizers: 'Deploy the stabilizers before operating the crane.', power: 'No hydraulic power: start the MG engine and engage the PTO.', estop: 'Emergency stop engaged.', limit: 'Joint at its mechanical limit.' },
    checks: {
      power: 'Hydraulic power on (engine + PTO)', 'stab-deployed': 'Stabilizers deployed', unfolded: 'Crane unfolded from transport position', slewed: 'Slewed at least 60°',
      hooked: 'Hooked on to the load', lifted: 'Load lifted clear (> 0.3 m)', 'over-target': 'Load over the landing mat', 'landed-on-target': 'Load landed on the mat',
      released: 'Load released', stowed: 'Crane returned to transport position', 'stab-stowed': 'Stabilizers stowed',
    } as Record<CraneCheckId, string>,
    events: {
      'lmi-warn': 'LMI warning: approaching rated capacity', 'lmi-limit': 'LMI limit reached — moment-increasing functions cut', 'hard-landing': 'Hard landing!',
      'load-lifted': 'Load lifted', 'hooked-on': 'Hooked on', released: 'Load released', 'release-suspended': 'Cannot release a suspended load — land it first',
      'hook-too-far': 'Hook too far from the lifting point', 'stab-deployed': 'Stabilizers deployed', 'stab-stowed': 'Stabilizers stowed',
      'stab-stow-blocked': 'Stow the crane (and unhook) before raising the stabilizers',
    } as Record<string, string>,
    hint: 'Hold the levers (drag) or use the keys. Gamepad: left stick = slew / main boom, right stick = extensions / outer boom.',
  },
  ar: {
    title: 'FASSI F215C — محطة التحكم بالرافعة', power: 'وحدة الطاقة MG', engine: 'المحرك', pto: 'مأخذ القدرة / الهيدروليك',
    on: 'تشغيل', off: 'إيقاف', stab: 'المثبتات', deploy: 'فرد', stow: 'طي', hookOn: 'ربط الخطاف', release: 'فك الحمولة',
    reset: 'إعادة المهمة', task: 'مهمة التدريب', checklist: 'قائمة التحقق', metrics: 'الأداء', time: 'الوقت', maxLmi: 'أقصى عزم',
    limitHits: 'قطع محدد العزم', hard: 'هبوط عنيف', swing: 'أقصى تأرجح', accuracy: 'خطأ الإنزال', score: 'النتيجة', done: 'اكتملت المهمة',
    estop: 'إيقاف', estopOn: 'الإيقاف الطارئ مفعّل — أدر للتحرير', radius: 'نصف القطر', load: 'الحمولة', cap: 'المقنن', page: 'صفحة',
    keys: 'المفاتيح', levers: ['التدوير', 'الذراع الرئيسية', 'الذراع الخارجية', 'الامتدادات'], plus: ['يسار', 'أعلى', 'أعلى', 'مدّ'], minus: ['يمين', 'أسفل', 'أسفل', 'سحب'],
    blocked: { lmi: 'قطع محدد العزم: يُسمح فقط بالحركات التي تقلل العزم (رفع الذراع / سحب الامتدادات).', stabilizers: 'افرد المثبتات قبل تشغيل الرافعة.', power: 'لا توجد طاقة هيدروليكية: شغّل محرك MG وفعّل مأخذ القدرة.', estop: 'الإيقاف الطارئ مفعّل.', limit: 'المفصل عند حده الميكانيكي.' },
    checks: {
      power: 'الطاقة الهيدروليكية (محرك + مأخذ قدرة)', 'stab-deployed': 'فرد المثبتات', unfolded: 'فتح الرافعة من وضع النقل', slewed: 'التدوير 60° على الأقل',
      hooked: 'ربط الخطاف بالحمولة', lifted: 'رفع الحمولة (> 0.3 م)', 'over-target': 'الحمولة فوق منصة الإنزال', 'landed-on-target': 'إنزال الحمولة على المنصة',
      released: 'فك الحمولة', stowed: 'إعادة الرافعة لوضع النقل', 'stab-stowed': 'طي المثبتات',
    } as Record<CraneCheckId, string>,
    events: {
      'lmi-warn': 'تحذير العزم: الاقتراب من الحمولة المقننة', 'lmi-limit': 'بلوغ حد العزم — قطع الحركات التي تزيد العزم', 'hard-landing': 'هبوط عنيف!',
      'load-lifted': 'تم رفع الحمولة', 'hooked-on': 'تم ربط الخطاف', released: 'تم فك الحمولة', 'release-suspended': 'لا يمكن فك حمولة معلقة — أنزلها أولاً',
      'hook-too-far': 'الخطاف بعيد عن نقطة الرفع', 'stab-deployed': 'تم فرد المثبتات', 'stab-stowed': 'تم طي المثبتات',
      'stab-stow-blocked': 'اطوِ الرافعة (وفك الخطاف) قبل رفع المثبتات',
    } as Record<string, string>,
    hint: 'اسحب الأذرع أو استخدم المفاتيح. ذراع التحكم: العصا اليسرى = التدوير / الذراع الرئيسية، اليمنى = الامتدادات / الذراع الخارجية.',
  },
};

/** Simple line pictograms in the style of the yellow Fassi lever labels. */
const Pictogram: React.FC<{ joint: CraneJoint }> = ({ joint }) => (
  <svg viewBox="0 0 48 32" className="w-12 h-8" stroke="#111" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
    {joint === 'slew' && (<><ellipse cx="24" cy="22" rx="16" ry="6" /><path d="M24 22 V8 L38 6" /><path d="M8 20 l-3 -3 M8 20 l4 -1" /></>)}
    {joint === 'main' && (<><path d="M8 28 V18 L30 6 L40 14" /><path d="M10 22 L22 13" strokeWidth={4} /></>)}
    {joint === 'outer' && (<><path d="M8 28 V18 L24 8 L42 18" /><path d="M24 8 l6 -4" strokeWidth={4} /></>)}
    {joint === 'extension' && (<><path d="M6 20 H26" strokeWidth={5} /><path d="M26 20 H42" strokeWidth={3} /><path d="M34 12 l6 8 l-6 8" /></>)}
  </svg>
);

/** Spring-return proportional lever. Drag up = +, down = −. Shows the combined live input. */
const Lever: React.FC<{ joint: CraneJoint; value: number; blocked: boolean }> = ({ joint, value, blocked }) => {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const setFromEvent = (clientY: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const v = -((clientY - (r.top + r.height / 2)) / (r.height / 2));
    craneStore.setLever(joint, Math.max(-1, Math.min(1, v)));
  };
  const release = () => { setDragging(false); craneStore.setLever(joint, 0); };
  const pos = Math.max(-1, Math.min(1, value));
  return (
    <div
      ref={track}
      className={`relative h-36 w-10 mx-auto rounded-full bg-zinc-800 border ${blocked ? 'border-red-500' : 'border-zinc-600'} touch-none select-none cursor-grab`}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); setFromEvent(e.clientY); }}
      onPointerMove={(e) => { if (dragging) setFromEvent(e.clientY); }}
      onPointerUp={release}
      onPointerCancel={release}
      role="slider"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={Number(pos.toFixed(2))}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 w-1.5 bg-zinc-500" style={{ height: `${Math.abs(pos) * 50}%`, transform: `translate(-50%, ${pos > 0 ? '-100%' : '0'})` }} />
      <div
        className="absolute left-1/2 w-8 h-8 rounded-full bg-gradient-to-b from-zinc-700 to-black border border-zinc-500 shadow-lg"
        style={{ top: `calc(${50 - pos * 42}% - 16px)`, transform: 'translateX(-50%)' }}
      />
    </div>
  );
};

interface Props {
  hydraulics: SimulatorState['hydraulics'];
  onUpdateHydraulics: (u: Partial<SimulatorState['hydraulics']>) => void;
}

export const CraneControlPanel: React.FC<Props> = ({ hydraulics, onUpdateHydraulics }) => {
  const { lang, dir } = useT();
  const s = STR[lang === 'ar' ? 'ar' : 'en'];
  const snap = useSyncExternalStore(craneStore.subscribe, craneStore.getSnapshot);
  const [page, setPage] = useState(0);
  const st = snap.state;
  const load = st.load;
  const suspendedKg = load?.attached && !load.landed ? load.def.massKg : 0;

  // Keyboard: capture phase so the MG console bindings (E = engine, R = run…) don't also fire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const down = e.type === 'keydown';
      if (e.code === 'KeyH') {
        if (down && !e.repeat) { const l = craneStore.getSnapshot().state.load; if (l?.attached) craneStore.hookOff(); else craneStore.hookOn(); }
        e.preventDefault(); e.stopImmediatePropagation();
        return;
      }
      if (craneStore.handleKey(e.code, down)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); };
  }, []);

  const blockedMsgs = Array.from(new Set(Object.values(st.blocked))).filter(Boolean) as Array<keyof typeof s.blocked>;
  const led = (on: boolean, color: string) => <span className={`inline-block w-3 h-3 rounded-full border border-black/40 ${on ? color : 'bg-zinc-700'}`} />;
  const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;
  const secs = (snap.progress.completedAt ?? st.time) - snap.progress.startedAt;
  const capacity = ratedCapacityAt(snap.spec, Math.max(st.radius, 1));

  const lcd = [
    [`LMI ${Math.round(st.lmiPercent)}%`, `${s.load} ${(suspendedKg / 1000).toFixed(2)} t`],
    [`${s.radius} ${st.radius.toFixed(1)} m`, `${s.cap} ${(capacity / 1000).toFixed(2)} t`],
    [`SL ${deg(st.joints.slew)} MB ${deg(st.joints.main)}`, `OB ${deg(st.joints.outer)} EX ${st.joints.extension.toFixed(1)}m`],
  ][page];

  return (
    <div dir={dir} className="rounded-xl bg-zinc-900 text-zinc-100 p-3 space-y-3 border border-zinc-700">
      <div className="text-xs font-bold tracking-wide text-zinc-300">{s.title}</div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
        {/* Fassi FX display */}
        <div className="rounded-lg bg-yellow-400 p-3 text-zinc-900 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 items-center">
              {led(st.powerAvailable, 'bg-green-500')}
              {led(st.lmiState === 'ok' && st.powerAvailable, 'bg-green-400')}
              {led(st.lmiState === 'warn', 'bg-yellow-200 animate-pulse')}
              {led(st.lmiState === 'limit', 'bg-red-600 animate-pulse')}
            </div>
            <span className="text-3xs font-black text-red-700">FASSI</span>
          </div>
          <div className="mt-2 rounded bg-[#b9c4a8] border-2 border-zinc-700 px-3 py-2 font-mono text-sm leading-tight min-w-[220px]">
            <div className="flex justify-between"><span>{lcd[0]}</span><span className="text-3xs">{s.page} {page + 1}/3</span></div>
            <div>{lcd[1]}</div>
            <div className="mt-1 h-2 bg-zinc-600/40 rounded overflow-hidden">
              <div className={`h-full ${st.lmiState === 'limit' ? 'bg-red-700' : st.lmiState === 'warn' ? 'bg-amber-600' : 'bg-zinc-800'}`} style={{ width: `${Math.min(100, st.lmiPercent)}%` }} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="px-2 py-1 rounded bg-zinc-800 text-yellow-300 text-xs" onClick={() => setPage((p) => (p + 2) % 3)}>◀</button>
            <button type="button" className="px-2 py-1 rounded bg-zinc-800 text-yellow-300 text-xs" onClick={() => setPage(0)}>%</button>
            <button type="button" className="px-2 py-1 rounded bg-zinc-800 text-yellow-300 text-xs" onClick={() => setPage((p) => (p + 1) % 3)}>▶</button>
            <button type="button" className="px-2 py-1 rounded bg-zinc-800 text-yellow-300 text-xs" onClick={() => (load?.attached ? craneStore.hookOff() : craneStore.hookOn())}>OK</button>
            <button
              type="button"
              onClick={() => craneStore.toggleEstop()}
              className={`ms-auto w-14 h-14 rounded-full border-4 border-yellow-300 font-black text-2xs text-white shadow-lg ${st.estop ? 'bg-red-900 translate-y-0.5' : 'bg-red-600 hover:bg-red-500'}`}
              aria-pressed={st.estop}
            >
              {s.estop}
            </button>
          </div>
        </div>

        {/* Power pack + stabilizers + hook */}
        <div className="space-y-2 text-2xs min-w-[200px]">
          <div className="font-bold text-zinc-400">{s.power}</div>
          <div className="flex gap-2">
            <button type="button" className={`flex-1 px-2 py-1.5 rounded font-semibold ${hydraulics.engineRunning ? 'bg-emerald-600' : 'bg-zinc-700'}`}
              onClick={() => onUpdateHydraulics({ engineRunning: !hydraulics.engineRunning, engineRpm: hydraulics.engineRunning ? 0 : 1100 })}>
              {s.engine}: {hydraulics.engineRunning ? s.on : s.off}
            </button>
            <button type="button" className={`flex-1 px-2 py-1.5 rounded font-semibold ${hydraulics.ptoEngaged ? 'bg-emerald-600' : 'bg-zinc-700'}`}
              onClick={() => onUpdateHydraulics({ ptoEngaged: !hydraulics.ptoEngaged })}>
              {s.pto}: {hydraulics.ptoEngaged ? s.on : s.off}
            </button>
          </div>
          <div className="font-bold text-zinc-400">{s.stab} — {Math.round(st.stabilizers * 100)}%</div>
          <div className="h-1.5 bg-zinc-700 rounded"><div className="h-full bg-amber-400 rounded" style={{ width: `${st.stabilizers * 100}%` }} /></div>
          <div className="flex gap-2">
            <button type="button" className="flex-1 px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={() => craneStore.deployStabilizers()}>{s.deploy}</button>
            <button type="button" className="flex-1 px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={() => craneStore.stowStabilizers()}>{s.stow}</button>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!load || load.attached} className="flex-1 px-2 py-1.5 rounded bg-amber-600 disabled:opacity-40" onClick={() => craneStore.hookOn()}>{s.hookOn} (H)</button>
            <button type="button" disabled={!load?.attached} className="flex-1 px-2 py-1.5 rounded bg-amber-600 disabled:opacity-40" onClick={() => craneStore.hookOff()}>{s.release} (H)</button>
          </div>
        </div>
      </div>

      {st.estop && <div className="rounded bg-red-700 px-3 py-1.5 text-xs font-bold text-center">{s.estopOn}</div>}
      {blockedMsgs.map((b) => <div key={b} className="rounded bg-amber-500/20 border border-amber-500 px-3 py-1 text-2xs text-amber-200">{s.blocked[b]}</div>)}

      {/* Lever bank */}
      <div className="grid grid-cols-4 gap-2">
        {CRANE_JOINTS.map((j, i) => (
          <div key={j} className="text-center space-y-1">
            <div className="rounded bg-yellow-400 text-zinc-900 px-1 py-1 flex flex-col items-center">
              <Pictogram joint={j} />
              <span className="text-3xs font-bold leading-tight">{s.levers[i]}</span>
            </div>
            <div className="text-3xs text-zinc-400">▲ {s.plus[i]} <kbd className="font-mono">{CRANE_KEYS[j][0].replace('Key', '')}</kbd></div>
            <Lever joint={j} value={snap.inputs[j]} blocked={!!st.blocked[j]} />
            <div className="text-3xs text-zinc-400">▼ {s.minus[i]} <kbd className="font-mono">{CRANE_KEYS[j][1].replace('Key', '')}</kbd></div>
          </div>
        ))}
      </div>
      <p className="text-3xs text-zinc-500">{s.hint}</p>

      {/* Task */}
      <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold text-zinc-300">{s.task}</span>
          <select className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-2xs" value={snap.task.id} onChange={(e) => craneStore.setTask(e.target.value)}>
            {CRANE_TASKS.map((t) => <option key={t.id} value={t.id}>{t.title[lang === 'ar' ? 'ar' : 'en']}</option>)}
          </select>
          <button type="button" className="px-2 py-1 rounded bg-zinc-700 text-2xs" onClick={() => craneStore.reset()}>{s.reset}</button>
        </div>
        <p className="text-2xs text-zinc-300">{snap.task.brief[lang === 'ar' ? 'ar' : 'en']}</p>
        <ol className="space-y-0.5 text-2xs">
          {snap.task.checks.map((c, i) => (
            <li key={c} className={i < snap.progress.checkIndex ? 'text-emerald-400' : i === snap.progress.checkIndex ? 'text-yellow-300 font-semibold' : 'text-zinc-500'}>
              {i < snap.progress.checkIndex ? '✔' : i === snap.progress.checkIndex ? '▶' : '○'} {s.checks[c]}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-3xs font-mono pt-1 border-t border-zinc-700">
          <div>{s.time}<div className="text-zinc-100 text-2xs">{Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, '0')}</div></div>
          <div>{s.maxLmi}<div className="text-zinc-100 text-2xs">{Math.round(snap.progress.maxLmi)}%</div></div>
          <div>{s.limitHits}<div className="text-zinc-100 text-2xs">{snap.progress.lmiLimitHits}</div></div>
          <div>{s.hard}<div className="text-zinc-100 text-2xs">{snap.progress.hardLandings}</div></div>
          <div>{s.swing}<div className="text-zinc-100 text-2xs">{snap.progress.maxSwingDeg.toFixed(1)}°</div></div>
          <div>{s.accuracy}<div className="text-zinc-100 text-2xs">{snap.progress.landingError === null ? '—' : `${snap.progress.landingError.toFixed(2)} m`}</div></div>
        </div>
        {snap.progress.completed && (
          <div className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold flex justify-between">
            <span>{s.done}</span><span>{s.score}: {snap.score}/100</span>
          </div>
        )}
        <ul className="text-3xs font-mono space-y-0.5 max-h-24 overflow-y-auto">
          {[...st.events].reverse().map((e, i) => (
            <li key={`${e.t}-${i}`} className={e.kind === 'error' ? 'text-red-400' : e.kind === 'warn' ? 'text-amber-300' : 'text-zinc-400'}>
              {e.t.toFixed(1)}s — {s.events[e.code] ?? e.code}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
