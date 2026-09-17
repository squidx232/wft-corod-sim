import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalBopValveProps {
  id?: string;
  letterLabel?: string; // 'O'
  isClosed: boolean; // true = BOP Closed / Engaged, false = BOP Open
  onToggle: () => void;
}

export const PhysicalBopValve: React.FC<PhysicalBopValveProps> = ({
  id = 'ctrl-bop-valve',
  letterLabel = 'O',
  isClosed,
  onToggle,
}) => {
  const handleClick = () => {
    soundManager.playMetalTap();
    onToggle();
  };

  return (
    <div id={id} className="flex flex-col items-center select-none text-slate-800">
      {/* Heavy Red Cast BOP Valve Housing */}
      <div className="relative flex items-center gap-2 my-1">
        <button
          type="button"
          onClick={handleClick}
          className="relative w-20 h-16 rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 border-2 border-red-950 shadow-xl flex items-center justify-between p-2 cursor-pointer group focus:outline-none"
          title={`Click to ${isClosed ? 'Open BOP' : 'Close BOP (Engage Annular Seal)'}`}
        >
          {/* Socket Cap Screws on Corner Flanges */}
          <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700" />
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700" />
          <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700" />
          <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700" />

          {/* Rotary Knob with Black Ball Grip */}
          <div className="relative z-10 w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-700 shadow-md flex items-center justify-center">
            <div
              style={{
                transform: isClosed ? 'rotate(-45deg)' : 'rotate(45deg)',
                transition: 'transform 0.15s ease-out',
              }}
              className="w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center"
            >
              <div className="w-1.5 h-3 bg-red-400 rounded-full" />
            </div>
          </div>

          {/* Side Status Indicator Dial */}
          <div className="w-6 h-10 rounded bg-slate-100 border border-slate-400 flex flex-col items-center justify-between py-1 text-[7.5px] font-mono font-black text-slate-900 shadow-inner">
            <span className={isClosed ? 'text-red-600 font-bold' : 'text-slate-400'}>ON</span>
            <div className="w-3 h-0.5 bg-slate-400" />
            <span className={!isClosed ? 'text-emerald-700 font-bold' : 'text-slate-400'}>OFF</span>
          </div>
        </button>

        {/* Vertical Labels: ON / BOP / OFF */}
        <div className="flex flex-col justify-between h-14 text-[9px] font-mono font-bold text-slate-800">
          <span className={isClosed ? 'text-red-700 font-black' : 'text-slate-500'}>ON</span>
          <span className="text-slate-900 font-black">BOP</span>
          <span className={!isClosed ? 'text-emerald-700 font-black' : 'text-slate-500'}>OFF</span>
        </div>
      </div>

      {/* Engraved Label Below */}
      <div className="flex items-center gap-1 mt-0.5">
        {letterLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
            {letterLabel}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-800">
          BOP (ON/OFF)
        </span>
      </div>

      {/* Status Badge */}
      <div
        className={`mt-1 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition-colors ${
          isClosed
            ? 'bg-red-700 text-white border-red-900 shadow-sm'
            : 'bg-emerald-100 border-emerald-600 text-emerald-900'
        }`}
      >
        {isClosed ? 'CLOSED (PRESSURE ISOLATED)' : 'OPEN (WELL VENTED)'}
      </div>
    </div>
  );
};
