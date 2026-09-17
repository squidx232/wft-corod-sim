import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hand, Sparkles } from 'lucide-react';
import { SimulatorState } from '../types';

interface OperatorHandsOverlayProps {
  state: SimulatorState;
  activeControlTarget?: string | null;
  showHands: boolean;
  onToggleShowHands: () => void;
  gloveStyle: 'hivis' | 'leather' | 'tactical';
  onChangeGloveStyle: (style: 'hivis' | 'leather' | 'tactical') => void;
}

export const OperatorHandsOverlay: React.FC<OperatorHandsOverlayProps> = ({
  state,
  activeControlTarget,
  showHands,
  gloveStyle,
}) => {
  const { joystickPosition } = state;
  const isMoving = Math.abs(joystickPosition) > 0.05;
  const isRih = joystickPosition < -0.05;
  const isPooh = joystickPosition > 0.05;

  const containerRef = useRef<HTMLDivElement>(null);

  // Computed pixel positions relative to the container
  const [joystickCoords, setJoystickCoords] = useState<{ x: number; y: number } | null>(null);
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number; label: string } | null>(null);

  // Map label to DOM element id
  const targetIdMap: Record<string, string> = {
    'Chain Tension Lever (P)': 'ctrl-lever-chain-tension-p',
    'Tension Micrometer Knob (Q)': 'ctrl-knob-chain-tension-q',
    'Squeeze Pressure Lever (R)': 'ctrl-lever-squeeze-r',
    'Squeeze Micrometer Knob (S)': 'ctrl-knob-squeeze-s',
    'Injector Brake Lever (T)': 'ctrl-lever-brake-t',
    'Rod Safety Clamp (V)': 'ctrl-lever-safety-v',
    'Down Pressure Block (U)': 'ctrl-reg-down-u',
    'Up Pressure Block (W)': 'ctrl-reg-up-w',
    'Safety Bleed Valve (X)': 'ctrl-safety-bleed-x',
    'BOP Valve / Bleed (N/O)': 'ctrl-bop-valve-o',
    'Air Regulator Knob (C)': 'ctrl-air-regulator-c',
    'Emergency Cutoff (J)': 'ctrl-estop-j',
    'Chain Oiler Switch (K)': 'ctrl-chain-oiler-k',
    'Panel Lights (D)': 'ctrl-panel-lights-d',
  };

  // Measure DOM positions
  const updatePositions = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    // 1. Right Hand: Joystick Coordinates
    const joyEl = document.getElementById('ctrl-joystick-y');
    if (joyEl) {
      const joyRect = joyEl.getBoundingClientRect();
      const joyX = joyRect.left - containerRect.left + joyRect.width / 2;
      const joyY = joyRect.top - containerRect.top + joyRect.height / 2;
      setJoystickCoords({ x: joyX, y: joyY });
    } else {
      // Fallback to bottom right corner of console
      setJoystickCoords({ x: containerRect.width * 0.88, y: containerRect.height * 0.78 });
    }

    // 2. Left Hand: Active Control Coordinates
    if (activeControlTarget) {
      const targetId = targetIdMap[activeControlTarget] || '';
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (targetEl) {
        const targetRect = targetEl.getBoundingClientRect();
        const tx = targetRect.left - containerRect.left + targetRect.width / 2;
        const ty = targetRect.top - containerRect.top + targetRect.height / 2;
        setTargetCoords({ x: tx, y: ty, label: activeControlTarget });
      } else {
        setTargetCoords(null);
      }
    } else {
      setTargetCoords(null);
    }
  };

  useEffect(() => {
    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);

    const interval = setInterval(updatePositions, 500);

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
      clearInterval(interval);
    };
  }, [activeControlTarget, showHands]);

  // Color palettes based on Glove Style
  const gloveThemes = {
    hivis: {
      name: 'Hi-Vis TPR Impact Glove',
      mainColor: '#ea580c', // Bright safety orange
      tprColor: '#84cc16', // Lime TPR metacarpal impact bumpers
      palmColor: '#1e293b', // Black synthetic leather
      cuffColor: '#0f172a',
      accentColor: '#fbbf24',
    },
    leather: {
      name: 'Classic Oilfield Cowhide',
      mainColor: '#d97706', // Golden brown leather
      tprColor: '#b45309', // Dark leather patch
      palmColor: '#78350f', // Suede palm
      cuffColor: '#451a03',
      accentColor: '#fef3c7',
    },
    tactical: {
      name: 'Heavy Rig Carbon Fiber',
      mainColor: '#18181b', // Matte black
      tprColor: '#dc2626', // Crimson red guards
      palmColor: '#27272a', // Textured grip
      cuffColor: '#09090b',
      accentColor: '#ef4444',
    },
  };

  const currentTheme = gloveThemes[gloveStyle];

  if (!showHands) return null;

  // Joystick Y translation mapped to rod speed & position:
  // In physical joystick: Pull UP = POOH (-y pixel offset), Push DOWN = RIH (+y pixel offset)
  const rightHandOffsetY = -joystickPosition * 26;
  const rightHandRotation = joystickPosition * 8;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden select-none"
    >
      {/* --------------------------------------------------------------------- */}
      {/* RIGHT HAND: Directly Gripping the Weatherford Gripper Joystick (Y)   */}
      {/* --------------------------------------------------------------------- */}
      {joystickCoords && (
        <motion.div
          style={{
            left: joystickCoords.x - 56,
            top: joystickCoords.y - 72,
          }}
          className="absolute w-28 h-40 origin-bottom-right pointer-events-none"
          animate={{
            y: rightHandOffsetY,
            rotate: rightHandRotation,
            scale: isMoving ? [1, 1.02, 0.99, 1] : 1,
          }}
          transition={{
            type: 'spring',
            damping: 24,
            stiffness: 240,
            scale: isMoving ? { repeat: Infinity, duration: 0.25 } : undefined,
          }}
        >
          <svg
            viewBox="0 0 240 320"
            className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.7)] opacity-90"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm & Sleeve */}
            <path
              d="M90 320 L110 240 L195 240 L230 320 Z"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="3"
            />
            {/* Hi-vis reflective sleeve tape */}
            <path d="M100 280 L210 280" stroke="#84cc16" strokeWidth="8" strokeLinecap="round" />

            {/* Glove Elastic Wrist Cuff */}
            <rect
              x="105"
              y="215"
              width="95"
              height="32"
              rx="8"
              fill={currentTheme.cuffColor}
              stroke="#334155"
              strokeWidth="2"
            />
            {/* Wrist Pull Strap */}
            <rect
              x="115"
              y="222"
              width="75"
              height="14"
              rx="4"
              fill={currentTheme.mainColor}
            />
            <text
              x="152"
              y="233"
              fontSize="7.5"
              fontWeight="bold"
              fill="#ffffff"
              textAnchor="middle"
              fontFamily="monospace"
            >
              WEATHERFORD
            </text>

            {/* Hand Palm & Metacarpal Body */}
            <path
              d="M95 215 C90 170 95 130 115 110 C135 90 185 95 195 135 C205 175 200 215 195 225 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="3"
            />

            {/* TPR Metacarpal Impact Protectors */}
            <g fill={currentTheme.tprColor} stroke="#0f172a" strokeWidth="1.5">
              <rect x="110" y="145" width="14" height="35" rx="5" />
              <rect x="130" y="138" width="16" height="42" rx="5" />
              <rect x="152" y="140" width="16" height="40" rx="5" />
              <rect x="174" y="148" width="13" height="32" rx="5" />
            </g>

            {/* Knuckle Guard Bar */}
            <rect
              x="105"
              y="125"
              width="88"
              height="16"
              rx="6"
              fill={currentTheme.palmColor}
              stroke="#0f172a"
              strokeWidth="2"
            />

            {/* Gripping Fingers over joystick ball */}
            {/* Index Finger */}
            <path
              d="M108 125 C100 100 95 80 110 75 C122 70 128 85 125 125 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            <rect x="104" y="85" width="14" height="20" rx="4" fill={currentTheme.tprColor} />

            {/* Middle Finger */}
            <path
              d="M128 125 C125 90 125 65 140 62 C152 60 156 80 150 125 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            <rect x="132" y="75" width="15" height="24" rx="4" fill={currentTheme.tprColor} />

            {/* Ring Finger */}
            <path
              d="M152 125 C152 95 155 72 168 70 C180 68 182 85 174 125 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            <rect x="156" y="82" width="14" height="22" rx="4" fill={currentTheme.tprColor} />

            {/* Pinky Finger */}
            <path
              d="M174 130 C178 105 182 88 192 88 C202 88 200 105 192 135 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            <rect x="180" y="96" width="12" height="18" rx="4" fill={currentTheme.tprColor} />

            {/* Thumb wrapping joystick top */}
            <path
              d="M95 170 C75 160 62 135 70 118 C78 102 98 115 108 140 Z"
              fill={currentTheme.mainColor}
              stroke="#0f172a"
              strokeWidth="3"
            />
            <rect x="72" y="125" width="22" height="14" rx="4" fill={currentTheme.tprColor} />
            <circle cx="85" cy="132" r="4" fill={currentTheme.palmColor} />
          </svg>

          {/* Action indicator tag */}
          <div className="absolute top-[0px] left-[-35px] bg-slate-950/90 border border-slate-700/80 px-2 py-0.5 rounded-md text-[9px] font-mono text-amber-400 font-bold whitespace-nowrap shadow-lg backdrop-blur-sm flex items-center gap-1">
            <Hand className="w-2.5 h-2.5 text-amber-400" />
            <span>
              {isPooh
                ? `POOH: ${Math.round(joystickPosition * 100)}%`
                : isRih
                ? `RIH: ${Math.round(Math.abs(joystickPosition) * 100)}%`
                : 'JOYSTICK (Y)'}
            </span>
          </div>
        </motion.div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* LEFT HAND: Dynamically Targets Exact Button / Lever Being Actuated    */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {targetCoords && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: targetCoords.x - 70, y: targetCoords.y + 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: targetCoords.x - 45,
              y: targetCoords.y - 70,
            }}
            exit={{ opacity: 0, scale: 0.85, y: targetCoords.y + 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="absolute w-28 h-40 origin-bottom-left pointer-events-none"
          >
            <svg
              viewBox="0 0 240 320"
              className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.7)] opacity-90"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Forearm & Sleeve */}
              <path
                d="M150 320 L130 240 L45 240 L10 320 Z"
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="3"
              />
              <path d="M140 280 L30 280" stroke="#84cc16" strokeWidth="8" strokeLinecap="round" />

              {/* Glove Cuff */}
              <rect
                x="40"
                y="215"
                width="95"
                height="32"
                rx="8"
                fill={currentTheme.cuffColor}
                stroke="#334155"
                strokeWidth="2"
              />
              <rect x="50" y="222" width="75" height="14" rx="4" fill={currentTheme.mainColor} />

              {/* Hand Back */}
              <path
                d="M145 215 C150 170 145 130 125 110 C105 90 55 95 45 135 C35 175 40 215 45 225 Z"
                fill={currentTheme.mainColor}
                stroke="#0f172a"
                strokeWidth="3"
              />

              {/* TPR Armor */}
              <g fill={currentTheme.tprColor} stroke="#0f172a" strokeWidth="1.5">
                <rect x="116" y="145" width="14" height="35" rx="5" />
                <rect x="94" y="138" width="16" height="42" rx="5" />
                <rect x="72" y="140" width="16" height="40" rx="5" />
                <rect x="53" y="148" width="13" height="32" rx="5" />
              </g>

              {/* Extended Index & Thumb Pinching / Actuating Control */}
              <path
                d="M132 125 C140 90 145 60 130 52 C118 48 112 68 115 125 Z"
                fill={currentTheme.mainColor}
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              <rect x="122" y="65" width="16" height="26" rx="4" fill={currentTheme.tprColor} />

              {/* Thumb Pinching */}
              <path
                d="M145 170 C165 160 178 135 170 118 C162 102 142 115 132 140 Z"
                fill={currentTheme.mainColor}
                stroke="#0f172a"
                strokeWidth="3"
              />
              <rect x="146" y="125" width="22" height="14" rx="4" fill={currentTheme.tprColor} />

              {/* Folded remaining fingers */}
              <path d="M112 125 C110 100 100 85 90 90 C80 95 85 115 88 130 Z" fill={currentTheme.mainColor} stroke="#0f172a" strokeWidth="2" />
              <path d="M88 125 C85 105 75 90 68 95 C60 100 65 118 68 135 Z" fill={currentTheme.mainColor} stroke="#0f172a" strokeWidth="2" />
            </svg>

            {/* Target Label Badge */}
            <div className="absolute top-[5px] left-[-20px] bg-slate-950/90 border border-emerald-500/80 px-2 py-0.5 rounded-md text-[9px] font-mono text-emerald-400 font-bold whitespace-nowrap shadow-lg flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
              <span>{targetCoords.label}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
