import React from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalSwitchProps {
  id: string;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accentColor?: string;
  onLabel?: string;
  offLabel?: string;
  warning?: boolean;
}

export const PhysicalSwitch: React.FC<PhysicalSwitchProps> = ({
  id,
  label,
  sublabel,
  checked,
  onChange,
  accentColor = '#10b981',
  onLabel = 'ON',
  offLabel = 'OFF',
  warning = false,
}) => {
  const handleToggle = () => {
    soundManager.playMetalTap();
    onChange(!checked);
  };

  return (
    <div
      id={id}
      className="flex flex-col items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-750 shadow-sm text-slate-100 select-none min-w-[120px] flex-1"
    >
      <div className="text-center w-full mb-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 block truncate">
          {label}
        </span>
        {sublabel && (
          <span className="text-[9px] text-slate-400 font-mono block">
            {sublabel}
          </span>
        )}
      </div>

      {/* Industrial Toggle Switch Assembly */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative my-2 w-16 h-20 flex flex-col items-center justify-between focus:outline-none group cursor-pointer"
      >
        {/* Hex Mounting Nut & Escutcheon Plate */}
        <div className="relative w-12 h-16 rounded-md bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-600 shadow-inner flex flex-col items-center justify-between p-1">
          <span className="text-[8px] font-bold text-slate-400 font-mono">ON</span>

          {/* Hex nut center */}
          <div className="relative w-7 h-7 rounded-sm bg-slate-400 border border-slate-600 shadow-md flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
              {/* Toggle Bat Lever */}
              <div
                style={{
                  transform: checked
                    ? 'translateY(-8px) rotate(-18deg)'
                    : 'translateY(8px) rotate(18deg)',
                  transition: 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                className="w-3.5 h-7 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-400 border border-slate-500 shadow-lg"
              />
            </div>
          </div>

          <span className="text-[8px] font-bold text-slate-500 font-mono">OFF</span>
        </div>

        {/* Status Indicator LED */}
        <div className="flex items-center gap-1.5 mt-1">
          <div
            style={{
              backgroundColor: checked ? (warning ? '#f59e0b' : accentColor) : '#334155',
              boxShadow: checked
                ? `0 0 8px ${warning ? '#f59e0b' : accentColor}`
                : 'none',
            }}
            className="w-3.5 h-3.5 rounded-full border border-slate-700"
          />
          <span
            className={`text-[10px] font-mono font-bold ${
              checked ? 'text-slate-100' : 'text-slate-400'
            }`}
          >
            {checked ? onLabel : offLabel}
          </span>
        </div>
      </button>
    </div>
  );
};
