import React, { useEffect, useRef, useState } from 'react';

/**
 * Very slight needle micro-vibration for realism. Returns a tiny angular offset
 * (degrees) that jitters continuously, driven by requestAnimationFrame. A live
 * pressure (value away from the floor) vibrates a touch more than a dead gauge,
 * mimicking pump ripple / mechanical dither on a real Bourdon-tube needle.
 */
function useNeedleVibration(active: boolean, intensity: number): number {
  const [offset, setOffset] = useState(0);
  const raf = useRef<number | null>(null);
  const seed = useRef(Math.random() * 1000); // desync each gauge
  useEffect(() => {
    if (!active) {
      setOffset(0);
      return;
    }
    const loop = () => {
      const t = performance.now() * 0.001 + seed.current;
      // Layered sines → organic, non-repeating micro-tremor (± ~0.35° × intensity).
      const j =
        Math.sin(t * 21.7) * 0.55 +
        Math.sin(t * 37.3 + 1.3) * 0.3 +
        Math.sin(t * 9.1 + 2.7) * 0.15;
      setOffset(j * 0.55 * intensity);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [active, intensity]);
  return offset;
}

interface Zone {
  from: number;
  to: number;
  color: string;
  label?: string;
}

export interface AnalogGaugeProps {
  id?: string;
  letterLabel?: string; // e.g. 'A', 'B', 'E', 'F', 'G', 'H', 'I', 'L', 'M'
  title: string;
  subtitle?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  zones?: Zone[];
  criticalLow?: number;
  criticalHigh?: number;
  bezelStyle?: 'chrome' | 'chrome-red-ring' | 'heavy-black';
  size?: 'sm' | 'md' | 'lg';
  isLarge?: boolean;
  kpaMax?: number;
  silverPlacard?: boolean;
  hasSideHandle?: boolean;
  /**
   * When true (rod running — RIH/POOH/any operation), the needle vibrates more
   * strongly to convey the live mechanical load / pump ripple. Off = the gentle
   * idle dither only.
   */
  operationActive?: boolean;
}

export const AnalogGauge: React.FC<AnalogGaugeProps> = ({
  id,
  letterLabel,
  title,
  subtitle,
  value,
  min,
  max,
  unit = 'PSI',
  zones = [],
  criticalLow,
  criticalHigh,
  bezelStyle = 'chrome',
  size = 'md',
  isLarge = false,
  kpaMax,
  silverPlacard = false,
  hasSideHandle = false,
  operationActive = false,
}) => {
  const clampedVal = Math.min(Math.max(value, min), max);
  const percent = (clampedVal - min) / (max - min);

  // Sweep angle: 270 degrees total
  // 0% -> -135 deg (7:30 o'clock)
  // 50% -> 0 deg (12:00 o'clock)
  // 100% -> +135 deg (4:30 o'clock)
  const baseNeedleRotation = -135 + percent * 270;
  // Slight always-on micro-vibration; a hair stronger when the gauge reads a
  // live (non-floor) pressure so pressurised gauges feel alive vs. dead ones.
  // Always dither slightly when live; during an active operation the needle
  // vibrates noticeably harder (rod running under load / pump ripple).
  const vibrationActive = percent > 0.01 || operationActive;
  const vibrationIntensity =
    (0.6 + Math.min(1, percent) * 0.7) * (operationActive ? 2.2 : 1); // ~0.6–1.3× idle, ~1.3–2.9× running
  const vibrationOffset = useNeedleVibration(vibrationActive, vibrationIntensity);
  const needleRotation = baseNeedleRotation + vibrationOffset;

  const isCritical =
    (criticalLow !== undefined && value < criticalLow) ||
    (criticalHigh !== undefined && value > criticalHigh);

  // Dimensions
  const isLargeGauge = isLarge || size === 'lg' || bezelStyle === 'heavy-black';
  const dimension = isLargeGauge ? 210 : size === 'sm' ? 150 : 172;
  const center = dimension / 2;
  const outerRadius = dimension / 2 - 6;
  const dialRadius = outerRadius - (isLargeGauge ? 10 : 8);
  const arcRadius = dialRadius - 12;

  // Determine tick intervals
  let tickInterval = 500;
  const range = max - min;
  if (range <= 150) {
    tickInterval = 25;
  } else if (range <= 600) {
    tickInterval = 100;
  } else if (range <= 1500) {
    tickInterval = 250;
  } else if (range <= 3000) {
    tickInterval = 500;
  } else {
    tickInterval = 1000;
  }

  const numMajorTicks = Math.round(range / tickInterval);
  const majorTicks: { val: number; x1: number; y1: number; x2: number; y2: number; lx: number; ly: number }[] = [];

  for (let i = 0; i <= numMajorTicks; i++) {
    const val = min + i * tickInterval;
    const tPct = (val - min) / range;
    const angleDeg = 135 + tPct * 270;
    const angleRad = (angleDeg * Math.PI) / 180;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const x1 = center + (arcRadius + 2) * cos;
    const y1 = center + (arcRadius + 2) * sin;
    const x2 = center + (arcRadius - 7) * cos;
    const y2 = center + (arcRadius - 7) * sin;
    const lx = center + (arcRadius - 17) * cos;
    const ly = center + (arcRadius - 17) * sin;

    majorTicks.push({
      val: Math.round(val),
      x1,
      y1,
      x2,
      y2,
      lx,
      ly,
    });
  }

  // Minor ticks (4 subdivisions per major)
  const minorTicks: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const numMinor = numMajorTicks * 4;
  for (let i = 0; i <= numMinor; i++) {
    if (i % 4 === 0) continue; // skip major
    const tPct = i / numMinor;
    const angleRad = ((135 + tPct * 270) * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    minorTicks.push({
      x1: center + (arcRadius + 1) * cos,
      y1: center + (arcRadius + 1) * sin,
      x2: center + (arcRadius - 3.5) * cos,
      y2: center + (arcRadius - 3.5) * sin,
    });
  }

  // Calculate approximate kPa equivalent max
  const computedKpaMax = kpaMax || Math.round((max * 6.89476) / 1000) * 1000;

  return (
    <div
      id={id || `gauge-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      className="flex flex-col items-center justify-between text-slate-900 select-none relative group"
    >
      {/* Authentic Engraved Label or Silver Placard Above */}
      {silverPlacard ? (
        <div className="w-full max-w-[195px] bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-2 border-slate-700 rounded-sm shadow-md px-2 py-0.5 mb-1.5 relative overflow-hidden flex flex-col items-center justify-center">
          {/* Corner Rivets */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />
          <div className="flex items-center justify-center gap-1.5">
            {letterLabel && (
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-900 text-white font-mono text-[8px] font-black shrink-0">
                {letterLabel}
              </span>
            )}
            <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-wider font-mono text-slate-900 text-center leading-tight">
              {title}
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-600 font-mono tracking-tight font-bold">
              {subtitle}
            </span>
          )}
        </div>
      ) : (
        <div className="text-center w-full mb-1">
          <div className="flex items-center justify-center gap-1">
            {letterLabel && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white font-mono text-[9px] font-black shrink-0">
                {letterLabel}
              </span>
            )}
            <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-800 font-mono block leading-tight">
              {title}
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-600 font-mono block tracking-tight">
              {subtitle}
            </span>
          )}
        </div>
      )}

      {/* SVG Analog Dial Face (with optional physical side handle) */}
      <div className="relative my-0.5 flex items-center justify-center">
        {hasSideHandle && (
          <div
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 flex items-center pointer-events-none"
            title="Calibrated Isolation Valve Handle"
          >
            <div className="w-4 sm:w-5 h-1.5 bg-gradient-to-r from-slate-700 to-slate-900 border border-slate-950 rounded-sm shadow-sm transform -rotate-12" />
            <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-600 shadow-md -ml-1" />
          </div>
        )}
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="overflow-visible filter drop-shadow-md"
        >
          <defs>
            {/* Chrome Bezel Outer Gradient */}
            <radialGradient id={`chrome-bezel-${title.replace(/[^a-z0-9]/gi, '')}`} cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="35%" stopColor="#cbd5e1" />
              <stop offset="65%" stopColor="#64748b" />
              <stop offset="85%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#334155" />
            </radialGradient>

            {/* Heavy Black Bezel Gradient */}
            <radialGradient id={`black-bezel-${title.replace(/[^a-z0-9]/gi, '')}`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="85%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>

            {/* Aged Ivory/Cream Dial Face — matches the weathered Weatherford
                console gauges (Figure 16), which read cream rather than stark white. */}
            <radialGradient id={`dial-face-${title.replace(/[^a-z0-9]/gi, '')}`} cx="50%" cy="42%" r="58%">
              <stop offset="0%" stopColor="#fbf7ec" />
              <stop offset="70%" stopColor="#f3ecda" />
              <stop offset="92%" stopColor="#e7dcc4" />
              <stop offset="100%" stopColor="#cdbfa2" />
            </radialGradient>

            {/* Soft glass specular highlight sweeping the upper-left of the dial. */}
            <linearGradient id={`glass-glare-${title.replace(/[^a-z0-9]/gi, '')}`} x1="0%" y1="0%" x2="60%" y2="90%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 1. Outer Metallic Bezel Ring */}
          {bezelStyle === 'heavy-black' ? (
            <>
              {/* Outer Flange */}
              <circle
                cx={center}
                cy={center}
                r={outerRadius}
                fill={`url(#black-bezel-${title.replace(/[^a-z0-9]/gi, '')})`}
                stroke="#475569"
                strokeWidth="2"
              />
              {/* Inner Bezel Step */}
              <circle
                cx={center}
                cy={center}
                r={outerRadius - 4}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              {/* Flange Bolts at 3 positions */}
              {[30, 150, 270].map((deg, i) => {
                const rRad = (deg * Math.PI) / 180;
                const bx = center + (outerRadius - 4.5) * Math.cos(rRad);
                const by = center + (outerRadius - 4.5) * Math.sin(rRad);
                return (
                  <g key={i}>
                    <circle cx={bx} cy={by} r="2.5" fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
                    <circle cx={bx} cy={by} r="1" fill="#0f172a" />
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* Polished Chrome Rim */}
              <circle
                cx={center}
                cy={center}
                r={outerRadius}
                fill={`url(#chrome-bezel-${title.replace(/[^a-z0-9]/gi, '')})`}
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              {/* Red Accent Ring if specified */}
              {bezelStyle === 'chrome-red-ring' && (
                <circle
                  cx={center}
                  cy={center}
                  r={outerRadius - 3.5}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                />
              )}
              {/* Chrome Flange Screws at 3 positions (120 deg apart) */}
              {[90, 210, 330].map((deg, i) => {
                const rRad = (deg * Math.PI) / 180;
                const bx = center + (outerRadius - 3.5) * Math.cos(rRad);
                const by = center + (outerRadius - 3.5) * Math.sin(rRad);
                return (
                  <g key={i}>
                    <circle cx={bx} cy={by} r="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.6" />
                    <line x1={bx - 1.2} y1={by} x2={bx + 1.2} y2={by} stroke="#334155" strokeWidth="0.6" />
                  </g>
                );
              })}
            </>
          )}

          {/* 2. Dial Glass Face (Aged ivory/cream as in the real Weatherford console) */}
          <circle
            cx={center}
            cy={center}
            r={dialRadius}
            fill={`url(#dial-face-${title.replace(/[^a-z0-9]/gi, '')})`}
            stroke="#a8956f"
            strokeWidth="1"
          />

          {/* Color Zone Arcs — painted bands on the dial face outer edge,
              between the numbers and the bezel (like the real gauges).
              Rendered as thick solid arcs at the outer edge of the tick area. */}
          {zones.map((zone, idx) => {
            const zStartPct = Math.max(0, Math.min(1, (zone.from - min) / (max - min)));
            const zEndPct = Math.max(0, Math.min(1, (zone.to - min) / (max - min)));
            if (zStartPct >= zEndPct) return null;

            // Zone band sits just inside the outer tick ends
            const zoneR = arcRadius + 3;
            const startAngleRad = ((135 + zStartPct * 270) * Math.PI) / 180;
            const endAngleRad = ((135 + zEndPct * 270) * Math.PI) / 180;

            const xStart = center + zoneR * Math.cos(startAngleRad);
            const yStart = center + zoneR * Math.sin(startAngleRad);
            const xEnd = center + zoneR * Math.cos(endAngleRad);
            const yEnd = center + zoneR * Math.sin(endAngleRad);
            const spanDeg = (zEndPct - zStartPct) * 270;
            const largeArc = spanDeg > 180 ? 1 : 0;

            return (
              <path
                key={idx}
                d={`M ${xStart} ${yStart} A ${zoneR} ${zoneR} 0 ${largeArc} 1 ${xEnd} ${yEnd}`}
                fill="none"
                stroke={zone.color}
                strokeWidth={isLargeGauge ? '4' : '3'}
                strokeLinecap="butt"
                opacity="0.9"
              />
            );
          })}

          {/* Inner Secondary Scale Track (kPa) — thin arc the inner numerals sit on */}
          <path
            d={`M ${center + (arcRadius - 12) * Math.cos((135 * Math.PI) / 180)} ${
              center + (arcRadius - 12) * Math.sin((135 * Math.PI) / 180)
            } A ${arcRadius - 12} ${arcRadius - 12} 0 1 1 ${
              center + (arcRadius - 12) * Math.cos((405 * Math.PI) / 180)
            } ${center + (arcRadius - 12) * Math.sin((405 * Math.PI) / 180)}`}
            fill="none"
            stroke="#9a3412"
            strokeWidth="0.7"
          />

          {/* Inner kPa numeric scale (large dual-scale gauges only).
              The real CPW Down/Up gauges print a red kPa scale (0-35000)
              concentric with the outer PSI scale. We render every second
              major tick to avoid crowding. */}
          {isLargeGauge &&
            majorTicks.map((t, idx) => {
              if (idx % 2 !== 0) return null; // thin out for legibility
              const tPct = numMajorTicks === 0 ? 0 : idx / numMajorTicks;
              const angleRad = ((135 + tPct * 270) * Math.PI) / 180;
              const cos = Math.cos(angleRad);
              const sin = Math.sin(angleRad);
              const kx = center + (arcRadius - 24) * cos;
              const ky = center + (arcRadius - 24) * sin;
              const kpaVal = Math.round((computedKpaMax * tPct) / 1000); // in thousands
              // inner tick mark
              const ix1 = center + (arcRadius - 13) * cos;
              const iy1 = center + (arcRadius - 13) * sin;
              const ix2 = center + (arcRadius - 17) * cos;
              const iy2 = center + (arcRadius - 17) * sin;
              return (
                <g key={`kpa-${idx}`}>
                  <line x1={ix1} y1={iy1} x2={ix2} y2={iy2} stroke="#b91c1c" strokeWidth={1} />
                  <text
                    x={kx}
                    y={ky + 2}
                    fill="#b91c1c"
                    fontSize="7"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {kpaVal}
                  </text>
                </g>
              );
            })}

          {/* Minor Ticks */}
          {minorTicks.map((t, idx) => (
            <line
              key={`min-${idx}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="#475569"
              strokeWidth={0.8}
            />
          ))}

          {/* Major Ticks & Numbers */}
          {majorTicks.map((t, idx) => (
            <g key={`maj-${idx}`}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              <text
                x={t.lx}
                y={t.ly + 3}
                fill="#0f172a"
                fontSize={isLargeGauge ? '10' : '8.5'}
                fontWeight="800"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {t.val >= 10000 ? `${t.val / 1000}k` : t.val}
              </text>
            </g>
          ))}

          {/* Dial Face Brand / Spec Watermark */}
          {isLargeGauge ? (
            <g transform={`translate(${center}, ${center + dialRadius * 0.45})`}>
              <rect x="-20" y="-8" width="40" height="15" rx="2" fill="#efe7d3" stroke="#a8956f" strokeWidth="0.5" />
              <text x="0" y="-2" fill="#334155" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
                CPW
              </text>
              <text x="0" y="4" fill="#b91c1c" fontSize="4" fontWeight="700" textAnchor="middle" fontFamily="monospace">
                kPa ×1000
              </text>
            </g>
          ) : (
            <g transform={`translate(${center}, ${center + dialRadius * 0.45})`}>
              <text x="0" y="0" fill="#475569" fontSize="6.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">
                {unit}
              </text>
              <text x="0" y="7" fill="#64748b" fontSize="5" fontWeight="600" textAnchor="middle" fontFamily="monospace">
                kPa
              </text>
            </g>
          )}

          {/* Curved glass reflection across the upper-left of the crystal. */}
          <path
            d={`M ${center - dialRadius * 0.72} ${center - dialRadius * 0.3}
                A ${dialRadius} ${dialRadius} 0 0 1 ${center + dialRadius * 0.3} ${center - dialRadius * 0.72}
                A ${dialRadius * 1.4} ${dialRadius * 1.4} 0 0 0 ${center - dialRadius * 0.72} ${center - dialRadius * 0.3} Z`}
            fill={`url(#glass-glare-${title.replace(/[^a-z0-9]/gi, '')})`}
            pointerEvents="none"
          />

          {/* Gauge Center Pivot Hub */}
          <circle cx={center} cy={center} r="6" fill="#334155" stroke="#64748b" strokeWidth="1" />

          {/* Needle Indicator */}
          <g transform={`rotate(${needleRotation} ${center} ${center})`}>
            {/* Needle Body (Black or Critical Red) */}
            <polygon
              points={`${center - 1.8},${center} ${center + 1.8},${center} ${center + 0.4},${
                center - arcRadius + 1
              } ${center - 0.4},${center - arcRadius + 1}`}
              fill={isCritical ? '#dc2626' : '#0f172a'}
            />
            {/* Counterbalance tail */}
            <polygon
              points={`${center - 2.5},${center} ${center + 2.5},${center} ${center},${center + 14}`}
              fill="#1e293b"
            />
            <circle cx={center} cy={center + 10} r="2.2" fill="#475569" />
          </g>

          {/* Center Cap Nut */}
          <circle cx={center} cy={center} r="3" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
        </svg>
      </div>

      {/* Industrial Stamped Value Badge */}
      <div
        className={`px-2.5 py-1 mt-0.5 rounded border font-mono text-center flex items-center justify-center gap-1 text-[13px] font-bold shadow-inner ${
          isCritical
            ? 'bg-red-900 border-red-500 text-red-100 ring-1 ring-red-400'
            : 'bg-slate-900 border-slate-700 text-emerald-400'
        }`}
      >
        <span>{Math.round(value).toLocaleString()}</span>
        <span className="text-[11px] text-slate-400 font-normal">{unit}</span>
      </div>
    </div>
  );
};
