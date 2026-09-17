import React from 'react';
import { soundManager } from '../utils/audio';
import { ShieldAlert } from 'lucide-react';

interface PhysicalSafetyLeverProps {
  id: string;
  isEngaged: boolean; // true = DOWN = ON, false = UP = OFF
  onChange: (engaged: boolean) => void;
}

export const PhysicalSafetyLever: React.FC<PhysicalSafetyLeverProps> = ({
  id,
  isEngaged,
  onChange,
}) => {
  const handleToggle = () => {
    soundManager.playMetalTap();
    onChange(!isEngaged);
  };

  return (
    <div
      id={id}
      className={`flex flex-col items-center justify-between p-3.5 rounded-xl border-2 transition-all select-none min-w-[140px] flex-1 ${
        isEngaged
          ? 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-500 shadow-lg shadow-red-950/60'
          : 'bg-slate-900 border-slate-750'
      }`}
    >
      <div className="text-center w-full mb-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-red-400 flex items-center justify-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          4. Rod Safety Clamp
        </span>
        <span className="text-[9px] text-slate-400 font-mono block">
          DOWN = ON (ENGAGED)
        </span>
      </div>

      {/* Heavy Mechanical Lever Assembly */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative my-2 w-20 h-24 flex flex-col items-center justify-between focus:outline-none cursor-pointer"
      >
        {/* Steel Plate with Hazard Stripes */}
        <div className="relative w-16 h-20 rounded-lg bg-gradient-to-b from-slate-900 to-black border-2 border-slate-700 shadow-inner flex flex-col items-center justify-between p-1 overflow-hidden">
          {/* Warning stripes */}
          <div className="absolute inset-x-0 top-0 h-2 bg-stripes-yellow-black opacity-40" />

          <span
            className={`text-[8px] font-black font-mono tracking-widest ${
              !isEngaged ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            UP (OFF)
          </span>

          {/* Pivot & Heavy Lever Arm */}
          <div className="relative w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center">
            {/* The Lever Arm */}
            <div
              style={{
                transform: isEngaged
                  ? 'translateY(12px) rotate(-35deg)'
                  : 'translateY(-12px) rotate(35deg)',
                transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              className="w-5 h-12 rounded-lg bg-gradient-to-b from-red-600 via-red-500 to-red-800 border-2 border-red-300 shadow-xl flex items-center justify-center"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md" />
            </div>
          </div>

          <span
            className={`text-[8px] font-black font-mono tracking-widest ${
              isEngaged ? 'text-red-400 font-bold' : 'text-slate-600'
            }`}
          >
            DOWN (ON)
          </span>
        </div>
      </button>

      {/* Bottom Status Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
          isEngaged
            ? 'bg-red-600 border-red-400 text-white shadow-md'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
        }`}
      >
        {isEngaged ? 'CLAMP ENGAGED' : 'CLAMP OPEN'}
      </button>
    </div>
  );
};
