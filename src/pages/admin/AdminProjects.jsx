import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  createPrivateFileUrls,
  createPrivateImageUrl,
  removeStoredFile,
  uploadFile,
} from '../../lib/storage';
import { formatDate, formatError } from '../../lib/helpers';
import { useAuth } from '../../contexts/AuthContext';
import Toast from '../../components/Toast';
import ProjectCoverField from '../../components/ProjectCoverField';

const emptyForm = {
  ownerId: '',
  studentName: '',
  experience: '',
  title: '',
  description: '',
  status: 'pending',
  imagePaths: [],
  imageDisplayUrls: [],
  coverPath: '',
  coverUrl: '',
  coverDisplayUrl: '',
  originalCoverPath: '',
  coverFile: null,
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

export default function AdminProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [removedImagePaths, setRemovedImagePaths] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const hydrated = await Promise.all((data || []).map(async (project) => {
      const paths = projectImagePaths(project);
      const displayUrls = paths.length ? await createPrivateFileUrls('student-projects', paths, 3600) : [];
      let coverDisplayUrl = projectCoverUrl(project);
      const coverPath = projectCoverPath(project);
      if (!coverDisplayUrl && coverPath) {
        try {
          coverDisplayUrl = await createPrivateImageUrl('student-projects', coverPath, 3600, { width: 900, quality: 72, resize: 'contain' });
        } catch {
          coverDisplayUrl = displayUrls[0] || '';
        }
      }
      return {
        ...project,
        imagePaths: paths,
        displayUrls: displayUrls.filter(Boolean),
        coverDisplayUrl: coverDisplayUrl || displayUrls[0] || '',
      };
    }));

    setProjects(hydrated);
  }, []);

  useEffect(() => {
    loadProjects().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [loadProjects]);

  const visible = useMemo(
    () => projects.filter((project) => filter === 'all' || project.status === filter),
    [projects, filter],
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId('');
    setImageFiles([]);
    setRemovedImagePaths([]);
    setUploadProgress(0);
  }

  function edit(project) {
    setEditingId(project.id);
    setForm({
      ownerId: project.user_id || '',
      studentName: project.student_name || '',
      experience: project.experience || '',
      title: project.title || '',
      description: project.description || '',
      status: project.status || 'pending',
      imagePaths: project.imagePaths || projectImagePaths(project),
      imageDisplayUrls: project.displayUrls || [],
      coverPath: project.cover_path || '',
      coverUrl: project.cover_url || '',
      coverDisplayUrl: project.coverDisplayUrl || '',
      originalCoverPath: project.cover_path || '',
      coverFile: null,
    });
    setImageFiles([]);
    setRemovedImagePaths([]);
    setUploadProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function moveExistingImage(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.imagePaths.length) return;
    setForm((current) => {
      const imagePaths = [...current.imagePaths];
      const imageDisplayUrls = [...current.imageDisplayUrls];
      [imagePaths[index], imagePaths[nextIndex]] = [imagePaths[nextIndex], imagePaths[index]];
      [imageDisplayUrls[index], imageDisplayUrls[nextIndex]] = [imageDisplayUrls[nextIndex], imageDisplayUrls[index]];
      return { ...current, imagePaths, imageDisplayUrls };
    });
  }

  function removeExistingImage(index) {
    const path = form.imagePaths[index];
    if (path) setRemovedImagePaths((current) => [...current, path]);
    setForm((current) => ({
      ...current,
      imagePaths: current.imagePaths.filter((_, itemIndex) => itemIndex !== index),
      imageDisplayUrls: current.imageDisplayUrls.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.studentName.trim() || !form.title.trim() || !form.description.trim()) {
      setToast({ type: 'error', message: 'اسم الطالب واسم المشروع ووصف المشروع بيانات أساسية.' });
      return;
    }
    if (!form.imagePaths.length && !imageFiles.length) {
      setToast({ type: 'error', message: 'اختار صورة واحدة على الأقل للمشروع.' });
      return;
    }

    setBusy(true);
    try {
      const ownerId = editingId ? (form.ownerId || user?.id) : user?.id;
      if (!ownerId) throw new Error('تعذر تحديد صاحب المشروع.');

      const nextPaths = [...form.imagePaths];
      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        const uploaded = await uploadFile({
          bucket: 'student-projects',
          folder: `projects/${ownerId}`,
          file,
          publicUrl: false,
          onProgress: (fileProgress) => {
            const total = Math.max(1, imageFiles.length + (form.coverFile ? 1 : 0));
            setUploadProgress(Math.round(((index + (fileProgress / 100)) / total) * 100));
          },
        });
        nextPaths.push(uploaded.path);
      }

      let coverPath = form.coverPath;
      let coverUrl = form.coverUrl;
      if (form.coverFile) {
        const coverUpload = await uploadFile({
          bucket: 'public-assets',
          folder: `project-covers/${ownerId}`,
          file: form.coverFile,
          publicUrl: true,
          onProgress: (fileProgress) => {
            const total = Math.max(1, imageFiles.length + 1);
            setUploadProgress(Math.round(((imageFiles.length + (fileProgress / 100)) / total) * 100));
          },
        });
        coverPath = coverUpload.path;
        coverUrl = coverUpload.url || '';
      }

      if (!coverPath) {
        coverPath = nextPaths[0] || '';
        coverUrl = '';
      }

      const payload = {
        user_id: ownerId,
        student_name: form.studentName.trim(),
        experience: form.experience.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        image_path: nextPaths[0] || '',
        image_url: coverUrl || '',
        image_paths: nextPaths,
        image_urls: [],
        cover_path: coverPath,
        cover_url: coverUrl || '',
        status: form.status,
        reviewed_by: form.status === 'pending' ? null : (user?.id || null),
        reviewed_at: form.status === 'pending' ? null : new Date().toISOString(),
      };

      let error;
      if (editingId) ({ error } = await supabase.from('projects').update(payload).eq('id', editingId));
      else ({ error } = await supabase.from('projects').insert(payload));
      if (error) throw error;

      const stillUsed = new Set([...nextPaths, coverPath].filter(Boolean));
      await Promise.all(
        [...new Set(removedImagePaths)]
          .filter((path) => path && !stillUsed.has(path))
          .map((path) => removeStoredFile('student-projects', path)),
      );

      if (
        form.originalCoverPath
        && form.originalCoverPath.startsWith('project-covers/')
        && form.originalCoverPath !== coverPath
      ) {
        await removeStoredFile('public-assets', form.originalCoverPath);
      }

      const wasEditing = Boolean(editingId);
      resetForm();
      await loadProjects();
      setToast({ type: 'success', message: wasEditing ? 'تم تعديل المشروع والغلاف.' : 'تمت إضافة المشروع.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from('projects').update({
      status,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return setToast({ type: 'error', message: formatError(error) });
    await loadProjects();
    setToast({ type: 'success', message: status === 'approved' ? 'تم نشر المشروع في المعرض.' : 'تم رفض المشروع.' });
  }

  async function remove(project) {
    if (!window.confirm(`حذف مشروع «${project.title}» نهائيًا؟`)) return;
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) return setToast({ type: 'error', message: formatError(error) });

    const paths = [...new Set(project.imagePaths?.length ? project.imagePaths : projectImagePaths(project))];
    await Promise.all(paths.filter(Boolean).map((path) => removeStoredFile('student-projects', path)));
    if (project.cover_path?.startsWith('project-covers/')) await removeStoredFile('public-assets', project.cover_path);

    if (editingId === project.id) resetForm();
    await loadProjects();
    setToast({ type: 'success', message: 'تم حذف المشروع.' });
  }

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />

      <div className="admin-page-heading">
        <div><span className="eyebrow">Students Portfolio</span><h1>إدارة مشاريع الطلبة</h1><p>تحكم في الصور والغلاف والمراجعة والنشر من مكان واحد.</p></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">قيد المراجعة</option><option value="approved">منشورة</option><option value="rejected">مرفوضة</option><option value="all">الكل</option>
        </select>
      </div>

      <form className="admin-form-card" onSubmit={submit}>
        <div className="panel-heading compact"><h2>{editingId ? 'تعديل المشروع' : 'إضافة مشروع جديد'}</h2>{editingId && <button className="btn text compact" type="button" onClick={resetForm}>إلغاء التعديل</button>}</div>

        <div className="two-cols">
          <label>اسم الطالب<input required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} /></label>
          <label>عدد سنين الخبرة <small>(اختياري)</small><input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="مثال: سنتين" /></label>
        </div>
        <label>اسم المشروع<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>وصف المشروع<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>

        <ProjectCoverField
          currentUrl={form.coverDisplayUrl}
          file={form.coverFile}
          onFileChange={(file) => setForm((current) => ({ ...current, coverFile: file }))}
          onClear={() => setForm((current) => ({ ...current, coverPath: '', coverUrl: '', coverDisplayUrl: '', coverFile: null }))}
          disabled={busy}
        />

        <div className="two-cols">
          <label className="file-field">صور المشروع<input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} /><span>{imageFiles.length ? `${imageFiles.length} صورة جديدة مختارة` : editingId ? 'إضافة صور أخرى' : 'اختيار صورة أو أكثر'}</span></label>
          <label>حالة المشروع<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="pending">قيد المراجعة</option><option value="approved">منشور</option><option value="rejected">مرفوض</option></select></label>
        </div>

        {editingId && form.imageDisplayUrls.length > 0 && (
          <div className="admin-project-images-editor">
            <small>رتّب أو احذف صور المشروع الداخلية. الغلاف مستقل عنها.</small>
            <div className="project-images-editor-grid">
              {form.imageDisplayUrls.map((url, index) => (
                <article className="project-image-editor-card" key={`${url}-${index}`}>
                  <div className="project-image-editor-preview"><img src={url} alt={`صورة ${index + 1}`} /></div>
                  <div className="project-image-editor-meta"><span>الصورة {index + 1}</span><small>محفوظة</small></div>
                  <div className="project-image-editor-actions">
                    <button type="button" className="btn ghost compact" disabled={index === 0} onClick={() => moveExistingImage(index, -1)}>→</button>
                    <button type="button" className="btn ghost compact" disabled={index === form.imageDisplayUrls.length - 1} onClick={() => moveExistingImage(index, 1)}>←</button>
                    <button type="button" className="btn text compact danger-text" onClick={() => removeExistingImage(index)}>حذف</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {imageFiles.length > 0 && <small>{imageFiles.map((file) => file.name).join(' • ')}</small>}
        {uploadProgress > 0 && <div className="progress-line"><i><em style={{ width: `${uploadProgress}%` }} /></i><span>{uploadProgress}%</span></div>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة المشروع'}</button>
      </form>

      <div className="admin-project-grid">
        {visible.map((project) => (
          <article key={project.id}>
            <div className="admin-project-image admin-project-cover-image">
              <img src={project.coverDisplayUrl || '/assets/cover-default.svg'} alt={project.title} />
              <span className={`status ${project.status}`}>{project.status === 'approved' ? 'منشور' : project.status === 'rejected' ? 'مرفوض' : 'مراجعة'}</span>
            </div>
            <div className="admin-project-body">
              <small>{formatDate(project.created_at)}{project.imagePaths?.length > 1 ? ` • ${project.imagePaths.length} صور` : ''}</small>
              <h2>{project.title}</h2><p>{project.description}</p>
              <div className="project-student"><b>{project.student_name}</b>{project.experience && <span>{project.experience}</span>}</div>
              <div className="project-actions">
                <button className="btn ghost compact" type="button" onClick={() => edit(project)}>تعديل</button>
                {project.status !== 'approved' && <button className="btn primary compact" type="button" onClick={() => setStatus(project.id, 'approved')}>نشر</button>}
                {project.status !== 'rejected' && <button className="btn ghost compact" type="button" onClick={() => setStatus(project.id, 'rejected')}>رفض</button>}
                <button className="btn text compact danger-text" type="button" onClick={() => remove(project)}>حذف</button>
              </div>
            </div>
          </article>
        ))}
        {!visible.length && <div className="empty-state">لا توجد مشاريع في هذا القسم.</div>}
      </div>
    </section>
  );
}
