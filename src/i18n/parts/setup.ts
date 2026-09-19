/**
 * Translations for the Well Setup tab (equipment config + well design) and the
 * squeeze-pressure alarm system (Slip / Free-Fall / Emergency lockout).
 */
import { TranslationPart } from './index';

export const setup: TranslationPart = {
  en: {
    'tabs.setup': 'Well Setup',

    // Squeeze-pressure alarm system
    'alarm.slip.title': 'SLIP WARNING — Raise Squeeze Pressure',
    'alarm.freefall.title': 'FREE-FALL ALARM — Engage Safety Clamp NOW',
    'alarm.discrepancy': 'Squeeze deficit: ${psi} PSI below required',
    'alarm.lockout.title': 'Emergency Lockout',
    'alarm.lockout.body':
      'No corrective action was taken within 20 seconds of the squeeze-pressure alarm. The system is now in a critical lockout state. Acknowledge to reset once the fault is corrected.',
    'alarm.lockout.ack': 'Acknowledge & Reset',
  },
  ar: {
    'tabs.setup': 'إعداد البئر',

    'alarm.slip.title': 'تحذير انزلاق — ارفع ضغط القبضة',
    'alarm.freefall.title': 'إنذار سقوط حر — فعّل مشبك الأمان فورًا',
    'alarm.discrepancy': 'نقص ضغط القبضة: ${psi} رطل/بوصة² أقل من المطلوب',
    'alarm.lockout.title': 'إغلاق طوارئ',
    'alarm.lockout.body':
      'لم يتم اتخاذ أي إجراء تصحيحي خلال 20 ثانية من إنذار ضغط القبضة. النظام الآن في حالة إغلاق حرج. أقر لإعادة الضبط بعد تصحيح العطل.',
    'alarm.lockout.ack': 'إقرار وإعادة ضبط',
  },
};
