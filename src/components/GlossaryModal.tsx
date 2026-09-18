/**
 * GlossaryModal — a plain-English dictionary of the oilfield jargon used in the
 * simulator, so trainees and non-technical users can look up any term.
 */
import React, { useState } from 'react';
import { X, BookMarked, Search } from 'lucide-react';
import { useT } from '../i18n';

interface Props {
  onClose: () => void;
}

interface Term {
  term: string;
  short: string;   // quick plain-English meaning
  detail: string;  // a little more
  category: string;
}

const TERMS: Term[] = [
  { term: 'RIH', category: 'Movement', short: 'Run In Hole — lower the rods DOWN into the well.', detail: 'You start at the surface (0 ft) and feed continuous rod down toward the bottom of the well.' },
  { term: 'POOH', category: 'Movement', short: 'Pull Out Of Hole — pull the rods UP out of the well.', detail: 'You start deep and reel the continuous rod back up to surface.' },
  { term: 'FREE / Free Trip', category: 'Movement', short: 'Working somewhere in the middle of the well.', detail: 'Neither at surface nor bottom — a mid-well starting point (about 2,250 ft).' },
  { term: 'Trip', category: 'Movement', short: 'Moving the rod string in or out of the well.', detail: '“Tripping in” = going down (RIH). “Tripping out” = coming up (POOH).' },

  { term: 'Engine', category: 'Power', short: 'The diesel engine that powers everything.', detail: 'It drives the hydraulic pumps. Nothing moves until it’s running.' },
  { term: 'PTO', category: 'Power', short: 'Power Take-Off — sends engine power to the hydraulics.', detail: 'Like putting the truck “in gear” for work. Engine can run with PTO off (idle).' },
  { term: 'RPM', category: 'Power', short: 'Engine speed (revolutions per minute).', detail: 'Higher RPM = more hydraulic flow/power. Typical working range ~1000–1300.' },
  { term: 'Charge Pressure', category: 'Power', short: 'The “feed” pressure that keeps the hydraulic system primed.', detail: 'If it drops below ~250 psi the brake can’t hold the rods and they can free-fall (freewheel). Keep it healthy.' },
  { term: 'System Pressure', category: 'Power', short: 'The main working hydraulic pressure.', detail: 'Powers the gripper, drive and other functions (up to ~2,500 psi).' },

  { term: 'Gripper / Injector', category: 'Gripper', short: 'The head that grips the rod and pushes/pulls it.', detail: 'Two chain-driven gripper blocks squeeze the rod and drive it in or out of the well.' },
  { term: 'Squeeze Pressure', category: 'Gripper', short: 'How hard the gripper clamps the rod.', detail: 'Too little and the rod slips; too much and you damage it. It’s matched to the rod weight.' },
  { term: 'Chain Tension', category: 'Gripper', short: 'Tension on the gripper drive chains.', detail: 'Keeps the drive chains snug so the gripper grabs evenly (typ. 100–200 psi).' },
  { term: 'Gripper Brake', category: 'Gripper', short: 'Holds the gripper still so the rod can’t move.', detail: 'Set it when you want the string to stay put.' },
  { term: 'Safety Lever / Clamp', category: 'Gripper', short: 'A backup that locks the rod if something fails.', detail: 'Your first move in a free-fall emergency — slam it DOWN.' },
  { term: 'Picker / Knuckle Picker', category: 'Gripper', short: 'An arm that guides/handles the rod at surface.', detail: 'Helps line the rod up as it enters or leaves the gripper.' },

  { term: 'BOP', category: 'Well Control', short: 'Blow-Out Preventer — the well’s big safety valve.', detail: 'Can seal the well around the rod to contain pressure. “Closed” = sealed.' },
  { term: 'Wellhead', category: 'Well Control', short: 'The equipment at the top of the well.', detail: 'Where the BOP and flow tee sit; the rod passes through it into the ground.' },
  { term: 'Flow Tee / Kill Valve', category: 'Well Control', short: 'A valve to route or kill well flow.', detail: 'Used to control fluids coming from the well.' },
  { term: 'Hand Pump', category: 'Well Control', short: 'A manual pump to close the BOP if power is lost.', detail: 'Stroke it repeatedly to build enough pressure to seal the well by hand.' },

  { term: 'Depth', category: 'Readouts', short: 'How far the rod string reaches into the well (ft).', detail: '0 ft = surface. Deeper = more rod in the hole and more weight.' },
  { term: 'Hookload / String Weight', category: 'Readouts', short: 'The total weight of rod hanging in the well.', detail: 'Grows as you run deeper. The gripper must hold this weight.' },
  { term: 'Up / Down Pressure', category: 'Readouts', short: 'The drive pressure that pushes the rod out (Up) or in (Down).', detail: 'More pressure = more force to move the string in that direction.' },

  { term: 'MG Unit', category: 'Equipment', short: 'Mobile Gripper Unit — the truck with the console.', detail: 'Carries the gripper/injector, hydraulics and the operator’s control console.' },
  { term: 'Pulling Unit', category: 'Equipment', short: 'The workover rig with the tall mast.', detail: 'Its mast + drawworks lift and support the gripper over the wellhead.' },
  { term: 'Reel / Service Reel', category: 'Equipment', short: 'The big spool that holds the continuous rod.', detail: 'The rod pays off the reel, over a guide, and into the gripper.' },
  { term: 'JSA', category: 'Safety', short: 'Job Safety Analysis — the pre-job safety review.', detail: 'Identifies hazards and controls before work starts. “You have the power to stop the job.”' },
  { term: 'E-Stop', category: 'Safety', short: 'Emergency Stop — halts everything instantly.', detail: 'Hit it whenever something is wrong. Reset only when safe.' },
];

const CATEGORIES = ['Movement', 'Power', 'Gripper', 'Well Control', 'Readouts', 'Equipment', 'Safety'];

export const GlossaryModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useT();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (t: Term) => !query || t.term.toLowerCase().includes(query) || t.short.toLowerCase().includes(query) || t.detail.toLowerCase().includes(query);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 bg-slate-100">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-800">{t('glossary.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-2 border-b border-slate-300 bg-slate-100/60">
          <div className="flex items-center gap-1 bg-slate-200 rounded-md px-2 py-1">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('glossary.searchPlaceholder')} className="bg-transparent outline-none text-2xs text-slate-700 w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {CATEGORIES.map((cat) => {
            const rows = TERMS.filter((t) => t.category === cat && match(t));
            if (!rows.length) return null;
            return (
              <div key={cat} className="mb-3">
                <div className="sticky top-0 bg-white py-1 text-eyebrow font-semibold text-blue-700/80 border-b border-slate-300 z-10">{cat}</div>
                {rows.map((t) => (
                  <div key={t.term} className="py-2 border-b border-slate-300/60">
                    <div className="text-2xs font-semibold text-slate-800">{t.term}</div>
                    <div className="text-2xs text-emerald-700">{t.short}</div>
                    <div className="text-2xs text-slate-500 mt-0.5">{t.detail}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
