// Visual identity of the three Naqla tracks (courses).
// A course row can set `accent` (pink | purple | orange | teal); otherwise the position decides.
export const ACCENTS = {
  pink: { key: 'pink', color: '#FB4C7D', shape: 'circle', tag: 'Graphic Design' },
  purple: { key: 'purple', color: '#694AFF', shape: 'bubble', tag: 'Vibe Coding' },
  orange: { key: 'orange', color: '#FF5500', shape: 'shield', tag: 'Paid Ads' },
  teal: { key: 'teal', color: '#54E6D4', shape: 'hook', tag: 'Naqla' },
};

const ORDER = ['pink', 'purple', 'orange'];

export function trackFor(course, index = 0) {
  const key = course?.accent && ACCENTS[course.accent] ? course.accent : ORDER[index % ORDER.length];
  return ACCENTS[key];
}

export function courseCover(course, index = 0) {
  return course?.thumbnail_url || course?.thumbnailUrl || `/assets/cover-${trackFor(course, index).key}.svg`;
}

export const DEFAULT_PLAN = {
  id: 'default',
  slug: 'naqla-lifetime',
  title: 'عضوية نقلة مدى الحياة',
  description: 'دفعة واحدة تفتح لك الكورسات الثلاثة، وأي كورس نضيفه لاحقًا.',
  price_egp: 1999,
  price_usd: null,
  price_usdt: null,
  is_lifetime: true,
  published: true,
};

// Shown until the database answers (and when Supabase is not configured yet).
export const DEMO_TRACKS = [
  { id: 'demo-graphic', title: 'تصميم المحتوى الجرافيكي', description: 'ابنِ هوية بصرية لمحتواك: من فكرة الشريحة والبوستر إلى غلاف الكورس والإعلان، بأدوات عملية وخطوات واضحة.', accent: 'pink', price: 0, published: true, featured: true },
  { id: 'demo-vibe', title: 'بناء المنصات بالـ Vibe Coding', description: 'اصنع منصتك ومنتجك الرقمي بنفسك بمساعدة الذكاء الاصطناعي، من غير ما تكون مبرمج.', accent: 'purple', price: 0, published: true },
  { id: 'demo-ads', title: 'الإعلانات الممولة', description: 'اعرف تستهدف العميل المناسب لك، وتبني حملة تجيب نتيجة وتقيس أثرها.', accent: 'orange', price: 0, published: true },
];

// What each track teaches, used on the tracks section. Order matches the accent order.
export const TRACK_OUTCOMES = {
  pink: ['غلاف كورس وبوستر احترافي', 'شرائح ومحتوى جذاب للتعليم', 'هوية بصرية تميزك'],
  purple: ['منصة كورسات بإيدك', 'صفحة هبوط لمنتجك', 'أتمتة الشغل المتكرر بالذكاء الاصطناعي'],
  orange: ['استهداف الجمهور المناسب', 'إعلان وميزانية محسوبة', 'قياس النتيجة وتحسينها'],
  teal: ['خطوة عملية بعد كل درس'],
};

// Topics shown in the track explorer. Starter copy: edit freely, or replace with real lesson titles later.
export const TRACK_TOPICS = {
  pink: [
    { title: 'أساسيات التصميم للمحتوى التعليمي', note: 'ألوان وخطوط وتكوين يخلي المحتوى واضح ومقروء.' },
    { title: 'غلاف الكورس والبوستر', note: 'تصميم أول صورة يشوفها الطالب عنك.' },
    { title: 'شرائح ومحتوى جذاب', note: 'حوّل الشرح لشرائح يفضل الطالب متابعها.' },
    { title: 'هوية بصرية تميّزك', note: 'لوجو وألوان وأسلوب موحد لكل شغلك.' },
    { title: 'تجهيز الملفات للنشر', note: 'المقاسات والتصدير لكل منصة.' },
  ],
  purple: [
    { title: 'فكرة المنصة وتحديد المطلوب', note: 'ابدأ بورقة واضحة قبل أول سطر.' },
    { title: 'كتابة الأوامر للذكاء الاصطناعي', note: 'إزاي تطلب صح وتوصل لنتيجة قابلة للتشغيل.' },
    { title: 'بناء صفحة الهبوط', note: 'صفحة تعرّف بيك وتجمع المشتركين.' },
    { title: 'منصة الكورسات', note: 'تسجيل، دروس، وتقدم الطالب.' },
    { title: 'النشر والدومين', note: 'من جهازك للإنترنت خطوة بخطوة.' },
  ],
  orange: [
    { title: 'فهم جمهورك المستهدف', note: 'مين اللي محتاج اللي بتقدمه فعلًا.' },
    { title: 'إعداد الحساب والبكسل', note: 'الأساس التقني لأي حملة.' },
    { title: 'كتابة إعلان يجذب', note: 'عنوان وصورة ودعوة واضحة للتصرف.' },
    { title: 'الميزانية والاستهداف', note: 'اصرف قليل وابدأ صح.' },
    { title: 'قياس النتائج وتحسين الحملة', note: 'اقرأ الأرقام واتخذ قرار.' },
  ],
  teal: [{ title: 'خطوة عملية بعد كل درس', note: 'تطبيق مباشر على شغلك.' }],
};

export const AUDIENCE = [
  { key: 'teacher', title: 'مدرّس', text: 'حوّل شرحك لمحتوى يوصل لطلاب أكتر.' },
  { key: 'lecturer', title: 'محاضر', text: 'ابنِ حضورك الرقمي بمنصتك وهويتك.' },
  { key: 'doctor', title: 'دكتور', text: 'قدّم علمك بلغة اليوم واستقل بمنصتك.' },
];
