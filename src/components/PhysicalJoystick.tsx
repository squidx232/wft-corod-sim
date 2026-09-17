import React from 'react';
import { soundManager } from '../utils/audio';
import { ArrowUp, ArrowDown, Pause } from 'lucide-react';

interface PhysicalJoystickProps {
  id: string;
  position: number; // -1.0 (Run Down) to +1.0 (Pull Up)
  onChange: (pos: number) => void;
  disabled?: boolean;
}

export const PhysicalJoystick: React.FC<PhysicalJoystickProps> = ({
  id,
  position,
  onChange,
  disabled = false,
}) => {
  const isUp = position > 0.05;
  const isDown = position < -0.05;

  return (
    <div
      id={id}
      className="flex flex-col items-center justify-between p-3 rounded-xl bg-slate-900 border-2 border-slate-700 shadow-inner select-none text-slate-100 w-full h-full"
    >
      <div className="text-center w-full mb-1">
        <span className="text-[14px] font-black uppercase tracking-wider text-slate-100 block font-mono">
          DRIVE JOYSTICK
        </span>
        <span className="text-[11px] text-slate-400 font-mono block">
          Speed &amp; Direction
        </span>
      </div>

      {/* Industrial Joystick Housing */}
      <div className="relative my-2 w-full flex-1 min-h-[220px] rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-700 shadow-xl flex flex-col items-center justify-between p-2">
        {/* Top Direction Indicator */}
        <div
          className={`flex items-center gap-1 text-[12px] font-black tracking-wider transition-colors ${
            isUp ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
          }`}
        >
          <ArrowUp className="w-4 h-4" /> PULL UP (POOH)
        </div>

        {/* Rubber Boot & Lever Track */}
        <div className="relative w-16 h-48 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center shadow-inner overflow-hidden">
          {/* Rubber bellows lines */}
          <div className="absolute inset-x-0 top-2 h-0.5 bg-slate-800" />
          <div className="absolute inset-x-0 top-6 h-0.5 bg-slate-800" />
          <div className="absolute inset-x-0 top-10 h-0.5 bg-slate-800" />
          <div className="absolute inset-x-0 top-14 h-0.5 bg-slate-800" />
          <div className="absolute inset-x-0 top-18 h-0.5 bg-slate-800" />

          {/* Center neutral notch marker */}
          <div className="absolute w-12 h-1 bg-amber-500/40 rounded-full" />

          {/* Heavy Steel Joystick Knob */}
          <div
            style={{
              transform: `translateY(${-position * 62}px)`,
              transition: 'transform 0.08s ease-out',
            }}
            className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-tr from-slate-600 via-slate-400 to-slate-200 border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            {/* Top red trigger ball */}
            <div className="w-5 h-5 rounded-full bg-red-600 border border-red-800 shadow-inner" />
          </div>
        </div>

        {/* Bottom Direction Indicator */}
        <div
          className={`flex items-center gap-1 text-[12px] font-black tracking-wider transition-colors ${
            isDown ? 'text-blue-400 animate-pulse' : 'text-slate-500'
          }`}
        >
          <ArrowDown className="w-4 h-4" /> RUN DOWN (RIH)
        </div>
      </div>

      {/* Real-time Status Badge & Quick Lever Snaps */}
      <div className="w-full space-y-1.5">
        <div className="flex justify-between items-center px-2 py-1 rounded bg-black/60 border border-slate-800 text-[11px] font-mono">
          <span className="text-slate-400">STATE:</span>
          <span
            className={`font-bold ${
              isUp ? 'text-emerald-400' : isDown ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            {isUp
              ? `PULL ${Math.round(position * 100)}%`
              : isDown
              ? `RUN ${Math.round(Math.abs(position) * 100)}%`
              : 'NEUTRAL'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              soundManager.playMetalTap();
              onChange(Math.min(1.0, position + 0.35));
            }}
            className="py-1.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-[12px] active:scale-95 transition-all shadow"
            title="Retrieve Continuous Rod (POOH)"
          >
            + PULL
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              soundManager.playMetalTap();
              onChange(0);
            }}
            className="py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[12px] active:scale-95 transition-all shadow flex items-center justify-center gap-0.5"
            title="Neutral / Stop Drive Motors"
          >
            <Pause className="w-3 h-3" /> STOP
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              soundManager.playMetalTap();
              onChange(Math.max(-1.0, position - 0.35));
            }}
            className="py-1.5 rounded bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 font-bold text-[12px] active:scale-95 transition-all shadow"
            title="Inject Continuous Rod (RIH)"
          >
            - RUN
          </button>
        </div>
      </div>
    </div>
  );
};
