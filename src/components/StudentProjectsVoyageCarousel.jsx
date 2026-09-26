import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPrivateFileUrl, createPrivateImageUrl } from '../lib/storage';

// High-fidelity student projects fallback showcasing diverse design disciplines & trainee profiles
const DEFAULT_STUDENT_PROJECTS = [
  {
    id: 'demo-p1',
    title: 'هوية بصرية لعلامة القهوة المختصة Kanso',
    student_name: 'كريم عادل',
    experience: 'خبرة سنة • مصمم هوية',
    track: 'مسار تصميم الهويات والبراندنج',
    batch: 'دفعة 2024',
    tools: 'Illustrator • Photoshop',
    category: 'مشاريع الطلبة',
    description: 'بناء هوية بصرية كاملة مستوحاة من فلسفة البساطة والتركيز، تشمل دليل التغليف، المواد الإعلانية، ونظام الألوان المتوازن.',
    image_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'demo-p2',
    title: 'حملة إعلانية ثلاثية الأبعاد لشركة Volt Energy',
    student_name: 'مريم الشريف',
    experience: 'خبرة سنتين • مخرجة فنية',
    track: 'دبلومة 3D والموشن جرافيكس',
    batch: 'دفعة 2024',
    tools: 'Blender • After Effects',
    category: 'مشاريع الطلبة',
    description: 'تصميم مشاهد وسيناريو إعلاني سينمائي ثلاثي الأبعاد مع محاكاة فيزيائية واقعية للسوائل وإضاءات النيون الديناميكية.',
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'demo-p3',
    title: 'تصميم تجربة Finova للتمويل والاستثمار الذكي',
    student_name: 'عمر طارق',
    experience: 'مصمم واجهات منتجات UI/UX',
    track: 'مسار واجهات وتجربة المستخدم',
    batch: 'دفعة 2024',
    tools: 'Figma • Design System',
    category: 'مشاريع الطلبة',
    description: 'تطبيق مالي مبتكر يُبسّط عمليات الاستثمار وتتبع المحافظ الرقمية من خلال نظام شبكي أنيق ورسوم بيانية تفاعلية سهلة القراءة.',
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'demo-p4',
    title: 'إعادة ابتكار تجربة استكشاف الفنون Muse Platform',
    student_name: 'نور الهدى',
    experience: 'فريق الإخراج الفني والإبداعي',
    track: 'مسار الإخراج الفني الرقمي',
    batch: 'دفعة 2024',
    tools: 'Photoshop • Midjourney AI',
    category: 'مشاريع الطلبة',
    description: 'منصة رقمية للمعارض الفنية المعاصرة تدمج بين التيبوجرافي التعبيري والمؤثرات التفاعلية الدقيقة مع دعم تجربة ثلاثية الأبعاد.',
    image_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'demo-p5',
    title: 'تصميم هوية وتغليف منتجات العناية AURA Organics',
    student_name: 'ياسين ممدوح',
    experience: 'مصمم عبوات وتغليف منتجات',
    track: 'مسار تصميم العبوات والمطبوعات',
    batch: 'دفعة 2024',
    tools: 'Illustrator • 3D Mockups',
    category: 'مشاريع الطلبة',
    description: 'دراسة تفصيلية لخامات الورق المعاد تدويره وتأثيرات الطباعة البارزة (Embossing) لتقديم تجربة حسيّة راقية للمنتج.',
    image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80',
  },
];

// Helper to resolve project cover
function resolveCover(project) {
  if (project?.cover_url) return project.cover_url;
  if (Array.isArray(project?.image_urls) && project.image_urls.length) {
    const found = project.image_urls.find(Boolean);
    if (found) return found;
  }
  return project?.image_url || '';
}

function resolveCoverPath(project) {
  if (project?.cover_path) return project.cover_path;
  if (Array.isArray(project?.image_paths) && project.image_paths.length) {
    const found = project.image_paths.find(Boolean);
    if (found) return found;
  }
  return project?.image_path || '';
}

