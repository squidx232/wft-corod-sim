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
import { useT } from '../i18n';

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

function assess(state: SimulatorState, t: (key: string, vars?: Record<string, string | number>) => string): Assessment {
  const h = state.hydraulics;
  const rod = state.rod;
  const bop = state.bop;

  // 1) Emergencies first
  if (h.emergencyStopTripped) {
    return {
      health: 'danger',
      title: t('banner.emergency.active.title'),
      detail: t('banner.emergency.active.detail'),
      nextAction: t('banner.emergency.active.action'),
    };
  }
  if (state.activeEmergency && state.activeEmergency !== 'none') {
    return {
      health: 'danger',
      title: t('banner.fault.title'),
      detail: t('banner.fault.detail'),
      nextAction: t('banner.fault.action'),
    };
  }

  // 1b) Squeeze-pressure alarm (Slip / Free-Fall / Emergency timeout). This must
  // take precedence over the normal "moving/ready" states so the banner reflects
  // the danger instead of reporting "All good" during a slip or free-fall.
  if (state.alarmTier && state.alarmTier !== 'none') {
    const deficit = Math.max(
      0,
      Math.round(state.rod.calculatedSqueezeRequiredPsi - state.hydraulics.squeezePressure),
    );
    return {
      health: 'danger',
      title: t(`banner.alarm.${state.alarmTier}.title`),
      detail: t(`banner.alarm.${state.alarmTier}.detail`, { psi: deficit }),
      nextAction: t('banner.alarm.action'),
    };
  }

  // 2) Startup sequence
  if (!h.engineRunning) {
    return {
      health: 'caution',
      title: t('banner.startup.engineOff.title'),
      detail: t('banner.startup.engineOff.detail'),
      nextAction: t('banner.startup.engineOff.action'),
    };
  }
  if (!h.ptoEngaged) {
    return {
      health: 'caution',
      title: t('banner.startup.ptoOff.title'),
      detail: t('banner.startup.ptoOff.detail'),
      nextAction: t('banner.startup.ptoOff.action'),
    };
  }

  // 3) Low charge pressure (freewheel risk) — only meaningful with engine on
  if (h.chargePressure < 250) {
    return {
      health: 'danger',
      title: t('banner.lowCharge.title'),
      detail: t('banner.lowCharge.detail'),
      nextAction: t('banner.lowCharge.action'),
    };
  }

  // 4) Moving
  const speed = Math.abs(rod.rodSpeedFtPerMin);
  if (speed > 0.5) {
    const direction = rod.rodSpeedFtPerMin > 0 ? 'rih' : 'pooh';
    const depthStr = Math.round(rod.currentDepthFt).toLocaleString();
    const speedStr = speed.toFixed(0);
    const weightStr = Math.round(rod.totalStringWeightLbs).toLocaleString();
    return {
      health: 'good',
      title: t('banner.moving.title', { direction: t(`banner.moving.dir.${direction}`) }),
      detail: t('banner.moving.detail', { depth: depthStr, speed: speedStr, weight: weightStr }),
      nextAction: t('banner.moving.action'),
    };
  }

  // 5) Ready / idle but powered
  const bopClosed = bop.reganBopClosed;
  const bopState = bopClosed ? 'closed' : 'open';
  const depthStr = Math.round(rod.currentDepthFt).toLocaleString();
  return {
    health: 'good',
    title: t('banner.ready.title'),
    detail: t('banner.ready.detail', { depth: depthStr, bopState: t(`banner.bopState.${bopState}`) }),
    nextAction: t('banner.ready.action'),
  };
}

const STYLES: Record<Health, { border: string; bg: string; icon: React.ReactNode; chip: string; chipLabel: string }> = {
  good: {
    border: 'border-green-300',
    bg: 'bg-green-50',
    icon: <CheckCircle2 className="w-6 h-6 text-green-700" />,
    chip: 'bg-green-700 text-white',
    chipLabel: 'status.good',
  },
  caution: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    icon: <AlertTriangle className="w-6 h-6 text-amber-700" />,
    chip: 'bg-amber-600 text-white',
    chipLabel: 'status.caution',
  },
  danger: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    icon: <AlertOctagon className="w-6 h-6 text-red-700 animate-pulse" />,
    chip: 'bg-red-700 text-white',
    chipLabel: 'status.action',
  },
};

export const StatusBanner: React.FC<Props> = ({ state }) => {
  const { t } = useT();
  const a = assess(state, t);
  const s = STYLES[a.health];
  return (
    <div
      className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 shadow-sm flex items-center gap-4`}
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-eyebrow font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.chip}`}>
            {t(s.chipLabel)}
          </span>
          <span className="text-sm sm:text-base font-semibold text-slate-800">{a.title}</span>
        </div>
        <div className="text-2xs text-slate-600 mt-0.5">{a.detail}</div>
      </div>
      <div className="hidden md:flex items-center gap-2 shrink-0 max-w-[42%]">
        <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="text-2xs text-slate-700">
          <span className="eyebrow block">{t('status.doThisNext')}</span>
          {a.nextAction}
        </div>
      </div>
    </div>
  );
};
