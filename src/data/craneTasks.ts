import type { CraneLoadDef } from '../crane/craneSim';

/**
 * Knuckle-crane training tasks. Positions are RELATIVE to the crane's slew
 * axis: `along` = metres toward the wellhead (+X), `out` = metres outward
 * from the truck on the crane's side. The store resolves them to world XZ once
 * the crane is mounted, so tasks stay valid if the truck model changes.
 */

export interface CraneTaskPlacement { along: number; out: number }

export type CraneCheckId =
  | 'power'
  | 'stab-deployed'
  | 'unfolded'
  | 'slewed'
  | 'hooked'
  | 'lifted'
  | 'over-target'
  | 'landed-on-target'
  | 'released'
  | 'stowed'
  | 'stab-stowed';

export interface CraneTask {
  id: string;
  title: { en: string; ar: string };
  brief: { en: string; ar: string };
  load?: Omit<CraneLoadDef, 'start'> & { start: CraneTaskPlacement };
  target?: CraneTaskPlacement & { radius: number };
  /** Ordered checklist the trainee must complete. */
  checks: CraneCheckId[];
}

const FULL_LIFT: CraneCheckId[] = [
  'power', 'stab-deployed', 'unfolded', 'hooked', 'lifted', 'over-target', 'landed-on-target', 'released', 'stowed', 'stab-stowed',
];

export const CRANE_TASKS: CraneTask[] = [
  {
    id: 'familiarisation',
    title: { en: 'Familiarisation — unfold, slew and stow', ar: 'التعرّف — الفتح والتدوير والطي' },
    brief: {
      en: 'Start the MG engine and engage hydraulics, deploy the stabilizers, unfold the crane, slew at least 60°, then return the crane to its transport position and stow the stabilizers.',
      ar: 'شغّل محرك وحدة MG وفعّل الهيدروليك، افرد المثبتات، افتح الرافعة، دوّرها 60° على الأقل، ثم أعدها لوضع النقل واطوِ المثبتات.',
    },
    checks: ['power', 'stab-deployed', 'unfolded', 'slewed', 'stowed', 'stab-stowed'],
  },
  {
    id: 'tool-basket',
    title: { en: 'Tool basket to landing mat (450 kg)', ar: 'سلة الأدوات إلى منصة الإنزال (450 كغ)' },
    brief: {
      en: 'Hook on to the tool basket beside the truck and set it down inside the yellow landing mat. Keep the load low and the swing under control; land it gently before releasing.',
      ar: 'اربط الخطاف بسلة الأدوات بجانب الشاحنة وأنزلها داخل منصة الإنزال الصفراء. أبقِ الحمولة منخفضة وتحكم في التأرجح وأنزلها بلطف قبل الفك.',
    },
    load: {
      id: 'tool-basket',
      label: { en: 'Tool basket', ar: 'سلة الأدوات' },
      massKg: 450,
      size: [1.2, 0.7, 0.9],
      color: 0xfacc15,
      kind: 'basket',
      start: { along: 2.6, out: 4.4 },
    },
    target: { along: -3.6, out: 5.0, radius: 0.6 },
    checks: FULL_LIFT,
  },
  {
    id: 'lubricator',
    title: { en: 'Lubricator section to far stand (1,700 kg)', ar: 'قسم المزلّق إلى الحامل البعيد (1,700 كغ)' },
    brief: {
      en: 'Move the lubricator section out to the far landing mat toward the wellhead. At that radius you will be close to the load chart: watch the LMI, keep extensions in as long as possible and move smoothly.',
      ar: 'انقل قسم المزلّق إلى منصة الإنزال البعيدة باتجاه رأس البئر. عند هذا البعد ستقترب من حدود جدول الأحمال: راقب محدد العزم وأبقِ الامتدادات مطوية قدر الإمكان وتحرك بسلاسة.',
    },
    load: {
      id: 'lubricator',
      label: { en: 'Lubricator section', ar: 'قسم المزلّق' },
      massKg: 1700,
      size: [2.2, 0.55, 0.55],
      color: 0x64748b,
      kind: 'lubricator',
      start: { along: 1.4, out: 3.6 },
    },
    target: { along: 5.0, out: 6.6, radius: 0.7 },
    checks: FULL_LIFT,
  },
  {
    id: 'injector-overload',
    title: { en: 'Spare injector head — load chart awareness (3,000 kg)', ar: 'رأس حاقن احتياطي — الوعي بجدول الأحمال (3,000 كغ)' },
    brief: {
      en: 'Lift the spare injector head and set it on the landing mat. The mat is close in — if you reach out too far the LMI will cut moment-increasing functions (main boom down, extension out). Recover by booming up / retracting, never by forcing the lever.',
      ar: 'ارفع رأس الحاقن الاحتياطي وضعه على منصة الإنزال القريبة. إذا مددت الذراع بعيداً سيقطع محدد العزم الحركات التي تزيد العزم (خفض الذراع الرئيسية، مدّ الامتداد). تعافَ برفع الذراع أو سحب الامتداد، ولا تضغط على الذراع بالقوة.',
    },
    load: {
      id: 'injector-spare',
      label: { en: 'Spare injector head', ar: 'رأس حاقن احتياطي' },
      massKg: 3000,
      size: [1.3, 1.6, 1.1],
      color: 0xb91c1c,
      kind: 'injector',
      start: { along: 2.3, out: 3.4 },
    },
    target: { along: 0.2, out: 4.9, radius: 0.7 },
    checks: FULL_LIFT,
  },
];
