import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalPanelLightsSwitchProps {
  id?: string;
  letterLabel?: string; // 'D'
  isOn: boolean;
  onToggle: () => void;
}

export const PhysicalPanelLightsSwitch: React.FC<PhysicalPanelLightsSwitchProps> = ({
  id = 'ctrl-panel-lights',
  letterLabel = 'D',
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
          PANEL LIGHTS
        </span>
      </div>

      {/* Small Rotary Switch with Metal Escutcheon */}
      <button
        type="button"
        onClick={handleClick}
        className="relative my-1 w-12 h-14 rounded bg-slate-200 border border-slate-400 shadow flex flex-col items-center justify-center cursor-pointer group focus:outline-none"
        title="Toggle Operator Console Night Lights"
      >
        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow-inner">
          <div
            style={{
              transform: isOn ? 'rotate(45deg)' : 'rotate(-45deg)',
              transition: 'transform 0.12s ease-out',
            }}
            className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center"
          >
            <div className={`w-1 h-3 rounded-full ${isOn ? 'bg-amber-300 shadow-[0_0_6px_#fde047]' : 'bg-slate-500'}`} />
          </div>
        </div>
      </button>

      {/* Status */}
      <div
        className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase border transition-colors ${
          isOn
            ? 'bg-amber-100 border-amber-500 text-amber-900'
            : 'bg-slate-200 border-slate-400 text-slate-600'
        }`}
      >
        {isOn ? 'LIGHTS ON' : 'LIGHTS OFF'}
      </div>
    </div>
  );
};
