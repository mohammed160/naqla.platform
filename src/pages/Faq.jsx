import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { faqCategories } from '../config/faqDefaults';
import { usePlan } from '../lib/membership';
import { BrandShape } from '../components/BrandShapes';

// Makes Arabic search forgiving: strips diacritics and unifies alef / yaa / taa marbuta variants.
function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export default function Faq() {
  const { settings = {} } = useOutletContext() || {};
  const { plan } = usePlan();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [openId, setOpenId] = useState(null);

  const price = Number(plan?.price_egp || 0);
  const priceText = price > 0 ? `${price.toLocaleString('ar-EG')} جنيه` : 'بالسعر المعروض في صفحة الاشتراك';
  const supportUrl = settings.support?.whatsappUrl || '';

  const items = useMemo(
    () => (settings.faqItems || []).map((item) => ({ ...item, answer: String(item.a || '').replaceAll('{price}', priceText) })),
    [settings.faqItems, priceText],
  );

  const counts = useMemo(() => {
    const map = { all: items.length };
    items.forEach((item) => { map[item.category] = (map[item.category] || 0) + 1; });
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const needle = normalize(query);
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      return normalize(`${item.q} ${item.answer}`).includes(needle);
    });
  }, [items, query, category]);

  // Deep link: /faq#price opens that question.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.replace('#', ''));
    if (!id || !items.some((item) => item.id === id)) return;
    setCategory('all');
    setQuery('');
    setOpenId(id);
    setTimeout(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  }, [location.hash, items]);

  // Page title + FAQPage structured data (helps search engines show the answers).
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `الأسئلة الشائعة | ${settings.siteName || 'نقلة'}`;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
    });
    document.head.appendChild(script);
    return () => { document.title = previousTitle; script.remove(); };
  }, [items, settings.siteName]);

  function color(id) {
    return faqCategories.find((entry) => entry.id === id)?.color || '#54e6d4';
  }

  function renderCta(cta) {
    if (!cta) return null;
    if (cta.support) {
      return supportUrl
        ? <a className="btn ghost compact" href={supportUrl} target="_blank" rel="noreferrer">{cta.label}</a>
        : null;
    }
    if (cta.to?.startsWith('/#')) return <a className="btn ghost compact" href={cta.to}>{cta.label}</a>;
    return <Link className="btn ghost compact" to={cta.to}>{cta.label}</Link>;
  }

  return (
    <main className="faq-page">
      <section className="faq-hero">
        <div className="hero-mesh" aria-hidden="true" />
        <div className="faq-hero-inner section-pad">
          <span className="nq-hero-badge"><i />الأسئلة الشائعة</span>
          <h1>كل سؤال في دماغك، له إجابة هنا</h1>
          <p>جمعنا أكتر الأسئلة اللي بتيجي قبل الاشتراك وبعده وجاوبنا عليها بوضوح.{supportUrl ? ' ولو مش لاقي سؤالك، ابعتلنا.' : ''}</p>
          <label className="faq-search">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن سؤالك… مثلًا: الدفع، كود، برمجة"
              aria-label="ابحث في الأسئلة"
            />
          </label>
        </div>
      </section>

      <section className="faq-body section-pad">
        <div className="faq-tabs" role="tablist" aria-label="أقسام الأسئلة">
          {[{ id: 'all', label: 'الكل', color: '#54e6d4' }, ...faqCategories].map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={category === entry.id}
              className={category === entry.id ? 'on' : ''}
              style={{ '--tc': entry.color }}
              onClick={() => setCategory(entry.id)}
            >
              <i />{entry.label}<small>{counts[entry.id] || 0}</small>
            </button>
          ))}
        </div>

        <div className="faq-layout">
          <div className="faq-list" aria-live="polite">
            {visible.map((item) => {
              const open = openId === item.id;
              return (
                <article key={item.id} id={`faq-${item.id}`} className={`faq-item ${open ? 'open' : ''}`} style={{ '--tc': color(item.category) }}>
                  <h3>
                    <button type="button" aria-expanded={open} aria-controls={`faq-panel-${item.id}`} onClick={() => setOpenId(open ? null : item.id)}>
                      <span>{item.q}</span>
                      <b aria-hidden="true" />
                    </button>
                  </h3>
                  <div className="faq-panel" id={`faq-panel-${item.id}`} role="region" aria-hidden={!open}>
                    <div>
                      <p>{item.answer}</p>
                      {renderCta(item.cta)}
                    </div>
                  </div>
                </article>
              );
            })}

            {!visible.length && (
              <div className="faq-empty">
                <BrandShape type="bubble" color="#694aff" />
                <h3>ملقيناش إجابة لـ «{query}»</h3>
                <p>{supportUrl ? 'جرّب كلمة تانية، أو اسألنا مباشرة وهنجاوبك.' : 'جرّب كلمة تانية أو اختار قسم من الأقسام.'}</p>
                {supportUrl && <a className="btn primary" href={supportUrl} target="_blank" rel="noreferrer">اسأل الدعم</a>}
                <button type="button" className="btn ghost" onClick={() => { setQuery(''); setCategory('all'); }}>عرض كل الأسئلة</button>
              </div>
            )}
          </div>

          <aside className="faq-aside">
            <BrandShape type="bubble" color="#694aff" />
            <h2>{supportUrl ? 'لسه عندك سؤال؟' : 'جاهز تبدأ؟'}</h2>
            <p>{supportUrl ? 'اكتبلنا وهنرد عليك. ولو جاهز تبدأ، الاشتراك مرة واحدة يفتح الكورسات التلاتة.' : 'الاشتراك مرة واحدة يفتح الكورسات التلاتة مدى الحياة.'}</p>
            <div>
              {supportUrl && <a className="btn primary full" href={supportUrl} target="_blank" rel="noreferrer">تواصل مع الدعم</a>}
              <Link className={`btn ${supportUrl ? 'ghost' : 'primary'} full`} to="/join">شوف الاشتراك</Link>
            </div>
          </aside>
        </div>
      </section>
      <div className="pattern-band slim" aria-hidden="true" />
    </main>
  );
}
