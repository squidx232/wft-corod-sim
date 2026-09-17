import React from 'react';
import { WeatherfordControlConsole } from './WeatherfordControlConsole';
import { SimulatorState } from '../types';

interface OperatorConsoleProps {
  state: SimulatorState;
  onUpdateHydraulics: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onUpdateBOP?: (updates: Partial<SimulatorState['bop']>) => void;
  onUpdateJoystick: (pos: number) => void;
  onSoundAirHorn: () => void;
  onTriggerEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
}

export const OperatorConsole: React.FC<OperatorConsoleProps> = ({
  state,
  onUpdateHydraulics,
  onUpdateBOP,
  onUpdateJoystick,
  onSoundAirHorn,
  onTriggerEmergencyStop,
  onResetEmergencyStop,
}) => {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <WeatherfordControlConsole
        state={state}
        onUpdateHydraulics={onUpdateHydraulics}
        onUpdateBOP={onUpdateBOP || (() => {})}
        onUpdateJoystick={onUpdateJoystick}
        onSoundAirHorn={onSoundAirHorn}
        onTriggerEmergencyStop={onTriggerEmergencyStop}
        onResetEmergencyStop={onResetEmergencyStop}
      />
    </div>
  );
};
