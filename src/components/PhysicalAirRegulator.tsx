import React, { useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalAirRegulatorProps {
  id?: string;
  letterLabel?: string; // 'C'
  value: number; // in PSI (e.g. 0 to 150)
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

export const PhysicalAirRegulator: React.FC<PhysicalAirRegulatorProps> = ({
  id = 'ctrl-air-regulator',
  letterLabel = 'C',
  value = 120,
  onChange,
  min = 0,
  max = 150,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  const pct = (value - min) / (max - min);
  const rotationDeg = -135 + pct * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
    soundManager.playMetalTap();

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaY = startYRef.current - ev.clientY;
      const range = max - min;
      const change = (deltaY / 120) * range;
      let newVal = startValRef.current + change;
      newVal = Math.max(min, Math.min(max, Math.round(newVal / 5) * 5));
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div id={id} className="flex flex-col items-center select-none text-slate-800">
      {/* Curved Arc Label: DECREASE <--- ---> INCREASE */}
      <div className="flex items-center justify-between w-full px-1 text-[8.5px] font-bold font-mono tracking-tighter text-slate-700">
        <span className="flex items-center gap-0.5">◀ DECREASE</span>
        <span className="flex items-center gap-0.5">INCREASE ▶</span>
      </div>

      {/* Yellow Knurled Rotary Cap */}
      <div
        className="relative my-1.5 w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing group"
        onMouseDown={handleMouseDown}
        title="Drag up/down or click +/- to adjust regulated air pressure"
      >
        {/* Black outer collar */}
        <div className="absolute inset-1 rounded-full bg-slate-950 border border-slate-800" />

        {/* Yellow knurled knob body */}
        <div
          style={{ transform: `rotate(${rotationDeg}deg)` }}
          className="relative w-11 h-11 rounded-full bg-amber-400 border-2 border-amber-500 shadow-inner flex items-center justify-center transition-transform duration-75"
        >
          {/* Knurl notches on the perimeter */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{ transform: `rotate(${i * 30}deg)` }}
              className="absolute inset-0 flex justify-center"
            >
              <div className="w-1 h-2 bg-amber-500 rounded-sm" />
            </div>
          ))}

          {/* Center cap with pointer notch */}
          <div className="relative z-10 w-7 h-7 rounded-full bg-amber-400 border border-amber-600 flex items-center justify-center shadow">
            <div className="absolute top-0.5 w-1 h-3 bg-slate-900 rounded-full" />
            <div className="w-2 h-2 rounded-full bg-amber-600" />
          </div>
        </div>
      </div>

      {/* Engraved Name Below */}
      <div className="flex items-center gap-1 mt-0.5">
        {letterLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
            {letterLabel}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-800">
          AIR REGULATOR
        </span>
      </div>

      {/* Compact Step Adjusters */}
      <div className="flex items-center gap-1 mt-1 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => {
            soundManager.playMetalTap();
            onChange(Math.max(min, value - 5));
          }}
          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center shadow-sm"
        >
          -
        </button>
        <span className="px-1.5 py-0.5 bg-slate-900 text-amber-300 font-bold rounded border border-slate-700 min-w-[48px] text-center">
          {value} PSI
        </span>
        <button
          type="button"
          onClick={() => {
            soundManager.playMetalTap();
            onChange(Math.min(max, value + 5));
          }}
          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center shadow-sm"
        >
          +
        </button>
      </div>
    </div>
  );
};
