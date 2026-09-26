import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlan, useMembership } from '../lib/membership';
import { DEMO_TRACKS } from '../lib/tracks';
import PlanCard from '../components/PlanCard';

const faqs = [
  ['هل الدفع مرة واحدة فعلًا؟', 'نعم. تدفع مرة واحدة فقط، ويفضل الوصول للكورسات الثلاثة مفتوحًا لك مدى الحياة بدون تجديد.'],
  ['هل أي كورس جديد يدخل ضمن الاشتراك؟', 'أي كورس ننشره في نقلة لاحقًا يظهر في حسابك تلقائيًا بدون رسوم إضافية.'],
  ['أقدر أجرب قبل ما أشترك؟', 'أكيد. في محاضرات مجانية في الصفحة الرئيسية تشوف منها أسلوب الشرح.'],
  ['معايا كود تفعيل، أستخدمه إزاي؟', 'سجّل حسابك، ثم افتح لوحتك واختر «تفعيل كود» واكتب الكود. الاشتراك يفتح فورًا.'],
];

export default function Join() {
  const { settings = {} } = useOutletContext() || {};
  const { user } = useAuth();
  const { plan } = usePlan();
  const { hasAccess } = useMembership(user?.id);
  const [courses, setCourses] = useState(DEMO_TRACKS);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase
      .from('courses')
      .select('id, title, description, accent, sort_order')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => { if (active && !error && data?.length) setCourses(data); });
    return () => { active = false; };
  }, []);

  return (
    <main className="join-page section-pad">
      <header className="join-hero">
        <span className="eyebrow">{settings.heroBadge}</span>
        <h1>اشتراك واحد، ثلاثة كورسات، مدى الحياة</h1>
        <p>تصميم المحتوى الجرافيكي، وبناء منصتك بالـ Vibe Coding، والإعلانات الممولة. كل اللي يحتاجه المحتوى التعليمي عشان يوصل للناس.</p>
      </header>

      <PlanCard plan={plan} courses={courses.slice(0, 3)} owned={hasAccess} />

      {!user && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', margin: 0 }}>
          محتاج حساب عشان تكمل الشراء. <Link className="text-link" to="/signup">أنشئ حسابك</Link> أو <Link className="text-link" to="/login">سجّل الدخول</Link>.
        </p>
      )}

      <div className="pattern-band slim" aria-hidden="true" />

      <section className="join-faq" aria-label="أسئلة شائعة">
        {faqs.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>
    </main>
  );
}
