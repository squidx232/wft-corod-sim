/**
 * StatusBanner — a plain-English "what's happening / what to do next" banner for
 * trainees and non-technical operators. It reads the live simulator state and
 * derives:
 *   - an overall HEALTH light (green = good, amber = caution, red = problem)
 *   - a short plain-language description of the current situation
 *   - the single most useful NEXT ACTION to take
 *
 * It deliberately avoids jargon in the main text (technical terms appear only in
 * small parentheses) so anyone can follow along.
 */
import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, ArrowRight } from 'lucide-react';
import { SimulatorState } from '../types';

interface Props {
  state: SimulatorState;
}

type Health = 'good' | 'caution' | 'danger';

interface Assessment {
  health: Health;
  title: string;    // what's happening (plain english)
  detail: string;   // a little more context
  nextAction: string; // what to do next
}

function assess(state: SimulatorState): Assessment {
  const h = state.hydraulics;
  const rod = state.rod;
  const bop = state.bop;

  // 1) Emergencies first
  if (h.emergencyStopTripped) {
    return {
      health: 'danger',
      title: 'Emergency Stop is active — everything is halted.',
      detail: 'The machine is locked out for safety.',
      nextAction: 'When the area is safe, press “Emergency Reset” to restore controls.',
    };
  }
  if (state.activeEmergency && state.activeEmergency !== 'none') {
    return {
      health: 'danger',
      title: 'A fault is in progress — respond now.',
      detail: 'The simulator has injected an emergency condition.',
      nextAction: 'Follow the on-screen emergency prompt, or hit the red Emergency Stop.',
    };
  }

  // 2) Startup sequence
  if (!h.engineRunning) {
    return {
      health: 'caution',
      title: 'Engine is off — nothing will move yet.',
      detail: 'Pressures are low because the pump isn’t turning. This is normal before startup.',
      nextAction: 'Start the engine (press E) to build up pressure.',
    };
  }
  if (!h.ptoEngaged) {
    return {
      health: 'caution',
      title: 'Engine running, but power to the hydraulics is off (PTO).',
      detail: 'The engine idles and builds charge pressure, but the drive/gripper aren’t powered yet.',
      nextAction: 'Engage the transmission/PTO (press P) to power the controls.',
    };
  }

  // 3) Low charge pressure (freewheel risk) — only meaningful with engine on
  if (h.chargePressure < 250) {
    return {
      health: 'danger',
      title: 'Low charge pressure — the rods could free-fall (freewheel).',
      detail: 'Below 250 psi the brake can’t hold the string safely.',
      nextAction: 'Reduce speed and set the Safety Lever; check the engine/pump.',
    };
  }

  // 4) Moving
  const speed = Math.abs(rod.rodSpeedFtPerMin);
  if (speed > 0.5) {
    const dir = rod.rodSpeedFtPerMin > 0 ? 'into the well (running in / RIH)' : 'out of the well (pulling out / POOH)';
    return {
      health: 'good',
      title: `Rods are moving ${dir}.`,
      detail: `Depth ${Math.round(rod.currentDepthFt).toLocaleString()} ft • Speed ${speed.toFixed(0)} ft/min • Weight ${Math.round(rod.totalStringWeightLbs).toLocaleString()} lb.`,
      nextAction: 'Watch the weight and pressures. Push the drive stick back to center to stop.',
    };
  }

  // 5) Ready / idle but powered
  const bopClosed = bop.reganBopClosed;
  return {
    health: 'good',
    title: 'Ready — powered and holding steady.',
    detail: `Depth ${Math.round(rod.currentDepthFt).toLocaleString()} ft • Well valve (BOP) is ${bopClosed ? 'CLOSED' : 'open'}.`,
    nextAction: 'Choose a direction and use the drive stick (right stick / R = in, F = out) to move the rods.',
  };
}

const STYLES: Record<Health, { bar: string; icon: React.ReactNode; chip: string; ring: string }> = {
  good: {
    bar: 'from-emerald-950/80 to-emerald-900/30 border-emerald-700',
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
    chip: 'bg-emerald-600 text-white',
    ring: 'ring-emerald-500/40',
  },
  caution: {
    bar: 'from-amber-950/80 to-amber-900/30 border-amber-700',
    icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
    chip: 'bg-amber-500 text-black',
    ring: 'ring-amber-500/40',
  },
  danger: {
    bar: 'from-red-950/90 to-red-900/40 border-red-600',
    icon: <AlertOctagon className="w-6 h-6 text-red-400 animate-pulse" />,
    chip: 'bg-red-600 text-white',
    ring: 'ring-red-500/50',
  },
};

export const StatusBanner: React.FC<Props> = ({ state }) => {
  const a = assess(state);
  const s = STYLES[a.health];
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-r ${s.bar} px-4 py-3 shadow-lg ring-1 ${s.ring} flex items-center gap-4`}
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${s.chip}`}>
            {a.health === 'good' ? 'All Good' : a.health === 'caution' ? 'Caution' : 'Action Needed'}
          </span>
          <span className="text-sm sm:text-base font-bold text-slate-100">{a.title}</span>
        </div>
        <div className="text-[12px] text-slate-300 mt-0.5">{a.detail}</div>
      </div>
      <div className="hidden md:flex items-center gap-2 shrink-0 max-w-[42%]">
        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="text-[12px] text-slate-200">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">Do this next</span>
          {a.nextAction}
        </div>
      </div>
    </div>
  );
};
