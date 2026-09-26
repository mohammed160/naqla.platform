import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatError } from '../lib/helpers';
import { createPrivateFileUrl, createPrivateImageUrl } from '../lib/storage';
import ProjectSocialActions from '../components/ProjectSocialActions';
import Toast from '../components/Toast';

function projectImagePaths(project) {
  if (Array.isArray(project?.image_paths) && project.image_paths.length) return project.image_paths.filter(Boolean);
  return project?.image_path ? [project.image_path] : [];
}

function projectImageUrls(project) {
  const paths = projectImagePaths(project);
  if (paths.length) return Array.isArray(project?.image_urls) ? project.image_urls : [];
  return project?.image_url ? [project.image_url] : [];
}

function getVisitorId() {
  if (typeof window === 'undefined') return null;
  const key = 'naqla_project_visitor_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const generated = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;
  window.localStorage.setItem(key, generated);
  return generated;
}

function ProgressiveProjectImage({ project, path, directUrl, index, onOpen }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(directUrl || '');
  const [ready, setReady] = useState(Boolean(directUrl));

  useEffect(() => {
    if (directUrl || !path) return undefined;
    let active = true;
    let observer;

    async function loadPreview() {
      try {
        const preview = await createPrivateImageUrl('student-projects', path, 3600, {
          width: index === 0 ? 1400 : 1100,
          quality: index === 0 ? 80 : 72,
          resize: 'contain',
        });
        if (active) setSrc(preview);
      } catch {
        try {
          const original = await createPrivateFileUrl('student-projects', path, 3600);
          if (active) setSrc(original);
        } catch {
          if (active) setSrc('');
        }
      }
    }

    if (index === 0 || !('IntersectionObserver' in window)) loadPreview();
    else if (ref.current) {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadPreview();
      }, { rootMargin: '700px 0px' });
      observer.observe(ref.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [directUrl, path, index]);

  async function openFullImage() {
    if (path) {
      try {
        const original = await createPrivateFileUrl('student-projects', path, 3600);
        onOpen(original || src);
        return;
      } catch {
        // Fall back to the already-rendered preview.
      }
    }
    onOpen(directUrl || src);
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={openFullImage}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.04 }}
      className={`project-detail-image-button ${ready ? 'is-ready' : ''}`}
      aria-label={`فتح الصورة ${index + 1} بالحجم الكامل`}
    >
      {!ready && <div className="project-image-loading" aria-hidden="true" />}
      {src && (
        <img
          src={src}
          alt={`${project.title} - ${index + 1}`}
          loading={index === 0 ? 'eager' : 'lazy'}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setReady(true)}
        />
      )}
    </motion.button>
  );
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const commentsRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('projects')
        .select('id,user_id,title,description,student_name,experience,image_path,image_url,image_paths,image_urls,status,likes_count,saves_count,comments_count,views_count')
        .eq('id', projectId)
        .eq('status', 'approved')
        .maybeSingle();

      if (!mounted) return;
      if (queryError) {
        setError(queryError.message || 'تعذر تحميل المشروع.');
        setLoading(false);
        return;
      }
      if (!data) {
        setError('المشروع غير موجود أو غير منشور حاليًا.');
        setLoading(false);
        return;
      }

      setProject(data);

      const tasks = [
        supabase
          .from('project_comments')
          .select('id,project_id,user_id,commenter_name,body,created_at,updated_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
      ];

      if (user?.id) {
        tasks.push(
          supabase.from('project_likes').select('project_id').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(),
          supabase.from('project_saves').select('project_id').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(),
        );
      }

      const results = await Promise.all(tasks);
      if (!mounted) return;

      const commentsResult = results[0];
      if (!commentsResult.error) setComments(commentsResult.data || []);
      else setToast({ type: 'error', message: formatError(commentsResult.error) });

      if (user?.id) {
        setLiked(Boolean(results[1]?.data));
        setSaved(Boolean(results[2]?.data));
      } else {
        setLiked(false);
        setSaved(false);
      }

      setLoading(false);
    }

    loadProject();
    return () => { mounted = false; };
  }, [projectId, user?.id]);

  useEffect(() => {
    if (!project?.id) return;
    let active = true;

    async function registerView() {
      const visitorId = user?.id ? null : getVisitorId();
      const { data, error: viewError } = await supabase.rpc('register_project_view', {
        p_project_id: project.id,
        p_visitor_id: visitorId,
      });

      if (!active || viewError || data !== true) return;
      setProject((current) => current ? { ...current, views_count: Number(current.views_count || 0) + 1 } : current);
    }

    registerView();
    return () => { active = false; };
  }, [project?.id, user?.id]);

  const images = useMemo(() => {
    if (!project) return [];
    const paths = projectImagePaths(project);
    const urls = projectImageUrls(project);
    const length = Math.max(paths.length, urls.length);
    return Array.from({ length }, (_, index) => ({ path: paths[index] || '', directUrl: urls[index] || '' }));
  }, [project]);

  function requireLogin() {
    if (user?.id) return true;
    setToast({ type: 'error', message: 'سجّل الدخول أولًا للتفاعل مع المشروع.' });
    return false;
  }

  async function toggleLike() {
    if (!requireLogin() || socialBusy) return;
    setSocialBusy(true);

    try {
      const query = liked
        ? supabase.from('project_likes').delete().eq('project_id', project.id).eq('user_id', user.id)
        : supabase.from('project_likes').insert({ project_id: project.id, user_id: user.id });
      const { error: actionError } = await query;
      if (actionError) throw actionError;

      setLiked((current) => !current);
      setProject((current) => ({
        ...current,
        likes_count: Math.max(0, Number(current.likes_count || 0) + (liked ? -1 : 1)),
      }));
    } catch (actionError) {
      setToast({ type: 'error', message: formatError(actionError) });
    } finally {
      setSocialBusy(false);
    }
  }

  async function toggleSave() {
    if (!requireLogin() || socialBusy) return;
    setSocialBusy(true);

    try {
      const query = saved
        ? supabase.from('project_saves').delete().eq('project_id', project.id).eq('user_id', user.id)
        : supabase.from('project_saves').insert({ project_id: project.id, user_id: user.id });
      const { error: actionError } = await query;
      if (actionError) throw actionError;

      setSaved((current) => !current);
      setProject((current) => ({
        ...current,
        saves_count: Math.max(0, Number(current.saves_count || 0) + (saved ? -1 : 1)),
      }));
    } catch (actionError) {
      setToast({ type: 'error', message: formatError(actionError) });
    } finally {
      setSocialBusy(false);
    }
  }

  function scrollToComments() {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!requireLogin() || commentBusy) return;

    const cleanBody = commentBody.trim();
    if (!cleanBody) return;
    if (cleanBody.length > 800) {
      setToast({ type: 'error', message: 'التعليق يجب ألا يتجاوز 800 حرف.' });
      return;
    }

    setCommentBusy(true);
    try {
      const { data, error: insertError } = await supabase
        .from('project_comments')
        .insert({ project_id: project.id, user_id: user.id, body: cleanBody })
        .select('id,project_id,user_id,commenter_name,body,created_at,updated_at')
        .single();

      if (insertError) throw insertError;
      setComments((current) => [...current, data]);
      setCommentBody('');
      setProject((current) => ({ ...current, comments_count: Number(current.comments_count || 0) + 1 }));
    } catch (insertError) {
      setToast({ type: 'error', message: formatError(insertError) });
    } finally {
      setCommentBusy(false);
    }
  }

  async function deleteComment(comment) {
    if (!user?.id || (!isAdmin && comment.user_id !== user.id)) return;
    if (!window.confirm('حذف هذا التعليق؟')) return;

    try {
      const { error: deleteError } = await supabase.from('project_comments').delete().eq('id', comment.id);
      if (deleteError) throw deleteError;
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setProject((current) => ({
        ...current,
        comments_count: Math.max(0, Number(current.comments_count || 0) - 1),
      }));
    } catch (deleteError) {
      setToast({ type: 'error', message: formatError(deleteError) });
    }
  }

  if (loading) return <main className="section-pad project-details-page"><div className="project-detail-skeleton" /></main>;

  if (error || !project) {
    return (
      <main className="section-pad project-details-page">
        <div className="empty-state"><p>{error || 'المشروع غير موجود.'}</p><Link className="btn ghost" to="/projects">العودة لمشاريع الطلبة</Link></div>
      </main>
    );
  }

  return (
    <main className="section-pad project-details-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="project-details-back"><Link className="btn ghost compact" to="/projects">→ العودة للمعرض</Link></div>
      <header className="project-details-header">
        <div>
          <span className="eyebrow">Student Project</span>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
          <div className="project-details-social">
            <ProjectSocialActions
              project={project}
              liked={liked}
              saved={saved}
              onToggleLike={toggleLike}
              onToggleSave={toggleSave}
              onComments={scrollToComments}
              busy={socialBusy}
            />
          </div>
        </div>
        <div className="project-details-student">
          <small>تنفيذ الطالب</small>
          <b>{project.student_name}</b>
          {project.experience && <span>{project.experience}</span>}
        </div>
      </header>

      <section className="project-details-images">
        {images.length ? images.map((image, index) => (
          <ProgressiveProjectImage
            key={`${image.path || image.directUrl}-${index}`}
            project={project}
            path={image.path}
            directUrl={image.directUrl}
            index={index}
            onOpen={setActiveImage}
          />
        )) : <div className="empty-state">لا توجد صور متاحة لهذا المشروع.</div>}
      </section>

      <section className="project-comments-section" ref={commentsRef}>
        <div className="project-comments-heading">
          <div>
            <span className="eyebrow">Community</span>
            <h2>التعليقات</h2>
          </div>
          <b>{comments.length}</b>
        </div>

        {user?.id ? (
          <form className="project-comment-form" onSubmit={submitComment}>
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="اكتب رأيك في المشروع…"
              maxLength={800}
              rows={4}
            />
            <div>
              <small>{commentBody.length}/800</small>
              <button className="btn primary compact" type="submit" disabled={commentBusy || !commentBody.trim()}>
                {commentBusy ? 'جاري النشر…' : 'نشر التعليق'}
              </button>
            </div>
          </form>
        ) : (
          <div className="project-comments-login">
            <p>سجّل الدخول علشان تقدر تكتب تعليق أو تعمل Like وتحفظ المشروع.</p>
            <Link className="btn ghost compact" to="/login">تسجيل الدخول</Link>
          </div>
        )}

        <div className="project-comments-list">
          {comments.length ? comments.map((comment) => (
            <article key={comment.id} className="project-comment-card">
              <div className="project-comment-avatar">{(comment.commenter_name || 'ط').slice(0, 1)}</div>
              <div className="project-comment-content">
                <div className="project-comment-meta">
                  <div>
                    <b>{comment.commenter_name || 'طالب في المنصة'}</b>
                    <small>{formatDate(comment.created_at)}</small>
                  </div>
                  {(isAdmin || comment.user_id === user?.id) && (
                    <button type="button" onClick={() => deleteComment(comment)}>حذف</button>
                  )}
                </div>
                <p>{comment.body}</p>
              </div>
            </article>
          )) : <div className="empty-state compact-empty">لسه مفيش تعليقات. كن أول واحد يشارك رأيه.</div>}
        </div>
      </section>

      {activeImage && (
        <div className="project-lightbox" role="dialog" aria-modal="true" onClick={() => setActiveImage('')}>
          <button type="button" onClick={() => setActiveImage('')} aria-label="إغلاق الصورة">×</button>
          <img src={activeImage} alt={project.title} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </main>
  );
}
