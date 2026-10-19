import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { craneStore, CRANE_KEYS, LEVER_ORDER } from '../crane/craneStore';
import { CraneJoint, ratedCapacityAt } from '../crane/craneSim';
import { CRANE_TASKS, CraneCheckId } from '../data/craneTasks';
import type { SimulatorState } from '../types';

/**
 * Fassi F215A.0.24 crane control station (matches the MG unit: yellow FX display
 * with LEDs + STOP button above a bank of four proportional levers with yellow
 * pictogram labels). Drives `craneStore`; the 3D viewport steps the sim.
 */

type DirWords = Record<CraneJoint, string>;

const STR = {
  en: {
    title: 'FASSI F215A.0.24 active — Crane control station', power: 'MG power pack', engine: 'Engine', pto: 'PTO / Hydraulics',
    on: 'ON', off: 'OFF', stab: 'MG outriggers (crane stabilizers)', deployAll: 'Deploy all', stowAll: 'Stow all',
    left: 'Left', right: 'Right', extend: 'Extend', retract: 'Retract', lower: 'Lower', raise: 'Raise', ready: 'READY', notReady: 'NOT SET',
    hookOn: 'Hook on', release: 'Release load',
    reset: 'Reset task', task: 'Training task', checklist: 'Checklist', metrics: 'Performance', time: 'Time', maxLmi: 'Max LMI',
    limitHits: 'LMI cut-outs', hard: 'Hard landings', swing: 'Max swing', accuracy: 'Landing error', score: 'Score', done: 'Task complete',
    estop: 'STOP', estopOn: 'E-STOP ENGAGED — twist to release', radius: 'Radius', load: 'Load', cap: 'Rated', page: 'Page',
    keys: 'Keys', leverDown: 'Lever down', leverUp: 'Lever up',
    specs: 'F215A.0.24: 178 kNm · max 9,930 kg · reach 17.05 m · 2,435 kg · folded 2.475 × 0.87 × 2.255 m',
    levers: { slew: 'Slewing', main: 'Main boom', outer: 'Second boom', extension: 'Extensions' } as DirWords,
    plus: { slew: 'Slew left', main: 'Up', outer: 'Up', extension: 'Out' } as DirWords,
    minus: { slew: 'Slew right', main: 'Down', outer: 'Down', extension: 'In' } as DirWords,
    blocked: {
      lmi: 'Load-moment limiter cut-out: only moment-reducing motions allowed (boom up / extensions in).',
      outriggers: 'Extend and lower both MG outriggers before operating the crane.',
      power: 'No hydraulic power: start the MG engine and engage the PTO.', estop: 'Emergency stop engaged.', limit: 'Joint at its mechanical limit.',
      collision: 'Collision: the boom is touching an object — reverse the motion to back away.',
    } as Record<string, string>,
    checks: {
      power: 'Hydraulic power on (engine + PTO)', 'stab-deployed': 'MG outriggers extended and lowered', unfolded: 'Crane unfolded from transport position', slewed: 'Slewed at least 60°',
      hooked: 'Hooked on to the load', lifted: 'Load lifted clear (> 0.3 m)', 'over-target': 'Load over the landing mat', 'landed-on-target': 'Load landed on the mat',
      released: 'Load released', stowed: 'Crane returned to transport position', 'stab-stowed': 'MG outriggers raised and retracted',
    } as Record<CraneCheckId, string>,
    events: {
      'lmi-warn': 'LMI warning: approaching rated capacity', 'lmi-limit': 'LMI limit reached — moment-increasing functions cut', 'hard-landing': 'Hard landing!',
      'load-lifted': 'Load lifted', 'hooked-on': 'Hooked on', released: 'Load released', 'release-suspended': 'Cannot release a suspended load — land it first',
      'hook-too-far': 'Hook too far from the lifting point', 'stab-deployed': 'Outriggers set', 'stab-stowed': 'Outriggers stowed',
      'stab-stow-blocked': 'Fold the crane (and unhook) before raising the outriggers',
      'boom-collision': 'Boom contact', 'load-strike': 'Load struck an object',
    } as Record<string, string>,
    hint: 'Pull a lever DOWN (towards you) for the + motion, push UP for the opposite. Drag the levers or use the keys. Gamepad: left stick = slew / main boom, right stick = extensions / second boom.',
  },
  ar: {
    title: 'FASSI F215A.0.24 active — محطة التحكم بالرافعة', power: 'وحدة الطاقة MG', engine: 'المحرك', pto: 'مأخذ القدرة / الهيدروليك',
    on: 'تشغيل', off: 'إيقاف', stab: 'مساند MG (مثبتات الرافعة)', deployAll: 'فرد الكل', stowAll: 'طي الكل',
    left: 'يسار', right: 'يمين', extend: 'مدّ', retract: 'سحب', lower: 'إنزال', raise: 'رفع', ready: 'جاهزة', notReady: 'غير مثبتة',
    hookOn: 'ربط الخطاف', release: 'فك الحمولة',
    reset: 'إعادة المهمة', task: 'مهمة التدريب', checklist: 'قائمة التحقق', metrics: 'الأداء', time: 'الوقت', maxLmi: 'أقصى عزم',
    limitHits: 'قطع محدد العزم', hard: 'هبوط عنيف', swing: 'أقصى تأرجح', accuracy: 'خطأ الإنزال', score: 'النتيجة', done: 'اكتملت المهمة',
    estop: 'إيقاف', estopOn: 'الإيقاف الطارئ مفعّل — أدر للتحرير', radius: 'نصف القطر', load: 'الحمولة', cap: 'المقنن', page: 'صفحة',
    keys: 'المفاتيح', leverDown: 'الذراع لأسفل', leverUp: 'الذراع لأعلى',
    specs: 'F215A.0.24: ‏178 كيلونيوتن·م · أقصى حمولة 9,930 كغ · مدى 17.05 م · الوزن 2,435 كغ · مطوية 2.475 × 0.87 × 2.255 م',
    levers: { slew: 'التدوير', main: 'الذراع الرئيسية', outer: 'الذراع الثانية', extension: 'الامتدادات' } as DirWords,
    plus: { slew: 'تدوير يسار', main: 'أعلى', outer: 'أعلى', extension: 'مدّ' } as DirWords,
    minus: { slew: 'تدوير يمين', main: 'أسفل', outer: 'أسفل', extension: 'سحب' } as DirWords,
    blocked: {
      lmi: 'قطع محدد العزم: يُسمح فقط بالحركات التي تقلل العزم (رفع الذراع / سحب الامتدادات).',
      outriggers: 'مدّ وأنزل مساندي وحدة MG قبل تشغيل الرافعة.',
      power: 'لا توجد طاقة هيدروليكية: شغّل محرك MG وفعّل مأخذ القدرة.', estop: 'الإيقاف الطارئ مفعّل.', limit: 'المفصل عند حده الميكانيكي.',
      collision: 'تصادم: الذراع تلامس جسماً — اعكس الحركة للابتعاد.',
    } as Record<string, string>,
    checks: {
      power: 'الطاقة الهيدروليكية (محرك + مأخذ قدرة)', 'stab-deployed': 'مدّ وإنزال مساند MG', unfolded: 'فتح الرافعة من وضع النقل', slewed: 'التدوير 60° على الأقل',
      hooked: 'ربط الخطاف بالحمولة', lifted: 'رفع الحمولة (> 0.3 م)', 'over-target': 'الحمولة فوق منصة الإنزال', 'landed-on-target': 'إنزال الحمولة على المنصة',
      released: 'فك الحمولة', stowed: 'إعادة الرافعة لوضع النقل', 'stab-stowed': 'رفع وسحب مساند MG',
    } as Record<CraneCheckId, string>,
    events: {
      'lmi-warn': 'تحذير العزم: الاقتراب من الحمولة المقننة', 'lmi-limit': 'بلوغ حد العزم — قطع الحركات التي تزيد العزم', 'hard-landing': 'هبوط عنيف!',
      'load-lifted': 'تم رفع الحمولة', 'hooked-on': 'تم ربط الخطاف', released: 'تم فك الحمولة', 'release-suspended': 'لا يمكن فك حمولة معلقة — أنزلها أولاً',
      'hook-too-far': 'الخطاف بعيد عن نقطة الرفع', 'stab-deployed': 'تم تثبيت المساند', 'stab-stowed': 'تم طي المساند',
      'stab-stow-blocked': 'اطوِ الرافعة (وفك الخطاف) قبل رفع المساند',
      'boom-collision': 'تلامس الذراع', 'load-strike': 'اصطدام الحمولة بجسم',
    } as Record<string, string>,
    hint: 'اسحب الذراع لأسفل (نحوك) للحركة +، وادفعها لأعلى للحركة المعاكسة. اسحب الأذرع أو استخدم المفاتيح. ذراع التحكم: العصا اليسرى = التدوير / الذراع الرئيسية، اليمنى = الامتدادات / الذراع الثانية.',
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

/** Max lever throw (rad) — matches the 3D valve bank on the MG console. */
const LEVER_THROW = 0.45;
/** The operator looks down at the valve bank from about 35° above. */
const VIEW_ELEV = (35 * Math.PI) / 180;
/** Lever drawing geometry (SVG units): pivot, stem length, view-box height. */
const PX = 40, PY = 132, L = 96, VB_H = 180;

/**
 * Spring-return proportional valve-bank lever, drawn as a real lever seen from
 * the operator position: cast valve section + spool boss, rubber boot, chrome
 * stem and black ball knob. Pulling DOWN (towards the operator) = "+".
 */
const Lever: React.FC<{ joint: CraneJoint; value: number; blocked: boolean; label: string }> = ({ joint, value, blocked, label }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const setFromEvent = (clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Invert the lever projection so the knob follows the pointer.
    const y = ((clientY - r.top) / r.height) * VB_H;
    const c = Math.max(-1, Math.min(1, ((PY - y) * Math.cos(VIEW_ELEV)) / L));
    const v = (Math.acos(c) - VIEW_ELEV) / LEVER_THROW;
    craneStore.setLever(joint, Math.max(-1, Math.min(1, v)));
  };
  const release = () => { setDragging(false); craneStore.setLever(joint, 0); };
  const pos = Math.max(-1, Math.min(1, value));
  const theta = pos * LEVER_THROW; // + = top of the lever tilted towards the operator
  // Projection: screen-up component of a lever tilted θ towards a viewer elevated VIEW_ELEV.
  const tipY = PY - (L * Math.cos(theta + VIEW_ELEV)) / Math.cos(VIEW_ELEV);
  const knobScale = 1 + 0.25 * Math.sin(theta);
  const id = `lv-${joint}`;
  return (
    <svg
      ref={ref}
      viewBox="0 0 80 180"
      className="w-16 h-40 mx-auto touch-none select-none cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); setDragging(true); setFromEvent(e.clientY); }}
      onPointerMove={(e) => { if (dragging) setFromEvent(e.clientY); }}
      onPointerUp={release}
      onPointerCancel={release}
      role="slider"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={Number(pos.toFixed(2))}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1">
          <stop offset="0" stopColor="#3f3f46" /><stop offset="0.45" stopColor="#a1a1aa" /><stop offset="1" stopColor="#27272a" />
        </linearGradient>
        <linearGradient id={`${id}-chrome`} x1="0" x2="1">
          <stop offset="0" stopColor="#71717a" /><stop offset="0.35" stopColor="#f4f4f5" /><stop offset="0.6" stopColor="#d4d4d8" /><stop offset="1" stopColor="#52525b" />
        </linearGradient>
        <radialGradient id={`${id}-knob`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#71717a" /><stop offset="0.25" stopColor="#27272a" /><stop offset="1" stopColor="#000" />
        </radialGradient>
      </defs>
      {/* Travel guide: + (down/towards operator) and − (up) */}
      <text x="72" y="22" fontSize="11" fill="#a1a1aa" textAnchor="middle">−</text>
      <text x="72" y="100" fontSize="11" fill="#a1a1aa" textAnchor="middle">+</text>
      {/* Valve section (cast body with bolts and spool cap) */}
      <rect x="8" y="138" width="64" height="38" rx="4" fill={`url(#${id}-body)`} stroke={blocked ? '#ef4444' : '#18181b'} strokeWidth={blocked ? 2.5 : 1.2} />
      <rect x="8" y="150" width="64" height="6" fill="#18181b" opacity="0.35" />
      {[16, 64].map((x) => <circle key={x} cx={x} cy="168" r="2.6" fill="#d4d4d8" stroke="#3f3f46" />)}
      {/* Pivot boss + rubber boot */}
      <ellipse cx={PX} cy={PY + 6} rx="17" ry="7" fill="#27272a" />
      <path d={`M${PX - 12} ${PY + 6} Q${PX} ${PY - 14 + theta * 10} ${PX + 12} ${PY + 6} Z`} fill="#111" />
      {[0, 1, 2].map((i) => <ellipse key={i} cx={PX} cy={PY + 2 - i * 4} rx={11 - i * 2.4} ry="2.2" fill="none" stroke="#3f3f46" strokeWidth="1" />)}
      {/* Chrome stem */}
      <line x1={PX} y1={PY - 6} x2={PX} y2={tipY} stroke={`url(#${id}-chrome)`} strokeWidth="7" strokeLinecap="round" />
      <line x1={PX - 1.5} y1={PY - 6} x2={PX - 1.5} y2={tipY} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
      {/* Ball knob (closer when pulled → larger) */}
      <g transform={`translate(${PX} ${tipY}) scale(${knobScale})`}>
        <ellipse cx="0" cy="3" rx="15" ry="7" fill="#000" opacity="0.25" />
        <ellipse cx="0" cy="-2" rx="14" ry="15" fill={`url(#${id}-knob)`} stroke="#000" strokeWidth="1" />
        <ellipse cx="-4.5" cy="-8" rx="4" ry="2.6" fill="#fff" opacity="0.35" />
      </g>
    </svg>
  );
};

type Outriggers = SimulatorState['outriggers'];

interface Props {
  hydraulics: SimulatorState['hydraulics'];
  onUpdateHydraulics: (u: Partial<SimulatorState['hydraulics']>) => void;
  /** MG outriggers — they are the crane's stabilizers. */
  outriggers: Outriggers;
  onUpdateOutriggers: (u: Partial<Outriggers>) => void;
}

export const CraneControlPanel: React.FC<Props> = ({ hydraulics, onUpdateHydraulics, outriggers, onUpdateOutriggers }) => {
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

  const blockedMsgs = Array.from(new Set(Object.values(st.blocked))).filter(Boolean) as string[];
  const led = (on: boolean, color: string) => <span className={`inline-block w-3 h-3 rounded-full border border-black/40 ${on ? color : 'bg-zinc-700'}`} />;
  const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;
  const secs = (snap.progress.completedAt ?? st.time) - snap.progress.startedAt;
  const capacity = ratedCapacityAt(snap.spec, Math.max(st.radius, 1));
  /** The outriggers carry the crane: only raise/retract them with the crane folded and unhooked. */
  const guardStow = () => {
    if (craneStore.canStowOutriggers()) return true;
    craneStore.noteOutriggerStowBlocked();
    return false;
  };

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
          <div className="font-bold text-zinc-400 flex items-center justify-between gap-2">
            <span>{s.stab}</span>
            <span className={`px-1.5 rounded text-3xs ${st.outriggersReady ? 'bg-emerald-600' : 'bg-red-700'}`}>{st.outriggersReady ? s.ready : s.notReady}</span>
          </div>
          {(['left', 'right'] as const).map((side) => {
            const ext = side === 'left' ? outriggers.leftExtended : outriggers.rightExtended;
            const low = side === 'left' ? outriggers.leftLowered : outriggers.rightLowered;
            const extKey = side === 'left' ? 'leftExtended' : 'rightExtended';
            const lowKey = side === 'left' ? 'leftLowered' : 'rightLowered';
            return (
              <div key={side} className="flex items-center gap-1.5">
                <span className="w-10 text-zinc-400">{s[side]}</span>
                <button type="button" className={`flex-1 px-1.5 py-1 rounded ${ext ? 'bg-amber-600' : 'bg-zinc-700'} disabled:opacity-40`}
                  disabled={ext && low}
                  onClick={() => {
                    if (ext && !guardStow()) return;
                    onUpdateOutriggers({ [extKey]: !ext } as Partial<Outriggers>);
                  }}>
                  {ext ? s.retract : s.extend}
                </button>
                <button type="button" className={`flex-1 px-1.5 py-1 rounded ${low ? 'bg-amber-600' : 'bg-zinc-700'} disabled:opacity-40`}
                  disabled={!ext}
                  onClick={() => {
                    if (low && !guardStow()) return;
                    onUpdateOutriggers({ [lowKey]: !low } as Partial<Outriggers>);
                  }}>
                  {low ? s.raise : s.lower}
                </button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button type="button" className="flex-1 px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600"
              onClick={() => onUpdateOutriggers({ leftExtended: true, rightExtended: true, leftLowered: true, rightLowered: true })}>{s.deployAll}</button>
            <button type="button" className="flex-1 px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600"
              onClick={() => { if (guardStow()) onUpdateOutriggers({ leftExtended: false, rightExtended: false, leftLowered: false, rightLowered: false }); }}>{s.stowAll}</button>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!load || load.attached} className="flex-1 px-2 py-1.5 rounded bg-amber-600 disabled:opacity-40" onClick={() => craneStore.hookOn()}>{s.hookOn} (H)</button>
            <button type="button" disabled={!load?.attached} className="flex-1 px-2 py-1.5 rounded bg-amber-600 disabled:opacity-40" onClick={() => craneStore.hookOff()}>{s.release} (H)</button>
          </div>
        </div>
      </div>

      {st.estop && <div className="rounded bg-red-700 px-3 py-1.5 text-xs font-bold text-center">{s.estopOn}</div>}
      {blockedMsgs.map((b) => (
        <div key={b} className="rounded bg-amber-500/20 border border-amber-500 px-3 py-1 text-2xs text-amber-200">
          {s.blocked[b] ?? b}{b === 'collision' && st.contact ? ` (${st.contact})` : ''}
        </div>
      ))}

      {/* Lever bank — physical order seen from the operator (left → right): extensions,
          second boom, main boom, slewing. Always laid out LTR to match the machine. */}
      <div dir="ltr" className="grid grid-cols-4 gap-2 rounded-lg bg-zinc-950/60 p-2 border border-zinc-800">
        {LEVER_ORDER.map((j) => {
          const [downKey, upKey] = CRANE_KEYS[j];
          return (
            <div key={j} dir={dir} className="text-center space-y-1">
              <div className="rounded bg-yellow-400 text-zinc-900 px-1 py-1 flex flex-col items-center">
                <Pictogram joint={j} />
                <span className="text-3xs font-bold leading-tight">{s.levers[j]}</span>
              </div>
              <div className="text-3xs text-zinc-400">{s.leverUp} <kbd className="font-mono">{upKey.replace('Key', '')}</kbd>: −{s.minus[j]}</div>
              <Lever joint={j} value={snap.inputs[j]} blocked={!!st.blocked[j]} label={s.levers[j]} />
              <div className="text-3xs text-emerald-300">{s.leverDown} <kbd className="font-mono">{downKey.replace('Key', '')}</kbd>: +{s.plus[j]}</div>
            </div>
          );
        })}
      </div>
      <p className="text-3xs text-zinc-500">{s.specs}</p>
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
              {e.t.toFixed(1)}s — {s.events[e.code] ?? e.code}{e.detail ? ` (${e.detail})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
