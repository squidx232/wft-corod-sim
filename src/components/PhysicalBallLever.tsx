import React from 'react';
import { soundManager } from '../utils/audio';

export type LeverPosition3 = 'OFF' | 'NEUTRAL' | 'ON';
export type LeverPosition2 = 'OFF' | 'ON';

interface PhysicalBallLeverProps {
  id?: string;
  letterLabel?: string;
  title: string;
  positions?: '2-way' | '3-way';
  position: LeverPosition3 | LeverPosition2;
  ballColor?: 'black' | 'red';
  isTall?: boolean;
  onChange: (pos: any) => void;
}

export const PhysicalBallLever: React.FC<PhysicalBallLeverProps> = ({
  id,
  letterLabel,
  title,
  positions = '3-way',
  position,
  ballColor = 'red',
  isTall = false,
  onChange,
}) => {
  const is3Way = positions === '3-way';

  const handleSetPosition = (targetPos: string) => {
    soundManager.playMetalTap();
    onChange(targetPos);
  };

  // Map position to a 0..1 fraction along the machined slot.
  // 0 = top of slot (OFF), 1 = bottom of slot (ON).
  let posFrac: number;
  if (is3Way) {
    posFrac = position === 'OFF' ? 0 : position === 'NEUTRAL' ? 0.5 : 1;
  } else {
    posFrac = position === 'OFF' ? 0 : 1;
  }

  // Slight tilt for realism
  const tilt = position === 'OFF' ? -8 : position === 'ON' ? 8 : 0;

  return (
    <div id={id} className="flex flex-col items-center select-none" style={{ minWidth: 72 }}>
      {/* Engraved title on aluminum panel — like stamped text on real console */}
      {title && (
        <div className="text-center mb-1">
          {letterLabel && (
            <span className="text-[9px] font-mono font-black text-slate-700 mr-1">{letterLabel}</span>
          )}
          <span className="text-[9px] font-mono font-bold text-slate-700 uppercase tracking-wide">
            {title}
          </span>
        </div>
      )}

      {/* Engraved position labels — stamped into the aluminum (per real photo) */}
      <div className="relative flex items-center">
        {/* Position labels engraved on panel surface */}
        <div className="flex flex-col items-end mr-1.5 text-[10px] font-mono font-bold text-slate-600 select-none" style={{ gap: is3Way ? 22 : 40 }}>
          <button
            onClick={() => handleSetPosition('OFF')}
            className={`cursor-pointer transition-colors hover:text-slate-900 ${position === 'OFF' ? 'text-slate-900' : ''}`}
          >
            OFF
          </button>
          {is3Way && (
            <button
              onClick={() => handleSetPosition('NEUTRAL')}
              className={`cursor-pointer transition-colors hover:text-slate-900 ${position === 'NEUTRAL' ? 'text-slate-900' : ''}`}
            >
              NEUTRAL
            </button>
          )}
          <button
            onClick={() => handleSetPosition('ON')}
            className={`cursor-pointer transition-colors hover:text-slate-900 ${position === 'ON' ? 'text-slate-900' : ''}`}
          >
            ON
          </button>
        </div>

        {/* The actual lever assembly — machined slot + chrome stem + ball */}
        {(() => {
          const SLOT_TOP = 8;
          const SLOT_H = is3Way ? 92 : 74;
          const BALL = 32;
          const STEM_H = 30;
          // Container is tall enough to hold the slot plus the stem rising above it.
          const containerH = SLOT_TOP + SLOT_H + STEM_H;
          // Ball centre travels between the top and bottom of the slot (inset by
          // half the ball so it never pokes past the ends of the track).
          const travelTop = SLOT_TOP + BALL / 2;
          const travelBottom = SLOT_TOP + SLOT_H - BALL / 2;
          const ballCenterY = travelTop + posFrac * (travelBottom - travelTop);
          return (
            <div className="relative w-8" style={{ height: containerH }}>
              {/* Machined slot in the aluminum panel */}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-full shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
                style={{
                  width: 10,
                  height: SLOT_H,
                  top: SLOT_TOP,
                  background: 'linear-gradient(to right, #2d3748, #1a202c, #2d3748)',
                  border: '1px solid #4a5568',
                }}
              />

              {/* Position detent marks (machined notches in the slot) */}
              {(is3Way ? [0, 0.5, 1] : [0, 1]).map((pct, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 -translate-x-1/2 h-[2px] bg-slate-500/60"
                  style={{ width: 10, top: travelTop + pct * (travelBottom - travelTop) }}
                />
              ))}

              {/* Chrome stem — rises from the ball upward, pivoting slightly */}
              <div
                className="absolute left-1/2 z-10"
                style={{
                  width: 6,
                  height: STEM_H,
                  top: ballCenterY - STEM_H,
                  transform: `translateX(-50%) rotate(${tilt}deg)`,
                  transformOrigin: 'bottom center',
                  background: 'linear-gradient(to right, #a0aec0, #e2e8f0, #f7fafc, #e2e8f0, #a0aec0)',
                  borderRadius: 2,
                  boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                  transition: 'top 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.12s ease',
                }}
              />

              {/* Ball knob — photorealistic sphere, centred on its slot position */}
              <div
                className="absolute left-1/2 z-20 cursor-pointer"
                style={{
                  width: BALL,
                  height: BALL,
                  top: ballCenterY - BALL / 2,
                  transform: 'translateX(-50%)',
                  borderRadius: '50%',
                  background: ballColor === 'red'
                    ? 'radial-gradient(circle at 35% 30%, #f87171, #dc2626 40%, #991b1b 80%, #7f1d1d)'
                    : 'radial-gradient(circle at 35% 30%, #6b7280, #374151 40%, #1f2937 80%, #111827)',
                  boxShadow: ballColor === 'red'
                    ? '2px 3px 6px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(0,0,0,0.3), inset 3px 3px 6px rgba(255,255,255,0.15)'
                    : '2px 3px 6px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(0,0,0,0.4), inset 3px 3px 6px rgba(255,255,255,0.1)',
                  border: `1px solid ${ballColor === 'red' ? '#991b1b' : '#1f2937'}`,
                  transition: 'top 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onClick={() => {
                  // Click the ball to cycle to the next position.
                  const order = is3Way ? ['OFF', 'NEUTRAL', 'ON'] : ['OFF', 'ON'];
                  const idx = order.indexOf(position);
                  handleSetPosition(order[(idx + 1) % order.length]);
                }}
              >
                {/* Specular highlight dot */}
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 6,
                    width: 8,
                    height: 5,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.4)',
                    filter: 'blur(1px)',
                  }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
