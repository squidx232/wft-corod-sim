/**
 * Egyptian Arabic translation dictionary.
 * Mirrors every key in en.ts. Tone: clear, field-friendly Egyptian Arabic
 * suitable for rig operators/trainees. Latin numerals + English units are
 * kept (PSI/FT/etc). Physical console hardware labels stay in English.
 */
export const ar: Record<string, string> = {
  // --- Language switcher ---
  'lang.switch': 'اللغة',
  'lang.english': 'English',
  'lang.arabic': 'العربية',

  // --- App header ---
  'header.title': 'محاكي كورود® موبايل جريبر™',
  'header.subtitle': 'مدرب عمليات ويذرفورد لقضبان المضخة المستمرة وعمليات موقع البئر',
  'header.rev': 'إصدار ٢٥',
  'header.level': 'المستوى',
  'header.level.trainee': 'متدرب',
  'header.level.operator': 'مشغّل',
  'header.level.specialist': 'أخصائي',
  'header.sound.on': 'كتم الصوت',
  'header.sound.off': 'تشغيل الصوت',
  'header.jsa': 'تحليل مخاطر الموقع (4.12)',
  'header.manual': 'دليل التشغيل',
  'header.glossary': 'يعني إيه ده؟',
  'header.startEngine': 'تشغيل الموتور',
  'header.engineRunning': 'الموتور شغّال',

  // --- Navigation tabs ---
  'tabs.3dview': 'العرض ثلاثي الأبعاد',
  'tabs.procedures': 'الخطوات بالتفصيل',
  'tabs.emergency': 'تدريب الطوارئ',
  'tabs.logbook': 'السجل والنتائج',

  // --- Common actions / words ---
  'common.start': 'ابدأ',
  'common.running': 'شغّال',
  'common.stop': 'وقف',
  'common.close': 'إغلاق',
  'common.reset': 'إعادة ضبط',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.next': 'التالي',
  'common.back': 'رجوع',
  'common.done': 'تمام',
  'common.on': 'تشغيل',
  'common.off': 'إيقاف',
  'common.yes': 'نعم',
  'common.no': 'لا',
  'common.depth': 'العمق',
  'common.engineOn': 'الموتور شغّال',
  'common.engineOff': 'الموتور مطفي',

  // --- Station header / telemetry ---
  'station.title': 'محطة المشغّل ثلاثية الأبعاد',
  'station.view': 'العرض',
  'station.view.split': 'جنب بعض',
  'station.view.windshield': 'الزجاج الأمامي',
  'station.view.console': 'لوحة التحكم',
  'station.popout': 'فتح في نافذة',
  'station.popout.3d': 'العرض ثلاثي الأبعاد',
  'station.popout.console': 'لوحة التحكم',
  'telemetry.depth': 'العمق',
  'telemetry.speed': 'السرعة',
  'telemetry.weight': 'الوزن',
  'telemetry.squeeze': 'ضغط القبض',
  'telemetry.chainTension': 'شد السلسلة',
  'telemetry.clamp': 'المشبك (V)',
  'telemetry.pooh': 'طالع ↑',
  'telemetry.rih': 'نازل ↓',

  // --- Charge warning ---
  'warn.charge.title': 'خطر: ضغط الشحن أقل من 250 PSI',
  'warn.charge.detail': 'شغّل مشبك أمان القضيب (V) حالًا عشان تثبّت عمود القضبان.',
  'warn.charge.action': 'شغّل مشبك الأمان (V)',

  // --- Status banner ---
  'status.good': 'كله تمام',
  'status.caution': 'خليك حاذر',
  'status.action': 'محتاج تصرّف',
  'status.doThisNext': 'اعمل ده دلوقتي',

  // --- Rig sightline ---
  'sightline.depth': 'العمق',
  'sightline.display': 'عرض خط الرؤية',
  'sightline.3d': 'عرض الحفّار ثلاثي الأبعاد (WebGL)',
  'sightline.2d': 'رسم تخطيطي ثنائي الأبعاد',
  'sightline.split': 'مقسوم (ثلاثي + ثنائي)',
  'sightline.stationary': 'ثابت',
};
