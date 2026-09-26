import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import { createPrivateFileUrl, createPrivateImageUrl } from '../lib/storage';
import ProjectSocialActions from '../components/ProjectSocialActions';
import Toast from '../components/Toast';

const demo = [{
  id: 'demo',
  title: 'Social Campaign',
  student_name: 'طالب Design Tips',
  experience: 'خبرة سنة',
  coverUrl: '/assets/cover-default.svg',
  description: 'مشروع تدريبي في بناء الهوية والحملات الإعلانية.',
  status: 'approved',
  likes_count: 0,
  saves_count: 0,
  comments_count: 0,
  views_count: 0,
}];

const galleryContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.04,
    },
  },
};

const galleryCard = {
  hidden: {
    opacity: 0,
    y: 28,
    scale: 0.988,
    filter: 'blur(6px)',
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function projectCoverPath(project) {
  if (project?.cover_path) return project.cover_path;
  if (Array.isArray(project?.image_paths) && project.image_paths.length) return project.image_paths.find(Boolean) || '';
  return project?.image_path || '';
}

function projectCoverUrl(project) {
  if (project?.cover_url) return project.cover_url;
  if (Array.isArray(project?.image_urls) && project.image_urls.length) return project.image_urls.find(Boolean) || project.image_url || '';
  return project?.image_url || '';
}

function LazyProjectCover({ project, eager = false }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(projectCoverUrl(project));
  const [ready, setReady] = useState(Boolean(projectCoverUrl(project)));

  useEffect(() => {
    const direct = projectCoverUrl(project);
    const path = projectCoverPath(project);
    if (direct || !path) {
      setSrc(direct);
      setReady(Boolean(direct));
      return undefined;
    }

    let active = true;
    let observer;
    async function load() {
      try {
        const optimized = await createPrivateImageUrl('student-projects', path, 3600, {
          width: eager ? 1200 : 900,
          quality: 72,
          resize: 'contain',
        });
        if (active && optimized) setSrc(optimized);
      } catch {
        try {
          const original = await createPrivateFileUrl('student-projects', path, 3600);
          if (active) setSrc(original);
        } catch {
          if (active) setSrc('');
        }
      }
    }

    if (eager || !('IntersectionObserver' in window)) load();
    else if (ref.current) {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        load();
      }, { rootMargin: '500px 0px' });
      observer.observe(ref.current);
    }

    return () => { active = false; observer?.disconnect(); };
  }, [project, eager]);

  return (
    <div ref={ref} className={`project-cover-shell premium-project-cover ${ready ? 'is-ready' : ''}`}>
      {src ? (
        <img
          src={src}
          alt={project.title}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setReady(true)}
        />
      ) : <div className="project-cover-placeholder" />}
    </div>
  );
}

