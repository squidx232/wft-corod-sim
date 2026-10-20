/**
 * Code-split entry points for heavy / rarely-shown UI.
 *
 * - `Rig3DViewport` is the only module that imports three.js (~700 kB min),
 *   so loading it lazily keeps three.js out of the critical startup bundle.
 * - Modals and secondary panels only appear on demand.
 *
 * Every export is a drop-in replacement for the named component (same props)
 * wrapped in its own <Suspense>, so a chunk loading never blanks the whole app.
 */
import React, { ComponentType, ReactNode, Suspense, lazy } from 'react';

type Loader<P> = () => Promise<ComponentType<P>>;

export function lazyNamed<P extends object>(loader: Loader<P>, fallback: ReactNode = null) {
  const Lazy = lazy(() => loader().then((Component) => ({ default: Component }))) as unknown as ComponentType<P>;
  const Wrapped = (props: P) => (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
  return Object.assign(Wrapped, { preload: loader });
}

const ViewportFallback = () => (
  <div
    className="w-full h-full min-h-[320px] rounded-xl bg-slate-900 flex items-center justify-center"
    role="status"
    aria-label="Loading 3D scene"
  >
    <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-amber-400 animate-spin" />
  </div>
);

export const Rig3DViewport = lazyNamed(
  () => import('./Rig3DViewport').then((m) => m.Rig3DViewport),
  <ViewportFallback />,
);

export const LeaderboardModal = lazyNamed(() => import('./LeaderboardModal').then((m) => m.LeaderboardModal));
export const AssessmentReportModal = lazyNamed(() => import('./AssessmentReportModal').then((m) => m.AssessmentReportModal));
export const GlossaryModal = lazyNamed(() => import('./GlossaryModal').then((m) => m.GlossaryModal));
export const ManualReferenceModal = lazyNamed(() => import('./ManualReferenceModal').then((m) => m.ManualReferenceModal));
export const JsaModal = lazyNamed(() => import('./JsaModal').then((m) => m.JsaModal));
export const EngineStartModal = lazyNamed(() => import('./EngineStartModal').then((m) => m.EngineStartModal));
export const EmergencyDrillModal = lazyNamed(() => import('./EmergencyDrillModal').then((m) => m.EmergencyDrillModal));
export const ControlBindingsPanel = lazyNamed(() => import('./ControlBindingsPanel').then((m) => m.ControlBindingsPanel));
export const PerformanceAnalytics = lazyNamed(() => import('./PerformanceAnalytics').then((m) => m.PerformanceAnalytics));
export const InstructorConsole = lazyNamed(() => import('./InstructorConsole').then((m) => m.InstructorConsole));
export const CraneControlPanel = lazyNamed(() => import('./CraneControlPanel').then((m) => m.CraneControlPanel));

/** Warm the 3D chunk while the intro splash is showing, without blocking first paint. */
if (typeof window !== 'undefined') {
  const warm = () => void Rig3DViewport.preload().catch(() => { /* retried on first render */ });
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(warm, { timeout: 2500 });
  else window.setTimeout(warm, 1200);
}
