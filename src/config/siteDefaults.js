import { defaultFaq } from './faqDefaults';

export const defaultSiteSettings = {
  siteName: 'نقلة',
  logoUrl: '/brand/logo-mark.svg',
  logoPath: '',
  animatedLogoUrl: '',
  animatedLogoPath: '',
  logoMode: 'static',
  logoSize: 46,
  logoMotionStyle: 'none',
  footerLogoUrl: '/brand/logo-mark.svg',
  footerLogoPath: '',
  footerTitle: '',
  footerText: 'نقلة: خطوة واحدة، أثر حقيقي. منصة تنقل المدرّس والمحاضر والدكتور من الشرح التقليدي إلى صناعة المحتوى الرقمي باستقلال كامل.',
  footerSocialTitle: 'تابعنا على',
  footerCopyright: '© {year} {siteName}. جميع الحقوق محفوظة.',
  navLinks: [
    { id: 'home', label: 'الرئيسية', url: '/', visible: true, newTab: false },
    { id: 'courses', label: 'المسارات الثلاثة', url: '/courses', visible: true, newTab: false },
    { id: 'free', label: 'محاضرات مجانية', url: '/#free', visible: true, newTab: false },
    { id: 'faq', label: 'الأسئلة الشائعة', url: '/faq', visible: true, newTab: false },
    { id: 'join', label: 'الاشتراك', url: '/join', visible: true, newTab: false },
  ],
  headerLoginText: 'دخول',
  headerSignupText: 'ابدأ الآن',
  headerDashboardText: 'لوحتي',
  announcement: {
    enabled: false,
    text: 'اشتراك واحد بدفعة واحدة يفتح لك الكورسات الثلاثة مدى الحياة.',
    buttonText: 'اعرف التفاصيل',
    url: '/join',
    newTab: false,
  },
  seoTitle: 'نقلة | Naqla: منصة المحتوى التعليمي لصنّاع المحتوى',
  seoDescription: 'اشتراك واحد يفتح ثلاثة كورسات: تصميم المحتوى الجرافيكي، بناء المنصات بالـ Vibe Coding، والإعلانات الممولة. للمدرّس والمحاضر والدكتور.',
  authPages: {
    loginTitle: 'تسجيل الدخول',
    loginText: 'ادخل بيانات حسابك وكمّل من آخر درس وصلتله.',
    signupTitle: 'إنشاء حساب جديد',
    signupText: 'أنشئ حسابك في نقلة، وابدأ أول خطوة.',
    resetTitle: 'استرجاع كلمة المرور',
    resetText: 'اكتب بريدك وسنرسل لك رابطًا آمنًا لتغيير كلمة المرور.',
  },
  projectsPage: {
    eyebrow: 'شغل حقيقي من المجتمع',
    title: 'مشاريع طلبة نقلة',
    text: 'اكتشف شغل الطلبة، وارفع مشروعك ليظهر في المعرض بعد المراجعة.',
  },
  heroBadge: 'خطوة واحدة، أثر حقيقي',
  heroTitle: 'من مدرّس تقليدي إلى صانع محتوى رقمي',
  heroText: 'اشتراك واحد يفتح لك ثلاثة كورسات عملية: تصميم المحتوى الجرافيكي، وبناء منصتك بالـ Vibe Coding، والإعلانات الممولة. تتعلّم تتكلم بلغة اليوم وتدير حضورك بنفسك.',
  primaryCtaText: 'اشترك مرة واحدة',
  primaryCtaUrl: '/join',
  secondaryCtaText: 'شاهد محاضرة مجانية',
  secondaryCtaUrl: '#free',
  heroMediaType: 'tracks',
  heroImageUrl: '',
  heroImagePath: '',
  heroVideoUrl: '',
  heroVideoPath: '',
  heroChips: ['تصميم', 'Vibe Coding', 'إعلانات ممولة'],
  motionTags: ['تصميم المحتوى', 'Vibe Coding', 'الإعلانات الممولة', 'هوية شخصية', 'منصتك بإيدك', 'استهداف صح'],
  stats: [
    { value: '3', label: 'كورسات في اشتراك واحد' },
    { value: '1', label: 'دفعة واحدة فقط' },
    { value: '∞', label: 'وصول مدى الحياة' },
  ],
  homeSections: {
    free: { enabled: true, eyebrow: 'جرّب قبل ما تشترك', title: 'محاضرات مجانية', text: 'شاهد أسلوب الشرح مباشرة، وقرّر بعدها.' },
    courses: { enabled: true, eyebrow: '', title: 'المسارات', text: 'من تصميم المحتوى، إلى بناء منصتك، إلى الوصول للعميل المناسب.' },
    features: { enabled: true },
    community: { enabled: true, eyebrow: 'مش لوحدك', title: 'انضم إلى مجتمع نقلة', text: 'اسأل، شارك شغلك، وتابع كل جديد مع صنّاع محتوى زيك.', buttonText: 'انضم للمجتمع', buttonUrl: '' },
  },
  featureItems: [
    { id: 'lifetime', icon: '∞', title: 'وصول مدى الحياة', text: 'ادفع مرة واحدة، والمحتوى والتحديثات تفضل معاك.' },
    { id: 'progress', icon: '✦', title: 'تقدم محفوظ', text: 'ارجع لنفس اللحظة اللي وقفت عندها.' },
    { id: 'faq', icon: '◆', title: 'إجابات واضحة', text: 'كل سؤال بيدور في دماغك له إجابة في الأسئلة الشائعة.' },
    { id: 'security', icon: '⌁', title: 'حساب محمي', text: 'جلسات محدودة وعلامة مائية شخصية.' },
  ],
  animationSettings: {
    enabled: true,
    intensity: 'medium',
    sectionReveal: true,
    cursorGlow: false,
    particles: false,
    heroParallax: true,
    cardMotion: true,
    logoMotion: false,
    ticker: false,
  },
  footerSections: [
    {
      id: 'quick-links',
      title: 'روابط سريعة',
      links: [
        { id: 'home', label: 'الرئيسية', url: '/', newTab: false },
        { id: 'courses', label: 'المسارات الثلاثة', url: '/courses', newTab: false },
        { id: 'join', label: 'الاشتراك', url: '/join', newTab: false },
        { id: 'faq', label: 'الأسئلة الشائعة', url: '/faq', newTab: false },
      ],
    },
  ],
  socialLinks: [],
  social: {},
  faqItems: defaultFaq,
  paymentMethods: { paymob: false, fawry: false, fawry_wallet: false, vodafone_cash: false, instapay: false, paypal: false, trc20: false },
  support: { whatsappUrl: '', label: 'تواصل مع الدعم' },
  manualPayments: {
    vodafoneCash: { paymentUrl: '', note: 'ادفع من خلال رابط Vodafone Cash ثم تواصل مع الدعم لإرسال إثبات الدفع.' },
    instaPay: { paymentUrl: '', note: 'ادفع من خلال رابط InstaPay ثم تواصل مع الدعم لإرسال إثبات الدفع.' },
  },
  trc20: { walletAddress: '', note: 'استخدم شبكة TRON (TRC20) فقط.' },
};

