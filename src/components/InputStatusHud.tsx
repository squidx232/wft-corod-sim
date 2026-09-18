/**
 * InputStatusHud — small floating widget showing gamepad connection status,
 * an enable/disable toggle for input capture, the last input seen, and a button
 * to open the full ControlBindingsPanel.
 */
import React from 'react';
import { useT } from '../i18n';
import { Gamepad2, Keyboard, Settings2, Power, Crosshair } from 'lucide-react';
import { UseInputSystem } from '../input/useInputSystem';
import { CONTROLS_BY_ID } from '../input/controlRegistry';

interface Props {
  input: UseInputSystem;
  onOpenPanel: () => void;
}

export const InputStatusHud: React.FC<Props> = ({ input, onOpenPanel }) => {
  const { status, enabled, setEnabled, activeMovementTarget, activeValueTarget } = input;
  const moveLabel = activeMovementTarget ? CONTROLS_BY_ID[activeMovementTarget]?.label : null;
  const valLabel = activeValueTarget ? CONTROLS_BY_ID[activeValueTarget]?.label : null;
  return (
    <div className="fixed bottom-3 right-3 z-[150] flex items-center gap-2 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-2.5 py-1.5 shadow-xl select-none">
      {/* Active selector targets */}
      {(moveLabel || valLabel) && (
        <>
          <div className="flex flex-col gap-0.5 text-[9px] font-mono max-w-[130px]">
            {moveLabel && (
              <div className="flex items-center gap-1 text-orange-300 truncate" title={`Movement axis → ${moveLabel}`}>
                <Crosshair className="w-3 h-3 shrink-0" /><span className="truncate">{moveLabel}</span>
              </div>
            )}
            {valLabel && (
              <div className="flex items-center gap-1 text-cyan-300 truncate" title={`Value axis → ${valLabel}`}>
                <Crosshair className="w-3 h-3 shrink-0" /><span className="truncate">{valLabel}</span>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-white/10" />
        </>
      )}
      {/* Gamepad status */}
      <div
        className={`flex items-center gap-1.5 text-[11px] font-mono ${status.gamepadConnected ? 'text-emerald-300' : 'text-neutral-500'}`}
        title={status.gamepadId || 'No gamepad detected'}
      >
        <Gamepad2 className="w-4 h-4" />
        <span className="hidden sm:inline">{status.gamepadConnected ? 'Pad' : 'No pad'}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Keyboard + last input */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-300" title="Last input">
        <Keyboard className="w-4 h-4" />
        <span className="hidden sm:inline text-neutral-400">{status.lastInput || '—'}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Enable toggle */}
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        title={enabled ? 'Input enabled (click to disable)' : 'Input disabled (click to enable)'}
        className={`flex items-center gap-1 text-[11px] font-bold uppercase px-1.5 py-0.5 rounded-md border transition-all
          ${enabled ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-neutral-900 text-neutral-500 border-neutral-700'}`}
      >
        <Power className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{enabled ? t('inputHud.on') : t('inputHud.off')}</span>
      </button>

      {/* Open bindings panel */}
      <button
        type="button"
        onClick={onOpenPanel}
        title={t('inputHud.configureBindings')}
        className="flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-400 hover:bg-slate-300"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('inputHud.bindings')}</span>
      </button>
    </div>
  );
};
