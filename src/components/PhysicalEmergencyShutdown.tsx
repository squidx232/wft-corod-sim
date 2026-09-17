import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalEmergencyShutdownProps {
  id?: string;
  letterLabel?: string; // 'J'
  isTripped: boolean;
  onTrigger: () => void;
  onReset: () => void;
}

export const PhysicalEmergencyShutdown: React.FC<PhysicalEmergencyShutdownProps> = ({
  id = 'ctrl-emergency-shutdown',
  letterLabel = 'J',
  isTripped,
  onTrigger,
  onReset,
}) => {
  const handleClick = () => {
    soundManager.playMetalTap();
    if (isTripped) {
      onReset();
    } else {
      soundManager.playAirHorn(1.0);
      onTrigger();
    }
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
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-red-700 leading-tight">
          EMERGENCY SHUT-DOWN
        </span>
      </div>

      {/* Red Safety Flip Guard & Switch Assembly */}
      <button
        type="button"
        onClick={handleClick}
        className="relative my-1 w-14 h-20 rounded-md bg-slate-900 border-2 border-slate-700 shadow-xl flex flex-col items-center justify-between p-1 cursor-pointer group focus:outline-none"
        title={isTripped ? 'Click to reset Positive Air Cutoff (Roda Valve)' : 'Click to trigger Positive Air Shutoff'}
      >
        {/* Stainless mounting plate */}
        <div className="absolute inset-1 rounded bg-slate-800 border border-slate-600" />

        {/* Red Molded Spring Flip Cover */}
        <div
          style={{
            transform: isTripped ? 'scaleY(0.7) translateY(-6px)' : 'scaleY(1)',
            transformOrigin: 'top center',
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          className={`relative z-10 w-8 h-12 rounded-sm border-2 shadow-lg flex items-center justify-center ${
            isTripped
              ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400'
              : 'bg-gradient-to-b from-red-700 via-red-600 to-red-900 border-red-500'
          }`}
        >
          {/* Inner Rocker Switch Mechanism */}
          <div
            className={`w-3.5 h-7 rounded-sm ${
              isTripped ? 'bg-black shadow-inner' : 'bg-red-950 border border-red-500'
            }`}
          />
        </div>

        {/* Status Text Below Switch */}
        <span
          className={`relative z-10 text-[8px] font-mono font-black ${
            isTripped ? 'text-red-400 animate-pulse' : 'text-slate-400'
          }`}
        >
          {isTripped ? 'TRIPPED' : 'ARMED'}
        </span>
      </button>

      {/* Status Button Action */}
      <button
        type="button"
        onClick={handleClick}
        className={`mt-1 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase transition-all shadow-sm ${
          isTripped
            ? 'bg-emerald-700 text-white hover:bg-emerald-600 border border-emerald-500'
            : 'bg-red-800 text-white hover:bg-red-700 border border-red-900'
        }`}
      >
        {isTripped ? 'RESET E-STOP' : 'TRIP SHUTDOWN'}
      </button>
    </div>
  );
};
