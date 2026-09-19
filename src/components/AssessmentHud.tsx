import React, { useEffect, useRef, useState } from 'react';
import { SimulatorState } from '../types';
import { useT } from '../i18n';
import { Timer, StopCircle, Activity, Eye, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

interface AssessmentHudProps {
  state: SimulatorState;
  onEnd: () => void;
}

const fmt = (totalSec: number): string => {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Floating status HUD for a live timed assessment run. Starts top-LEFT but is
 * DRAGGABLE (grip the header) and COLLAPSIBLE, so it never permanently hides the
 * depth/controls underneath it. Shows the run timer, events handled, hints used,
 * and an always-available End Run button.
 */
export const AssessmentHud: React.FC<AssessmentHudProps> = ({ state, onEnd }) => {
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 16, y: 80 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const a = state.assessment;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Drag handling (pointer events started on the header).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const maxX = window.innerWidth - 220;
      const maxY = window.innerHeight - 80;
      setPos({
        x: Math.max(4, Math.min(maxX, e.clientX - dragRef.current.dx)),
        y: Math.max(4, Math.min(maxY, e.clientY - dragRef.current.dy)),
      });
    };
    const onUp = () => (dragRef.current = null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!a || !a.active || a.ended) return null;

  const elapsedSec = (now - a.startedAt) / 1000;
  const remainingSec = Math.max(0, a.targetDurationSec - elapsedSec);
  const eventsHandled = a.events.length;
  const inEvent = !!state.emergencyScenarioId;
  const timeCritical = remainingSec <= 30;

  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  return (
    <div
      className="fixed z-[90] w-[260px] max-w-[calc(100vw-2rem)] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="rounded-xl border-2 border-red-500/60 bg-slate-900 text-white shadow-2xl overflow-hidden">
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 bg-red-600/90 border-b border-red-400/40 cursor-move touch-none"
          onPointerDown={startDrag}
          title={t('assessmentHud.drag')}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="w-4 h-4 flex-shrink-0 opacity-70" />
            <Activity className="w-4 h-4 flex-shrink-0 animate-pulse" />
            <span className="text-[12px] font-bold truncate">{t('assessmentHud.title')}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`flex items-center gap-1 font-mono text-sm font-bold ${
                timeCritical ? 'text-amber-200 animate-pulse' : ''
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              {fmt(remainingSec)}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setCollapsed((c) => !c)}
              className="p-0.5 rounded hover:bg-black/20"
              title={collapsed ? t('assessmentHud.expand') : t('assessmentHud.collapse')}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="p-3 space-y-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('assessmentHud.operator')}</span>
              <span className="font-semibold truncate max-w-[140px]">{a.operator.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('assessmentHud.mode')}</span>
              <span className="font-semibold">
                {t(a.difficulty === 'realistic' ? 'assessment.diff.realistic' : 'assessment.diff.guided')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('assessmentHud.handled')}</span>
              <span className="font-mono font-bold">{eventsHandled}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {t('assessmentHud.hints')}
              </span>
              <span className="font-mono font-bold text-amber-300">{a.hintsUsedTotal}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('assessmentHud.status')}</span>
              <span
                className={`font-semibold ${
                  inEvent ? 'text-red-300 animate-pulse' : 'text-emerald-300'
                }`}
              >
                {inEvent ? t('assessmentHud.status.active') : t('assessmentHud.status.monitoring')}
              </span>
            </div>

            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700">
              {t('assessmentHud.elapsed', { time: fmt(elapsedSec) })}
            </div>

            <button
              type="button"
              onClick={onEnd}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-semibold text-xs transition-all"
            >
              <StopCircle className="w-4 h-4" />
              {t('assessmentHud.btn.end')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