function replaceLegacyBrand(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/hunda design|design tips/gi, 'نقلة');
}

function upgradeLegacyBranding(data = {}) {
  return {
    ...data,
    siteName: replaceLegacyBrand(data.siteName),
    footerTitle: replaceLegacyBrand(data.footerTitle),
    footerText: replaceLegacyBrand(data.footerText),
    seoTitle: replaceLegacyBrand(data.seoTitle),
    seoDescription: replaceLegacyBrand(data.seoDescription),
    heroTitle: replaceLegacyBrand(data.heroTitle),
    heroText: replaceLegacyBrand(data.heroText),
    announcement: data.announcement
      ? { ...data.announcement, text: replaceLegacyBrand(data.announcement.text) }
      : data.announcement,
    authPages: data.authPages
      ? {
          ...data.authPages,
          loginText: replaceLegacyBrand(data.authPages.loginText),
          signupText: replaceLegacyBrand(data.authPages.signupText),
          resetText: replaceLegacyBrand(data.authPages.resetText),
        }
      : data.authPages,
    projectsPage: data.projectsPage
      ? {
          ...data.projectsPage,
          title: replaceLegacyBrand(data.projectsPage.title),
          text: replaceLegacyBrand(data.projectsPage.text),
        }
      : data.projectsPage,
    homeSections: data.homeSections
      ? {
          ...data.homeSections,
          community: data.homeSections.community
            ? {
                ...data.homeSections.community,
                title: replaceLegacyBrand(data.homeSections.community.title),
                text: replaceLegacyBrand(data.homeSections.community.text),
              }
            : data.homeSections.community,
        }
      : data.homeSections,
  };
}

