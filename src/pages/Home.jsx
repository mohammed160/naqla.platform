import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { supabase } from '../lib/supabase';
import ReviewsSection from '../components/ReviewsSection';
import StudentReviewsGrid from '../components/StudentReviewsGrid';
import TrackDish from '../components/TrackDish';
import TrackExplorer from '../components/TrackExplorer';
import AudiencePills from '../components/AudiencePills';
import PlanCard from '../components/PlanCard';
import { useAuth } from '../contexts/AuthContext';
import { usePlan, useMembership } from '../lib/membership';
import { DEMO_TRACKS } from '../lib/tracks';

const demoLectures = [
  {
    id: 'demo-free',
    title: 'أول خطوة: كيف تبدأ كصانع محتوى',
    description: 'محاضرة مجانية تعرّفك بأسلوب الشرح والمسارات الثلاثة قبل ما تشترك.',
    thumbnailUrl: '/assets/cover-default.svg',
    durationText: '18 دقيقة',
    isFree: true,
    published: true,
  },
];

const demoCourses = DEMO_TRACKS;

const particleSeeds = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: `${(index * 37) % 96}%`,
  y: `${(index * 53) % 92}%`,
  size: 3 + (index % 4) * 2,
  delay: (index % 7) * 0.45,
  duration: 4.5 + (index % 5),
}));

function AnimatedStat({ value, label, enabled }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const raw = String(value ?? '');
    const match = raw.match(/\d+/);
    if (!enabled || !match || !ref.current) {
      setDisplay(raw);
      return undefined;
    }

    let frame = 0;
    let started = false;
    const target = Number(match[0]);
    const prefix = raw.slice(0, match.index);
    const suffix = raw.slice((match.index || 0) + match[0].length);

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      const start = performance.now();
      const duration = 1100;

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(`${prefix}${Math.round(target * eased)}${suffix}`);
        if (progress < 1) frame = requestAnimationFrame(tick);
      }

      frame = requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.45 });

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, enabled]);

  return <div ref={ref}><b>{display}</b><span>{label}</span></div>;
}

function Reveal({ children, enabled, delay = 0, className = '' }) {
  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 38, scale: 0.97, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.88, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function HeroMedia({ settings, motionEnabled, parallaxEnabled }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 120, damping: 20 });
  const springY = useSpring(y, { stiffness: 120, damping: 20 });
  const rotateY = useTransform(springX, [-1, 1], [-5, 5]);
  const rotateX = useTransform(springY, [-1, 1], [5, -5]);
  const translateX = useTransform(springX, [-1, 1], [-10, 10]);
  const translateY = useTransform(springY, [-1, 1], [-10, 10]);

  const heroImage = settings.heroImageUrl || '/assets/cover-default.svg';
  const useVideo = settings.heroMediaType === 'video' && settings.heroVideoUrl;

  function handlePointerMove(event) {
    if (!motionEnabled || !parallaxEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    y.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function resetPointer() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      className="hero-art hero-art-v7 border-beam-container"
      initial={motionEnabled ? { opacity: 0, scale: 0.93, y: 32, filter: 'blur(12px)' } : false}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      style={motionEnabled && parallaxEnabled ? {
        rotateX,
        rotateY,
        x: translateX,
        y: translateY,
        transformPerspective: 1100,
        transformStyle: 'preserve-3d',
      } : undefined}
    >
      <div className="border-beam" aria-hidden="true" />
      <div className="hero-grid" />
      <div className="hero-media-shine" />
      {useVideo ? (
        <video src={settings.heroVideoUrl} poster={heroImage} autoPlay loop muted playsInline />
      ) : (
        <img src={heroImage} alt={settings.siteName || 'نقلة'} />
      )}
      {(settings.heroChips || []).slice(0, 5).map((chip, index) => (
        <motion.span
          className={`floating-chip dynamic-chip chip-position-${index + 1}`}
          key={`${chip}-${index}`}
          animate={motionEnabled ? { y: [0, -7 - index * 1.5, 0], opacity: [0.92, 1, 0.92] } : undefined}
          transition={{ duration: 4.8 + index * 0.7, repeat: Infinity, ease: 'easeInOut', delay: index * 0.25 }}
        >
          {chip}
        </motion.span>
      ))}
    </motion.div>
  );
}

