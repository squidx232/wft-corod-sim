/**
 * English translation dictionary (source of truth for keys).
 * Keys are namespaced by area: `header.*`, `tabs.*`, `station.*`, etc.
 * Keep values as the exact UI copy. Add new keys here first, then mirror
 * them in ar.ts.
 */
export const en: Record<string, string> = {
  // --- Language switcher ---
  'lang.switch': 'Language',
  'lang.english': 'English',
  'lang.arabic': 'العربية',

  // --- App header ---
  'header.title': 'COROD® Mobile Gripper™ Simulator',
  'header.subtitle': 'Weatherford Continuous Rod & Wellsite Operations Trainer',
  // --- Intro splash ---
  'intro.eyebrow': 'Wellsite Operations Training',
  'intro.title': 'COROD® Mobile Gripper™ Operator Simulator',
  'intro.subtitle': 'An immersive Weatherford continuous-rod & wellsite operations trainer with realistic hydraulics, authentic console controls, and timed emergency-response assessment.',
  'intro.start': 'Start',
  'header.rev': 'Rev 25',
  'header.level': 'Level',
  'header.level.trainee': 'Trainee',
  'header.level.operator': 'Operator',
  'header.level.specialist': 'Specialist',
  'header.sound.on': 'Mute audio',
  'header.sound.off': 'Enable audio',
  'header.jsa': 'Site JSA (4.12)',
  'header.manual': 'Operations Manual',
  'header.glossary': 'What do these mean?',
  'header.startEngine': 'Start Engine',
  'header.engineRunning': 'Engine Running',

  // --- Navigation tabs ---
  'tabs.3dview': '3D View',
  'tabs.procedures': 'Step-by-Step Procedures',
  'tabs.emergency': 'Emergency Practice',
  'tabs.logbook': 'Log & Scores',

  // --- Common actions / words ---
  'common.start': 'Start',
  'common.running': 'Running',
  'common.stop': 'Stop',
  'common.close': 'Close',
  'common.reset': 'Reset',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.done': 'Done',
  'common.on': 'ON',
  'common.off': 'OFF',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.depth': 'Depth',
  'common.engineOn': 'Engine running',
  'common.engineOff': 'Engine off',

  // --- Station header / telemetry ---
  'station.title': '3D Operator Station',
  'station.view': 'View',
  'station.view.split': 'Side-by-Side',
  'station.view.windshield': 'Windshield',
  'station.view.console': 'Console',
  'station.popout': 'Pop out',
  'station.popout.3d': '3D View',
  'station.popout.console': 'Console',
  'telemetry.depth': 'Depth',
  'telemetry.speed': 'Speed',
  'telemetry.weight': 'Weight',
  'telemetry.squeeze': 'Squeeze',
  'telemetry.chainTension': 'Chain Tension',
  'telemetry.clamp': 'CLAMP (V)',
  'telemetry.pooh': 'POOH ↑',
  'telemetry.rih': 'RIH ↓',

  // --- Charge warning ---
  'warn.charge.title': 'Critical: charge pressure below 250 PSI',
  'warn.charge.detail': 'Engage the rod safety clamp (V) immediately to lock the rod string.',
  'warn.charge.action': 'Engage Safety Clamp (V)',

  // --- Status banner ---
  'status.good': 'All good',
  'status.caution': 'Caution',
  'status.action': 'Action needed',
  'status.doThisNext': 'Do this next',

  // --- Rig sightline ---
  'sightline.depth': 'Depth',
  'sightline.display': 'Sightline Display',
  'sightline.3d': '3D Rig Viewport (WebGL)',
  'sightline.2d': '2D Schematic',
  'sightline.split': 'Split (3D + 2D)',
  'sightline.stationary': 'STATIONARY',
};
