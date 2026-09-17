import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalChainOilerSwitchProps {
  id?: string;
  letterLabel?: string; // 'K'
  isOn: boolean;
  onToggle: () => void;
}

export const PhysicalChainOilerSwitch: React.FC<PhysicalChainOilerSwitchProps> = ({
  id = 'ctrl-chain-oiler',
  letterLabel = 'K',
  isOn,
  onToggle,
}) => {
  const handleClick = () => {
    soundManager.playMetalTap();
    onToggle();
  };

  return (
    <div id={id} className="flex flex-col items-center select-none text-slate-800">
      {/* Engraved Header */}
      <div className="flex items-center justify-center gap-1 mb-1 text-center">
        {letterLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
            {letterLabel}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-800 leading-tight">
          CHAIN OILER
        </span>
      </div>

      {/* Brass Hex Nut and Teardrop Bat Switch */}
      <button
        type="button"
        onClick={handleClick}
        className="relative my-1 w-20 h-16 flex items-center justify-between p-1 cursor-pointer group focus:outline-none"
        title="Toggle automatic chain lubrication pump"
      >
        {/* State Label: ON */}
        <span className={`text-[8.5px] font-mono font-bold ${isOn ? 'text-emerald-700 font-black' : 'text-slate-500'}`}>
          ON
        </span>

        {/* Brass Hex Mounting Nut */}
        <div className="relative w-9 h-9 rounded-sm bg-gradient-to-tr from-amber-600 via-amber-300 to-amber-600 border border-amber-700 shadow-md flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
            {/* Black Teardrop Toggle Handle */}
            <div
              style={{
                transform: isOn ? 'rotate(-30deg) translateX(-4px)' : 'rotate(30deg) translateX(4px)',
                transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              className="w-4 h-8 rounded-full bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-slate-600 shadow-xl flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>
        </div>

        {/* State Label: OFF */}
        <span className={`text-[8.5px] font-mono font-bold ${!isOn ? 'text-slate-800 font-black' : 'text-slate-500'}`}>
          OFF
        </span>
      </button>

      {/* Status Badge */}
      <div
        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-colors ${
          isOn
            ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
            : 'bg-slate-200 border-slate-400 text-slate-600'
        }`}
      >
        {isOn ? 'OILER ACTIVE' : 'OILER OFF'}
      </div>
    </div>
  );
};
