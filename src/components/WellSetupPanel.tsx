/**
 * Well Setup tab — combines two operator-configuration modules:
 *
 *  1. Equipment Configuration (Injector Profiles + measurement units)
 *     Request 1: select the active injector type (different mechanical
 *     properties → different squeeze thresholds / performance curves) and the
 *     working measurement units.
 *
 *  2. Well Design & String Architecture
 *     Request 2: configure well specs prior to a run — target depth, run
 *     operation type, active rod size, and per-rod-size nominal weights. Select
 *     a pre-saved design or build a new one from scratch, then Apply it to the
 *     live simulation.
 *
 * Persistence is delegated to utils/equipmentConfig + utils/wellDesigns
 * (localStorage; presets are merged in and cannot be overwritten).
 */
import React, { useMemo, useState } from 'react';
import { Sliders, Layers, Save, Trash2, CheckCircle2, PlusCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { SimulatorState, JobType, RodSize } from '../types';
import { Card, Button, Badge, cx } from './ui';
import { soundManager } from '../utils/audio';
import {
  InjectorProfile,
  requiredSqueezeForWeight,
} from '../data/injectorProfiles';
import {
  WellDesign,
  RodSegment,
  ALL_ROD_SIZES,
  createBlankWellDesign,
  wellDesignTotalDepthFt,
} from '../data/wellDesigns';
import { ROD_SPECIFICATIONS } from '../data/manualReference';
import {
  saveInjectorProfile,
  deleteInjectorProfile,
  loadAllInjectorProfiles,
} from '../utils/equipmentConfig';
import {
  saveWellDesign,
  deleteWellDesign,
  loadAllWellDesigns,
} from '../utils/wellDesigns';

const JOB_TYPES: JobType[] = ['install', 'surface', 'rerun', 'fishing', 'pump_change', 'slant'];

interface WellSetupPanelProps {
  state: SimulatorState;
  injectorProfiles: InjectorProfile[];
  wellDesigns: WellDesign[];
  /** Select the active injector profile (persisted by parent). */
  onSelectInjectorProfile: (id: string) => void;
  /** Change measurement units (persisted by parent). */
  onSetMeasurementUnits: (units: 'imperial' | 'metric') => void;
  /** Refresh injector profiles list after a save/delete. */
  onInjectorProfilesChanged: (profiles: InjectorProfile[]) => void;
  /** Refresh well designs list after a save/delete. */
  onWellDesignsChanged: (designs: WellDesign[]) => void;
  /** Apply a well design to the live simulation (depth, rod size, weights). */
  onApplyWellDesign: (design: WellDesign) => void;
}

export const WellSetupPanel: React.FC<WellSetupPanelProps> = ({
  state,
  injectorProfiles,
  wellDesigns,
  onSelectInjectorProfile,
  onSetMeasurementUnits,
  onInjectorProfilesChanged,
  onWellDesignsChanged,
  onApplyWellDesign,
}) => {
  const activeProfile =
    injectorProfiles.find((p) => p.id === state.equipmentConfig.activeInjectorProfileId) ||
    injectorProfiles[0];

  // Local editable draft for the well-design builder. Always carries a segments
  // array (tapered string is the source of truth).
  const [draft, setDraft] = useState<WellDesign>(() =>
    createBlankWellDesign(`wd-${Date.now()}`),
  );

  const segments: RodSegment[] = draft.segments ?? [];
  const draftTotalDepthFt = wellDesignTotalDepthFt(draft);

  const units = state.equipmentConfig.measurementUnits;
  const isMetric = units === 'metric';

  // Preview: total string weight at TD summed across all tapered segments, and
  // the required squeeze that implies for the active injector profile.
  const previewStringWeight = useMemo(
    () => segments.reduce((sum, s) => sum + Math.max(0, s.lengthFt) * s.weightLbsPerFt, 0),
    [segments],
  );
  const previewRequiredSqueeze = useMemo(() => {
    if (!activeProfile) return 0;
    return requiredSqueezeForWeight(activeProfile, previewStringWeight);
  }, [activeProfile, previewStringWeight]);

  const loadDesignIntoDraft = (d: WellDesign) => {
    // Ensure the loaded design has a segments array (legacy → single segment).
    const segs: RodSegment[] =
      d.segments && d.segments.length > 0
        ? d.segments.map((s) => ({ ...s }))
        : [{ rodSize: d.activeRodSize, lengthFt: d.targetDepthFt, weightLbsPerFt: d.rodSizeWeights[d.activeRodSize] ?? 2.04 }];
    setDraft({
      ...d,
      id: d.isPreset ? `wd-${Date.now()}` : d.id,
      name: d.isPreset ? `${d.name} (Copy)` : d.name,
      rodSizeWeights: { ...d.rodSizeWeights },
      segments: segs,
    });
  };

  // ---- Segment mutators -----------------------------------------------------
  const commitSegments = (segs: RodSegment[]) =>
    setDraft((d) => ({
      ...d,
      segments: segs,
      targetDepthFt: segs.reduce((sum, s) => sum + Math.max(0, s.lengthFt), 0),
      activeRodSize: segs[0]?.rodSize ?? d.activeRodSize,
    }));

  const addSegment = () => {
    const last = segments[segments.length - 1];
    const size: RodSize = last?.rodSize ?? '#6R';
    commitSegments([
      ...segments,
      { rodSize: size, lengthFt: 1000, weightLbsPerFt: ROD_SPECIFICATIONS[size]?.weightLbsPerFt ?? 2.04 },
    ]);
    soundManager.playMetalTap();
  };
  const removeSegment = (i: number) => {
    if (segments.length <= 1) return; // keep at least one section
    commitSegments(segments.filter((_, idx) => idx !== i));
    soundManager.playMetalTap();
  };
  const moveSegment = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= segments.length) return;
    const next = segments.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commitSegments(next);
  };
  const updateSegment = (i: number, patch: Partial<RodSegment>) => {
    const next = segments.map((s, idx) => {
      if (idx !== i) return s;
      const merged = { ...s, ...patch };
      // When the rod size changes, default its weight from the spec table.
      if (patch.rodSize && patch.rodSize !== s.rodSize) {
        merged.weightLbsPerFt = ROD_SPECIFICATIONS[patch.rodSize]?.weightLbsPerFt ?? s.weightLbsPerFt;
      }
      return merged;
    });
    commitSegments(next);
  };

  const handleSaveProfileCopy = () => {
    if (!activeProfile) return;
    const copy: InjectorProfile = {
      ...activeProfile,
      id: `inj-${Date.now()}`,
      name: `${activeProfile.name} (Copy)`,
      isPreset: false,
      curve: activeProfile.curve.map((c) => ({ ...c })),
    };
    saveInjectorProfile(copy);
    onInjectorProfilesChanged(loadAllInjectorProfiles());
    onSelectInjectorProfile(copy.id);
    soundManager.playMetalTap();
  };

  const handleDeleteProfile = (id: string) => {
    deleteInjectorProfile(id);
    onInjectorProfilesChanged(loadAllInjectorProfiles());
    soundManager.playMetalTap();
  };

  const handleSaveDraft = () => {
    saveWellDesign(draft);
    onWellDesignsChanged(loadAllWellDesigns());
    soundManager.playSuccessChime();
  };

  const handleDeleteDesign = (id: string) => {
    deleteWellDesign(id);
    onWellDesignsChanged(loadAllWellDesigns());
    soundManager.playMetalTap();
  };

  const fmtDepth = (ft: number) =>
    isMetric ? `${Math.round(ft * 0.3048)} m` : `${Math.round(ft)} ft`;

  return (
    <div className="space-y-6">
      {/* ============================ EQUIPMENT ============================ */}
      <Card>
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4">
          <div className="p-2 rounded-xl bg-blue-700 text-white">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Equipment Configuration</h3>
            <p className="text-xs text-slate-500">
              Active injector type &amp; measurement units — dictates squeeze thresholds &amp;
              performance curves.
            </p>
          </div>
          <Badge tone="neutral" className="ml-auto">Placeholder specs</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Injector selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Active Injector Type
            </label>
            <select
              value={activeProfile?.id ?? ''}
              onChange={(e) => {
                soundManager.playMetalTap();
                onSelectInjectorProfile(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {injectorProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isPreset ? '' : ' ★'}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Button variant="ghost" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveProfileCopy}>
                Save editable copy
              </Button>
              {activeProfile && !activeProfile.isPreset && (
                <Button
                  variant="ghost"
                  icon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                  onClick={() => handleDeleteProfile(activeProfile.id)}
                >
                  Delete
                </Button>
              )}
            </div>

            {/* Measurement units */}
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide pt-2">
              Measurement Units
            </label>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {(['imperial', 'metric'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => {
                    soundManager.playMetalTap();
                    onSetMeasurementUnits(u);
                  }}
                  className={cx(
                    'px-4 py-1.5 text-xs font-semibold capitalize transition-colors',
                    units === u ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Injector spec readout */}
          {activeProfile && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">
                {activeProfile.name} — Specifications
              </div>
              <SpecRow label="Cylinder count" value={`${activeProfile.cylinderCount}`} />
              <SpecRow label="Contact area" value={`${activeProfile.contactAreaSqIn.toFixed(2)} in²`} />
              <SpecRow label="Max squeeze" value={`${activeProfile.maxSqueezePsi} psi`} />
              <SpecRow label="Squeeze factor" value={`×${activeProfile.squeezeMultiplier.toFixed(2)}`} />
              <SpecRow
                label="Live required squeeze"
                value={`${Math.round(state.rod.calculatedSqueezeRequiredPsi)} psi`}
                highlight
              />
            </div>
          )}
        </div>
      </Card>

      {/* ============================ WELL DESIGN ============================ */}
      <Card>
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-700 text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Well Design &amp; String Architecture</h3>
            <p className="text-xs text-slate-500">
              Configure well specs before a run: target depth, run type, rod size &amp; nominal weights.
            </p>
          </div>
        </div>

        {/* Saved / preset designs */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Saved Designs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {wellDesigns.map((d) => {
              const isActive = state.activeWellDesignId === d.id;
              return (
                <div
                  key={d.id}
                  className={cx(
                    'rounded-xl border p-3 flex flex-col gap-2',
                    isActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">{d.name}</div>
                    {d.isPreset ? (
                      <Badge tone="neutral">Preset</Badge>
                    ) : (
                      <button
                        onClick={() => handleDeleteDesign(d.id)}
                        title="Delete design"
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fmtDepth(wellDesignTotalDepthFt(d))} • {d.runOperationType}
                    {' • '}
                    {d.segments && d.segments.length > 1
                      ? `${d.segments.length}-stage taper`
                      : d.activeRodSize}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="ghost"
                      icon={<PlusCircle className="w-3.5 h-3.5" />}
                      onClick={() => loadDesignIntoDraft(d)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="primary"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        soundManager.playSuccessChime();
                        onApplyWellDesign(d);
                      }}
                    >
                      {isActive ? 'Applied' : 'Apply'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Design builder */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Build / Edit Design
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Design name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Run operation type">
              <select
                value={draft.runOperationType}
                onChange={(e) => setDraft((d) => ({ ...d, runOperationType: e.target.value as JobType }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
              >
                {JOB_TYPES.map((j) => (
                  <option key={j} value={j}>{j.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label={`Total depth (${isMetric ? 'm' : 'ft'}) — derived`}>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono font-bold text-slate-700">
                {fmtDepth(draftTotalDepthFt)}
              </div>
            </Field>
          </div>

          {/* Tapered rod-string segments (ordered surface → bottom) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-600">
                Rod String Segments (surface → bottom)
              </div>
              <Button variant="ghost" icon={<PlusCircle className="w-3.5 h-3.5" />} onClick={addSegment}>
                Add section
              </Button>
            </div>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[2rem,1fr,1fr,1fr,auto] gap-2 px-1 mb-1 text-[10px] font-semibold uppercase text-slate-400">
              <span>#</span>
              <span>Rod size</span>
              <span>Length ({isMetric ? 'm' : 'ft'})</span>
              <span>Weight (lb/ft)</span>
              <span className="text-right">Order</span>
            </div>

            <div className="space-y-2">
              {segments.map((sg, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-[2rem,1fr,1fr,1fr,auto] gap-2 items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                >
                  <div className="text-xs font-mono font-bold text-slate-500">{i + 1}</div>
                  <select
                    value={sg.rodSize}
                    onChange={(e) => updateSegment(i, { rodSize: e.target.value as RodSize })}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {ALL_ROD_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={isMetric ? 10 : 25}
                    value={isMetric ? Math.round(sg.lengthFt * 0.3048) : Math.round(sg.lengthFt)}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      updateSegment(i, { lengthFt: Math.max(0, isMetric ? v / 0.3048 : v) });
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={sg.weightLbsPerFt}
                    onChange={(e) => updateSegment(i, { weightLbsPerFt: Number(e.target.value) || 0 })}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => moveSegment(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSegment(i, 1)}
                      disabled={i === segments.length - 1}
                      title="Move down"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeSegment(i)}
                      disabled={segments.length <= 1}
                      title="Remove section"
                      className="p-1 rounded text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveDraft}>
              Save Design
            </Button>
            <Button
              variant="secondary"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => {
                handleSaveDraft();
                onApplyWellDesign(draft);
              }}
            >
              Save &amp; Apply
            </Button>
            <Button
              variant="ghost"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setDraft(createBlankWellDesign(`wd-${Date.now()}`))}
            >
              New blank
            </Button>
            <span className="text-xs text-slate-500 ml-auto">
              Planned string weight @ TD: <b>{Math.round(previewStringWeight).toLocaleString()} lbs</b>
              {' '}→ required squeeze <b>{Math.round(previewRequiredSqueeze)} psi</b>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const SpecRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500">{label}</span>
    <span className={cx('font-semibold', highlight ? 'text-blue-700' : 'text-slate-800')}>{value}</span>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
    {children}
  </div>
);