export function normalizeSiteSettings(data = {}) {
  data = upgradeLegacyBranding(data);
  const legacySocialLinks = Object.entries(data.social || {})
    .filter(([, url]) => Boolean(url))
    .map(([label, url]) => ({ id: `legacy-${label}`, label, url, newTab: true }));

  return {
    ...defaultSiteSettings,
    ...data,
    homeSections: {
      ...defaultSiteSettings.homeSections,
      ...(data.homeSections || {}),
      free: { ...defaultSiteSettings.homeSections.free, ...(data.homeSections?.free || {}) },
      courses: { ...defaultSiteSettings.homeSections.courses, ...(data.homeSections?.courses || {}) },
      features: { ...defaultSiteSettings.homeSections.features, ...(data.homeSections?.features || {}) },
      community: {
        ...defaultSiteSettings.homeSections.community,
        title: data.communityTitle || data.homeSections?.community?.title || defaultSiteSettings.homeSections.community.title,
        text: data.communityText || data.homeSections?.community?.text || defaultSiteSettings.homeSections.community.text,
        ...(data.homeSections?.community || {}),
      },
    },
    animationSettings: {
      ...defaultSiteSettings.animationSettings,
      ...(data.animationSettings || {}),
    },
    announcement: {
      ...defaultSiteSettings.announcement,
      ...(data.announcement || {}),
    },
    authPages: {
      ...defaultSiteSettings.authPages,
      ...(data.authPages || {}),
    },
    projectsPage: {
      ...defaultSiteSettings.projectsPage,
      ...(data.projectsPage || {}),
    },
    paymentMethods: {
      ...defaultSiteSettings.paymentMethods,
      ...(data.paymentMethods || {}),
    },
    support: {
      ...defaultSiteSettings.support,
      ...(data.support || {}),
    },
    manualPayments: {
      ...defaultSiteSettings.manualPayments,
      ...(data.manualPayments || {}),
      vodafoneCash: {
        ...defaultSiteSettings.manualPayments.vodafoneCash,
        ...(data.manualPayments?.vodafoneCash || {}),
      },
      instaPay: {
        ...defaultSiteSettings.manualPayments.instaPay,
        ...(data.manualPayments?.instaPay || {}),
      },
    },
    trc20: {
      ...defaultSiteSettings.trc20,
      ...(data.trc20 || {}),
    },
    navLinks: (Array.isArray(data.navLinks) ? data.navLinks : defaultSiteSettings.navLinks).map((link) => {
      if (link.id === 'courses' || link.url === '/#courses' || link.url === '#courses') {
        return { ...link, url: '/courses' };
      }
      return link;
    }),
    faqItems: Array.isArray(data.faqItems) && data.faqItems.length ? data.faqItems : defaultSiteSettings.faqItems,
    heroChips: Array.isArray(data.heroChips) ? data.heroChips : defaultSiteSettings.heroChips,
    motionTags: Array.isArray(data.motionTags) ? data.motionTags : defaultSiteSettings.motionTags,
    stats: Array.isArray(data.stats) ? data.stats : defaultSiteSettings.stats,
    featureItems: Array.isArray(data.featureItems) ? data.featureItems : defaultSiteSettings.featureItems,
    footerSections: (Array.isArray(data.footerSections) ? data.footerSections : defaultSiteSettings.footerSections).map((sec) => ({
      ...sec,
      links: Array.isArray(sec.links)
        ? sec.links.map((link) => {
            if (link.id === 'courses' || link.url === '/#courses' || link.url === '#courses') {
              return { ...link, url: '/courses' };
            }
            return link;
          })
        : sec.links,
    })),
    socialLinks: Array.isArray(data.socialLinks)
      ? data.socialLinks
      : (legacySocialLinks.length ? legacySocialLinks : defaultSiteSettings.socialLinks),
  };
}