// Smooth, light transition curve
const VOYAGE_EASING = [0.32, 1, 0.45, 1];
const TRANSITION_DURATION = 0.68; // Smooth, lightweight transition

export default function StudentProjectsVoyageCarousel({
  projects = [],
  title = 'شغلك يستحق يتشاف',
  eyebrow = '',
  subtitle = '',
  autoPlayInterval = 3800, // 3.8s per slide as requested (3-4s)
  showViewAll = true,
  className = '',
}) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  // Combine DB projects with fallbacks if fewer than 4 items
  const items = useMemo(() => {
    const validDB = (projects || []).filter((p) => p && (p.title || p.id));
    if (validDB.length >= 4) return validDB;
    if (validDB.length > 0) {
      // Merge with default items to ensure rich carousel experience
      const combined = [...validDB];
      DEFAULT_STUDENT_PROJECTS.forEach((fallback) => {
        if (!combined.find((p) => p.id === fallback.id) && combined.length < 6) {
          combined.push(fallback);
        }
      });
      return combined;
    }
    return DEFAULT_STUDENT_PROJECTS;
  }, [projects]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resolvedImages, setResolvedImages] = useState({});
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resolve Supabase storage paths if needed
  useEffect(() => {
    let isMounted = true;
    items.forEach(async (project) => {
      const direct = resolveCover(project);
      if (direct) {
        if (isMounted) setResolvedImages((prev) => ({ ...prev, [project.id]: direct }));
        return;
      }
      const path = resolveCoverPath(project);
      if (path) {
        try {
          const opt = await createPrivateImageUrl('student-projects', path, 3600, {
            width: 1200,
            quality: 75,
            resize: 'cover',
          });
          if (isMounted && opt) setResolvedImages((prev) => ({ ...prev, [project.id]: opt }));
        } catch {
          try {
            const raw = await createPrivateFileUrl('student-projects', path, 3600);
            if (isMounted && raw) setResolvedImages((prev) => ({ ...prev, [project.id]: raw }));
          } catch {
            // fallback
          }
        }
      }
    });
    return () => { isMounted = false; };
  }, [items]);

  const total = items.length;

  const nextSlide = useCallback(() => {
    setActiveIndex((current) => (current + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setActiveIndex((current) => (current - 1 + total) % total);
  }, [total]);

  // Autoplay timer with pause on hover/interaction
  useEffect(() => {
    if (reducedMotion || isHovered || isDragging || total <= 1) return undefined;
    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [nextSlide, autoPlayInterval, isHovered, isDragging, reducedMotion, total]);

  // Calculate circular offset relative to active card
  const getCardOffset = (index) => {
    let diff = (index - activeIndex) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  const activeProject = items[activeIndex] || items[0];
  const activeCover = resolvedImages[activeProject?.id] || resolveCover(activeProject) || '/assets/cover-default.svg';

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const threshold = 40;
    const velocityThreshold = 200;

    // In RTL, dragging right (positive x) moves to next, dragging left moves to prev
    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      nextSlide();
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      prevSlide();
    }
  };

  const handleCardClick = (project, offset) => {
    if (offset === 0) {
      // If clicking center card, navigate to project page if real project
      if (project.id && !project.id.startsWith('demo-')) {
        navigate(`/projects/${project.id}`);
      } else {
        navigate('/projects');
      }
    } else {
      // If clicking side card, rotate it to center immediately!
      const targetIndex = items.findIndex((p) => p.id === project.id);
      if (targetIndex !== -1) setActiveIndex(targetIndex);
    }
  };

  return (
    <section
      className={`voyage-carousel-wrapper ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="معرض مشاريع الطلبة ثلاثي الأبعاد"
    >
      {/* Dynamic Ambient Gaussian Blurred Backdrop */}
      <div className="voyage-ambient-backdrop" aria-hidden="true">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeCover}
            src={activeCover}
            alt=""
            className="voyage-ambient-img"
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: VOYAGE_EASING }}
          />
        </AnimatePresence>
        <div className="voyage-ambient-overlay" />
      </div>

      {/* Header Info */}
      <div className="voyage-header">
        {eyebrow && <span className="voyage-eyebrow">{eyebrow}</span>}
        <h2 className="voyage-title">{title}</h2>
        {subtitle && <p className="voyage-subtitle">{subtitle}</p>}
      </div>

      {/* 3D Perspective Stage */}
      <motion.div
        className="voyage-stage-container"
        drag={reducedMotion ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.992 }}
        transition={{ duration: 0.2 }}
      >
        {/* Navigation Arrows (Hover Fade In) */}
        <button
          type="button"
          className="voyage-nav-btn nav-prev"
          onClick={prevSlide}
          aria-label="المشروع السابق"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          className="voyage-nav-btn nav-next"
          onClick={nextSlide}
          aria-label="المشروع التالي"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="voyage-stage">
          {items.map((project, index) => {
            const offset = getCardOffset(index);
            const isCenter = offset === 0;
            const isVisible = Math.abs(offset) <= 2;

            if (!isVisible) return null;

            // Compute 3D values based on relative offset
            // CC Cylinder / Perspective Layer orientation
            let xOffset = 0;
            let scaleVal = 1;
            let rotateYVal = 0;
            let zVal = 0;
            let opacityVal = 1;
            let brightnessVal = 1;
            let blurVal = 0;
            let zIndexVal = 10;

            if (isCenter) {
              xOffset = 0;
              scaleVal = 1.0;
              rotateYVal = 0;
              zVal = isMobile ? 20 : 30;
              opacityVal = 1;
              brightnessVal = 1;
              blurVal = 0;
              zIndexVal = 12;
            } else if (offset === -1) {
              // Left Card - tilted inward cylinder perspective, dimmed as in reference
              xOffset = isMobile ? -74 : -62;
              scaleVal = isMobile ? 0.82 : 0.86;
              rotateYVal = isMobile ? 22 : 24;
              zVal = isMobile ? -25 : -30;
              opacityVal = isMobile ? 0.8 : 0.88;
              brightnessVal = isMobile ? 0.46 : 0.5;
              blurVal = 0;
              zIndexVal = 6;
            } else if (offset === 1) {
              // Right Card - tilted inward cylinder perspective, dimmed as in reference
              xOffset = isMobile ? 74 : 62;
              scaleVal = isMobile ? 0.82 : 0.86;
              rotateYVal = isMobile ? -22 : -24;
              zVal = isMobile ? -25 : -30;
              opacityVal = isMobile ? 0.8 : 0.88;
              brightnessVal = isMobile ? 0.46 : 0.5;
              blurVal = 0;
              zIndexVal = 6;
            } else if (offset === -2) {
              xOffset = isMobile ? -125 : -112;
              scaleVal = 0.65;
              rotateYVal = 26;
              zVal = -80;
              opacityVal = 0;
              brightnessVal = 0.3;
              blurVal = 1;
              zIndexVal = 2;
            } else if (offset === 2) {
              xOffset = isMobile ? 125 : 112;
              scaleVal = 0.65;
              rotateYVal = -26;
              zVal = -80;
              opacityVal = 0;
              brightnessVal = 0.3;
              blurVal = 1;
              zIndexVal = 2;
            }

            const coverSrc = resolvedImages[project.id] || resolveCover(project) || '/assets/cover-default.svg';
            const categoryText = project.category || 'مشاريع الطلبة';

            return (
              <motion.article
                key={project.id}
                className={`voyage-card ${isCenter ? 'is-active' : ''}`}
                onClick={() => handleCardClick(project, offset)}
                animate={{
                  x: `${xOffset}%`,
                  y: isCenter && !reducedMotion ? [0, -6, 0] : 0,
                  scale: scaleVal,
                  rotateY: rotateYVal,
                  z: zVal,
                  opacity: opacityVal,
                  filter: `brightness(${brightnessVal}) blur(${blurVal}px)`,
                }}
                transition={{
                  duration: TRANSITION_DURATION,
                  ease: VOYAGE_EASING,
                  y: isCenter ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5 },
                }}
                style={{
                  zIndex: zIndexVal,
                  pointerEvents: isVisible ? 'auto' : 'none',
                }}
              >
                {/* Media Layer */}
                <div className="voyage-card-media">
                  <img
                    src={coverSrc}
                    alt={project.title}
                    className="voyage-card-img"
                    loading={isCenter ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  <div className="voyage-card-overlay" />
                  <div className="voyage-card-shine" />
                </div>

                {/* Top Badge & Index */}
                <div className="voyage-card-top">
                  <span className="voyage-card-badge">
                    <i />
                    {categoryText}
                  </span>
                  <span className="voyage-card-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Staggered Typography Layer & Trainee Profile */}
                <div className="voyage-card-content">
                  {/* Title with Slide Up + Fade In */}
                  <motion.h3
                    className="voyage-card-title"
                    key={`title-${project.id}-${isCenter}`}
                    initial={isCenter && !reducedMotion ? { opacity: 0, y: 24 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                      delay: isCenter ? 0.05 : 0,
                    }}
                  >
                    {project.title}
                  </motion.h3>

                  {/* Trainee Details Panel with Staggered Delay */}
                  <motion.div
                    className="voyage-trainee-panel"
                    key={`trainee-${project.id}-${isCenter}`}
                    initial={isCenter && !reducedMotion ? { opacity: 0, y: 20 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.55,
                      ease: [0.22, 1, 0.36, 1],
                      delay: isCenter ? 0.16 : 0,
                    }}
                  >
                    <div className="voyage-trainee-avatar">
                      {project.student_name ? project.student_name.trim().charAt(0).toUpperCase() : 'ط'}
                    </div>
                    <div className="voyage-trainee-info">
                      <div className="voyage-trainee-header">
                        <span className="voyage-trainee-name">{project.student_name || 'طالب الأكاديمية'}</span>
                        <svg className="voyage-verified-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="voyage-trainee-batch">{project.batch || project.experience || 'دفعة 2024'}</span>
                      </div>
                      <div className="voyage-trainee-meta">
                        <span className="voyage-trainee-track">{project.track || project.category || 'مسار التصميم الاحترافي'}</span>
                        {project.tools && (
                          <span className="voyage-trainee-tools">• {project.tools}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {project.description && (
                    <motion.p
                      className="voyage-card-description"
                      key={`desc-${project.id}-${isCenter}`}
                      initial={isCenter && !reducedMotion ? { opacity: 0, y: 16 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: isCenter ? 0.22 : 0 }}
                    >
                      {project.description}
                    </motion.p>
                  )}

                  {/* Action button on active card */}
                  {isCenter && (
                    <motion.div
                      initial={!reducedMotion ? { opacity: 0, y: 14 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.28 }}
                    >
                      <Link
                        to={project.id && !project.id.startsWith('demo-') ? `/projects/${project.id}` : '/projects'}
                        className="voyage-card-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        عرض تفاصيل المشروع
                        <span>←</span>
                      </Link>
                    </motion.div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </motion.div>

      {/* Pagination Dots */}
      <div className="voyage-pagination" role="tablist" aria-label="تنقل بين المشاريع">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={item.id || index}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`المشروع ${index + 1}: ${item.title}`}
              className={`voyage-dot ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
            />
          );
        })}
      </div>

      {/* View All Projects Link */}
      {showViewAll && (
        <div className="voyage-footer">
          <Link to="/projects" className="voyage-gallery-link">
            <span>تصفح جميع مشاريع الطلاب في المعرض الكامل</span>
            <b>←</b>
          </Link>
        </div>
      )}
    </section>
  );
}
