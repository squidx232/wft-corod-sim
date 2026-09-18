import type { TranslationPart } from './index';

export const station: TranslationPart = {
  en: {
    // --- Banner status chips (reuse existing status.* keys for "All good", "Caution", "Action needed") ---
    'status.doThisNext': 'Do this next',

    // --- StatusBanner content (section messages) ---
    'banner.emergency.active.title': 'Emergency Stop is active — everything is halted.',
    'banner.emergency.active.detail': 'The machine is locked out for safety.',
    'banner.emergency.active.action': 'When the area is safe, press "Emergency Reset" to restore controls.',

    'banner.fault.title': 'A fault is in progress — respond now.',
    'banner.fault.detail': 'The simulator has injected an emergency condition.',
    'banner.fault.action': 'Follow the on-screen emergency prompt, or hit the red Emergency Stop.',

    'banner.startup.engineOff.title': 'Engine is off — nothing will move yet.',
    'banner.startup.engineOff.detail': "Pressures are low because the pump isn't turning. This is normal before startup.",
    'banner.startup.engineOff.action': 'Start the engine (press E) to build up pressure.',

    'banner.startup.ptoOff.title': 'Engine running, but power to the hydraulics is off (PTO).',
    'banner.startup.ptoOff.detail': "The engine idles and builds charge pressure, but the drive/gripper aren't powered yet.",
    'banner.startup.ptoOff.action': 'Engage the transmission/PTO (press P) to power the controls.',

    'banner.lowCharge.title': 'Low charge pressure — the rods could free-fall (freewheel).',
    'banner.lowCharge.detail': "Below 250 PSI the brake can't hold the string safely.",
    'banner.lowCharge.action': 'Reduce speed and set the Safety Lever; check the engine/pump.',

    'banner.moving.title': 'Rods are moving ${direction}.',
    'banner.moving.detail': 'Depth ${depth} ft • Speed ${speed} ft/min • Weight ${weight} lb.',
    'banner.moving.action': 'Watch the weight and pressures. Push the drive stick back to center to stop.',
    'banner.moving.dir.rih': 'into the well (running in / RIH)',
    'banner.moving.dir.pooh': 'out of the well (pulling out / POOH)',

    'banner.ready.title': 'Ready — powered and holding steady.',
    'banner.ready.detail': 'Depth ${depth} ft • Well valve (BOP) is ${bopState}.',
    'banner.ready.action': 'Choose a direction and use the drive stick (right stick / R = in, F = out) to move the rods.',
    'banner.bopState.closed': 'CLOSED',
    'banner.bopState.open': 'open',

    // --- DynamicRigSightline: Status indicators ---
    'sightline.rihInjecting': 'RIH INJECTING: ${speed} FT/MIN',
    'sightline.poohSurfacing': 'POOH SURFACING: +${speed} FT/MIN',
    'sightline.stationary': 'STATIONARY: ${depth} FT',
    'sightline.tagBarLanded': 'TAG BAR LANDED',

    // --- DynamicRigSightline: Depth controls ---
    'sightline.depth': 'Depth',
    'sightline.depthPreset.surface': "0' (Surface)",
    'sightline.depthPreset.1000': "1000'",
    'sightline.depthPreset.mid': "2250' (Mid)",
    'sightline.depthPreset.3500': "3500'",
    'sightline.depthPreset.bottom': "4500' (Bottom)",
    'sightline.adjustDepth': 'Adjust Depth: ${depth} ft',

    // --- DynamicRigSightline: Display mode selector ---
    'sightline.display': 'Sightline Display',
    'sightline.3d': '3D Rig Viewport (WebGL)',
    'sightline.2d': '2D Schematic',
    'sightline.split': 'Split (3D + 2D)',

    // --- DynamicRigSightline: 2D view modes ---
    'sightline.view.fullRig': 'Full Rig',
    'sightline.view.gripperHead': 'Gripper Head',
    'sightline.view.serviceReel': 'Service Reel',

    // --- DynamicRigSightline: Mechanical Clamp Controller ---
    'sightline.mechClamp': 'Mech Clamp',
    'sightline.clampCount': '${count} (550 ft-lbs)',
    'sightline.clampNone': 'None',
    'sightline.install': 'Install',
    'sightline.remove': 'Remove',

    // --- DynamicRigSightline: Action buttons ---
    'sightline.tapTest': 'Hammer Tap Test',
    'sightline.tapTestTooltip': 'Acoustic Tap Test: Strike string with brass hammer to verify secure clamping (Dull thud = Loose / Sharp ping = Tight)',

    'sightline.reelFork': 'Reel Fork',
    'sightline.reelForkEngaged': 'ENGAGED (LOCKED)',
    'sightline.reelForkDisengaged': 'DISENGAGED',

    'sightline.containment': 'Containment',
    'sightline.containmentAttached': 'ATTACHED',
    'sightline.containmentDetached': 'DETACHED',

    'sightline.bopHandPump': 'BOP Hand Pump (${strokes}x)',
    'sightline.bopHandPumpTooltip': 'Stroke Manual BOP Emergency Hand Pump (+250 PSI per stroke)',
  },
  ar: {
    // --- Banner status chips ---
    'status.doThisNext': 'اعمل ده دلوقتي',

    // --- StatusBanner content ---
    'banner.emergency.active.title': 'المكابح الطارئة مشغّلة — كل حاجة مطفية.',
    'banner.emergency.active.detail': 'الماكينة مقفولة عشان السلامة.',
    'banner.emergency.active.action': 'لما الموقع يبقى آمن، اضغط على "إعادة تشغيل الطوارئ" عشان تشغّل التحكم تاني.',

    'banner.fault.title': 'فيه عطل بتجري دلوقتي — تصرّف حالًا.',
    'banner.fault.detail': 'المحاكاة حقنت شرط طوارئ.',
    'banner.fault.action': 'تابع النص اللي ظهر على الشاشة، أو اضغط على الزرار الأحمر للطوارئ.',

    'banner.startup.engineOff.title': 'الموتور مطفي — حاجة ما بتتحرك دلوقتي.',
    'banner.startup.engineOff.detail': 'الضغط منخفض لأن المضخة ما تشتغلش. ده عادي قبل التشغيل.',
    'banner.startup.engineOff.action': 'شغّل الموتور (اضغط E) عشان تجيب ضغط.',

    'banner.startup.ptoOff.title': 'الموتور شغّال، بس القوة للهيدروليك قاطع (PTO).',
    'banner.startup.ptoOff.detail': 'الموتور يتعطل ويعطي ضغط شحن، بس الدرايف والجريبر ما فيهم قوة دلوقتي.',
    'banner.startup.ptoOff.action': 'شغّل الجير/PTO (اضغط P) عشان تقدر تتحكم.',

    'banner.lowCharge.title': 'ضغط الشحن منخفض — القضبان قد تسقط بحرية.',
    'banner.lowCharge.detail': 'تحت 250 PSI الفرامل ما تمسك الخيط بأمان.',
    'banner.lowCharge.action': 'قلّل السرعة وشغّل مشبك الأمان؛ تفقد الموتور والمضخة.',

    'banner.moving.title': 'القضبان بتتحرك ${direction}.',
    'banner.moving.detail': 'العمق ${depth} ft • السرعة ${speed} ft/min • الوزن ${weight} lb.',
    'banner.moving.action': 'انتبه للوزن والضغوط. ردّ عصا الجير للمنتصف عشان توقف.',
    'banner.moving.dir.rih': 'دخول البئر (نازل / RIH)',
    'banner.moving.dir.pooh': 'طالع من البئر (طالع / POOH)',

    'banner.ready.title': 'جاهز — في قوة وثابت.',
    'banner.ready.detail': 'العمق ${depth} ft • صمام البئر (BOP) ${bopState}.',
    'banner.ready.action': 'اختار جهة واستخدم عصا الجير (اليمين / R = دخول، F = طالع) عشان تتحرك.',
    'banner.bopState.closed': 'مقفول',
    'banner.bopState.open': 'مفتوح',

    // --- DynamicRigSightline: Status indicators ---
    'sightline.rihInjecting': 'نازل: ${speed} FT/MIN',
    'sightline.poohSurfacing': 'طالع: +${speed} FT/MIN',
    'sightline.stationary': 'ثابت: ${depth} FT',
    'sightline.tagBarLanded': 'النهاية مأمورة',

    // --- DynamicRigSightline: Depth controls ---
    'sightline.depth': 'العمق',
    'sightline.depthPreset.surface': "0' (السطح)",
    'sightline.depthPreset.1000': "1000'",
    'sightline.depthPreset.mid': "2250' (النص)",
    'sightline.depthPreset.3500': "3500'",
    'sightline.depthPreset.bottom': "4500' (النهاية)",
    'sightline.adjustDepth': 'حرّك العمق: ${depth} ft',

    // --- DynamicRigSightline: Display mode selector ---
    'sightline.display': 'عرض خط الرؤية',
    'sightline.3d': 'عرض الحفّار ثلاثي الأبعاد (WebGL)',
    'sightline.2d': 'رسم تخطيطي ثنائي الأبعاد',
    'sightline.split': 'مقسوم (ثلاثي + ثنائي)',

    // --- DynamicRigSightline: 2D view modes ---
    'sightline.view.fullRig': 'الحفّار كله',
    'sightline.view.gripperHead': 'رأس الجريبر',
    'sightline.view.serviceReel': 'بكرة الخدمة',

    // --- DynamicRigSightline: Mechanical Clamp Controller ---
    'sightline.mechClamp': 'مشبك ميكانيكي',
    'sightline.clampCount': '${count} (550 ft-lbs)',
    'sightline.clampNone': 'بلا',
    'sightline.install': 'رّكب',
    'sightline.remove': 'شيّل',

    // --- DynamicRigSightline: Action buttons ---
    'sightline.tapTest': 'اختبار الطرقة',
    'sightline.tapTestTooltip': 'اختبار الطرقة: اضرب الخيط بمطرقة نحاس عشان تتأكد إن المشبك آمن (صوت طبيعي = فضفاض / صوت حادّ = محكم)',

    'sightline.reelFork': 'شوكة البكرة',
    'sightline.reelForkEngaged': 'مشغّلة (مقفولة)',
    'sightline.reelForkDisengaged': 'معطّلة',

    'sightline.containment': 'جهاز الحماية',
    'sightline.containmentAttached': 'متركبة',
    'sightline.containmentDetached': 'مفصولة',

    'sightline.bopHandPump': 'مضخة BOP اليدوية (${strokes}x)',
    'sightline.bopHandPumpTooltip': 'اضرب مضخة BOP الطارئة اليدوية (+250 PSI في كل مرة)',
  },
};
