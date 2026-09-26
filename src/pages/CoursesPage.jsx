import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlan, useMembership } from '../lib/membership';
import { DEMO_TRACKS } from '../lib/tracks';
import StudentReviewsGrid from '../components/StudentReviewsGrid';
import TrackExplorer from '../components/TrackExplorer';
import PlanCard from '../components/PlanCard';

export default function CoursesPage() {
  const { settings = {} } = useOutletContext() || {};
  const { user } = useAuth();
  const { plan } = usePlan();
  const { hasAccess } = useMembership(user?.id);
  const [courses, setCourses] = useState(DEMO_TRACKS);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase
      .from('courses')
      .select('id, title, description, price, thumbnail_url, published, featured, accent, sort_order')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (active && !error && data?.length) setCourses(data);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="courses-page-shell">
      <div className="hero-aurora-mesh" aria-hidden="true">
        <div className="hero-aurora-orb orb-1" />
        <div className="hero-aurora-orb orb-2" />
        <div className="hero-aurora-orb orb-3" />
      </div>

      <section className="courses-hero-section section-pad">
        <motion.div
          className="courses-hero-copy"
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="kinetic-title">ثلاث مسارات، اشتراك واحد</h1>
          <p>من تصميم المحتوى، إلى بناء منصتك بنفسك، إلى الوصول للعميل المناسب. كل المسارات مفتوحة لك بعد الاشتراك.</p>
        </motion.div>
      </section>

      <TrackExplorer courses={courses} stats={settings.stats || []} title="" text="" />

      <section className="section-pad" style={{ paddingBlock: '56px 88px' }}>
        <PlanCard plan={plan} courses={courses.slice(0, 3)} owned={hasAccess} />
      </section>

      <StudentReviewsGrid courses={courses} />
    </main>
  );
}
