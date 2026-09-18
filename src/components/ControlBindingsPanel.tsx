/**
 * ControlBindingsPanel — full settings modal for keyboard + gamepad bindings.
 * Lists every control grouped by category. Each control shows its bound key and
 * gamepad button; analog controls additionally show axis + inc/dec step slots.
 * Click a slot to capture a new key/button/axis; right-click (or the ✕) clears.
 */
import React, { useState } from 'react';
import { X, Keyboard, Gamepad2, RotateCcw, Search } from 'lucide-react';
import { CONTROLS, CONTROL_CATEGORIES, ControlDef } from '../input/controlRegistry';
import { keyLabel, padButtonLabel, padAxisLabel } from '../input/bindings';
import { UseInputSystem, CaptureSlot } from '../input/useInputSystem';
import { useT } from '../i18n';

interface Props {
  input: UseInputSystem;
  onClose: () => void;
}

export const ControlBindingsPanel: React.FC<Props> = ({ input, onClose }) => {
  const {
    bindings, capture, startCapture, clearBindingSlot, resetAll, enabled, setEnabled, status,
    sharedAxes, setSharedAxes, activeMovementTarget, activeValueTarget,
  } = input;
  const { t } = useT();
  const [query, setQuery] = useState('');

  const isCapturing = (id: string, slot: CaptureSlot) =>
    capture?.controlId === id && capture?.slot === slot;

  const Slot = ({
    controlId, slot, value, kind,
  }: { controlId: string; slot: CaptureSlot; value: string; kind: 'key' | 'pad' | 'axis' }) => {
    const capturing = isCapturing(controlId, slot);
    return (
      <button
        type="button"
        onClick={() => startCapture(controlId, slot)}
        onContextMenu={(e) => { e.preventDefault(); clearBindingSlot(controlId, slot); }}
        title={t('bindings.legend.hint')}
        className={`min-w-[68px] px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-all
          ${capturing
            ? 'bg-amber-500 text-black border-amber-300 animate-pulse'
            : value === '—'
              ? 'bg-slate-100 text-slate-500 border-slate-300 hover:border-slate-400'
              : kind === 'key'
                ? 'bg-sky-50 text-sky-700 border-sky-300 hover:border-sky-500'
                : kind === 'axis'
                  ? 'bg-purple-50 text-purple-700 border-purple-300 hover:border-purple-500'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-500'}`}
      >
        {capturing ? 'Press…' : value}
      </button>
    );
  };

  const Row = ({ c }: { c: ControlDef }) => {
    const b = bindings[c.id] || {};
    return (
      <div className="flex items-center gap-2 py-1.5 border-b border-slate-200">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-slate-700 font-medium truncate">
            {c.label}
            {c.axisGroup && (
              <span className={`ml-1.5 text-[8px] font-mono px-1 py-0.5 rounded ${c.axisGroup === 'movement' ? 'bg-orange-50 text-orange-700' : 'bg-cyan-50 text-cyan-700'}`}>
                {c.axisGroup === 'movement' ? 'MOVE-AXIS' : 'VALUE-AXIS'}
              </span>
            )}
          </div>
          {c.hint && <div className="text-[10px] text-slate-500 truncate">{c.hint}</div>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {c.kind === 'analog' ? (
            c.axisGroup ? (
              // Analog TARGET: selector only. Adjust with the shared RT/LT (or
              // shared value keys) after selecting. No per-control +/- to avoid
              // multiple knobs responding at once.
              <>
                <span className="text-[9px] text-amber-700 font-mono" title={t('bindings.selectorHint')}>{t('bindings.selector')}</span>
                <Slot controlId={c.id} slot="selectorKey" kind="key" value={keyLabel(b.selectorKey)} />
                <Slot controlId={c.id} slot="selectorButton" kind="pad" value={padButtonLabel(b.selectorButton)} />
                <span className="text-[9px] text-slate-500 ml-1 italic">{t('bindings.thenShared')}</span>
              </>
            ) : (
              // Special analog (e.g. gripper drive) — driven directly, info only.
              <span className="text-[10px] text-cyan-700 font-mono italic px-2">{t('bindings.specialAnalog')}</span>
            )
          ) : (
            <>
              <Slot controlId={c.id} slot="key" kind="key" value={keyLabel(b.key)} />
              <Slot controlId={c.id} slot="gamepadButton" kind="pad" value={padButtonLabel(b.gamepadButton)} />
            </>
          )}
        </div>
      </div>
    );
  };

  const q = query.trim().toLowerCase();
  const filtered = (cat: string) =>
    CONTROLS.filter((c) => c.category === cat && (!q || c.label.toLowerCase().includes(q)));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white border-2 border-slate-300 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 bg-slate-100">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-emerald-700" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{t('bindings.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-1 rounded-full border ${status.gamepadConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
              {status.gamepadConnected ? t('bindings.connected') : t('bindings.disconnected')}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-300 bg-slate-50 flex-wrap">
          <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-emerald-500" />
            {t('bindings.inputEnabled')}
          </label>
          <div className="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1 flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('bindings.searchPlaceholder')}
              className="bg-transparent outline-none text-[12px] text-slate-700 w-full"
            />
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-300 hover:bg-red-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('bindings.resetBtn')}
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-slate-500 border-b border-slate-200 flex-wrap">
          <span className="flex items-center gap-1"><Keyboard className="w-3 h-3 text-sky-700" /> {t('bindings.legend.key')}</span>
          <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3 text-emerald-700" /> {t('bindings.legend.pad')}</span>
          <span className="flex items-center gap-1"><span className="text-purple-700">◑</span> {t('bindings.legend.axis')}</span>
          <span className="ml-auto italic">{t('bindings.legend.hint')}</span>
        </div>

        {/* Shared-axis selector scheme explainer + config */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-600 mb-1.5">
            {t('bindings.sharedExplain')}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono">
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-300 rounded-md px-2 py-1 flex-wrap">
              <span className="text-orange-700 font-bold">{t('bindings.moveAxis')}</span>
              <span className="text-slate-500">{t('bindings.moveAxisLabel')}</span>
              <button onClick={() => startCapture('__sharedMove', 'gamepadAxis')} className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-300">
                {isCapturing('__sharedMove', 'gamepadAxis') ? 'Move…' : padAxisLabel(sharedAxes.movementAxis)}
              </button>
              <button onClick={() => setSharedAxes({ ...sharedAxes, movementInvert: !sharedAxes.movementInvert })} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-400" title={t('bindings.invHint')}>
                {sharedAxes.movementInvert ? 'Inv ✓' : 'Inv ✗'}
              </button>
              <span className="text-slate-500 ml-1">{t('bindings.decButton')}</span>
              <button onClick={() => startCapture('__sharedMoveDec', 'gamepadButton')} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300" title={t('bindings.decButtonHint')}>
                {isCapturing('__sharedMoveDec', 'gamepadButton') ? '…' : padButtonLabel(sharedAxes.movementDecButton)}
              </button>
              <span className="text-slate-500">{t('bindings.incButton')}</span>
              <button onClick={() => startCapture('__sharedMoveInc', 'gamepadButton')} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300" title={t('bindings.incButtonHint')}>
                {isCapturing('__sharedMoveInc', 'gamepadButton') ? '…' : padButtonLabel(sharedAxes.movementIncButton)}
              </button>
              <span className="text-slate-500 ml-1">▶ <span className="text-orange-700">{activeMovementTarget ? (CONTROLS.find(c=>c.id===activeMovementTarget)?.label ?? activeMovementTarget) : '—'}</span></span>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 rounded-md px-2 py-1 flex-wrap">
              <span className="text-cyan-700 font-bold">{t('bindings.valueAxis')}</span>
              <span className="text-slate-500">{t('bindings.valueAxisLabel')}</span>
              <button onClick={() => startCapture('__sharedValue', 'gamepadAxis')} className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-300">
                {isCapturing('__sharedValue', 'gamepadAxis') ? 'Move…' : padAxisLabel(sharedAxes.valueAxis)}
              </button>
              <button onClick={() => setSharedAxes({ ...sharedAxes, valueInvert: !sharedAxes.valueInvert })} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-400" title={t('bindings.invHint')}>
                {sharedAxes.valueInvert ? 'Inv ✓' : 'Inv ✗'}
              </button>
              <span className="text-slate-500 ml-1">{t('bindings.decButton')} (LT)</span>
              <button onClick={() => startCapture('__sharedValueDec', 'gamepadButton')} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300" title={t('bindings.valueDecButtonHint')}>
                {isCapturing('__sharedValueDec', 'gamepadButton') ? '…' : padButtonLabel(sharedAxes.valueDecButton)}
              </button>
              <span className="text-slate-500">{t('bindings.incButton')} (RT)</span>
              <button onClick={() => startCapture('__sharedValueInc', 'gamepadButton')} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300" title={t('bindings.valueIncButtonHint')}>
                {isCapturing('__sharedValueInc', 'gamepadButton') ? '…' : padButtonLabel(sharedAxes.valueIncButton)}
              </button>
              <span className="text-slate-500 ml-1">▶ <span className="text-cyan-700">{activeValueTarget ? (CONTROLS.find(c=>c.id===activeValueTarget)?.label ?? activeValueTarget) : '—'}</span></span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {CONTROL_CATEGORIES.map((cat) => {
            const rows = filtered(cat);
            if (!rows.length) return null;
            return (
              <div key={cat} className="mb-3">
                <div className="sticky top-0 bg-white py-1 text-[11px] font-black uppercase tracking-widest text-emerald-700/80 border-b border-emerald-300 z-10">
                  {cat}
                </div>
                {rows.map((c) => <Row key={c.id} c={c} />)}
              </div>
            );
          })}
        </div>

        {/* Capture hint footer */}
        {capture && (
          <div className="px-4 py-2 bg-amber-500 text-black text-[12px] font-bold text-center">
            {t('bindings.capture')}
          </div>
        )}
      </div>
    </div>
  );
};
