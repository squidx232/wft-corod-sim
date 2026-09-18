import React, { useState, useEffect } from 'react';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
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
                HIGH-PRIORITY EMERGENCY DRILL
              </span>
              <h3 className="text-lg font-semibold text-white">
                {drillType === 'freefall' && 'Loss of Charge Pressure / Freefalling Rod String'}
                {drillType === 'blowout' && 'Well Kick & Rapid BOP Shut-In Drill'}
                {drillType === 'h2s' && 'H2S Sour Gas Release & Man Down Drill'}
                {drillType === 'overheat' && 'Hydraulic Overheat Emergency Shutdown (>70°C)'}
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
                <p>
                  <strong>INCIDENT:</strong> Main charge pump pressure dropped below 250 psi! Gripper motors are freewheeling.
                  Follow Section 4.18 procedure in exact sequence:
                </p>
              )}
              {drillType === 'blowout' && (
                <p>
                  <strong>INCIDENT:</strong> Formation kick encountered! Wellbore fluid rising rapidly through casing.
                  Follow Section 4.19 rapid shut-in procedure (EUB 60s mandate):
                </p>
              )}
              {drillType === 'h2s' && (
                <p>
                  <strong>INCIDENT:</strong> H2S monitor alarmed (&gt;10 ppm). Crew member prone on wellpad ("Man Down").
                  Follow Section 4.20 H2S emergency response procedure:
                </p>
              )}
              {drillType === 'overheat' && (
                <p>
                  <strong>INCIDENT:</strong> Hydraulic temperature spiked over 70°C. Hydraulic component failure imminent.
                  Follow Section 3.6.7 &amp; 4.23.5 emergency cooling and shutdown:
                </p>
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
                    {drillType === 'freefall' && '1. Move Safety Lever DOWN (Engage Safety Clamp)'}
                    {drillType === 'blowout' && '1. Sound 1 Long Blast Rig Air Horn'}
                    {drillType === 'h2s' && '1. Sound 1 Long Air Horn Alert'}
                    {drillType === 'overheat' && '1. Apply Gripper Brake to Lock String'}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step1Done ? '✓ Action Executed' : 'Click to perform immediate action'}
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
                    {drillType === 'freefall' && '2. Sound Air Horn & Evacuate if Moving'}
                    {drillType === 'blowout' && '2. Turn Automatic BOP Pump ON (1250 PSI)'}
                    {drillType === 'h2s' && '2. Evacuate Upwind to Muster Point'}
                    {drillType === 'overheat' && '2. Turn Cooler Fan Bypass to MANUAL'}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step2Done ? '✓ Action Executed' : 'Step 2'}
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
                    {drillType === 'freefall' && '3. Install Two 2-Bolt Mechanical Rod Clamps'}
                    {drillType === 'blowout' && '3. Install Mechanical Rod Clamp on BOP Plate'}
                    {drillType === 'h2s' && '3. Verify 100% Crew Headcount & Don SCBA'}
                    {drillType === 'overheat' && '3. Close Tank Heater & Allow Fluid to Circulate'}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step3Done ? '✓ Action Executed' : 'Step 3'}
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
                    {drillType === 'freefall' && '4. Perform Mandatory 3-Tap Bump Test'}
                    {drillType === 'blowout' && '4. Perform 3-Tap Bump Test & Muster'}
                    {drillType === 'h2s' && '4. Execute Backward Arm Drag Rescue'}
                    {drillType === 'overheat' && '4. Hit Emergency Shut Down if Temp >70°C'}
                  </span>
                  <span className="text-eyebrow text-slate-500">
                    {step4Done ? '✓ Action Executed' : 'Final Step'}
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
                Drill Passed with Excellence!
              </h4>
              <p className="text-xs text-emerald-700 font-mono mt-1">
                Reaction Time: {(elapsedMs / 1000).toFixed(2)}s • Safety Compliance: 100%
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-600 max-w-md mx-auto">
              <span className="font-bold text-amber-700 block mb-1">Key Operational Takeaway:</span>
              {drillType === 'freefall' && 'The Safety Accumulator only maintains holding pressure for a few minutes. Immediate installation of 2 mechanical rod clamps with 500 ft-lb torque is required.'}
              {drillType === 'blowout' && 'Regan BOP was successfully closed within the strict 1-minute EUB regulatory shut-in threshold.'}
              {drillType === 'h2s' && 'Never attempt rescue without SCBA. Always drag victims backward under arms, never by the feet.'}
              {drillType === 'overheat' && 'Managing cooler bypass and heating circuits prevents catastrophic pump cavitation and seal breakdown.'}
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg"
            >
              Close & Log to Operations Book
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-300 flex items-center justify-between text-2xs text-slate-500">
          <span>Weatherford Global Safety Manual (Form GL-PCP-OEPS-L4-11)</span>
          <button onClick={onClose} className="hover:text-slate-700">
            Cancel Drill
          </button>
        </div>
      </div>
    </div>
  );
};
