import React, { useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalPressureRegulatorBlockProps {
  id?: string;
  letterLabel?: string; // 'U' or 'W'
  title: string; // 'DOWN PRESSURE' or 'UP PRESSURE'
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

export const PhysicalPressureRegulatorBlock: React.FC<PhysicalPressureRegulatorBlockProps> = ({
  id,
  letterLabel,
  title,
  value,
  min,
  max,
  step = 50,
  unit = 'PSI',
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rotationDeg = -135 + pct * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
    soundManager.playMetalTap();

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaY = startYRef.current - ev.clientY;
      const range = max - min;
      const change = (deltaY / 140) * range;
      let newVal = startValRef.current + change;
      newVal = Math.max(min, Math.min(max, newVal));
      newVal = Math.round(newVal / step) * step;
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

  const handleStep = (delta: number) => {
    soundManager.playMetalTap();
    const newVal = Math.max(min, Math.min(max, value + delta));
    onChange(newVal);
  };

  return (
    <div id={id} className="flex flex-col items-center select-none text-slate-800">
      {/* Title Above */}
      <div className="flex items-center justify-center gap-1 mb-0.5 text-center">
        {letterLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
            {letterLabel}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-800 leading-tight">
          {title}
        </span>
      </div>

      {/* Arc Guide: DECREASE <--- ---> INCREASE */}
      <div className="flex items-center justify-between w-full px-1 text-[8px] font-bold font-mono tracking-tighter text-slate-700 mb-1">
        <span>◀ DECREASE</span>
        <span>INCREASE ▶</span>
      </div>

      {/* Heavy Red Square Cast Housing */}
      <div
        className="relative my-1 w-20 h-20 rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 border-2 border-red-950 shadow-xl flex flex-col items-center justify-between p-1.5 cursor-grab active:cursor-grabbing group"
        onMouseDown={handleMouseDown}
        title="Drag up/down or click +/- to adjust pressure"
      >
        {/* 4 Corner Allen Bolts */}
        <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-700 flex items-center justify-center">
          <div className="w-1 h-1 bg-slate-900 rounded-sm" />
        </div>
        <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-700 flex items-center justify-center">
          <div className="w-1 h-1 bg-slate-900 rounded-sm" />
        </div>
        <div className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-700 flex items-center justify-center">
          <div className="w-1 h-1 bg-slate-900 rounded-sm" />
        </div>
        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-700 flex items-center justify-center">
          <div className="w-1 h-1 bg-slate-900 rounded-sm" />
        </div>

        {/* Central Knurled Silver Knob on Threaded Spindle */}
        <div className="relative z-10 w-11 h-11 rounded-full bg-gradient-to-tr from-slate-400 via-slate-100 to-slate-300 border-2 border-slate-500 shadow-xl flex items-center justify-center">
          <div
            style={{ transform: `rotate(${rotationDeg}deg)` }}
            className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-300 to-slate-400 border border-slate-600 flex items-center justify-center shadow-inner"
          >
            {/* Fine knurl grooves */}
            <div className="absolute inset-0 rounded-full border border-dashed border-slate-500 opacity-60" />
            <div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-400" />
            <div className="absolute top-0.5 w-1 h-2 bg-red-600 rounded-full" />
          </div>
        </div>

        {/* Metal Spec Nameplate */}
        <div className="w-14 h-3 bg-black/90 rounded border border-slate-600 flex items-center justify-center">
          <span className="text-[6.5px] font-mono text-slate-300 font-bold tracking-widest uppercase">
            REGULATOR
          </span>
        </div>
      </div>

      {/* Readout and Step Adjusters */}
      <div className="flex items-center gap-1 mt-1 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center shadow-sm"
        >
          -
        </button>
        <span className="px-1.5 py-0.5 bg-slate-900 text-cyan-300 font-bold rounded border border-slate-700 min-w-[56px] text-center">
          {Math.round(value)} <span className="text-[8px] text-slate-400">{unit}</span>
        </span>
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center shadow-sm"
        >
          +
        </button>
      </div>
    </div>
  );
};
