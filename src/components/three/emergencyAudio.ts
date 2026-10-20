import { soundManager } from '../../utils/audio';

/** Short bounded cues only; main simulator retains ownership of slip/freefall loops. */
export function createEmergencyAudioController() {
  let previous: string | null = null;
  let nextAt = 0;
  return {
    update(id: string | null, time: number) {
      if (id !== previous) { previous = id; nextAt = 0; }
      if (!id || soundManager.isAudioMuted() || time < nextAt) return;
      nextAt = time + 4;
      switch (id) {
        case 'emg-freefall': case 'emg-h2s': soundManager.playCriticalLockoutAlarm(); break;
        case 'emg-lightning': case 'emg-wind': soundManager.playAirHorn(0.5); nextAt = time + 8; break;
        case 'emg-hydraulic': case 'emg-bopair': case 'emg-blowout': case 'emg-overheat': soundManager.playHiss(0.7); break;
        case 'emg-chain': case 'emg-outrigger': case 'emg-overpull': soundManager.playMetalTap(); nextAt = time + 1.5; break;
        default: soundManager.playBuzzerAlert();
      }
    },
    dispose() { previous = null; nextAt = 0; },
  };
}
