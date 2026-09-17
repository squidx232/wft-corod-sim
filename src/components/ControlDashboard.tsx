/**
 * ControlDashboard — the MAIN operator screen. Clean, organized, readable.
 * Shows EVERYTHING the console controls, but grouped into clearly-labeled cards
 * (Engine & Power, Drive, Gripper, Pressures, Well Control, Switches) with big
 * gauges, plain-English labels + units, and "?" help on every item.
 *
 * Replaces the crowded skeuomorphic wall as the default view. The photoreal 3D
 * console/cab lives on a separate Advanced tab.
 */
import React from 'react';
import { AnalogGauge } from './AnalogGauge';
import { SimulatorState } from '../types';
import {
  Power, Play, ArrowDownToLine, ArrowUpFromLine, Square, ShieldAlert,
  Volume2, Plus, Minus, HelpCircle, Zap, Droplets, Wrench, Link2,
} from 'lucide-react';

interface Props {
  state: SimulatorState;
  onUpdateHydraulics: (u: Partial<SimulatorState['hydraulics']>) => void;
  onUpdateBOP: (u: Partial<SimulatorState['bop']>) => void;
  onSetJoystick: (pos: number) => void;
  onAirHorn: () => void;
  onEmergencyStop: () => void;
  onEmergencyReset: () => void;
}

/* ---------- small shared UI atoms ---------- */

