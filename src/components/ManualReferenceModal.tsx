import React, { useState } from 'react';
import {
  SQUEEZE_PRESSURE_CURVES,
  ROD_SPECIFICATIONS,
  ROD_STRAIGHTENING_TABLE,
  getRecommendedClamp,
} from '../data/manualReference';
import { RodSize, RodGrade } from '../types';
import {
  BookOpen,
  Search,
  Wrench,
  Table as TableIcon,
  ShieldCheck,
  Thermometer,
  Layers,
  HelpCircle,
  X,
} from 'lucide-react';

interface ManualReferenceModalProps {
  onClose: () => void;
}

export const ManualReferenceModal: React.FC<ManualReferenceModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'squeeze' | 'clamps' | 'straightener' | 'weather' | 'tools' | 'glossary'>('squeeze');
  const [calcRodSize, setCalcRodSize] = useState<RodSize>('#6');
  const [calcDepthFt, setCalcDepthFt] = useState<number>(4500);

  // Dynamic Squeeze calculation
  const rodSpec = ROD_SPECIFICATIONS[calcRodSize];
  const stringWeight = calcDepthFt * rodSpec.weightLbsPerFt;
  // Interpolate squeeze
  const matchedCurve = SQUEEZE_PRESSURE_CURVES.find((p) => p.weightLbs >= stringWeight) || SQUEEZE_PRESSURE_CURVES[SQUEEZE_PRESSURE_CURVES.length - 1];
  const recommendedClamp = getRecommendedClamp(calcRodSize, stringWeight);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl p-6 text-slate-100 max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold">
                GL-PCP-OEPS-L4-11 (REV 25)
              </span>
              <h3 className="text-base font-black uppercase text-slate-100">
                Weatherford COROD® Mobile Gripper Reference Manual
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 my-3 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('squeeze')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'squeeze' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Squeeze Curves & Calculator (Fig 248)
          </button>
          <button
            onClick={() => setActiveTab('clamps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'clamps' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rod Clamp Selection (Table 9/10)
          </button>
          <button
            onClick={() => setActiveTab('straightener')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'straightener' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rod Straightener (Table 11)
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'weather' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weather & Humidex (Table 2-5)
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'tools' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tool Inventory (Table 14)
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'glossary' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Glossary (Appendix J)
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* TAB 1: SQUEEZE CALCULATOR */}
          {activeTab === 'squeeze' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold uppercase text-amber-400 block mb-3">
                  Interactive Squeeze Pressure & String Weight Calculator (Figure 248)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Select COROD Size & Shape:
                    </label>
                    <select
                      value={calcRodSize}
                      onChange={(e) => setCalcRodSize(e.target.value as RodSize)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
                    >
                      {Object.keys(ROD_SPECIFICATIONS).map((s) => (
                        <option key={s} value={s}>
                          {s} ({ROD_SPECIFICATIONS[s as RodSize].nominalOd}) - {ROD_SPECIFICATIONS[s as RodSize].shape}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Well Depth: {calcDepthFt} FT ({Math.round(calcDepthFt * 0.3048)} M)
                    </label>
                    <input
                      type="range"
                      min="500"
                      max="10000"
                      step="100"
                      value={calcDepthFt}
                      onChange={(e) => setCalcDepthFt(Number(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 text-center font-mono">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total String Weight</span>
                    <span className="text-lg font-bold text-amber-400">{Math.round(stringWeight).toLocaleString()} lbs</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Min Squeeze Required</span>
                    <span className="text-lg font-bold text-emerald-400">{matchedCurve.minSqueezePsi} psi</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Recommended Clamp</span>
                    <span className="text-xs font-bold text-cyan-300 truncate block mt-1">
                      {recommendedClamp.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Banner */}
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
                <strong>WARNING (Figure 248):</strong> NEVER MOVE COROD WITH LESS THAN 400 PSI SQUEEZE PRESSURE.
                Max standard injector dynamic load: 13,000 lbs (up to 15,000 lbs with 3-part sling upgrade).
              </div>
            </div>
          )}

          {/* TAB 2: ROD CLAMP SELECTION */}
          {activeTab === 'clamps' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-200 block mb-2">
                  Table 9 & 10: Rod Clamp Selection Guidelines
                </span>
                <div className="text-xs text-slate-300 space-y-2">
                  <p>
                    • <strong>0.59" Radius Clamps (Painted RED):</strong> Exclusively for #6R and #8.5R round COROD.
                    Single-bolt rated to 9,800 lbs (#6) / 13,000 lbs (#8.5). Two-bolt rated to 27,600 lbs (#6) / 31,400 lbs (#8.5).
                  </p>
                  <p>
                    • <strong>2.50" Radius Modified Clamps:</strong> For all elliptical COROD and other round sizes (except #8.5R).
                    Single-bolt rated to 9,000 lbs (elliptical) / 8,500 lbs (round). Two-bolt rated to 20,300 lbs (elliptical) / 16,000 lbs (round).
                  </p>
                  <p>
                    • <strong>Torque & Tap Test Rule:</strong> Bolts must be tightened to 500-600 lb-ft (200lb man on 3ft wrench in 3 stages).
                    Mandatory bump test: tap against BOP plate 3 times before releasing from hook!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROD STRAIGHTENER TABLE */}
          {activeTab === 'straightener' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                <span className="text-xs font-bold uppercase text-slate-200 block mb-3">
                  Table 11: Rod Straightening Pressures for Round COROD (psi)
                </span>
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Grade</th>
                      <th>Reel Type</th>
                      <th>#4 (psi)</th>
                      <th>#6 (psi)</th>
                      <th>#8.5 (psi)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {ROD_STRAIGHTENING_TABLE.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-bold text-amber-400">{row.grade}</td>
                        <td>{row.reel}</td>
                        <td>{row.p4 || '-'}</td>
                        <td>{row.p6 || '-'}</td>
                        <td>{row.p85 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: WEATHER & HUMIDEX */}
          {activeTab === 'weather' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <span className="text-xs font-bold uppercase text-slate-200 block mb-2">
                  Extreme Weather & Thermal Management (Section 4.23 & 4.24)
                </span>
                <p>
                  • <strong>Cold Weather Limit:</strong> Never operate hydraulics until fluid is at least 0°C (32°F). Maintain between 0°C and 50°C.
                  At temperatures &lt; -29°C (-20°F) or equivalent wind chill, supervisor assesses operations.
                </p>
                <p>
                  • <strong>High Heat & Overheating:</strong> If hydraulic fluid temperature exceeds 70°C (158°F), the unit MUST BE SHUT DOWN immediately!
                  Switch cooler fan bypass to MANUAL to keep oil cool on hot summer days.
                </p>
                <p>
                  • <strong>30-30 Lightning Rule:</strong> If time between lightning flash and thunder is &lt; 30 seconds, cease operations and seek shelter inside truck cab. Remain sheltered for 30 minutes after last thunder!
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: TOOL INVENTORY */}
          {activeTab === 'tools' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="text-xs font-bold uppercase text-slate-200 block mb-2">
                Table 14: Mobile Gripper Standard Tool Chest
              </span>
              <p>• 18", 24", and 36" Rigid Pipe Wrenches (Never use snipes on aluminum wrenches!)</p>
              <p>• Trico Sucker Rod Wrenches (3/4", 7/8", 1", 1-1/8")</p>
              <p>• 4lb (12" & 18") and 8lb (30") Sledgehammers (Inspect handles daily)</p>
              <p>• Bimetal Hacksaws (Never use torch over wellbore!)</p>
              <p>• GasBadge Personal H2S Detectors (Daily bump test required)</p>
              <p>• 25 Ton Rod Elevators with replaceable plate inserts (1/8" max bail play)</p>
            </div>
          )}

          {/* TAB 6: GLOSSARY */}
          {activeTab === 'glossary' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="text-xs font-bold uppercase text-slate-200 block mb-2">
                Appendix J: Glossary of Terms
              </span>
              <p><strong>BOP:</strong> Blow Out Preventer used to control well pressure during servicing.</p>
              <p><strong>COROD:</strong> Continuous sucker rod with no couplings manufactured by Weatherford.</p>
              <p><strong>Roda Valve:</strong> Emergency positive air cutoff valve on diesel engine intake.</p>
              <p><strong>Y-Tool:</strong> Optical caliper and depthometer measuring rod diameter in X and Y axes.</p>
              <p><strong>RADAR:</strong> Recognize, Approach, Discuss, Agree, Report safety behavioral habit.</p>
              <p><strong>Tag Bar:</strong> Stop bar at bottom of PCP stator where rotor lands (reduces rod weight to zero).</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase"
          >
            Close Manual
          </button>
        </div>
      </div>
    </div>
  );
};
