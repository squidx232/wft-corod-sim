import type { TranslationPart } from './index';

export const modals: TranslationPart = {
  en: {
    // EngineStartModal
    'engineStart.title': 'Engine Start-Up Sequence',
    'engineStart.subtitle': 'Daily Procedure — Manual Section 5.2 (pp. 151-152)',
    'engineStart.progress': 'Progress',
    'engineStart.steps': '${completed} / ${total} steps',
    'engineStart.step': 'STEP ${num}',
    'engineStart.manualRef': 'Manual reference — ${ref}',
    'engineStart.complete': 'COMPLETE',
    'engineStart.closeFull': 'Complete all start-up steps before closing',
    'engineStart.readyBtn': 'Engine Ready — Begin Operation',
    'engineStart.inProgress': 'Complete each step in sequence to bring the engine online…',
    
    // Engine Start Steps
    'engineStart.checks.title': 'Pre-Start Fluid Checks',
    'engineStart.checks.instruction': 'Before starting, check the engine oil and coolant levels. Confirm the hydraulic reservoir level is adequate.',
    'engineStart.checks.ref': 'Section 5.2.1 (p. 151)',
    'engineStart.checks.action': 'Confirm Levels OK',
    
    'engineStart.preheater.title': 'Verify Engine Pre-Heater',
    'engineStart.preheater.instruction': 'Confirm the Webasto / ProHeat diesel pre-heater is operational. Required below 0 °C to prevent cold-start damage; run weekly in summer to burn off soot.',
    'engineStart.preheater.ref': 'Section 5.2.1 / Fig. 124 Control Pad (p. 151)',
    'engineStart.preheater.action': 'Verify Pre-Heater',
    
    'engineStart.crank.title': 'Start the Rig Engine',
    'engineStart.crank.instruction': 'Turn the ignition and crank the diesel engine. Bring it to a low idle of 1000–1100 RPM. DO NOT elevate RPM during initial warm-up — serious engine damage can result.',
    'engineStart.crank.ref': 'Section 5.2.1 / Cab Ignition, Clutch & Gear (p. 151)',
    'engineStart.crank.action': 'Crank & Idle @ 1050 RPM',
    
    'engineStart.warmup.title': 'Warm Engine to Operating Temp',
    'engineStart.warmup.instruction': 'Allow the engine to warm until the cab temperature gauge reaches the normal operating range (≈15 min in summer; longer below freezing).',
    'engineStart.warmup.ref': 'Section 5.2.1 / Dash Trans-Temp Gauge (p. 151)',
    'engineStart.warmup.action': 'Warm to Operating Temp',
    
    'engineStart.pto.title': 'Engage the PTO (Pump Drive)',
    'engineStart.pto.instruction': 'Engage the Power Take-Off to drive the hydraulic pumps. In cold weather, start in a lower gear and increase as fluid warms.',
    'engineStart.pto.ref': 'Section 5.2.2 / Cab ROAD-HYDRAULIC PTO Selector (p. 152)',
    'engineStart.pto.action': 'Engage PTO',
    
    'engineStart.circulate.title': 'Circulate & Build System Pressure',
    'engineStart.circulate.instruction': 'Turn the gripper motors with minimal up-pressure to circulate fluid. Open the safety bleed valve to warm the auxiliary pump, then CLOSE it before work so the pump can build pressure.',
    'engineStart.circulate.ref': 'Section 5.2.2 / Fig. 125 Control Console (p. 152, 154)',
    'engineStart.circulate.action': 'Circulate & Close Bleed',

    // GlossaryModal
    'glossary.title': 'Plain-English Glossary',
    'glossary.searchPlaceholder': 'Search a term (e.g. BOP, squeeze, PTO)…',

    // JSA Modal
    'jsa.title': 'Pre-Job Site Hazard Assessment & JSA (Section 4.11 / 4.12)',
    'jsa.form': 'FORM 3-5-GL-GL-CSR-00001 (REV 2)',
    'jsa.wellLocation': 'Wellsite Location & Lease #',
    'jsa.operator': 'Lead MG Operator & Rig Crew Lead',
    'jsa.windDirection': 'Wind Direction & Conditions (Windsock)',
    'jsa.musterPoint': 'Designated Upwind Muster Point',
    'jsa.checklist': 'Critical Safety Verification Checklist (Appendix O)',
    'jsa.powerLines': 'Overhead Power Lines: Verified >7 meters clearance from crane and loads (Section 4.9)',
    'jsa.lockout': 'Energy Lockout (LOTO): Electrical panel locked out and production flow line block valves closed (Section 4.15)',
    'jsa.redZone': 'Red Zone Barricades: Demarcation cones/chains deployed around crane swing radius and rod guide',
    'jsa.respiratory': 'Respiratory & PPE: GasAlert H2S personal monitors bump tested, SCBA breathing packs inspected (Section 4.7)',
    'jsa.radar': 'RADAR Behavior Process (Section 4.13):',
    'jsa.radarStep1': '1. Recognize: Scan the entire lease and observe behavior.',
    'jsa.radarStep2': '2. Approach: Safely halt uncoordinated work.',
    'jsa.radarStep3': '3. Discuss: Understand the issue without rush.',
    'jsa.radarStep4': '4. Agree: Align on the approved Weatherford safe work procedure.',
    'jsa.radarStep5': '5. Report: Document observations on daily log sheet.',
    'jsa.footer': 'Rules to Live By: I will ALWAYS intervene and Stop unsafe acts.',
    'jsa.approveBtn': 'Approve & Authorize Work (JSA Signoff)',

    // ManualReferenceModal
    'manual.title': 'Weatherford COROD® Mobile Gripper Reference Manual',
    'manual.doc': 'GL-PCP-OEPS-L4-11 (REV 25)',
    'manual.tab.squeeze': 'Squeeze Curves & Calculator (Fig 248)',
    'manual.tab.clamps': 'Rod Clamp Selection (Table 9/10)',
    'manual.tab.straightener': 'Rod Straightener (Table 11)',
    'manual.tab.weather': 'Weather & Humidex (Table 2-5)',
    'manual.tab.tools': 'Tool Inventory (Table 14)',
    'manual.tab.glossary': 'Glossary (Appendix J)',
    'manual.close': 'Close Manual',
    
    // Squeeze Tab
    'manual.squeeze.title': 'Interactive Squeeze Pressure & String Weight Calculator (Figure 248)',
    'manual.squeeze.rodSize': 'Select COROD Size & Shape:',
    'manual.squeeze.depth': 'Well Depth: ${depth} FT (${depthM} M)',
    'manual.squeeze.stringWeight': 'Total String Weight',
    'manual.squeeze.minSqueeze': 'Min Squeeze Required',
    'manual.squeeze.recommendedClamp': 'Recommended Clamp',
    'manual.squeeze.warning': 'WARNING (Figure 248): NEVER MOVE COROD WITH LESS THAN 400 PSI SQUEEZE PRESSURE. Max standard injector dynamic load: 13,000 lbs (up to 15,000 lbs with 3-part sling upgrade).',
    
    // Clamps Tab
    'manual.clamps.title': 'Table 9 & 10: Rod Clamp Selection Guidelines',
    'manual.clamps.radiusRed': '• 0.59" Radius Clamps (Painted RED): Exclusively for #6R and #8.5R round COROD. Single-bolt rated to 9,800 lbs (#6) / 13,000 lbs (#8.5). Two-bolt rated to 27,600 lbs (#6) / 31,400 lbs (#8.5).',
    'manual.clamps.radiusModified': '• 2.50" Radius Modified Clamps: For all elliptical COROD and other round sizes (except #8.5R). Single-bolt rated to 9,000 lbs (elliptical) / 8,500 lbs (round). Two-bolt rated to 20,300 lbs (elliptical) / 16,000 lbs (round).',
    'manual.clamps.torque': '• Torque & Tap Test Rule: Bolts must be tightened to 500-600 lb-ft (200lb man on 3ft wrench in 3 stages). Mandatory bump test: tap against BOP plate 3 times before releasing from hook!',
    
    // Straightener Tab
    'manual.straightener.title': 'Table 11: Rod Straightening Pressures for Round COROD (psi)',
    'manual.straightener.grade': 'Grade',
    'manual.straightener.reel': 'Reel Type',
    
    // Weather Tab
    'manual.weather.title': 'Extreme Weather & Thermal Management (Section 4.23 & 4.24)',
    'manual.weather.cold': '• Cold Weather Limit: Never operate hydraulics until fluid is at least 0°C (32°F). Maintain between 0°C and 50°C. At temperatures < -29°C (-20°F) or equivalent wind chill, supervisor assesses operations.',
    'manual.weather.heat': '• High Heat & Overheating: If hydraulic fluid temperature exceeds 70°C (158°F), the unit MUST BE SHUT DOWN immediately! Switch cooler fan bypass to MANUAL to keep oil cool on hot summer days.',
    'manual.weather.lightning': '• 30-30 Lightning Rule: If time between lightning flash and thunder is < 30 seconds, cease operations and seek shelter inside truck cab. Remain sheltered for 30 minutes after last thunder!',
    
    // Tools Tab
    'manual.tools.title': 'Table 14: Mobile Gripper Standard Tool Chest',
    'manual.tools.wrenches': '• 18", 24", and 36" Rigid Pipe Wrenches (Never use snipes on aluminum wrenches!)',
    'manual.tools.rodWrenches': '• Trico Sucker Rod Wrenches (3/4", 7/8", 1", 1-1/8")',
    'manual.tools.hammers': '• 4lb (12" & 18") and 8lb (30") Sledgehammers (Inspect handles daily)',
    'manual.tools.hacksaws': '• Bimetal Hacksaws (Never use torch over wellbore!)',
    'manual.tools.detectors': '• GasBadge Personal H2S Detectors (Daily bump test required)',
    'manual.tools.elevators': '• 25 Ton Rod Elevators with replaceable plate inserts (1/8" max bail play)',
    
    // Glossary Tab
    'manual.glossary.title': 'Appendix J: Glossary of Terms',
    'manual.glossary.bop': 'BOP: Blow Out Preventer used to control well pressure during servicing.',
    'manual.glossary.corod': 'COROD: Continuous sucker rod with no couplings manufactured by Weatherford.',
    'manual.glossary.roda': 'Roda Valve: Emergency positive air cutoff valve on diesel engine intake.',
    'manual.glossary.ytool': 'Y-Tool: Optical caliper and depthometer measuring rod diameter in X and Y axes.',
    'manual.glossary.radar': 'RADAR: Recognize, Approach, Discuss, Agree, Report safety behavioral habit.',
    'manual.glossary.tagbar': 'Tag Bar: Stop bar at bottom of PCP stator where rotor lands (reduces rod weight to zero).',

    // ControlBindingsPanel
    'bindings.title': 'Control Bindings',
    'bindings.connected': '🎮 Connected',
    'bindings.disconnected': '🎮 No gamepad',
    'bindings.inputEnabled': 'Input enabled',
    'bindings.searchPlaceholder': 'Search controls…',
    'bindings.resetBtn': 'Reset defaults',
    'bindings.legend.key': 'Key',
    'bindings.legend.pad': 'Pad button',
    'bindings.legend.axis': 'Analog axis',
    'bindings.legend.hint': 'Click a slot to bind • Right-click to clear',
    'bindings.selector': 'SELECT',
    'bindings.selectorHint': 'Tap this to make this knob the active target for the shared RT/LT (+/−)',
    'bindings.thenShared': 'then RT/LT',
    'bindings.specialAnalog': 'Right stick ↑POOH / ↓RIH',
    'bindings.moveAxis': 'MOVE',
    'bindings.moveAxisLabel': 'axis',
    'bindings.invHint': 'Invert axis',
    'bindings.decButton': '−',
    'bindings.decButtonHint': 'Button that DECREASES the selected movement target',
    'bindings.incButton': '＋',
    'bindings.incButtonHint': 'Button that INCREASES the selected movement target',
    'bindings.target': '▶',
    'bindings.valueAxis': 'VALUE',
    'bindings.valueAxisLabel': 'axis',
    'bindings.valueDecButtonHint': 'Button that DECREASES the selected value (e.g. LT)',
    'bindings.valueIncButtonHint': 'Button that INCREASES the selected value (e.g. RT)',
    'bindings.sharedExplain': 'Selector + Shared Axis: Tap a control\'s SEL key/button to make it the active target, then use a shared stick to change it. MOVE-AXIS drives movement controls; VALUE-AXIS drives values (up = increase/ON, down = decrease/OFF).',
    'bindings.capture': 'Press a key or gamepad input to bind… (Esc to cancel)',
    'bindings.moveAxisGroup': 'MOVE-AXIS',
    'bindings.valueAxisGroup': 'VALUE-AXIS',
  },

  ar: {
    // EngineStartModal
    'engineStart.title': 'تسلسل بدء تشغيل المحرك',
    'engineStart.subtitle': 'الإجراء اليومي — القسم 5.2 من الدليل (الصفحات 151-152)',
    'engineStart.progress': 'التقدم',
    'engineStart.steps': '${completed} / ${total} خطوات',
    'engineStart.step': 'الخطوة ${num}',
    'engineStart.manualRef': 'مرجع الدليل — ${ref}',
    'engineStart.complete': 'مكتملة',
    'engineStart.closeFull': 'أكمل جميع خطوات البدء قبل الإغلاق',
    'engineStart.readyBtn': 'المحرك جاهز — ابدأ العمل',
    'engineStart.inProgress': 'أكمل كل خطوة على التوالي لتشغيل المحرك...',
    
    // Engine Start Steps
    'engineStart.checks.title': 'فحوصات السوائل قبل البدء',
    'engineStart.checks.instruction': 'قبل البدء، تحقق من مستويات زيت المحرك والمبرد. أكد أن مستوى خزان الزيت الهيدروليكي كافٍ.',
    'engineStart.checks.ref': 'القسم 5.2.1 (الصفحة 151)',
    'engineStart.checks.action': 'أكد أن المستويات صحيحة',
    
    'engineStart.preheater.title': 'التحقق من مسخن المحرك المسبق',
    'engineStart.preheater.instruction': 'أكد أن مسخن الوقود الديزل Webasto / ProHeat يعمل بكفاءة. مطلوب أقل من 0 درجة مئوية لمنع أضرار البدء البارد؛ قم بتشغيله أسبوعياً في الصيف للتخلص من السخام.',
    'engineStart.preheater.ref': 'القسم 5.2.1 / الشكل 124 لوحة التحكم (الصفحة 151)',
    'engineStart.preheater.action': 'تحقق من المسخن',
    
    'engineStart.crank.title': 'بدء تشغيل محرك الحفار',
    'engineStart.crank.instruction': 'شغل نظام الإشعال واطلب تشغيل محرك الديزل. أحضره إلى خمول منخفض من 1000-1100 دورة في الدقيقة. لا تزيد سرعة الدوران أثناء الإحماء الأولي — قد يحدث ضرر خطير للمحرك.',
    'engineStart.crank.ref': 'القسم 5.2.1 / الإشعال والمكبح والتروس في المقصورة (الصفحة 151)',
    'engineStart.crank.action': 'اطلب التشغيل والخمول @ 1050 دورة في الدقيقة',
    
    'engineStart.warmup.title': 'إحماء المحرك إلى درجة الحرارة المناسبة',
    'engineStart.warmup.instruction': 'دع المحرك يدفأ حتى يصل مقياس حرارة المقصورة إلى نطاق التشغيل الطبيعي (≈15 دقيقة في الصيف؛ أطول تحت الصفر).',
    'engineStart.warmup.ref': 'القسم 5.2.1 / مقياس درجة حرارة ناقل الحركة بالمقصورة (الصفحة 151)',
    'engineStart.warmup.action': 'أحم إلى درجة التشغيل',
    
    'engineStart.pto.title': 'تفعيل نقل القوة (محرك المضخة)',
    'engineStart.pto.instruction': 'فعّل نقل القوة لتشغيل مضخات الزيت الهيدروليكي. في الطقس البارد، ابدأ بتروس منخفضة وزيادة مع تدفئة السائل.',
    'engineStart.pto.ref': 'القسم 5.2.2 / محدد نقل القوة الهيدروليكي بالمقصورة (الصفحة 152)',
    'engineStart.pto.action': 'فعّل نقل القوة',
    
    'engineStart.circulate.title': 'دوّر السائل وبناء ضغط النظام',
    'engineStart.circulate.instruction': 'شغّل محركات الملقط بضغط أقل للأعلى لتدوير السائل. افتح صمام التنفيس الآمن لتدفئة المضخة الإضافية، ثم أغلقه قبل العمل حتى تتمكن المضخة من بناء الضغط.',
    'engineStart.circulate.ref': 'القسم 5.2.2 / الشكل 125 وحدة التحكم (الصفحات 152، 154)',
    'engineStart.circulate.action': 'دوّر السائل وأغلق الفتحة',

    // GlossaryModal
    'glossary.title': 'قاموس بسيط باللغة الإنجليزية',
    'glossary.searchPlaceholder': 'ابحث عن مصطلح (مثال: BOP، squeeze، PTO)…',

    // JSA Modal
    'jsa.title': 'تقييم الأخطار قبل العمل وتحليل السلامة (القسم 4.11 / 4.12)',
    'jsa.form': 'النموذج 3-5-GL-GL-CSR-00001 (التعديل 2)',
    'jsa.wellLocation': 'موقع الحقل ورقم الحفار #',
    'jsa.operator': 'مشغل وحدة التثقيب الرئيسي وقائد فريق الحفر',
    'jsa.windDirection': 'اتجاه الرياح والظروف الجوية (طارة الرياح)',
    'jsa.musterPoint': 'نقطة التجمع المحددة (ضد اتجاه الرياح)',
    'jsa.checklist': 'قائمة التحقق من السلامة الحرجة (الملحق أ)',
    'jsa.powerLines': 'خطوط الكهرباء العلوية: تم التحقق من المسافة > 7 أمتار من الرافعة والأحمال (القسم 4.9)',
    'jsa.lockout': 'قفل الطاقة (LOTO): لوحة التوزيع مقفلة وصمامات خط التدفق مغلقة (القسم 4.15)',
    'jsa.redZone': 'حواجز المنطقة الحمراء: تم نشر أقماع/سلاسل التحديد حول دائرة تأرجح الرافعة ودليل القضيب',
    'jsa.respiratory': 'الجهاز التنفسي وحماية العاملين: تم اختبار أجهزة كشف H2S الشخصية، تم فحص عبوات التنفس (القسم 4.7)',
    'jsa.radar': 'عملية السلوك RADAR (القسم 4.13):',
    'jsa.radarStep1': '1. تعرّف: انظر حول الموقع وراقب السلوك.',
    'jsa.radarStep2': '2. تقترب: توقف العمل غير المنسق بأمان.',
    'jsa.radarStep3': '3. ناقش: افهم المشكلة بدون عجلة.',
    'jsa.radarStep4': '4. توافق: توافق على إجراء العمل الآمن المعتمد من Weatherford.',
    'jsa.radarStep5': '5. أبلغ: وثّق الملاحظات في ورقة السجل اليومي.',
    'jsa.footer': 'القواعد المهمة: سأتدخل دائماً وأوقف أي أعمال غير آمنة.',
    'jsa.approveBtn': 'الموافقة والتفويض (توقيع تحليل السلامة)',

    // ManualReferenceModal
    'manual.title': 'دليل الحفار المستمر من Weatherford®',
    'manual.doc': 'GL-PCP-OEPS-L4-11 (التعديل 25)',
    'manual.tab.squeeze': 'منحنيات الضغط والحاسبة (الشكل 248)',
    'manual.tab.clamps': 'اختيار مشابك القضيب (الجداول 9/10)',
    'manual.tab.straightener': 'محاذي القضيب (الجدول 11)',
    'manual.tab.weather': 'الطقس والرطوبة (الجداول 2-5)',
    'manual.tab.tools': 'جرد الأدوات (الجدول 14)',
    'manual.tab.glossary': 'القاموس (الملحق ج)',
    'manual.close': 'إغلاق الدليل',
    
    // Squeeze Tab
    'manual.squeeze.title': 'حاسبة ضغط الضغط ووزن خيط القضيب التفاعلية (الشكل 248)',
    'manual.squeeze.rodSize': 'اختر حجم وشكل COROD:',
    'manual.squeeze.depth': 'عمق الحفار: ${depth} FT (${depthM} M)',
    'manual.squeeze.stringWeight': 'إجمالي وزن خيط القضيب',
    'manual.squeeze.minSqueeze': 'الحد الأدنى من الضغط المطلوب',
    'manual.squeeze.recommendedClamp': 'المشبك الموصى به',
    'manual.squeeze.warning': 'تحذير (الشكل 248): لا تحرك COROD بأقل من 400 PSI من ضغط الضغط. الحد الأقصى للحمل الديناميكي للمحقن القياسي: 13000 رطل (حتى 15000 رطل مع ترقية الحبل ثلاثي الأجزاء).',
    
    // Clamps Tab
    'manual.clamps.title': 'الجداول 9 & 10: إرشادات اختيار مشابك القضيب',
    'manual.clamps.radiusRed': '• مشابك نصف قطر 0.59" (مطلية بالأحمر): حصرياً لـ #6R و #8.5R COROD المستدير. التصنيف أحادي الترباس: 9800 رطل (#6) / 13000 رطل (#8.5). التصنيف الثنائي: 27600 رطل (#6) / 31400 رطل (#8.5).',
    'manual.clamps.radiusModified': '• مشابك نصف قطر 2.50" المعدلة: لجميع COROD الإهليلجي وأحجام الدوران الأخرى (باستثناء #8.5R). التصنيف أحادي الترباس: 9000 رطل (إهليلجي) / 8500 رطل (دائري). التصنيف الثنائي: 20300 رطل (إهليلجي) / 16000 رطل (دائري).',
    'manual.clamps.torque': '• قاعدة الشد والنقر: يجب شد البراغي إلى 500-600 رطل-قدم (200 رطل رجل على مفتاح 3 قدم في 3 مراحل). اختبار النقر الإلزامي: انقر ضد لوحة BOP 3 مرات قبل التحرير من الخطاف!',
    
    // Straightener Tab
    'manual.straightener.title': 'الجدول 11: ضغط محاذاة القضيب المستدير COROD (psi)',
    'manual.straightener.grade': 'الدرجة',
    'manual.straightener.reel': 'نوع الملف',
    
    // Weather Tab
    'manual.weather.title': 'الطقس القاسي والإدارة الحرارية (القسم 4.23 & 4.24)',
    'manual.weather.cold': '• حد الطقس البارد: لا تشغّل الأنظمة الهيدروليكية حتى يصل السائل إلى درجة حرارة 0 درجة مئوية على الأقل (32 درجة فهرنهايت). حافظ على درجة حرارة بين 0 و 50 درجة مئوية. عند درجات حرارة < -29 درجة مئوية (-20 درجة فهرنهايت)، يقيّم المشرف العمليات.',
    'manual.weather.heat': '• الحرارة العالية والإفراط في التسخين: إذا تجاوزت درجة حرارة السائل الهيدروليكي 70 درجة مئوية (158 درجة فهرنهايت)، يجب إيقاف الوحدة فوراً! غيّر تجاوز مروحة المبرد إلى يدوي للحفاظ على برودة الزيت في أيام الصيف الحار.',
    'manual.weather.lightning': '• قاعدة البرق 30-30: إذا كان الوقت بين بريق البرق والرعد < 30 ثانية، وقف العمليات وابحث عن ملجأ داخل مقصورة الشاحنة. ابق محمياً لمدة 30 دقيقة بعد آخر رعدة!',
    
    // Tools Tab
    'manual.tools.title': 'الجدول 14: صندوق الأدوات القياسي لوحدة التثقيب المتنقلة',
    'manual.tools.wrenches': '• مفاتيح أنابيب صلبة بحجم 18" و 24" و 36" (لا تستخدم أداوات قطع على مفاتيح الألومنيوم!)',
    'manual.tools.rodWrenches': '• مفاتيح Trico للقضيب الماص (3/4"، 7/8"، 1"، 1-1/8")',
    'manual.tools.hammers': '• مطارق 4 رطل (12" و 18") و 8 رطل (30") (افحص المقابض يومياً)',
    'manual.tools.hacksaws': '• المناشير ثنائية المعادن (لا تستخدم مشاعل فوق بئر الحفار!)',
    'manual.tools.detectors': '• أجهزة كشف H2S الشخصية GasBadge (اختبار يومي مطلوب)',
    'manual.tools.elevators': '• مصاعد القضيب بسعة 25 طن مع قوابس قابلة للاستبدال (تسامح أقصى للعروة 1/8")',
    
    // Glossary Tab
    'manual.glossary.title': 'الملحق ج: قاموس المصطلحات',
    'manual.glossary.bop': 'BOP: جهاز منع انفجار الآبار يُستخدم للتحكم في ضغط البئر أثناء الصيانة.',
    'manual.glossary.corod': 'COROD: قضيب ماص مستمر بدون وصلات من تصنيع Weatherford.',
    'manual.glossary.roda': 'صمام Roda: صمام قطع الهواء الموجب الطارئ على مدخل محرك الديزل.',
    'manual.glossary.ytool': 'أداة Y: مقياس بصري وعمق يقيس قطر القضيب على محوري X و Y.',
    'manual.glossary.radar': 'RADAR: تعرّف، تقترب، ناقش، توافق، أبلغ - عادة السلوك الآمن.',
    'manual.glossary.tagbar': 'شريط العلامة: شريط إيقاف في أسفل محرّك PCP حيث يهبط الدوار (يقلل وزن القضيب إلى صفر).',

    // ControlBindingsPanel
    'bindings.title': 'ربط عناصر التحكم',
    'bindings.connected': '🎮 متصل',
    'bindings.disconnected': '🎮 بدون تحكم',
    'bindings.inputEnabled': 'المدخلات مفعّلة',
    'bindings.searchPlaceholder': 'ابحث عن عناصر التحكم…',
    'bindings.resetBtn': 'استعد الإعدادات الافتراضية',
    'bindings.legend.key': 'مفتاح',
    'bindings.legend.pad': 'زر لوحة التحكم',
    'bindings.legend.axis': 'محور تناظري',
    'bindings.legend.hint': 'انقر على فتحة للربط • انقر بزر الماوس الأيمن لحذف',
    'bindings.selector': 'تحديد',
    'bindings.selectorHint': 'انقر على هذا لجعل هذا الزر المحدد النشط للـ RT/LT المشترك (+/−)',
    'bindings.thenShared': 'ثم RT/LT',
    'bindings.specialAnalog': 'عصا اليمين ↑POOH / ↓RIH',
    'bindings.moveAxis': 'حرك',
    'bindings.moveAxisLabel': 'محور',
    'bindings.invHint': 'عكس المحور',
    'bindings.decButton': '−',
    'bindings.decButtonHint': 'زر يقلل مستهدف الحركة المحدد',
    'bindings.incButton': '＋',
    'bindings.incButtonHint': 'زر يزيد مستهدف الحركة المحدد',
    'bindings.target': '▶',
    'bindings.valueAxis': 'قيمة',
    'bindings.valueAxisLabel': 'محور',
    'bindings.valueDecButtonHint': 'زر يقلل القيمة المحددة (مثل LT)',
    'bindings.valueIncButtonHint': 'زر يزيد القيمة المحددة (مثل RT)',
    'bindings.sharedExplain': 'محدد + محور مشترك: انقر على مفتاح/زر SEL لجعله المستهدف النشط، ثم استخدم عصا مشتركة لتغييره. MOVE-AXIS يقود عناصر التحكم في الحركة؛ VALUE-AXIS يقود القيم (أعلى = زيادة/تشغيل، أسفل = تقليل/إيقاف).',
    'bindings.capture': 'اضغط على مفتاح أو مدخل لوحة تحكم للربط… (Esc للإلغاء)',
    'bindings.moveAxisGroup': 'MOVE-AXIS',
    'bindings.valueAxisGroup': 'VALUE-AXIS',
  },
};