function MotionTicker({ tags, enabled }) {
  if (!enabled || !tags?.length) return null;
  const duplicated = [...tags, ...tags];

  return (
    <div className="motion-ticker" aria-label="مجالات المنصة">
      <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
        {duplicated.map((tag, index) => <span key={`${tag}-${index}`}><i />{tag}</span>)}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { settings } = useOutletContext();
  const { user } = useAuth();
  const { plan } = usePlan();
  const { hasAccess } = useMembership(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState(demoLectures);
  const [courses, setCourses] = useState(demoCourses);
  const reducedMotion = useReducedMotion();
  const animation = settings.animationSettings || {};
  const motionEnabled = Boolean(animation.enabled && !reducedMotion);
  const revealEnabled = Boolean(motionEnabled && animation.sectionReveal);
  const cardMotion = Boolean(motionEnabled && animation.cardMotion);

  // If visiting /#courses, redirect directly to /courses
  useEffect(() => {
    if (location.hash === '#courses') {
      navigate('/courses', { replace: true });
    }
  }, [location.hash, navigate]);

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      if (!supabase) return;
      const [lectureResult, courseResult] = await Promise.all([
        supabase
          .from('lectures')
          .select('id, title, description, duration_text, thumbnail_url, is_free, published, sort_order')
          .eq('published', true)
          .eq('is_free', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('courses')
          .select('id, title, description, price, thumbnail_url, published, featured, accent, sort_order')
          .eq('published', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (!active) return;

      if (!lectureResult.error) {
        setLectures((lectureResult.data || []).map((item) => ({
          ...item,
          durationText: item.duration_text,
          thumbnailUrl: item.thumbnail_url,
          isFree: item.is_free,
        })));
      } else {
        console.error('Free lectures loading error:', lectureResult.error);
      }

      if (!courseResult.error) {
        const rows = (courseResult.data || []).map((item) => ({ ...item, thumbnailUrl: item.thumbnail_url }));
        if (rows.length) setCourses(rows);
      } else {
        console.error('Courses loading error:', courseResult.error);
      }

    }

    loadHomeData();
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => settings.stats || [], [settings.stats]);
  const sections = settings.homeSections || {};
  const community = sections.community || {};
  const whatsapp = community.buttonUrl
    || settings.socialLinks?.find((item) => /whatsapp/i.test(item.label || ''))?.url
    || settings.social?.whatsapp
    || '#';

  const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.13, delayChildren: 0.08 } },
  };
  const heroItem = {
    hidden: { opacity: 0, y: 32, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.95, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <main className="home-v7">
      {motionEnabled && animation.particles && (
        <div className="motion-particles" aria-hidden="true">
          {particleSeeds.map((particle) => (
            <motion.i
              key={particle.id}
              style={{ left: particle.x, top: particle.y, width: particle.size, height: particle.size }}
              animate={{ y: [0, -28, 0], opacity: [0.15, 0.75, 0.15], scale: [0.8, 1.45, 0.8] }}
              transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}

      <section className="nq-hero">
        <div className="hero-mesh" aria-hidden="true" />
        <div className="nq-hero-inner section-pad">
          <motion.div className="nq-hero-copy" variants={heroContainer} initial={motionEnabled ? 'hidden' : false} animate="visible">
            <motion.span className="nq-hero-badge" variants={heroItem}><i />{settings.heroBadge}</motion.span>
            <motion.h1 variants={heroItem}>{settings.heroTitle}</motion.h1>
            <motion.p variants={heroItem}>{settings.heroText}</motion.p>
            <motion.div className="hero-actions center" variants={heroItem}>
              <Link className="btn primary large" to={settings.primaryCtaUrl || '/join'}>
                <span>{settings.primaryCtaText || 'اشترك مرة واحدة'}</span><i>↗</i>
              </Link>
              <a className="btn ghost large" href={settings.secondaryCtaUrl || '#free'}>
                <span>{settings.secondaryCtaText || 'شاهد محاضرة مجانية'}</span><i>◉</i>
              </a>
            </motion.div>
          </motion.div>

          {settings.heroMediaType === 'image' || settings.heroMediaType === 'video'
            ? <HeroMedia settings={settings} motionEnabled={motionEnabled} parallaxEnabled={animation.heroParallax !== false} />
            : <TrackDish courses={courses} motionEnabled={motionEnabled} />}

          <div className="hero-pillbar">
            <div className="hero-pillbar-stats">
              {stats.map((item, index) => (
                <AnimatedStat key={`${item.label}-${index}`} value={item.value} label={item.label} enabled={motionEnabled} />
              ))}
            </div>
            <Link className="btn primary" to="/join">شوف الاشتراك</Link>
          </div>
        </div>
      </section>

      <MotionTicker tags={settings.motionTags} enabled={motionEnabled && animation.ticker === true} />
      <div className="pattern-band" aria-hidden="true" />

      <AudiencePills />

      {sections.courses?.enabled !== false && (
        <TrackExplorer courses={courses} stats={stats} title={sections.courses?.title} text={sections.courses?.text} />
      )}

      <section className="section-pad plan-section">
        <Reveal enabled={revealEnabled}>
          <PlanCard plan={plan} courses={courses.slice(0, 3)} owned={hasAccess} />
        </Reveal>
      </section>

      {sections.free?.enabled !== false && (
        <section id="free" className="section-pad section-block">
          <Reveal enabled={revealEnabled}>
            <div className="section-heading">
              <div><span className="eyebrow">{sections.free?.eyebrow}</span><h2>{sections.free?.title}</h2></div>
              <p>{sections.free?.text}</p>
            </div>
          </Reveal>
          <div className="card-grid lectures-grid">
            {lectures.length ? lectures.map((lecture, index) => (
              <Reveal key={lecture.id} enabled={revealEnabled} delay={index * 0.07}>
                <motion.article className="course-card motion-card" whileHover={cardMotion ? { y: -10, scale: 1.012 } : undefined}>
                  <div className="course-thumb">
                    <img src={lecture.thumbnailUrl || '/assets/cover-default.svg'} alt={lecture.title} />
                    <span className="free-badge">مجاني</span>
                    <Link className="play-button" to={`/watch/${lecture.id}`} aria-label="مشاهدة">▶</Link>
                  </div>
                  <div className="course-body">
                    <small>{lecture.durationText || 'فيديو مجاني'}</small>
                    <h3>{lecture.title}</h3>
                    <p>{lecture.description}</p>
                    <Link className="text-link" to={`/watch/${lecture.id}`}>شاهد المحاضرة ←</Link>
                    <ReviewsSection lectureId={lecture.id} compact readOnly />
                  </div>
                </motion.article>
              </Reveal>
            )) : <div className="empty-state">لا توجد محاضرات مجانية منشورة حاليًا.</div>}
          </div>
        </section>
      )}

      {/* Student Reviews Bento Grid - Powerful Social Proof & Sales Driver */}
      <StudentReviewsGrid courses={courses} />

      {sections.features?.enabled !== false && (
        <section className="section-pad feature-strip feature-strip-v7">
          {(settings.featureItems || []).map((item, index) => (
            <Reveal key={item.id || `${item.title}-${index}`} enabled={revealEnabled} delay={index * 0.06}>
              <motion.div className="feature-motion-card" whileHover={cardMotion ? { y: -8, borderColor: 'rgba(84,230,212,.38)' } : undefined}>
                <i>{item.icon}</i><h3>{item.title}</h3><p>{item.text}</p><span className="feature-index">0{index + 1}</span>
              </motion.div>
            </Reveal>
          ))}
        </section>
      )}

      {community.enabled !== false && (
        <Reveal enabled={revealEnabled} className="section-pad">
          <section id="community" className="community-section community-section-v7">
            <div className="community-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div><span className="eyebrow">{community.eyebrow}</span><h2>{community.title}</h2><p>{community.text}</p></div>
            <a className="btn primary large magnetic-button" href={whatsapp} target="_blank" rel="noreferrer">
              {community.buttonText || 'انضم للمجتمع'} <i>↗</i>
            </a>
          </section>
        </Reveal>
      )}
    </main>
  );
}
