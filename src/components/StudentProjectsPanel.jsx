import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createPrivateFileUrls,
  createPrivateImageUrl,
  removeStoredFile,
  uploadFile,
} from '../lib/storage';
import { formatError } from '../lib/helpers';
import ProjectCoverField from './ProjectCoverField';

const emptyEditor = {
  title: '',
  experience: '',
  description: '',
  items: [],
  coverPath: '',
  coverUrl: '',
  coverDisplayUrl: '',
  coverFile: null,
  originalCoverPath: '',
};

function projectImagePaths(project) {
  if (Array.isArray(project?.image_paths) && project.image_paths.length) return project.image_paths.filter(Boolean);
  return project?.image_path ? [project.image_path] : [];
}

function projectCoverPath(project) {
  return project?.cover_path || project?.image_path || projectImagePaths(project)[0] || '';
}

function projectCoverUrl(project) {
  return project?.cover_url || project?.image_url || '';
}

function ProjectThumb({ project }) {
  const [src, setSrc] = useState(projectCoverUrl(project));

  useEffect(() => {
    const direct = projectCoverUrl(project);
    const path = projectCoverPath(project);
    if (direct || !path) {
      setSrc(direct);
      return undefined;
    }

    let active = true;
    createPrivateImageUrl('student-projects', path, 3600, { width: 720, quality: 70, resize: 'contain' })
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(''));
    return () => { active = false; };
  }, [project]);

  return (
    <div className="student-project-card-cover">
      {src ? <img src={src} alt={project.title} loading="lazy" decoding="async" /> : <div className="project-cover-placeholder" />}
    </div>
  );
}