export default function ProjectsGallery() {
  const [projects, setProjects] = useState(demo);
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { settings } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      if (!supabase) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id,user_id,title,description,student_name,experience,image_path,image_url,image_paths,image_urls,cover_path,cover_url,status,created_at,likes_count,saves_count,comments_count,views_count')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) {
        setToast({ type: 'error', message: formatError(error) });
        setLoading(false);
        return;
      }

      const nextProjects = data || [];
      setProjects(nextProjects);

      if (user?.id && nextProjects.length) {
        const ids = nextProjects.map((project) => project.id);
        const [likesResult, savesResult] = await Promise.all([
          supabase.from('project_likes').select('project_id').eq('user_id', user.id).in('project_id', ids),
          supabase.from('project_saves').select('project_id').eq('user_id', user.id).in('project_id', ids),
        ]);

        if (!active) return;
        if (!likesResult.error) setLikedIds(new Set((likesResult.data || []).map((item) => item.project_id)));
        if (!savesResult.error) setSavedIds(new Set((savesResult.data || []).map((item) => item.project_id)));
      } else {
        setLikedIds(new Set());
        setSavedIds(new Set());
      }

      setLoading(false);
    }

    loadProjects();
    return () => { active = false; };
  }, [user?.id]);

  function openProject(project) {
    if (!project?.id || project.id === 'demo') return;
    navigate(`/projects/${project.id}`);
  }

  function requireLogin() {
    if (user?.id) return true;
    setToast({ type: 'error', message: 'سجّل الدخول أولًا للتفاعل مع مشاريع الطلبة.' });
    return false;
  }

  async function toggleLike(project) {
    if (!requireLogin() || busyId) return;
    const wasLiked = likedIds.has(project.id);
    setBusyId(project.id);

    try {
      const query = wasLiked
        ? supabase.from('project_likes').delete().eq('project_id', project.id).eq('user_id', user.id)
        : supabase.from('project_likes').insert({ project_id: project.id, user_id: user.id });
      const { error } = await query;
      if (error) throw error;

      setLikedIds((current) => {
        const next = new Set(current);
        if (wasLiked) next.delete(project.id);
        else next.add(project.id);
        return next;
      });
      setProjects((current) => current.map((item) => item.id === project.id
        ? { ...item, likes_count: Math.max(0, Number(item.likes_count || 0) + (wasLiked ? -1 : 1)) }
        : item));
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyId('');
    }
  }

  async function toggleSave(project) {
    if (!requireLogin() || busyId) return;
    const wasSaved = savedIds.has(project.id);
    setBusyId(project.id);

    try {
      const query = wasSaved
        ? supabase.from('project_saves').delete().eq('project_id', project.id).eq('user_id', user.id)
        : supabase.from('project_saves').insert({ project_id: project.id, user_id: user.id });
      const { error } = await query;
      if (error) throw error;

      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(project.id);
        else next.add(project.id);
        return next;
      });
      setProjects((current) => current.map((item) => item.id === project.id
        ? { ...item, saves_count: Math.max(0, Number(item.saves_count || 0) + (wasSaved ? -1 : 1)) }
        : item));
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="projects-page section-pad premium-projects-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <motion.header
        className="projects-hero"
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow">{settings.projectsPage?.eyebrow || 'من التعلم للتطبيق'}</span>
        <h1>{settings.projectsPage?.title || 'معرض مشاريع الطلبة'}</h1>
        <p>{settings.projectsPage?.text || 'مساحة بصرية مميزة بنعرض فيها شغل طلاب Design Tips، مع اسم كل طالب وخبرته.'}</p>
      </motion.header>

      {loading ? (
        <div className="projects-loading-grid" aria-label="جاري تحميل المشاريع">
          {Array.from({ length: 4 }).map((_, index) => <div className="project-skeleton" key={index} />)}
        </div>
      ) : (
        <motion.div
          className="projects-wall premium-projects-wall"
          variants={galleryContainer}
          initial={reducedMotion ? false : 'hidden'}
          whileInView="show"
          viewport={{ once: true, amount: 0.04 }}
        >
          {projects.map((project, index) => {
            const canOpen = project.id !== 'demo';
            return (
              <motion.article
                key={project.id}
                className={`${index % 5 === 0 ? 'wide' : ''} premium-project-card`}
                variants={galleryCard}
                whileHover={reducedMotion || !canOpen ? undefined : {
                  y: -6,
                  scale: 1.006,
                  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                }}
                whileTap={reducedMotion || !canOpen ? undefined : { scale: 0.996 }}
                role={canOpen ? 'link' : undefined}
                tabIndex={canOpen ? 0 : undefined}
                onClick={() => openProject(project)}
                onKeyDown={(event) => {
                  if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openProject(project);
                  }
                }}
                style={{ cursor: canOpen ? 'pointer' : 'default' }}
              >
                <div className="project-image">
                  <LazyProjectCover project={project} eager={index === 0} />
                  <span className="project-sequence">0{index + 1}</span>
                  {canOpen && <div className="project-open-hint"><span>عرض المشروع كامل</span><b>←</b></div>}
                </div>
                <div className="project-meta">
                  <div><h2>{project.title}</h2><p>{project.description}</p></div>
                  <div className="student-sign"><b>{project.student_name}</b>{project.experience && <small>{project.experience}</small>}</div>
                </div>
                {canOpen && (
                  <div className="project-card-social-row">
                    <ProjectSocialActions
                      project={project}
                      liked={likedIds.has(project.id)}
                      saved={savedIds.has(project.id)}
                      onToggleLike={() => toggleLike(project)}
                      onToggleSave={() => toggleSave(project)}
                      onComments={() => openProject(project)}
                      compact
                      busy={busyId === project.id}
                    />
                  </div>
                )}
              </motion.article>
            );
          })}
        </motion.div>
      )}
    </main>
  );
}
