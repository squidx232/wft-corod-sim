import React, { useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalKnobProps {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (val: number) => void;
  accentColor?: string;
  criticalNotice?: string;
}

export const PhysicalKnob: React.FC<PhysicalKnobProps> = ({
  id,
  label,
  sublabel,
  value,
  min,
  max,
  step = 50,
  unit,
  onChange,
  accentColor = '#10b981',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  // Angle from -135deg to +135deg (270 degree rotation)
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
      const change = (deltaY / 150) * range;
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
    <div
      id={id}
      className="flex flex-col items-center justify-between p-3.5 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-750 shadow-inner select-none min-w-[140px] flex-1 text-slate-100"
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

      {/* Realistic Mechanical Knob */}
      <div
        className="relative my-2 w-24 h-24 flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        {/* Dial Base & Scale Marks */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          
          {/* Major Calibrated Tick Marks (9 marks) */}
          {Array.from({ length: 9 }).map((_, i) => {
            const tickAngle = (-135 + (i / 8) * 270) * (Math.PI / 180);
            const x1 = 50 + 36 * Math.cos(tickAngle);
            const y1 = 50 + 36 * Math.sin(tickAngle);
            const x2 = 50 + 44 * Math.cos(tickAngle);
            const y2 = 50 + 44 * Math.sin(tickAngle);
            return (
              <line
                key={`maj-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i === 0 || i === 8 ? '#cbd5e1' : '#94a3b8'}
                strokeWidth={i === 0 || i === 8 ? 2.5 : 1.5}
              />
            );
          })}
          {/* Minor Tick Marks (32 marks between majors) */}
          {Array.from({ length: 32 }).map((_, i) => {
            const tickAngle = (-135 + (i / 31) * 270) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(tickAngle);
            const y1 = 50 + 40 * Math.sin(tickAngle);
            const x2 = 50 + 44 * Math.cos(tickAngle);
            const y2 = 50 + 44 * Math.sin(tickAngle);
            return (
              <line
                key={`min-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#64748b"
                strokeWidth="0.8"
              />
            );
          })}
        </svg>

        {/* Outer Knurled Grip Ring — with SVG radial ridges */}
        <div
          style={{ transform: `rotate(${rotationDeg}deg)`, transition: 'transform 0.08s ease-out' }}
          className={`relative w-16 h-16 rounded-full bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-2 shadow-2xl flex items-center justify-center ${
            isDragging ? 'border-emerald-500/60' : 'border-slate-500'
          }`}
        >
          {/* Knurling ridges — 28 radial lines around the grip edge */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 64 64">
            {Array.from({ length: 28 }).map((_, i) => {
              const a = ((i / 28) * 360 * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={32 + 25 * Math.cos(a)}
                  y1={32 + 25 * Math.sin(a)}
                  x2={32 + 30 * Math.cos(a)}
                  y2={32 + 30 * Math.sin(a)}
                  stroke="#4b5563"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Recessed Center Cap */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-600 flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]">
            {/* Colored Pointer Line */}
            <div
              style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}66` }}
              className="absolute top-1.5 w-1.5 h-5 rounded-full"
            />
            {/* Center hex screw head */}
            <div className="w-3 h-3 rounded-full bg-gradient-to-b from-slate-400 to-slate-600 border border-slate-500 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Digital Readout & Quick Step Buttons */}
      <div className="w-full flex items-center justify-between gap-1 mt-1.5">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-600 active:bg-slate-500 text-white font-bold flex items-center justify-center shadow-md border border-slate-700 transition-all text-sm"
          title="Decrease"
        >
          −
        </button>
        <div className={`flex-1 text-center font-mono font-bold text-xs px-1.5 py-1 rounded-md border shadow-inner transition-colors ${
          isDragging
            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
            : 'bg-black/70 text-emerald-400 border-slate-700'
        }`}>
          {Math.round(value)} <span className="text-[8px] text-slate-500">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-600 active:bg-slate-500 text-white font-bold flex items-center justify-center shadow-md border border-slate-700 transition-all text-sm"
          title="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
};
