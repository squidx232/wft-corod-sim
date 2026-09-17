import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalWingBleedValveProps {
  id?: string;
  letterLabel?: string; // 'N' or 'X'
  label: string; // 'BOP BLEED' or 'SAFETY BLEED'
  isOpen: boolean;
  onToggle: () => void;
}

export const PhysicalWingBleedValve: React.FC<PhysicalWingBleedValveProps> = ({
  id,
  letterLabel,
  label,
  isOpen,
  onToggle,
}) => {
  const handleClick = () => {
    if (!isOpen) {
      soundManager.playHiss(0.6);
    } else {
      soundManager.playMetalTap();
    }
    onToggle();
  };

  return (
    <div id={id} className="flex flex-col items-center select-none text-slate-800">
      {/* Curved Arc Label: OPEN <--- ---> CLOSE */}
      <div className="flex items-center justify-between w-full px-1 text-[8px] font-bold font-mono tracking-tighter text-slate-700">
        <span>◀ OPEN</span>
        <span>CLOSE ▶</span>
      </div>

      {/* Stainless Steel Wing Cock / T-Handle Valve */}
      <button
        type="button"
        onClick={handleClick}
        className="relative my-2 w-20 h-20 flex flex-col items-center justify-center cursor-pointer group focus:outline-none"
        title={`Click to ${isOpen ? 'close' : 'open'} ${label}`}
      >
        {/* Hex Jam Nut Base */}
        <div className="w-9 h-9 rounded-sm bg-gradient-to-tr from-slate-400 via-slate-200 to-slate-400 border border-slate-500 shadow-md flex items-center justify-center transform rotate-45">
          {/* Threaded Stem */}
          <div className="w-5 h-5 rounded-full bg-slate-300 border border-slate-500 shadow-inner flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />
          </div>
        </div>

        {/* Wing / T-Bar Handle */}
        <div
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          className="absolute z-10 w-16 h-5 rounded-md bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 border-2 border-slate-500 shadow-xl flex items-center justify-between px-1"
        >
          {/* Wing grip lobes */}
          <div className="w-3.5 h-4 rounded bg-slate-400 border border-slate-500" />
          <div className="w-3.5 h-3.5 rounded-full bg-slate-600 border border-slate-300 shadow-inner" />
          <div className="w-3.5 h-4 rounded bg-slate-400 border border-slate-500" />
        </div>
      </button>

      {/* Engraved Label Below */}
      <div className="flex items-center gap-1 mt-0.5">
        {letterLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
            {letterLabel}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-800">
          {label}
        </span>
      </div>

      {/* Status Badge */}
      <div
        className={`mt-1 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition-colors ${
          isOpen
            ? 'bg-amber-100 border-amber-600 text-amber-900 shadow-sm animate-pulse'
            : 'bg-slate-200 border-slate-400 text-slate-700'
        }`}
      >
        {isOpen ? 'OPEN (BLEEDING)' : 'CLOSED (SEALED)'}
      </div>
    </div>
  );
};