const Help: React.FC<{ text: string }> = ({ text }) => (
  <span className="group relative inline-flex">
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-cyan-500 cursor-help" />
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 z-50 hidden group-hover:block bg-slate-900 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 shadow-xl border border-slate-700 text-left normal-case font-normal">
      {text}
    </span>
  </span>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }>
  = ({ title, icon, children, accent = 'text-cyan-300' }) => (
  <div className="bg-slate-900/70 rounded-2xl border border-slate-700/70 shadow-lg overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/60">
      <span className={accent}>{icon}</span>
      <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-100">{title}</h3>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

const Toggle: React.FC<{ label: string; help: string; on: boolean; onClick: () => void; onColor?: string }>
  = ({ label, help, on, onClick, onColor = 'bg-emerald-600' }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border-2 shadow-sm active:scale-95 transition-all w-full
      ${on ? `${onColor} text-white border-transparent` : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500'}`}
  >
    <span className="text-[12px] font-bold text-left">{label}</span>
    <span className="flex items-center gap-1.5">
      <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${on ? 'bg-black/25' : 'bg-slate-900 text-slate-400'}`}>{on ? 'ON' : 'OFF'}</span>
      <Help text={help} />
    </span>
  </button>
);

/* ---------- main component ---------- */

export const ControlDashboard: React.FC<Props> = ({
  state, onUpdateHydraulics, onUpdateBOP, onSetJoystick, onAirHorn, onEmergencyStop, onEmergencyReset,
}) => {
  const h = state.hydraulics;
  const rod = state.rod;
  const bop = state.bop;
  const [driving, setDriving] = React.useState<'in' | 'out' | null>(null);

  const drive = (dir: 'in' | 'out' | 'stop') => {
    if (dir === 'stop') { onSetJoystick(0); setDriving(null); return; }
    onSetJoystick(dir === 'in' ? -1 : 1); // joystick <0 = RIH(in); >0 = POOH(out)
    setDriving(dir);
  };
  const set = (u: Partial<SimulatorState['hydraulics']>) => onUpdateHydraulics(u);

  const ValueCard: React.FC<{
    label: string; help: string; value: number; unit: string; color: string;
    min: number; max: number; step: number; extra?: Partial<SimulatorState['hydraulics']>;
    field: keyof SimulatorState['hydraulics'];
  }> = ({ label, help, value, unit, color, min, max, step, extra, field }) => (
    <div className="bg-slate-800/70 rounded-xl border border-slate-600/60 p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">{label}</span>
        <Help text={help} />
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => set({ [field]: Math.max(min, value - step), ...extra } as Partial<SimulatorState['hydraulics']>)}
          className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 flex items-center justify-center text-slate-100 shadow-sm">
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center bg-slate-950 rounded-lg py-1.5 border border-slate-700">
          <span className={`text-base font-black tabular-nums ${color}`}>{Math.round(value).toLocaleString()}</span>
          <span className="text-[9px] text-slate-500 ml-1">{unit}</span>
        </div>
        <button onClick={() => set({ [field]: Math.min(max, value + step), ...extra } as Partial<SimulatorState['hydraulics']>)}
          className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 flex items-center justify-center text-slate-100 shadow-sm">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const BigBtn: React.FC<{ label: string; sub?: string; icon: React.ReactNode; active?: boolean; color: string; onClick: () => void; help?: string }>
    = ({ label, sub, icon, active, color, onClick, help }) => (
    <button onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 font-bold shadow-md active:scale-95 transition-all border-2
        ${active ? color + ' text-white border-transparent ring-2 ring-white/30' : 'bg-slate-800 text-slate-200 border-slate-600 hover:border-slate-400'}`}>
      {help && <span className="absolute top-1 right-1"><Help text={help} /></span>}
      {icon}
      <span className="text-[12px] leading-tight text-center">{label}</span>
      {sub && <span className={`text-[9px] font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>{sub}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ============ TOP: gauges + live readouts ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] gap-4 items-center bg-slate-900/60 rounded-2xl border border-slate-700/70 p-4">
        <div className="flex justify-center">
          <AnalogGauge id="dash-hookload" title="Rod Weight" subtitle="Hookload"
            value={rod.totalStringWeightLbs} min={0} max={12000} unit="lbs" size="lg" isLarge
            zones={[{ from: 0, to: 9000, color: '#22c55e' }, { from: 9000, to: 12000, color: '#ef4444' }]} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Readout label="Depth" value={`${Math.round(rod.currentDepthFt).toLocaleString()} ft`} help="How deep the rods reach into the well (0 = surface)." accent="text-emerald-400" />
          <Readout label="Speed" value={`${Math.abs(rod.rodSpeedFtPerMin).toFixed(0)} ft/min`} help="How fast the rods are moving." accent="text-sky-400" />
          <Readout label="Direction" value={rod.rodSpeedFtPerMin > 0.5 ? 'Pulling Out' : rod.rodSpeedFtPerMin < -0.5 ? 'Running In' : 'Stopped'} help="Which way the rods are travelling right now." accent="text-purple-300" />
          <Readout label="Engine" value={h.engineRunning ? 'Running' : 'Off'} help="Is the diesel engine on? Nothing moves until it is." accent={h.engineRunning ? 'text-emerald-400' : 'text-slate-400'} />
          <Readout label="Well Valve (BOP)" value={bop.reganBopClosed ? 'CLOSED' : 'Open'} help="The blow-out preventer that seals the well." accent={bop.reganBopClosed ? 'text-red-400' : 'text-emerald-400'} />
          <Readout label="Charge" value={`${Math.round(h.chargePressure)} psi`} help="System feed pressure. Keep above 250 or the rods can free-fall." accent={h.chargePressure < 250 && h.engineRunning ? 'text-red-400' : 'text-emerald-400'} />
        </div>
        <div className="flex justify-center">
          <AnalogGauge id="dash-system" title="System Pressure" subtitle="hydraulics"
            value={h.systemPressure} min={0} max={3000} unit="psi" size="lg" isLarge
            zones={[{ from: 0, to: 2000, color: '#3b82f6' }, { from: 2000, to: 2500, color: '#22c55e' }, { from: 2500, to: 3000, color: '#ef4444' }]} />
        </div>
      </div>

      {/* ============ ENGINE & POWER + DRIVE ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Engine & Power" icon={<Zap className="w-4 h-4" />} accent="text-amber-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <BigBtn label={h.engineRunning ? 'Engine On' : 'Start Engine'} icon={<Power className="w-6 h-6" />} active={h.engineRunning} color="bg-emerald-600" onClick={() => set({ engineRunning: !h.engineRunning })} help="Turn the diesel engine on/off. Do this first." />
            <BigBtn label={h.ptoEngaged ? 'Power Engaged' : 'Engage Power (PTO)'} icon={<Zap className="w-6 h-6" />} active={h.ptoEngaged} color="bg-amber-500" onClick={() => set({ ptoEngaged: !h.ptoEngaged })} help="Send engine power to the hydraulics (like shifting into gear)." />
          </div>
          <div className="mt-2.5">
            <ValueCard label="Engine RPM" help="Engine speed. Higher = more hydraulic power (1000–1300)." value={h.engineRpm} unit="rpm" color="text-amber-300" min={1000} max={1300} step={25} field="engineRpm" />
          </div>
        </Section>

        <Section title="Drive the Rods" icon={<ArrowDownToLine className="w-4 h-4" />} accent="text-blue-300">
          <div className="grid grid-cols-3 gap-2.5">
            <BigBtn label="Run In" sub="RIH · down" icon={<ArrowDownToLine className="w-6 h-6" />} active={driving === 'in'} color="bg-blue-600" onClick={() => drive('in')} help="Lower the rods DOWN into the well." />
            <BigBtn label="Pull Out" sub="POOH · up" icon={<ArrowUpFromLine className="w-6 h-6" />} active={driving === 'out'} color="bg-indigo-600" onClick={() => drive('out')} help="Pull the rods UP out of the well." />
            <BigBtn label="Stop" icon={<Square className="w-6 h-6" />} color="bg-slate-600" onClick={() => drive('stop')} help="Stop all rod movement." />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            <ValueCard label="Down Pressure" help="Force pushing the rod DOWN (running in)." value={h.downPressureTarget} unit="psi" color="text-blue-300" min={200} max={1500} step={50} field="downPressureTarget" />
            <ValueCard label="Up Pressure" help="Force pulling the rod UP (pulling out)." value={h.upPressureTarget} unit="psi" color="text-cyan-300" min={1000} max={3200} step={50} field="upPressureTarget" />
          </div>
        </Section>
      </div>

      {/* ============ GRIPPER + WELL CONTROL ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Gripper / Clamp" icon={<Wrench className="w-4 h-4" />} accent="text-orange-300">
          <div className="grid grid-cols-2 gap-2.5">
            <ValueCard label="Squeeze" help="How hard the gripper clamps the rod. Too low = slip; too high = damage." value={h.squeezePressureTarget} unit="psi" color="text-amber-300" min={400} max={2500} step={100} field="squeezePressureTarget" extra={{ squeezePressureSwitch: true }} />
            <ValueCard label="Chain Tension" help="Tension on the gripper drive chains (100–200 typical)." value={h.chainTensionTarget} unit="psi" color="text-emerald-300" min={100} max={600} step={25} field="chainTensionTarget" extra={{ chainTensionSwitch: true }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
            <Toggle label="Gripper Brake" help="Holds the gripper still so the rod can't move." on={h.gripperBrakeSwitch} onClick={() => set({ gripperBrakeSwitch: !h.gripperBrakeSwitch })} />
            <Toggle label="Safety Clamp" help="Backup lock that grabs the rod if something fails." on={h.safetyClampLever === 'ON'} onColor="bg-lime-600" onClick={() => set({ safetyClampLever: h.safetyClampLever === 'ON' ? 'OFF' : 'ON' })} />
          </div>
        </Section>

        <Section title="Well Control (BOP)" icon={<ShieldAlert className="w-4 h-4" />} accent="text-red-300">
          <div className="grid grid-cols-2 gap-2.5">
            <BigBtn label={bop.reganBopClosed ? 'Well Sealed' : 'Seal Well'} sub="BOP" icon={<ShieldAlert className="w-6 h-6" />} active={bop.reganBopClosed} color="bg-red-700" onClick={() => onUpdateBOP({ reganBopClosed: !bop.reganBopClosed })} help="Close the BOP to seal the well around the rod." />
            <BigBtn label="Sound Horn" icon={<Volume2 className="w-6 h-6" />} color="bg-yellow-500" onClick={onAirHorn} help="Warn the crew with the air horn." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
            <Toggle label="BOP Pump" help="Powers the BOP hydraulics." on={bop.bopPumpSwitch} onClick={() => onUpdateBOP({ bopPumpSwitch: !bop.bopPumpSwitch })} />
            <Toggle label="Flow Tee (Kill)" help="Valve to control/kill well flow." on={bop.flowTeeValveOpen} onColor="bg-red-600" onClick={() => onUpdateBOP({ flowTeeValveOpen: !bop.flowTeeValveOpen })} />
          </div>
        </Section>
      </div>

      {/* ============ UTILITY SWITCHES + EMERGENCY ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <Section title="Utilities & Switches" icon={<Droplets className="w-4 h-4" />} accent="text-sky-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Toggle label="Chain Oiler" help="Lubricates the gripper drive chains." on={h.chainOilerOn} onClick={() => set({ chainOilerOn: !h.chainOilerOn })} />
            <Toggle label="Panel Lights" help="Console lighting." on={h.panelLightsOn} onColor="bg-yellow-500" onClick={() => set({ panelLightsOn: !h.panelLightsOn })} />
            <Toggle label="Tank Heater" help="Warms the hydraulic oil in cold weather." on={h.hydraulicTankHeaterOpen} onColor="bg-orange-600" onClick={() => set({ hydraulicTankHeaterOpen: !h.hydraulicTankHeaterOpen })} />
            <Toggle label="Safety Bleed" help="Bleeds off the safety-clamp circuit." on={h.safetyBleedValveOpen} onColor="bg-red-600" onClick={() => set({ safetyBleedValveOpen: !h.safetyBleedValveOpen })} />
          </div>
          <div className="mt-2.5">
            <ValueCard label="Air Regulator" help="Air-system pressure for pneumatic controls." value={h.airRegulatorPsi} unit="psi" color="text-sky-300" min={0} max={200} step={5} field="airRegulatorPsi" />
          </div>
        </Section>

        {/* Emergency Stop — always prominent */}
        <div className="flex items-stretch">
          {h.emergencyStopTripped ? (
            <button onClick={onEmergencyReset} className="w-full min-w-[180px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black shadow-lg active:scale-95 flex flex-col items-center justify-center gap-2 px-6 py-4">
              <Play className="w-8 h-8" /> <span className="text-lg">RESET</span>
              <span className="text-[10px] font-mono">restore controls</span>
            </button>
          ) : (
            <button onClick={onEmergencyStop} className="w-full min-w-[180px] rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black shadow-xl active:scale-95 flex flex-col items-center justify-center gap-2 px-6 py-4 ring-4 ring-red-400/50">
              <ShieldAlert className="w-8 h-8" /> <span className="text-lg">EMERGENCY STOP</span>
              <span className="text-[10px] font-mono opacity-80">halt everything</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Readout: React.FC<{ label: string; value: string; help: string; accent: string }> = ({ label, value, help, accent }) => (
  <div className="bg-slate-800/70 rounded-xl border border-slate-600/60 px-3 py-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <Help text={help} />
    </div>
    <div className={`text-base font-black tabular-nums ${accent}`}>{value}</div>
  </div>
);
