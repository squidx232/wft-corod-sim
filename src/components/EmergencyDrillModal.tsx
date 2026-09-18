import React, { useState, useEffect } from 'react';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import { useT } from '../i18n';
import {
  ShieldAlert,
  Volume2,
  Lock,
  Layers,
  Wrench,
  UserCheck,
  CheckCircle,
  AlertOctagon,
  Timer,
  Award,
  Zap,
} from 'lucide-react';

interface EmergencyDrillModalProps {
  state: SimulatorState;
  drillType: 'freefall' | 'blowout' | 'h2s' | 'overheat';
  onClose: () => void;
  onResolveEmergency: () => void;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onUpdateBop: (updates: Partial<SimulatorState['bop']>) => void;
}

export const EmergencyDrillModal: React.FC<EmergencyDrillModalProps> = ({
  state,
  drillType,
  onClose,
  onResolveEmergency,
  onUpdateHydraulics,
  onUpdateBop,
}) => {
  const { t } = useT();
  const [startTime] = useState<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [step1Done, setStep1Done] = useState<boolean>(false);
  const [step2Done, setStep2Done] = useState<boolean>(false);
  const [step3Done, setStep3Done] = useState<boolean>(false);
  const [step4Done, setStep4Done] = useState<boolean>(false);
  const [drillCompleted, setDrillCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (drillCompleted) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 50);
    return () => clearInterval(interval);
  }, [startTime, drillCompleted]);

  // Handle completion
  const checkFinished = (s1: boolean, s2: boolean, s3: boolean, s4: boolean) => {
    if (s1 && s2 && s3 && s4) {
      setDrillCompleted(true);
      soundManager.playSuccessChime();
      onResolveEmergency();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl bg-white border-4 border-red-400 shadow-xl p-6 text-slate-800 animate-in fade-in zoom-in-95">
        {/* Drill Header */}
        <div className="flex items-center justify-between border-b-2 border-red-400/60 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600 text-white animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <span className="text-eyebrow font-black px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-300">
                {t('drill.header.title')}
              </span>
              <h3 className="text-lg font-semibold text-white">
                {drillType === 'freefall' && t('drill.freefall.title')}
                {drillType === 'blowout' && t('drill.blowout.title')}
                {drillType === 'h2s' && t('drill.h2s.title')}
                {drillType === 'overheat' && t('drill.overheat.title')}
              </h3>
            </div>
          </div>

          {/* Reaction Timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-sm">
            <Timer className="w-4 h-4 text-amber-700" />
            <span className={drillCompleted ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
              {(elapsedMs / 1000).toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Drill Content based on Type */}
        {!drillCompleted ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-200">
              {drillType === 'freefall' && (
                <p>{t('drill.freefall.incident')}</p>
              )}
              {drillType === 'blowout' && (
                <p>{t('drill.blowout.incident')}</p>
              )}
              {drillType === 'h2s' && (
                <p>{t('drill.h2s.incident')}</p>
              )}
              {drillType === 'overheat' && (
                <p>{t('drill.overheat.incident')}</p>
              )}
            </div>

            {/* Interactive Step Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Step 1 */}
              <button
                id="btn-drill-step-1"
                disabled={step1Done}
                onClick={() => {
                  soundManager.playMetalTap();
                  setStep1Done(true);
                  if (drillType === 'freefall') {
                    onUpdateHydraulics({ safetyClampLever: 'ON', safetyPressure: 2800 });
                  } else if (drillType === 'blowout') {
                    soundManager.playAirHorn(1.2);
                  } else if (drillType === 'h2s') {
                    soundManager.playAirHorn(1.5);
                  } else if (drillType === 'overheat') {
                    onUpdateHydraulics({ gripperBrakeSwitch: true });
                  }
                  checkFinished(true, step2Done, step3Done, step4Done);
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  step1Done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-300 hover:border-amber-500 active:scale-98'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    step1Done ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
                  }`}
                >
                  {step1Done ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-800">
                    {drillType === 'freefall' && t('drill.step1.freefall')}
                    {drillType === 'blowout' && t('drill.step1.blowout')}
                    {drillType === 'h2s' && t('drill.step1.h2s')}
                    {drillType === 'overheat' && t('drill.step1.overheat')}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step1Done ? t('drill.step1.status.done') : t('drill.step1.status.pending')}
                  </span>
                </div>
              </button>

              {/* Step 2 */}
              <button
                id="btn-drill-step-2"
                disabled={!step1Done || step2Done}
                onClick={() => {
                  soundManager.playAirHorn(1.2);
                  setStep2Done(true);
                  if (drillType === 'blowout') {
                    onUpdateBop({ bopPumpSwitch: true, reganBopClosed: true });
                    onUpdateHydraulics({ bopPressure: 1250 });
                  }
                  checkFinished(step1Done, true, step3Done, step4Done);
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  step2Done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : !step1Done
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300'
                    : 'bg-white border-slate-300 hover:border-amber-500 active:scale-98'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    step2Done ? 'bg-emerald-700 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {step2Done ? <CheckCircle className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-800">
                    {drillType === 'freefall' && t('drill.step2.freefall')}
                    {drillType === 'blowout' && t('drill.step2.blowout')}
                    {drillType === 'h2s' && t('drill.step2.h2s')}
                    {drillType === 'overheat' && t('drill.step2.overheat')}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step2Done ? t('drill.step1.status.done') : t('drill.step2.status')}
                  </span>
                </div>
              </button>

              {/* Step 3 */}
              <button
                id="btn-drill-step-3"
                disabled={!step2Done || step3Done}
                onClick={() => {
                  soundManager.playMetalTap();
                  setStep3Done(true);
                  checkFinished(step1Done, step2Done, true, step4Done);
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  step3Done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : !step2Done
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300'
                    : 'bg-white border-slate-300 hover:border-amber-500 active:scale-98'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    step3Done ? 'bg-emerald-700 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  {step3Done ? <CheckCircle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-800">
                    {drillType === 'freefall' && t('drill.step3.freefall')}
                    {drillType === 'blowout' && t('drill.step3.blowout')}
                    {drillType === 'h2s' && t('drill.step3.h2s')}
                    {drillType === 'overheat' && t('drill.step3.overheat')}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step3Done ? t('drill.step1.status.done') : t('drill.step3.status')}
                  </span>
                </div>
              </button>

              {/* Step 4 */}
              <button
                id="btn-drill-step-4"
                disabled={!step3Done || step4Done}
                onClick={() => {
                  soundManager.playMetalTap();
                  setStep4Done(true);
                  checkFinished(step1Done, step2Done, step3Done, true);
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  step4Done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : !step3Done
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300'
                    : 'bg-white border-slate-300 hover:border-amber-500 active:scale-98'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    step4Done ? 'bg-emerald-700 text-white' : 'bg-purple-600 text-white'
                  }`}
                >
                  {step4Done ? <CheckCircle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-800">
                    {drillType === 'freefall' && t('drill.step4.freefall')}
                    {drillType === 'blowout' && t('drill.step4.blowout')}
                    {drillType === 'h2s' && t('drill.step4.h2s')}
                    {drillType === 'overheat' && t('drill.step4.overheat')}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step4Done ? t('drill.step1.status.done') : t('drill.step4.status')}
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Completed Score Debrief */
          <div className="p-6 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-center space-y-4">
            <Award className="w-14 h-14 text-emerald-700 mx-auto animate-bounce" />
            <div>
              <h4 className="text-lg font-semibold text-emerald-200">
                {t('drill.completion.title')}
              </h4>
              <p className="text-xs text-emerald-700 font-mono mt-1">
                {t('drill.completion.reaction')}: {(elapsedMs / 1000).toFixed(2)}s • {t('drill.completion.safety')}: 100%
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-600 max-w-md mx-auto">
              <span className="font-bold text-amber-700 block mb-1">{t('drill.completion.takeaway')}:</span>
              {drillType === 'freefall' && t('drill.takeaway.freefall')}
              {drillType === 'blowout' && t('drill.takeaway.blowout')}
              {drillType === 'h2s' && t('drill.takeaway.h2s')}
              {drillType === 'overheat' && t('drill.takeaway.overheat')}
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg"
            >
              {t('drill.btn.close')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-300 flex items-center justify-between text-2xs text-slate-500">
          <span>{t('drill.footer')}</span>
          <button onClick={onClose} className="hover:text-slate-700">
            {t('drill.btn.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
