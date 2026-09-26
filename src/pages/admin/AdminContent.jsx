import { faqCategories } from '../../config/faqDefaults';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadFile } from '../../lib/storage';
import { formatError } from '../../lib/helpers';
import { defaultSiteSettings, normalizeSiteSettings } from '../../config/siteDefaults';
import BrandMedia from '../../components/BrandMedia';
import Toast from '../../components/Toast';

const makeId = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function FilePicker({ label, accept, file, currentUrl, onChange, hint }) {
  return (
    <label className="file-field">
      {label}
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <span>{file?.name || (currentUrl ? 'اختيار ملف جديد بدل الحالي' : hint || 'اختيار ملف')}</span>
    </label>
  );
}

function Toggle({ checked, onChange, title, text }) {
  return (
    <label className="content-toggle-card">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span><b>{title}</b>{text && <small>{text}</small>}</span>
    </label>
  );
}

function StringListEditor({ title, values, onChange, placeholder, max }) {
  const list = Array.isArray(values) ? values : [];
  return (
    <div className="mini-editor-block">
      <div className="mini-editor-head"><h4>{title}</h4><button type="button" className="btn ghost compact" disabled={max && list.length >= max} onClick={() => onChange([...list, ''])}>+ إضافة</button></div>
      <div className="string-list-editor">
        {list.map((value, index) => (
          <div key={`${title}-${index}`}>
            <input value={value} placeholder={placeholder} onChange={(event) => onChange(list.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
            <button type="button" className="icon-delete" onClick={() => onChange(list.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminContent() {
  const { user } = useAuth();
  const [form, setForm] = useState(defaultSiteSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [files, setFiles] = useState({ logo: null, animatedLogo: null, footerLogo: null, heroImage: null, heroVideo: null });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      const { data, error } = await supabase.from('site_settings').select('settings').eq('id', 'public').maybeSingle();
      if (!active) return;
      if (error) {
        setToast({ type: 'error', message: formatError(error) });
        return;
      }
      if (data?.settings) setForm(normalizeSiteSettings(data.settings));
    }
    loadSettings();
    return () => { active = false; };
  }, []);

  const animatedPreview = useMemo(() => files.animatedLogo ? URL.createObjectURL(files.animatedLogo) : '', [files.animatedLogo]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setFile(key, value) {
    setFiles((current) => ({ ...current, [key]: value }));
  }

  function updateArray(field, index, key, value) {
    setForm((current) => ({
      ...current,
      [field]: (current[field] || []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  function removeArrayItem(field, index) {
    setForm((current) => ({ ...current, [field]: (current[field] || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function setStat(index, key, value) { updateArray('stats', index, key, value); }
  function setFeature(index, key, value) { updateArray('featureItems', index, key, value); }

  function setHomeSection(section, key, value) {
    setForm((current) => ({
      ...current,
      homeSections: {
        ...current.homeSections,
        [section]: { ...current.homeSections?.[section], [key]: value },
      },
    }));
  }

  function setAnimation(key, value) {
    setForm((current) => ({
      ...current,
      animationSettings: { ...current.animationSettings, [key]: value },
    }));
  }

  function addNavLink() {
    setForm((current) => ({
      ...current,
      navLinks: [...(current.navLinks || []), { id: makeId('nav'), label: 'رابط جديد', url: '/', visible: true, newTab: false }],
    }));
  }

  function addFeature() {
    setForm((current) => ({
      ...current,
      featureItems: [...(current.featureItems || []), { id: makeId('feature'), icon: '✦', title: 'ميزة جديدة', text: 'اكتب وصف الميزة.' }],
    }));
  }

  function addFaq() {
    setForm((current) => ({
      ...current,
      faqItems: [...(current.faqItems || []), { id: makeId('faq'), category: 'about', q: 'سؤال جديد؟', a: 'اكتب الإجابة هنا.' }],
    }));
  }

  function addFooterSection() {
    setForm((current) => ({
      ...current,
      footerSections: [...(current.footerSections || []), { id: makeId('section'), title: 'قسم جديد', links: [] }],
    }));
  }

  function updateFooterSection(sectionIndex, key, value) {
    setForm((current) => {
      const footerSections = [...(current.footerSections || [])];
      footerSections[sectionIndex] = { ...footerSections[sectionIndex], [key]: value };
      return { ...current, footerSections };
    });
  }

  function removeFooterSection(sectionIndex) {
    setForm((current) => ({ ...current, footerSections: (current.footerSections || []).filter((_, index) => index !== sectionIndex) }));
  }

  function addFooterLink(sectionIndex) {
    setForm((current) => {
      const footerSections = [...(current.footerSections || [])];
      footerSections[sectionIndex] = {
        ...footerSections[sectionIndex],
        links: [...(footerSections[sectionIndex].links || []), { id: makeId('link'), label: 'رابط جديد', url: '', newTab: false }],
      };
      return { ...current, footerSections };
    });
  }

  function updateFooterLink(sectionIndex, linkIndex, key, value) {
    setForm((current) => {
      const footerSections = [...(current.footerSections || [])];
      const links = [...(footerSections[sectionIndex].links || [])];
      links[linkIndex] = { ...links[linkIndex], [key]: value };
      footerSections[sectionIndex] = { ...footerSections[sectionIndex], links };
      return { ...current, footerSections };
    });
  }

  function removeFooterLink(sectionIndex, linkIndex) {
    setForm((current) => {
      const footerSections = [...(current.footerSections || [])];
      footerSections[sectionIndex] = {
        ...footerSections[sectionIndex],
        links: (footerSections[sectionIndex].links || []).filter((_, index) => index !== linkIndex),
      };
      return { ...current, footerSections };
    });
  }

  function addSocialLink() {
    setForm((current) => ({
      ...current,
      socialLinks: [...(current.socialLinks || []), { id: makeId('social'), label: 'منصة جديدة', url: '', newTab: true }],
    }));
  }

  async function uploadAsset(file, currentUrl, currentPath, folder = 'public/branding', bucket = 'public-assets') {
    if (!file) return { url: currentUrl || '', path: currentPath || '' };
    return uploadFile({ bucket, folder, file, publicUrl: true, onProgress: setProgress });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setProgress(2);

    try {
      const [logoAsset, animatedLogoAsset, footerLogoAsset, heroImageAsset, heroVideoAsset] = await Promise.all([
        uploadAsset(files.logo, form.logoUrl, form.logoPath),
        uploadAsset(files.animatedLogo, form.animatedLogoUrl, form.animatedLogoPath, 'branding', 'public-media'),
        uploadAsset(files.footerLogo, form.footerLogoUrl, form.footerLogoPath),
        uploadAsset(files.heroImage, form.heroImageUrl, form.heroImagePath, 'public/home'),
        uploadAsset(files.heroVideo, form.heroVideoUrl, form.heroVideoPath, 'home', 'public-media'),
      ]);

      const legacySocial = Object.fromEntries((form.socialLinks || []).map((item) => [String(item.label || '').toLowerCase(), item.url || '']));
      const payload = normalizeSiteSettings({
        ...form,
        social: legacySocial,
        logoUrl: logoAsset.url || '',
        logoPath: logoAsset.path || '',
        animatedLogoUrl: animatedLogoAsset.url || '',
        animatedLogoPath: animatedLogoAsset.path || '',
        footerLogoUrl: footerLogoAsset.url || '',
        footerLogoPath: footerLogoAsset.path || '',
        heroImageUrl: heroImageAsset.url || '',
        heroImagePath: heroImageAsset.path || '',
        heroVideoUrl: heroVideoAsset.url || '',
        heroVideoPath: heroVideoAsset.path || '',
        communityTitle: form.homeSections?.community?.title,
        communityText: form.homeSections?.community?.text,
        navLinks: (form.navLinks || []).map((item) => ({ ...item, id: item.id || makeId('nav') })),
        featureItems: (form.featureItems || []).map((item) => ({ ...item, id: item.id || makeId('feature') })),
        faqItems: (form.faqItems || []).map((item) => ({ ...item, id: item.id || makeId('faq') })),
        footerSections: (form.footerSections || []).map((section) => ({
          ...section,
          id: section.id || makeId('section'),
          links: (section.links || []).map((link) => ({ ...link, id: link.id || makeId('link') })),
        })),
        socialLinks: (form.socialLinks || []).map((item) => ({ ...item, id: item.id || makeId('social') })),
      });

      const { error } = await supabase.from('site_settings').upsert({
        id: 'public',
        settings: payload,
        updated_by: user?.id || null,
      }, { onConflict: 'id' });

      if (error) throw error;
      setForm(payload);
      setFiles({ logo: null, animatedLogo: null, footerLogo: null, heroImage: null, heroVideo: null });
      setProgress(0);
      window.dispatchEvent(new CustomEvent('naqla-settings-updated', { detail: payload }));
      setToast({ type: 'success', message: 'تم حفظ ونشر محتوى المنصة والحركات بنجاح.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    ['general', 'عام والصفحات'],
    ['branding', 'الهوية واللوجو'],
    ['navigation', 'النافبار'],
    ['hero', 'الواجهة الرئيسية'],
    ['sections', 'أقسام الرئيسية'],
    ['motion', 'الأنيميشن'],
    ['footer', 'الفوتر والسوشيال'],
    ['payments', 'طرق الدفع'],
  ];

  return (
    <section className="admin-page admin-content-v7">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading">
        <div><span className="eyebrow">Visual CMS V7</span><h1>محتوى المنصة بالكامل</h1><p>تحكم في النصوص والصور والفيديو واللوجو المتحرك وحركة الصفحة الرئيسية بدون تعديل الكود.</p></div>
      </div>

      <div className="content-editor-tabs">
        {tabs.map(([id, label]) => <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}
      </div>

      <form className="admin-form-card content-editor content-editor-v7" onSubmit={submit}>
        {activeTab === 'general' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>الإعدادات العامة ونصوص الصفحات</h2><span>SEO، شريط الإعلان، وصفحات الحساب والمشاريع</span></div>
            <div className="two-cols">
              <label>عنوان الموقع في Google والمتصفح<input value={form.seoTitle || ''} onChange={(event) => setField('seoTitle', event.target.value)} /></label>
              <label>وصف الموقع لمحركات البحث<textarea value={form.seoDescription || ''} onChange={(event) => setField('seoDescription', event.target.value)} /></label>
            </div>
            <article className="section-editor-card">
              <Toggle checked={Boolean(form.announcement?.enabled)} onChange={(value) => setForm({ ...form, announcement: { ...form.announcement, enabled: value } })} title="شريط إعلان أعلى المنصة" text="يظهر أسفل النافبار ويمكن ربطه بعرض أو صفحة." />
              <div className="three-cols">
                <label>نص الإعلان<input value={form.announcement?.text || ''} onChange={(event) => setForm({ ...form, announcement: { ...form.announcement, text: event.target.value } })} /></label>
                <label>نص الرابط<input value={form.announcement?.buttonText || ''} onChange={(event) => setForm({ ...form, announcement: { ...form.announcement, buttonText: event.target.value } })} /></label>
                <label>الرابط<input dir="ltr" value={form.announcement?.url || ''} onChange={(event) => setForm({ ...form, announcement: { ...form.announcement, url: event.target.value } })} /></label>
              </div>
            </article>
            <div className="editor-separator"><h3>صفحات الحساب</h3></div>
            <div className="two-cols">
              <label>عنوان تسجيل الدخول<input value={form.authPages?.loginTitle || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, loginTitle: event.target.value } })} /></label>
              <label>وصف تسجيل الدخول<input value={form.authPages?.loginText || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, loginText: event.target.value } })} /></label>
              <label>عنوان إنشاء الحساب<input value={form.authPages?.signupTitle || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, signupTitle: event.target.value } })} /></label>
              <label>وصف إنشاء الحساب<input value={form.authPages?.signupText || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, signupText: event.target.value } })} /></label>
              <label>عنوان استرجاع كلمة المرور<input value={form.authPages?.resetTitle || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, resetTitle: event.target.value } })} /></label>
              <label>وصف استرجاع كلمة المرور<input value={form.authPages?.resetText || ''} onChange={(event) => setForm({ ...form, authPages: { ...form.authPages, resetText: event.target.value } })} /></label>
            </div>
            <div className="editor-separator"><h3>صفحة مشاريع الطلبة</h3></div>
            <div className="three-cols">
              <label>الكلمة الصغيرة<input value={form.projectsPage?.eyebrow || ''} onChange={(event) => setForm({ ...form, projectsPage: { ...form.projectsPage, eyebrow: event.target.value } })} /></label>
              <label>العنوان<input value={form.projectsPage?.title || ''} onChange={(event) => setForm({ ...form, projectsPage: { ...form.projectsPage, title: event.target.value } })} /></label>
              <label>الوصف<textarea value={form.projectsPage?.text || ''} onChange={(event) => setForm({ ...form, projectsPage: { ...form.projectsPage, text: event.target.value } })} /></label>
            </div>
            <div className="payment-warning"><b>إدارة كاملة</b><p>النصوص والصور والفيديو واللوجو والنافبار والفوتر والحركات من هذه الصفحة. الكورسات وصورها وأسعارها من «الكورسات»، والمحاضرات والفيديوهات والماتريال من «المحاضرات والماتريال»، ومشاريع الطلبة من صفحة المراجعة.</p></div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>الهوية واللوجو المتحرك</h2><span>GIF / SVG / WebP / MP4 / WebM</span></div>
            <div className="three-cols">
              <label>اسم المنصة<input value={form.siteName} onChange={(event) => setField('siteName', event.target.value)} /></label>
              <label>نوع اللوجو<select value={form.logoMode || 'static'} onChange={(event) => setField('logoMode', event.target.value)}><option value="static">لوجو ثابت</option><option value="animated">لوجو متحرك</option></select></label>
              <label>حجم اللوجو<input type="number" min="28" max="120" value={form.logoSize || 44} onChange={(event) => setField('logoSize', Number(event.target.value))} /></label>
            </div>
            <div className="three-cols">
              <FilePicker label="اللوجو الثابت" accept="image/png,image/jpeg,image/webp,image/svg+xml" file={files.logo} currentUrl={form.logoUrl} onChange={(file) => setFile('logo', file)} />
              <FilePicker label="اللوجو المتحرك" accept="image/gif,image/webp,image/svg+xml,video/webm,video/mp4" file={files.animatedLogo} currentUrl={form.animatedLogoUrl} onChange={(file) => setFile('animatedLogo', file)} />
              <label>حركة اللوجو<select value={form.logoMotionStyle || 'float'} onChange={(event) => setField('logoMotionStyle', event.target.value)}><option value="float">طفو هادئ</option><option value="pulse">نبض ضوئي</option><option value="spin">دوران بسيط</option><option value="none">بدون حركة CSS</option></select></label>
            </div>
            <div className="asset-preview-stage">
              <div><span>معاينة الهوية</span><div className="brand preview-brand"><BrandMedia settings={form} previewUrl={animatedPreview} previewType={files.animatedLogo?.type || ''} /><b>{form.siteName}</b></div></div>
              <div className="row-actions">
                <button type="button" className="btn ghost compact" onClick={() => setForm({ ...form, logoUrl: '', logoPath: '' })}>إزالة الثابت</button>
                <button type="button" className="btn ghost compact" onClick={() => setForm({ ...form, animatedLogoUrl: '', animatedLogoPath: '', logoMode: 'static' })}>إزالة المتحرك</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'navigation' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>النافبار والأزرار</h2><button type="button" className="btn ghost compact" onClick={addNavLink}>+ إضافة رابط</button></div>
            <div className="three-cols">
              <label>نص زر الدخول<input value={form.headerLoginText || ''} onChange={(event) => setField('headerLoginText', event.target.value)} /></label>
              <label>نص زر التسجيل<input value={form.headerSignupText || ''} onChange={(event) => setField('headerSignupText', event.target.value)} /></label>
              <label>نص زر لوحة الطالب<input value={form.headerDashboardText || ''} onChange={(event) => setField('headerDashboardText', event.target.value)} /></label>
            </div>
            <div className="content-rows-list">
              {(form.navLinks || []).map((item, index) => (
                <div className="content-row-grid nav-row" key={item.id || index}>
                  <input value={item.label || ''} onChange={(event) => updateArray('navLinks', index, 'label', event.target.value)} placeholder="اسم الرابط" />
                  <input dir="ltr" value={item.url || ''} onChange={(event) => updateArray('navLinks', index, 'url', event.target.value)} placeholder="/page أو /#section" />
                  <label className="inline-check"><input type="checkbox" checked={item.visible !== false} onChange={(event) => updateArray('navLinks', index, 'visible', event.target.checked)} />ظاهر</label>
                  <label className="inline-check"><input type="checkbox" checked={Boolean(item.newTab)} onChange={(event) => updateArray('navLinks', index, 'newTab', event.target.checked)} />نافذة جديدة</label>
                  <button type="button" className="icon-delete" onClick={() => removeArrayItem('navLinks', index)}>×</button>
                </div>
              ))}
            </div>
            <div className="payment-warning"><b>الأمان</b><p>لا يتم إضافة أي رابط للوحة الإدارة هنا أو داخل الواجهة العامة. بوابة الإدارة تفتح فقط من الرابط الخاص المحفوظ عندك.</p></div>
          </div>
        )}

        {activeTab === 'hero' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>Hero — أول انطباع</h2><span>النصوص والصورة أو الفيديو</span></div>
            <label>الكلمة الصغيرة أعلى العنوان<input value={form.heroBadge || ''} onChange={(event) => setField('heroBadge', event.target.value)} /></label>
            <label>العنوان الرئيسي<input value={form.heroTitle || ''} onChange={(event) => setField('heroTitle', event.target.value)} /></label>
            <label>الوصف<textarea value={form.heroText || ''} onChange={(event) => setField('heroText', event.target.value)} /></label>
            <div className="two-cols">
              <label>نص الزر الأساسي<input value={form.primaryCtaText || ''} onChange={(event) => setField('primaryCtaText', event.target.value)} /></label>
              <label>رابط الزر الأساسي<input dir="ltr" value={form.primaryCtaUrl || ''} onChange={(event) => setField('primaryCtaUrl', event.target.value)} /></label>
              <label>نص الزر الثاني<input value={form.secondaryCtaText || ''} onChange={(event) => setField('secondaryCtaText', event.target.value)} /></label>
              <label>رابط الزر الثاني<input dir="ltr" value={form.secondaryCtaUrl || ''} onChange={(event) => setField('secondaryCtaUrl', event.target.value)} /></label>
            </div>
            <div className="three-cols">
              <label>نوع الميديا<select value={form.heroMediaType || 'tracks'} onChange={(event) => setField('heroMediaType', event.target.value)}><option value="tracks">المسارات الثلاثة (كاروسيل)</option><option value="image">صورة</option><option value="video">فيديو متحرك</option></select></label>
              <FilePicker label="صورة الـHero" accept="image/*" file={files.heroImage} currentUrl={form.heroImageUrl} onChange={(file) => setFile('heroImage', file)} />
              <FilePicker label="فيديو الـHero" accept="video/mp4,video/webm" file={files.heroVideo} currentUrl={form.heroVideoUrl} onChange={(file) => setFile('heroVideo', file)} hint="MP4 أو WebM قصير" />
            </div>
            <div className="two-cols">
              <label>رابط صورة مباشر — اختياري<input dir="ltr" value={form.heroImageUrl || ''} onChange={(event) => setField('heroImageUrl', event.target.value)} /></label>
              <label>رابط فيديو مباشر — اختياري<input dir="ltr" value={form.heroVideoUrl || ''} onChange={(event) => setField('heroVideoUrl', event.target.value)} /></label>
            </div>
            <div className="two-cols">
              <StringListEditor title="العناصر الطافية فوق الـHero" values={form.heroChips} onChange={(values) => setField('heroChips', values)} placeholder="AI Design" max={5} />
              <StringListEditor title="شريط المجالات المتحرك" values={form.motionTags} onChange={(values) => setField('motionTags', values)} placeholder="Motion UI" />
            </div>
            <div className="editor-separator"><h3>أرقام المنصة</h3></div>
            <div className="three-cols">
              {(form.stats || []).map((stat, index) => <div className="stat-editor" key={index}><input value={stat.value || ''} onChange={(event) => setStat(index, 'value', event.target.value)} placeholder="+500" /><input value={stat.label || ''} onChange={(event) => setStat(index, 'label', event.target.value)} placeholder="طالب" /></div>)}
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>أقسام الصفحة الرئيسية</h2><span>إظهار وإخفاء وتعديل كل Section</span></div>
            {['free', 'courses'].map((section) => (
              <article className="section-editor-card" key={section}>
                <Toggle checked={form.homeSections?.[section]?.enabled !== false} onChange={(value) => setHomeSection(section, 'enabled', value)} title={section === 'free' ? 'المحاضرات المجانية' : 'الكورسات'} />
                <div className="three-cols">
                  <label>الكلمة الصغيرة<input value={form.homeSections?.[section]?.eyebrow || ''} onChange={(event) => setHomeSection(section, 'eyebrow', event.target.value)} /></label>
                  <label>العنوان<input value={form.homeSections?.[section]?.title || ''} onChange={(event) => setHomeSection(section, 'title', event.target.value)} /></label>
                  <label>الوصف<input value={form.homeSections?.[section]?.text || ''} onChange={(event) => setHomeSection(section, 'text', event.target.value)} /></label>
                </div>
              </article>
            ))}
            <article className="section-editor-card">
              <div className="mini-editor-head"><Toggle checked={form.homeSections?.features?.enabled !== false} onChange={(value) => setHomeSection('features', 'enabled', value)} title="قسم المميزات" /><button type="button" className="btn ghost compact" onClick={addFeature}>+ إضافة ميزة</button></div>
              <div className="feature-editor-grid">
                {(form.featureItems || []).map((item, index) => (
                  <div className="feature-editor-card" key={item.id || index}>
                    <input value={item.icon || ''} onChange={(event) => setFeature(index, 'icon', event.target.value)} placeholder="الأيقونة" />
                    <input value={item.title || ''} onChange={(event) => setFeature(index, 'title', event.target.value)} placeholder="العنوان" />
                    <textarea value={item.text || ''} onChange={(event) => setFeature(index, 'text', event.target.value)} placeholder="الوصف" />
                    <button type="button" className="btn danger compact" onClick={() => removeArrayItem('featureItems', index)}>حذف</button>
                  </div>
                ))}
              </div>
            </article>
            <article className="section-editor-card">
              <div className="mini-editor-head"><h3>الأسئلة الشائعة ({(form.faqItems || []).length})</h3><button type="button" className="btn ghost compact" onClick={addFaq}>إضافة سؤال</button></div>
              <p className="muted-note">تظهر في صفحة /faq. استخدم <code dir="ltr">{'{price}'}</code> داخل الإجابة لعرض سعر الاشتراك الحالي تلقائيًا.</p>
              <div className="feature-editor-grid">
                {(form.faqItems || []).map((item, index) => (
                  <div className="feature-editor-card" key={item.id || index}>
                    <select value={item.category || 'about'} onChange={(event) => updateArray('faqItems', index, 'category', event.target.value)}>
                      {faqCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                    </select>
                    <input value={item.q || ''} onChange={(event) => updateArray('faqItems', index, 'q', event.target.value)} placeholder="السؤال" />
                    <textarea value={item.a || ''} onChange={(event) => updateArray('faqItems', index, 'a', event.target.value)} placeholder="الإجابة" rows={4} />
                    <button type="button" className="btn danger compact" onClick={() => removeArrayItem('faqItems', index)}>حذف</button>
                  </div>
                ))}
              </div>
            </article>
            <article className="section-editor-card">
              <Toggle checked={form.homeSections?.community?.enabled !== false} onChange={(value) => setHomeSection('community', 'enabled', value)} title="قسم المجتمع" />
              <div className="three-cols">
                <label>الكلمة الصغيرة<input value={form.homeSections?.community?.eyebrow || ''} onChange={(event) => setHomeSection('community', 'eyebrow', event.target.value)} /></label>
                <label>العنوان<input value={form.homeSections?.community?.title || ''} onChange={(event) => setHomeSection('community', 'title', event.target.value)} /></label>
                <label>نص الزر<input value={form.homeSections?.community?.buttonText || ''} onChange={(event) => setHomeSection('community', 'buttonText', event.target.value)} /></label>
              </div>
              <label>الوصف<textarea value={form.homeSections?.community?.text || ''} onChange={(event) => setHomeSection('community', 'text', event.target.value)} /></label>
              <label>رابط المجتمع<input dir="ltr" value={form.homeSections?.community?.buttonUrl || ''} onChange={(event) => setHomeSection('community', 'buttonUrl', event.target.value)} placeholder="https://wa.me/..." /></label>
            </article>
            <div className="payment-warning"><b>الفيديوهات والكورسات</b><p>المحاضرات والفيديوهات والماتريال يتم التحكم فيها من صفحة «المحاضرات والماتريال»، والكورسات وأسعارها وصورها من صفحة «الكورسات».</p></div>
          </div>
        )}

        {activeTab === 'motion' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>Motion System</h2><span>قوة الحركة وتجربة المستخدم</span></div>
            <div className="three-cols">
              <label>شدة الحركة<select value={form.animationSettings?.intensity || 'high'} onChange={(event) => setAnimation('intensity', event.target.value)}><option value="low">هادئة</option><option value="medium">متوسطة</option><option value="high">مبهرة</option></select></label>
              <Toggle checked={form.animationSettings?.enabled !== false} onChange={(value) => setAnimation('enabled', value)} title="تشغيل الأنيميشن" text="إيقاف شامل للحركات" />
              <Toggle checked={form.animationSettings?.logoMotion !== false} onChange={(value) => setAnimation('logoMotion', value)} title="حركة اللوجو" />
            </div>
            <div className="motion-toggle-grid">
              <Toggle checked={form.animationSettings?.sectionReveal !== false} onChange={(value) => setAnimation('sectionReveal', value)} title="ظهور الأقسام عند السكرول" />
              <Toggle checked={form.animationSettings?.cursorGlow !== false} onChange={(value) => setAnimation('cursorGlow', value)} title="إضاءة تتبع الماوس" />
              <Toggle checked={form.animationSettings?.particles !== false} onChange={(value) => setAnimation('particles', value)} title="جزيئات ضوئية" />
              <Toggle checked={form.animationSettings?.heroParallax !== false} onChange={(value) => setAnimation('heroParallax', value)} title="Parallax للـHero" />
              <Toggle checked={form.animationSettings?.cardMotion !== false} onChange={(value) => setAnimation('cardMotion', value)} title="حركة الكروت" />
              <Toggle checked={form.animationSettings?.ticker !== false} onChange={(value) => setAnimation('ticker', value)} title="الشريط المتحرك" />
            </div>
            <div className="motion-preview-box"><i /><i /><i /><div><span>Motion Preview</span><b>واجهة حية، سريعة، ومبهرة</b></div></div>
          </div>
        )}

        {activeTab === 'footer' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>الفوتر والسوشيال</h2><button type="button" className="btn ghost compact" onClick={addFooterSection}>+ قسم روابط</button></div>
            <div className="three-cols">
              <label>عنوان الفوتر<input value={form.footerTitle || ''} onChange={(event) => setField('footerTitle', event.target.value)} /></label>
              <label>عنوان السوشيال<input value={form.footerSocialTitle || ''} onChange={(event) => setField('footerSocialTitle', event.target.value)} /></label>
              <FilePicker label="لوجو الفوتر" accept="image/*" file={files.footerLogo} currentUrl={form.footerLogoUrl} onChange={(file) => setFile('footerLogo', file)} />
            </div>
            <label>وصف الفوتر<textarea value={form.footerText || ''} onChange={(event) => setField('footerText', event.target.value)} /></label>
            <label>حقوق النشر<input value={form.footerCopyright || ''} onChange={(event) => setField('footerCopyright', event.target.value)} /><small className="field-help">استخدم {'{year}'} و{'{siteName}'}.</small></label>
            <div className="footer-sections-editor">
              {(form.footerSections || []).map((section, sectionIndex) => (
                <article className="footer-section-card" key={section.id || sectionIndex}>
                  <div className="footer-section-head">
                    <label>عنوان القسم<input value={section.title || ''} onChange={(event) => updateFooterSection(sectionIndex, 'title', event.target.value)} /></label>
                    <div className="row-actions"><button type="button" className="btn ghost compact" onClick={() => addFooterLink(sectionIndex)}>+ رابط</button><button type="button" className="btn danger compact" onClick={() => removeFooterSection(sectionIndex)}>حذف</button></div>
                  </div>
                  <div className="footer-links-editor">
                    {(section.links || []).map((link, linkIndex) => (
                      <div className="footer-link-editor-row" key={link.id || linkIndex}>
                        <input value={link.label || ''} onChange={(event) => updateFooterLink(sectionIndex, linkIndex, 'label', event.target.value)} placeholder="اسم الرابط" />
                        <input dir="ltr" value={link.url || ''} onChange={(event) => updateFooterLink(sectionIndex, linkIndex, 'url', event.target.value)} placeholder="/page أو https://" />
                        <label className="inline-check"><input type="checkbox" checked={Boolean(link.newTab)} onChange={(event) => updateFooterLink(sectionIndex, linkIndex, 'newTab', event.target.checked)} />نافذة جديدة</label>
                        <button type="button" className="icon-delete" onClick={() => removeFooterLink(sectionIndex, linkIndex)}>×</button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="editor-separator"><h3>السوشيال ميديا</h3><button type="button" className="btn ghost compact" onClick={addSocialLink}>+ منصة</button></div>
            <div className="social-editor-list">
              {(form.socialLinks || []).map((item, index) => (
                <div className="social-editor-row" key={item.id || index}>
                  <input value={item.label || ''} onChange={(event) => updateArray('socialLinks', index, 'label', event.target.value)} placeholder="اسم المنصة" />
                  <input dir="ltr" value={item.url || ''} onChange={(event) => updateArray('socialLinks', index, 'url', event.target.value)} placeholder="https://" />
                  <label className="inline-check"><input type="checkbox" checked={item.newTab !== false} onChange={(event) => updateArray('socialLinks', index, 'newTab', event.target.checked)} />نافذة جديدة</label>
                  <button type="button" className="icon-delete" onClick={() => removeArrayItem('socialLinks', index)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="content-tab-panel">
            <div className="panel-heading compact"><h2>طرق الدفع والدعم</h2><span>إظهار الوسائل وربط روابط الدفع والتواصل</span></div>

            <div className="editor-separator"><h3>الدعم</h3></div>
            <div className="two-cols">
              <label>رابط واتساب الدعم<input dir="ltr" placeholder="https://wa.me/2010XXXXXXXX" value={form.support?.whatsappUrl || ''} onChange={(event) => setForm({ ...form, support: { ...form.support, whatsappUrl: event.target.value.trim() } })} /></label>
              <label>نص زر الدعم<input value={form.support?.label || ''} onChange={(event) => setForm({ ...form, support: { ...form.support, label: event.target.value } })} /></label>
            </div>

            <div className="editor-separator"><h3>الوسائل المتاحة</h3></div>
            <div className="payment-toggle-grid">
              {[
                ["paymob", "Paymob", "Visa / Mastercard والمحافظ"],
                ["fawry", "Fawry", "كود دفع من منافذ فوري"],
                ["fawry_wallet", "Fawry Wallet", "طلب دفع مباشر على المحفظة عبر R2P"],
                ["vodafone_cash", "Vodafone Cash", "فتح رابط دفع أو تحويل خارجي"],
                ["instapay", "InstaPay", "فتح رابط دفع أو طلب تحصيل خارجي"],
                ["paypal", "PayPal", "دفع دولي بالدولار"],
                ["trc20", "USDT TRC20", "تحويل USDT على شبكة TRON"],
              ].map(([name, title, description]) => (
                <Toggle key={name} checked={form.paymentMethods?.[name] === true} onChange={(value) => setForm({ ...form, paymentMethods: { ...form.paymentMethods, [name]: value } })} title={title} text={description} />
              ))}
            </div>

            <div className="editor-separator"><h3>Vodafone Cash و InstaPay</h3></div>
            <div className="two-cols">
              <label>رابط دفع Vodafone Cash<input dir="ltr" placeholder="https://..." value={form.manualPayments?.vodafoneCash?.paymentUrl || ''} onChange={(event) => setForm({ ...form, manualPayments: { ...form.manualPayments, vodafoneCash: { ...form.manualPayments?.vodafoneCash, paymentUrl: event.target.value.trim() } } })} /></label>
              <label>ملاحظة Vodafone Cash<input value={form.manualPayments?.vodafoneCash?.note || ''} onChange={(event) => setForm({ ...form, manualPayments: { ...form.manualPayments, vodafoneCash: { ...form.manualPayments?.vodafoneCash, note: event.target.value } } })} /></label>
              <label>رابط دفع InstaPay<input dir="ltr" placeholder="https://..." value={form.manualPayments?.instaPay?.paymentUrl || ''} onChange={(event) => setForm({ ...form, manualPayments: { ...form.manualPayments, instaPay: { ...form.manualPayments?.instaPay, paymentUrl: event.target.value.trim() } } })} /></label>
              <label>ملاحظة InstaPay<input value={form.manualPayments?.instaPay?.note || ''} onChange={(event) => setForm({ ...form, manualPayments: { ...form.manualPayments, instaPay: { ...form.manualPayments?.instaPay, note: event.target.value } } })} /></label>
            </div>

            <div className="editor-separator"><h3>USDT TRC20</h3></div>
            <div className="two-cols">
              <label>عنوان محفظة TRC20<input dir="ltr" value={form.trc20?.walletAddress || ''} onChange={(event) => setForm({ ...form, trc20: { ...form.trc20, walletAddress: event.target.value.trim() } })} /></label>
              <label>ملاحظة التحويل<input value={form.trc20?.note || ''} onChange={(event) => setForm({ ...form, trc20: { ...form.trc20, note: event.target.value } })} /></label>
            </div>

            <div className="payment-warning"><b>ربط فوري الآمن</b><p>مفاتيح Fawry لا تُحفظ هنا نهائيًا. خيار Fawry Wallet يحتاج Edge Function وربط Merchant Code + Secure Key داخل Supabase Secrets فقط.</p></div>
          </div>
        )}

        {progress > 0 && <div className="progress-line"><i><em style={{ width: `${progress}%` }} /></i><span>{progress}%</span></div>}
        <div className="content-save-bar"><span>احفظ مرة واحدة ليتم تحديث الصفحة الرئيسية مباشرة.</span><button className="btn primary large" disabled={busy}>{busy ? 'جاري الحفظ والرفع...' : 'حفظ ونشر كل التعديلات'}</button></div>
      </form>
    </section>
  );
}
