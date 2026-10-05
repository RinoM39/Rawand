/* =====================================================================
   RAWAND — Arabic / English
   The pages are written in Arabic (RTL). The inline script in each page's <head> reads the chosen
   language (?lang=en|ar, then localStorage) and, for English, sets <html lang="en" dir="ltr">
   before anything is drawn. This file runs before the page scripts and:
     - points the nav's language switch at the other language
     - in English, translates every text (dictionary below, keyed by the Arabic text), the
       attributes (aria-label, placeholder, alt, title), the <title> and the description
     - turns the small accent line under a few headings into the Arabic original
   Scripts that write text themselves use window.rwT(arabic, english).
   Layout mirroring for English lives in css/i18n.css.
   ===================================================================== */
(() => {
  'use strict';

  const html = document.documentElement;
  const EN = html.lang === 'en';
  window.RW_LANG = EN ? 'en' : 'ar';
  window.rwT = (ar, en) => (EN ? en : ar);

  // the language switch: "EN" on the Arabic site, "ع" on the English one
  document.querySelectorAll('.nav-lang').forEach(a => {
    const to = EN ? 'ar' : 'en';
    a.href = location.pathname + '?lang=' + to;
    a.textContent = EN ? 'ع' : 'EN';
    a.lang = to;
    a.setAttribute('hreflang', to);
    a.setAttribute('aria-label', EN ? 'العربية' : 'English');
  });
  if (!EN) return;

  const DICT = {
    // ---- shared: nav, footer, titles
    'روند | RAWAND — Architecture & Planning': 'RAWAND — Architecture & Planning | Riyadh',
    'روند — استوديو للاستشارات الهندسية والتصميم والتنفيذ في الرياض. تصاميم تنسجم فيها الوظيفة والجمال والاستدامة.': 'RAWAND — engineering consultancy, design and construction studio in Riyadh. Designs where function, beauty and sustainability work as one.',
    'روند — الصفحة الرئيسية': 'RAWAND — Home',
    'القائمة الرئيسية': 'Main menu',
    'القائمة': 'Menu',
    'من نحن': 'About',
    'خدماتنا': 'Services',
    'مشاريعنا': 'Projects',
    'الفريق': 'Team',
    'تواصل معنا': 'Contact',
    'لنرسم': 'Let’s draw',
    'مشروعك القادم.': 'your next project.',
    'ابدأ مشروعك': 'Start your project',
    'للاستشارات الهندسية — تصميم وتنفيذ.': 'Engineering consultancy — design and build.',
    'ثلاثة شركاء، رؤية واحدة: الوظيفة والجمال والاستدامة.': 'Three partners, one vision: function, beauty and sustainability.',
    'روابط الموقع': 'Site links',
    'الموقع': 'Location',
    'الرئيسية': 'Home',
    'تواصل': 'Contact',
    'الخدمات': 'Services',
    'الاستشارات الهندسية': 'Engineering consulting',
    'التصميم المعماري والداخلي': 'Architectural and interior design',
    'التنفيذ والإشراف': 'Construction and supervision',
    'الرياض، المملكة العربية السعودية': 'Riyadh, Saudi Arabia',
    '© ٢٠٢٦ روند للاستشارات الهندسية. صُمّم في الرياض.': '© 2026 RAWAND Engineering Consultants. Designed in Riyadh.',
    'إلى أعلى الصفحة': 'Back to top',

    // ---- home: hero
    'روند — ثلاثة عقول، رؤية واحدة': 'RAWAND — Three minds, one vision',
    'فريق روند': 'The RAWAND team',
    'الوظيفة': 'Function',
    'الجمال': 'Beauty',
    'الاستدامة': 'Sustainability',
    'الهيكل الإنشائي ·': 'Structure ·',
    'الواجهة ·': 'Facade ·',
    'السطح الأخضر ·': 'Green roof ·',
    'الشريك الأول': 'Partner one',
    'الشريك الثاني': 'Partner two',
    'الشريك الثالث': 'Partner three',

    // ---- home: about
    'رؤيتنا': 'Our vision',
    'أن نكون الخيار الأول في تقديم حلول هندسية مبتكرة ومستدامة تصنع قيمة حقيقية لعملائنا وللمجتمع.': 'To be the first choice for innovative, sustainable engineering solutions that create real value for our clients and for society.',
    'رسالتنا': 'Our mission',
    'نقدّم خدمات هندسية متكاملة بأعلى معايير الجودة والاحترافية، نحو تصاميم تنسجم فيها الوظيفة والجمال والاستدامة.': 'We deliver integrated engineering services to the highest standards of quality and professionalism — designs where function, beauty and sustainability work as one.',
    'قيمنا': 'Our values',
    'أ': 'A', 'ب': 'B', 'ج': 'C', 'د': 'D',
    'العمل الجماعي': 'Teamwork',
    'نعمل بروح فريق واحد لتحقيق الأفضل.': 'We work as one team to achieve the best.',
    'المصداقية': 'Integrity',
    'نؤمن بالشفافية وبناء الثقة.': 'We believe in transparency and in building trust.',
    'الابتكار': 'Innovation',
    'نبتكر حلولاً هندسية مستدامة وعصرية.': 'We create sustainable, contemporary engineering solutions.',
    'الاحترافية': 'Professionalism',
    'نلتزم بأعلى معايير الجودة والدقة.': 'We hold ourselves to the highest standards of quality and precision.',

    // ---- home: services
    'ثلاث خدمات،': 'Three services,',
    'مسار واحد.': 'one path.',
    'نرافق المشروع في كل مراحله: نبدأ بقراءة الموقع والاحتياج، نحوّل الفكرة إلى تصميم متكامل، ثم نتابع تنفيذه في الموقع حتى التسليم.': 'We stay with the project through every stage: we start by reading the site and the brief, turn the idea into a complete design, then follow it on site until handover.',
    'نقرأ الموقع والاحتياج قبل رسم أي خط، لنضع للمشروع أساساً واضحاً ومدروساً.': 'We read the site and the brief before drawing a single line, so the project rests on a clear, considered foundation.',
    'دراسة الموقع وتحليله': 'Site study and analysis',
    'دراسات الجدوى والبرنامج الوظيفي': 'Feasibility studies and space programming',
    'مراجعة المخططات والتصاميم': 'Drawing and design reviews',
    'التصميم': 'Design',
    'نحوّل الفكرة إلى تصميم معماري وداخلي متكامل، يوازن بين الوظيفة والجمال والاستدامة.': 'We turn the idea into a complete architectural and interior design that balances function, beauty and sustainability.',
    'التخطيط العمراني': 'Urban planning',
    'المخططات التنفيذية': 'Construction drawings',
    'التنفيذ': 'Execution',
    'نتابع المشروع في الموقع خطوة بخطوة، ليُبنى كما صُمّم تماماً.': 'We follow the project on site step by step, so it is built exactly as designed.',
    'إدارة المشروع': 'Project management',
    'الإشراف على التنفيذ': 'Construction supervision',
    'ضبط الجودة والتسليم': 'Quality control and handover',
    'لديك مشروع؟': 'Have a project?',
    'لنبدأ من الموقع.': 'Let’s start on site.',

    // ---- home: projects
    'من الفكرة،': 'From idea,',
    'إلى المكان.': 'to place.',
    'مختارات من أعمالنا في العمارة والتخطيط. لكل مشروع لوحته، ولكل لوحة قصة توازن بين الوظيفة والجمال والاستدامة.': 'Selected work in architecture and planning. Every project has its own sheet, and every sheet tells a story of function, beauty and sustainability in balance.',
    'مرّر لاستعراض المشاريع': 'Scroll to browse the projects',
    'سكني': 'Residential',
    'تجاري': 'Commercial',
    'ثقافي': 'Cultural',
    'تخطيط عمراني': 'Urban planning',
    'فيلا الياسمين': 'Al-Yasmin Villa',
    'فيلا عائلية بطابقين تستلهم العمارة النجدية: جدران صمّاء تحمي من الشمس، ومشربية تمنح الخصوصية والضوء معاً.': 'A two-storey family villa inspired by Najdi architecture: solid walls that shade it from the sun, and a mashrabiya that brings privacy and light together.',
    'مكاتب الواحة': 'Al-Waha Offices',
    'مبنى مكاتب بعشرة طوابق، تكسو واجهته زعانف عمودية تكسر أشعة الشمس وتخفّض استهلاك الطاقة.': 'A ten-storey office building wrapped in vertical fins that break the sun and cut energy use.',
    'المركز المجتمعي': 'Community Centre',
    'رواق من الأقواس يظلّل الساحة، وملقف هواء يستعيد التبريد الطبيعي، في مبنى يجمع أهل الحي.': 'An arcade of arches shades the square and a wind tower brings back natural cooling, in a building that brings the neighbourhood together.',
    'مخطط حي الريحان': 'Al-Rayhan Master Plan',
    'مخطط لحي متكامل يتوسطه محور أخضر، بشوارع تمنح الأولوية للمشاة والظل.': 'A master plan for a complete neighbourhood around a green spine, with streets that give priority to walking and to shade.',
    'الرياض — حي الياسمين': 'Riyadh — Al-Yasmin',
    'الرياض — حي العليا': 'Riyadh — Al-Olaya',
    'الرياض — حي النرجس': 'Riyadh — Al-Narjis',
    'القصيم — بريدة': 'Qassim — Buraydah',
    'السنة': 'Year',
    'المساحة': 'Area',
    '٢٠٢٤': '2024', '٢٠٢٥': '2025', '٢٠٢٦': '2026',
    '٦٥٠ م²': '650 m²',
    '١٢٬٤٠٠ م²': '12,400 m²',
    '٣٬٢٠٠ م²': '3,200 m²',
    '٤٨ هكتار': '48 ha',
    'نطاق عملنا': 'Our scope',
    'استشارة': 'Consulting',
    'تصميم': 'Design',
    'تنفيذ': 'Execution',
    'اللوحة التالية': 'The next sheet',
    'لمشروعك.': 'is yours.',

    // ---- team
    'الفريق | روند RAWAND — Architecture & Planning': 'Team | RAWAND — Architecture & Planning',
    'فريق روند: ثلاثة شركاء، لكل منهم محوره — الوظيفة والجمال والاستدامة — ورؤية واحدة.': 'The RAWAND team: three partners, each with an axis — function, beauty and sustainability — and one vision.',
    'ثلاثة عقول،': 'Three minds,',
    'رؤية واحدة.': 'one vision.',
    '١': '1', '٢': '2', '٣': '3',
    'العمارة والتصميم الإنشائي': 'Architecture and structural design',
    'وضوح المخطط ومنطق الإنشاء أولاً: كل مساحة تؤدي وظيفتها قبل أي شيء، وكل خط في مكانه لسبب.': 'Clear plans and structural logic first: every space does its job before anything else, and every line is there for a reason.',
    'الواجهات والتصميم الداخلي': 'Facades and interior design',
    'عين على التفاصيل والمواد والضوء، لتكون العمارة جميلة بقدر ما هي عملية.': 'An eye for detail, material and light, so the architecture is as beautiful as it is practical.',
    'الاستدامة والتخطيط': 'Sustainability and planning',
    'حلول تحترم المناخ والموارد: ظلّ، وتهوية طبيعية، ومساحات خضراء تعيش طويلاً.': 'Solutions that respect climate and resources: shade, natural ventilation and green spaces that last.',
    'ثلاثة محاور…': 'Three axes…',
    'ومشروعك يُكمل الشبكة.': 'and your project completes the grid.',
    'شاهد مشاريعنا': 'See our projects',

    // ---- contact
    'تواصل معنا | روند RAWAND — Architecture & Planning': 'Contact | RAWAND — Architecture & Planning',
    'تواصل مع روند للاستشارات الهندسية في الرياض: أرسل موجز مشروعك، ولنبدأ من الخط الأول.': 'Get in touch with RAWAND engineering consultants in Riyadh: send us your project brief, and let’s start from the first line.',
    'كل مشروع يبدأ': 'Every project starts',
    'بخطٍّ أول.': 'with a first line.',
    'احكِ لنا عن فكرتك، ولو كانت مجرد خاطرة على ورقة. نقرأ كل موجز بعناية، ونعود إليك لنرتّب جلسة استشارة أولى.': 'Tell us about your idea, even if it is just a sketch on paper. We read every brief carefully and get back to you to arrange a first consultation.',
    'الهاتف': 'Phone',
    'البريد': 'Email',
    'الاستوديو': 'Studio',
    'ساعات العمل': 'Hours',
    'الأحد – الخميس · ٩ص – ٥م': 'Sun – Thu · 9am – 5pm',
    'موجز المشروع': 'Project brief',
    'عنك': 'About you',
    'الاسم': 'Name',
    'الجوال أو البريد الإلكتروني': 'Mobile or email',
    'مشروعك': 'Your project',
    'نوع المشروع': 'Project type',
    'تصميم داخلي': 'Interior design',
    'الخدمة المطلوبة': 'Service needed',
    'استشارات': 'Consulting',
    'المدينة': 'City',
    'الرياض': 'Riyadh',
    'المساحة التقريبية': 'Approximate area',
    'م²': 'm²',
    'فكرتك': 'Your idea',
    'احكِ لنا عن المشروع': 'Tell us about the project',
    'عند الإرسال نجهّز موجزك في تطبيق البريد لتراجعه وترسله بنفسك.': 'When you send, we prepare your brief in your email app so you can review it and send it yourself.',
    'أرسل الموجز': 'Send the brief',
    'جهّزنا موجزك.': 'Your brief is ready.',
    'أكمل الإرسال من التطبيق الذي فُتح لك، وسنعود إليك قريباً.': 'Finish sending it from the app that just opened — we will get back to you soon.',
    'تعديل الموجز': 'Edit the brief',

    // ---- project page
    'مشاريعنا | روند RAWAND — Architecture & Planning': 'Projects | RAWAND — Architecture & Planning',
    'مشروع من أعمال روند للاستشارات الهندسية في الرياض — تصميم وتنفيذ.': 'A project by RAWAND engineering consultants in Riyadh — design and build.',
    'مسودّة — هذه المعاينة تظهر لك لأنك مسجّل الدخول، ولا يراها الزوّار.': 'Draft — you see this preview because you are signed in; visitors don’t.',
    'عرض الصورة بالحجم الكامل': 'View the photo full size',
    'عن المشروع': 'About the project',
    'فيلم المشروع': 'Project film',
    'الصور': 'Photographs',
    'مشاريع أخرى': 'More projects',
    'لم نجد هذا المشروع.': 'We couldn’t find this project.',
    'ربما تغيّر رابطه أو لم يُنشر بعد.': 'Its link may have changed, or it isn’t published yet.',
    'كل المشاريع': 'All projects',
    'عارض الصور': 'Photo viewer',
    'إغلاق': 'Close',
    'الصورة السابقة': 'Previous photo',
    'الصورة التالية': 'Next photo',
  };

  // blocks whose inline markup doesn't line up word for word with the Arabic
  const RICH = {
    '.about-statement': 'RAWAND is an architecture and planning studio in Riyadh that brings <em>three partners</em> together around one idea: a good building is born when <em>function, beauty and sustainability</em> are in balance. We stay with every project from the first consultation, through design, to construction.',
  };

  // the small line under these headings shows the Arabic original in English mode
  const PAIRS = [
    ['.svc-heading', '.svc-heading-en'],
    ['.prj-heading', '.prj-heading-en'],
    ['.prj-next-title', '.prj-next-en'],
    ['.contact-heading', '.contact-heading-en'],
    ['.team-title', '.team-title-en'],
  ];

  const norm = s => s.replace(/\s+/g, ' ').trim();
  const accents = PAIRS.map(([m, a]) => [document.querySelector(m), document.querySelector(a)])
    .filter(([m, a]) => m && a)
    .map(([m, a]) => {
      const c = m.cloneNode(true);
      c.querySelectorAll('br').forEach(b => b.replaceWith(' '));
      return [a, norm(c.textContent)];
    });

  Object.entries(RICH).forEach(([sel, markup]) => document.querySelectorAll(sel).forEach(n => { n.innerHTML = markup; }));

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentNode.closest('script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const v = DICT[norm(n.nodeValue)];
    if (v == null) return;
    n.nodeValue = n.nodeValue.match(/^\s*/)[0] + v + n.nodeValue.match(/\s*$/)[0];
  });
  ['aria-label', 'placeholder', 'alt', 'title'].forEach(attr => document.querySelectorAll(`[${attr}]`).forEach(n => {
    const v = DICT[norm(n.getAttribute(attr))];
    if (v != null) n.setAttribute(attr, v);
  }));
  const meta = document.querySelector('meta[name="description"]');
  if (meta && DICT[norm(meta.content)]) meta.content = DICT[norm(meta.content)];
  if (DICT[norm(document.title)]) document.title = DICT[norm(document.title)];

  accents.forEach(([a, ar]) => {
    a.textContent = ar;
    a.lang = 'ar';
    a.dir = 'rtl';
    a.classList.add('is-accent-ar');
  });
})();