export default function StudentProjectsPanel({ user, profile, onChanged, onToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [editor, setEditor] = useState(emptyEditor);
  const [removedPaths, setRemovedPaths] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const notify = useCallback((toast) => onToast?.(toast), [onToast]);

  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) throw error;
    setProjects(data || []);
  }, [user?.id]);

  useEffect(() => {
    loadProjects().catch((error) => notify({ type: 'error', message: formatError(error) }));
  }, [loadProjects, notify]);

  function releaseNewItemPreviews(items = editor.items) {
    items.forEach((item) => {
      if (item.kind === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }

  function resetEditor() {
    releaseNewItemPreviews();
    setEditor(emptyEditor);
    setEditingId('');
    setRemovedPaths([]);
    setUploadProgress(0);
  }

  function startNew() {
    resetEditor();
    window.requestAnimationFrame(() => document.querySelector('.student-project-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function resolveCoverDisplay(project) {
    const direct = projectCoverUrl(project);
    if (direct) return direct;
    const path = projectCoverPath(project);
    if (!path) return '';
    try {
      return await createPrivateImageUrl('student-projects', path, 3600, { width: 1000, quality: 76, resize: 'contain' });
    } catch {
      return '';
    }
  }

  async function startEdit(project) {
    try {
      releaseNewItemPreviews();
      setBusy(true);
      const paths = projectImagePaths(project);
      const displayUrls = paths.length ? await createPrivateFileUrls('student-projects', paths, 3600) : [];
      const coverDisplayUrl = await resolveCoverDisplay(project);

      setEditingId(project.id);
      setRemovedPaths([]);
      setUploadProgress(0);
      setEditor({
        title: project.title || '',
        experience: project.experience || '',
        description: project.description || '',
        items: paths.map((path, index) => ({
          id: `existing-${path}-${index}`,
          kind: 'existing',
          path,
          previewUrl: displayUrls[index] || '',
        })),
        coverPath: project.cover_path || '',
        coverUrl: project.cover_url || '',
        coverDisplayUrl,
        coverFile: null,
        originalCoverPath: project.cover_path || '',
      });
      window.requestAnimationFrame(() => document.querySelector('.student-project-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      notify({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  function appendFiles(files) {
    const next = Array.from(files || []).filter((file) => file.type?.startsWith('image/')).map((file) => ({
      id: `new-${crypto.randomUUID()}`,
      kind: 'new',
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    if (!next.length) return;
    setEditor((current) => ({ ...current, items: [...current.items, ...next] }));
  }

  function moveItem(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= editor.items.length) return;
    setEditor((current) => {
      const items = [...current.items];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, items };
    });
  }

  function removeItem(index) {
    const item = editor.items[index];
    if (!item) return;
    if (item.kind === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.kind === 'existing' && item.path) setRemovedPaths((current) => [...current, item.path]);
    setEditor((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function clearCover() {
    setEditor((current) => ({
      ...current,
      coverPath: '',
      coverUrl: '',
      coverDisplayUrl: '',
      coverFile: null,
    }));
  }

  async function submitProject(event) {
    event.preventDefault();
    if (busy) return;
    if (!editor.title.trim() || !editor.description.trim()) {
      notify({ type: 'error', message: 'اسم المشروع ووصف المشروع مطلوبين.' });
      return;
    }
    if (!editor.items.length) {
      notify({ type: 'error', message: 'لازم المشروع يحتوي على صورة واحدة على الأقل.' });
      return;
    }

    setBusy(true);
    setUploadProgress(0);
    try {
      const finalItems = [];
      const newCount = editor.items.filter((item) => item.kind === 'new').length;
      let newIndex = 0;

      for (const item of editor.items) {
        if (item.kind === 'existing') {
          finalItems.push({ path: item.path, url: '' });
          continue;
        }

        const uploaded = await uploadFile({
          bucket: 'student-projects',
          folder: `projects/${user.id}`,
          file: item.file,
          publicUrl: false,
          onProgress: (fileProgress) => {
            const total = Math.max(1, newCount + (editor.coverFile ? 1 : 0));
            setUploadProgress(Math.round(((newIndex + (fileProgress / 100)) / total) * 100));
          },
        });
        finalItems.push({ path: uploaded.path, url: '' });
        newIndex += 1;
      }

      const paths = finalItems.map((item) => item.path).filter(Boolean);
      let coverPath = editor.coverPath;
      let coverUrl = editor.coverUrl;

      if (editor.coverFile) {
        const coverUpload = await uploadFile({
          bucket: 'public-assets',
          folder: `project-covers/${user.id}`,
          file: editor.coverFile,
          publicUrl: true,
          onProgress: (fileProgress) => {
            const total = Math.max(1, newCount + 1);
            setUploadProgress(Math.round(((newCount + (fileProgress / 100)) / total) * 100));
          },
        });
        coverPath = coverUpload.path;
        coverUrl = coverUpload.url || '';
      }

      if (!coverPath) {
        coverPath = paths[0] || '';
        coverUrl = '';
      }

      const payload = {
        student_name: profile?.displayName || user?.displayName || user?.email || 'طالب',
        experience: editor.experience.trim(),
        title: editor.title.trim(),
        description: editor.description.trim(),
        image_path: paths[0] || '',
        image_url: coverUrl || '',
        image_paths: paths,
        image_urls: [],
        cover_path: coverPath,
        cover_url: coverUrl || '',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
      };

      let error;
      if (editingId) {
        ({ error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id));
      } else {
        ({ error } = await supabase.from('projects').insert({ ...payload, user_id: user.id }));
      }
      if (error) throw error;

      const stillUsed = new Set([...paths, coverPath].filter(Boolean));
      await Promise.all(
        [...new Set(removedPaths)]
          .filter((path) => path && !stillUsed.has(path))
          .map((path) => removeStoredFile('student-projects', path)),
      );

      if (
        editor.originalCoverPath
        && editor.originalCoverPath.startsWith('project-covers/')
        && editor.originalCoverPath !== coverPath
      ) {
        await removeStoredFile('public-assets', editor.originalCoverPath);
      }

      const wasEditing = Boolean(editingId);
      resetEditor();
      await loadProjects();
      await onChanged?.();
      notify({
        type: 'success',
        message: wasEditing
          ? 'تم حفظ التعديلات، والمشروع رجع تلقائيًا لقيد المراجعة قبل النشر.'
          : 'تم رفع المشروع للمراجعة. الإدارة هي اللي بتوافق على النشر.',
      });
    } catch (error) {
      notify({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="student-projects-manager">
      <div className="panel-heading student-projects-manager-heading">
        <div>
          <h2>مشاريعي</h2>
          <p>ارفع مشروعك وعدّله في أي وقت. أي تعديل بعد الرفع بيرجعه للمراجعة، والنشر يفضل بقرار الإدارة فقط.</p>
        </div>
        {editingId && <button type="button" className="btn ghost compact" onClick={startNew}>إضافة مشروع جديد</button>}
      </div>

      <form className="project-upload-card student-project-editor" onSubmit={submitProject}>
        <div className="project-editor-title-row">
          <div>
            <span className="eyebrow">{editingId ? 'Edit Project' : 'New Project'}</span>
            <h3>{editingId ? 'تعديل المشروع' : 'إضافة مشروع جديد'}</h3>
          </div>
          {editingId && <span className="project-rereview-badge">أي تعديل = مراجعة جديدة</span>}
        </div>

        <div className="two-cols">
          <label>اسم المشروع<input required value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} /></label>
          <label>مدة الخبرة <small>(اختياري)</small><input placeholder="مثال: سنة ونصف" value={editor.experience} onChange={(e) => setEditor({ ...editor, experience: e.target.value })} /></label>
        </div>
        <label>وصف المشروع<textarea required value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></label>

        <ProjectCoverField
          currentUrl={editor.coverDisplayUrl}
          file={editor.coverFile}
          onFileChange={(file) => setEditor((current) => ({ ...current, coverFile: file }))}
          onClear={clearCover}
          disabled={busy}
        />

        <div className="project-images-editor">
          <div className="project-images-editor-head">
            <div><b>صور المشروع الداخلية</b><span>دي الصور اللي هتظهر كاملة داخل صفحة المشروع وبنفس الترتيب.</span></div>
            <label className="btn ghost compact">
              <input type="file" accept="image/*" multiple onChange={(e) => { appendFiles(e.target.files); e.target.value = ''; }} />
              إضافة صور
            </label>
          </div>

          {editor.items.length ? (
            <div className="project-images-editor-grid">
              {editor.items.map((item, index) => (
                <article key={item.id} className="project-image-editor-card">
                  <div className="project-image-editor-preview"><img src={item.previewUrl} alt={`صورة ${index + 1}`} /></div>
                  <div className="project-image-editor-meta"><span>الصورة {index + 1}</span><small>{item.kind === 'new' ? 'جديدة' : 'محفوظة'}</small></div>
                  <div className="project-image-editor-actions">
                    <button type="button" className="btn ghost compact" disabled={index === 0 || busy} onClick={() => moveItem(index, -1)}>→</button>
                    <button type="button" className="btn ghost compact" disabled={index === editor.items.length - 1 || busy} onClick={() => moveItem(index, 1)}>←</button>
                    <button type="button" className="btn text compact danger-text" disabled={busy} onClick={() => removeItem(index)}>حذف</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="project-images-empty">أضف صورة واحدة على الأقل للمشروع.</div>}
        </div>

        {uploadProgress > 0 && <div className="progress-line"><i><em style={{ width: `${uploadProgress}%` }} /></i><span>{uploadProgress}%</span></div>}

        <div className="project-editor-submit-row">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'جاري الحفظ...' : editingId ? 'حفظ وإرسال للمراجعة' : 'رفع المشروع للمراجعة'}</button>
          {editingId && <button type="button" className="btn text" onClick={resetEditor} disabled={busy}>إلغاء التعديل</button>}
        </div>
      </form>

      <div className="student-projects-list-heading"><h3>المشاريع المرفوعة</h3><span>{projects.length} مشروع</span></div>
      {loading ? <div className="project-skeleton student-projects-skeleton" /> : (
        <div className="my-projects-grid student-projects-cards">
          {projects.map((project) => (
            <article key={project.id} className="student-project-manage-card">
              <ProjectThumb project={project} />
              <div className="student-project-manage-body">
                <div><h3>{project.title}</h3><small>{projectImagePaths(project).length} صور</small></div>
                <span className={`status ${project.status}`}>{project.status === 'approved' ? 'منشور' : project.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span>
                <div className="student-project-manage-actions">
                  <button type="button" className="btn ghost compact" onClick={() => startEdit(project)} disabled={busy}>تعديل المشروع</button>
                  {project.status === 'approved' && <Link className="btn text compact" to={`/projects/${project.id}`}>عرض المشروع</Link>}
                </div>
              </div>
            </article>
          ))}
          {!projects.length && <div className="empty-state">لسه ما رفعتش أي مشروع. ابدأ بأول مشروع فوق.</div>}
        </div>
      )}
    </div>
  );
}
