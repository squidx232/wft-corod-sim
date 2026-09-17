import React, { useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface PhysicalMicrometerKnobProps {
  id?: string;
  letterLabel?: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

export const PhysicalMicrometerKnob: React.FC<PhysicalMicrometerKnobProps> = ({
  id,
  letterLabel,
  title,
  value,
  min,
  max,
  step = 25,
  unit = 'PSI',
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  // Guard against undefined/NaN values (e.g. before state hydration)
  const safeValue = Number.isFinite(value) ? value : min;
  const startValRef = useRef<number>(safeValue);

  const pct = Math.max(0, Math.min(1, (safeValue - min) / (max - min)));
  const rotationDeg = -135 + pct * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = safeValue;
    soundManager.playMetalTap();

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaY = startYRef.current - ev.clientY;
      const range = max - min;
      const change = (deltaY / 130) * range;
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
    onChange(Math.max(min, Math.min(max, safeValue + delta)));
  };

  return (
    <div id={id} className="flex flex-col items-center select-none" style={{ minWidth: 96 }}>
      {/* Engraved title on aluminum panel — stamped like real console */}
      <div className="text-center mb-1">
        {letterLabel && (
          <span className="text-[11px] font-mono font-black text-slate-700 mr-1">{letterLabel}</span>
        )}
        <span className="text-[11px] font-mono font-bold text-slate-700 uppercase tracking-wide">
          {title}
        </span>
      </div>

      {/* "DECREASE ← → INCREASE" engraved labels (per real photo) */}
      <div className="flex items-center justify-between w-full px-0.5 mb-1">
        <span className="text-[6.5px] font-mono text-slate-500 uppercase">← decrease</span>
        <span className="text-[6.5px] font-mono text-slate-500 uppercase">increase →</span>
      </div>

      {/* RED Square Cast Metal Housing (per real photo: Q, S, U, W) */}
      <div
        className={`relative rounded-md shadow-lg cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-white/30' : ''}`}
        style={{
          width: 76,
          height: 76,
          background: 'linear-gradient(145deg, #ef4444, #dc2626 30%, #b91c1c 70%, #991b1b)',
          border: '2px solid #7f1d1d',
          boxShadow: '3px 4px 8px rgba(0,0,0,0.4), inset 1px 1px 2px rgba(255,255,255,0.15)',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Nameplate / label on the red housing */}
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[5px] font-mono font-bold text-white/70 uppercase tracking-wider whitespace-nowrap"
        >
          {title}
        </div>

        {/* Black knurled round knob centered on red housing */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #4b5563, #1f2937 50%, #111827 85%, #0a0a0a)',
            border: '2px solid #374151',
            boxShadow: '2px 2px 6px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.08)',
            transform: `rotate(${rotationDeg}deg)`,
            transition: 'transform 0.08s ease-out',
          }}
        >
          {/* Knurling ridges — radial lines around edge */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 38 38">
            {Array.from({ length: 20 }).map((_, i) => {
              const a = ((i / 20) * 360 * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={19 + 14 * Math.cos(a)}
                  y1={19 + 14 * Math.sin(a)}
                  x2={19 + 18 * Math.cos(a)}
                  y2={19 + 18 * Math.sin(a)}
                  stroke="#4b5563"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* White index pointer */}
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 3,
              height: 10,
              borderRadius: 2,
              background: '#e5e7eb',
              boxShadow: '0 0 3px rgba(255,255,255,0.5)',
            }}
          />
        </div>
      </div>

      {/* Value readout + step buttons */}
      <div className="flex items-center gap-0.5 mt-1 font-mono text-[10px]">
        <button
          onClick={() => handleStep(-step)}
          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-500 active:bg-slate-400 text-white font-bold flex items-center justify-center shadow border border-slate-600 text-sm"
        >
          −
        </button>
        <span className={`px-1.5 py-0.5 rounded border min-w-[62px] text-center font-bold shadow-inner text-[12px] ${
          isDragging ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-900 text-emerald-400 border-slate-700'
        }`}>
          {Math.round(safeValue)} <span className="text-[9px] text-slate-500">{unit}</span>
        </span>
        <button
          onClick={() => handleStep(step)}
          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-500 active:bg-slate-400 text-white font-bold flex items-center justify-center shadow border border-slate-600 text-sm"
        >
          +
        </button>
      </div>
    </div>
  );
};
