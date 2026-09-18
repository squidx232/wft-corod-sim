import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { ShieldCheck, FileCheck, AlertTriangle, X, CheckCircle, UserCheck } from 'lucide-react';
import { useT } from '../i18n';

interface JsaModalProps {
  onClose: () => void;
  onApproveJsa: () => void;
}

export const JsaModal: React.FC<JsaModalProps> = ({ onClose, onApproveJsa }) => {
  const { t } = useT();
  const [wellName, setWellName] = useState('Pembina 04-12-048-09W5');
  const [operator, setOperator] = useState('Hassan Hany (Lead MG Operator)');
  const [windDir, setWindDir] = useState('North-West (15 km/h)');
  const [musterPoint, setMusterPoint] = useState('Primary Lease Gate (Upwind 50m)');
  const [hazards, setHazards] = useState({
    powerLines: true,
    unevenLease: true,
    h2sPresent: false,
    redZoneSet: true,
    fallArrest: true,
    lockoutDone: true,
    scbaReady: true,
  });

  const handleApprove = () => {
    soundManager.playSuccessChime();
    onApproveJsa();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl bg-white border-2 border-slate-300 shadow-2xl p-6 text-slate-800 max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="eyebrow text-red-700">
                {t('jsa.form')}
              </span>
              <h3 className="text-base font-semibold text-slate-800">
                {t('jsa.title')}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 my-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow block mb-1">
                {t('jsa.wellLocation')}
              </label>
              <input
                type="text"
                value={wellName}
                onChange={(e) => setWellName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-100 border border-slate-300 font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1">
                {t('jsa.operator')}
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-100 border border-slate-300 font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1">
                {t('jsa.windDirection')}
              </label>
              <input
                type="text"
                value={windDir}
                onChange={(e) => setWindDir(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-100 border border-slate-300 font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1">
                {t('jsa.musterPoint')}
              </label>
              <input
                type="text"
                value={musterPoint}
                onChange={(e) => setMusterPoint(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-100 border border-slate-300 font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Checklist Verification */}
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-2">
            <span className="eyebrow text-amber-700 block mb-2">
              {t('jsa.checklist')}
            </span>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hazards.powerLines}
                  onChange={(e) => setHazards({ ...hazards, powerLines: e.target.checked })}
                  className="rounded text-red-600 accent-red-600 w-4 h-4"
                />
                <span className="text-slate-600">
                  {t('jsa.powerLines')}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hazards.lockoutDone}
                  onChange={(e) => setHazards({ ...hazards, lockoutDone: e.target.checked })}
                  className="rounded text-red-600 accent-red-600 w-4 h-4"
                />
                <span className="text-slate-600">
                  {t('jsa.lockout')}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hazards.redZoneSet}
                  onChange={(e) => setHazards({ ...hazards, redZoneSet: e.target.checked })}
                  className="rounded text-red-600 accent-red-600 w-4 h-4"
                />
                <span className="text-slate-600">
                  {t('jsa.redZone')}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hazards.scbaReady}
                  onChange={(e) => setHazards({ ...hazards, scbaReady: e.target.checked })}
                  className="rounded text-red-600 accent-red-600 w-4 h-4"
                />
                <span className="text-slate-600">
                  {t('jsa.respiratory')}
                </span>
              </label>
            </div>
          </div>

          {/* RADAR Assessment Box */}
          <div className="p-3 rounded-lg bg-white border border-slate-300 text-2xs text-slate-500 space-y-1">
            <span className="font-semibold text-slate-700 block">{t('jsa.radar')}</span>
            <p>{t('jsa.radarStep1')}</p>
            <p>{t('jsa.radarStep2')}</p>
            <p>{t('jsa.radarStep3')}</p>
            <p>{t('jsa.radarStep4')}</p>
            <p>{t('jsa.radarStep5')}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-300 flex justify-between items-center">
          <span className="text-2xs text-slate-500">{t('jsa.footer')}</span>
          <button
            id="btn-sign-jsa"
            onClick={handleApprove}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            {t('jsa.approveBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
