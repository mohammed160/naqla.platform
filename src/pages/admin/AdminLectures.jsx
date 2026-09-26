import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadFile, removeStoredFile } from '../../lib/storage';
import { formatError, formatBytes } from '../../lib/helpers';
import {
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  extractYouTubeVideoId,
} from '../../lib/youtube';
import { useAuth } from '../../contexts/AuthContext';
import Toast from '../../components/Toast';
import YouTubeLecturePlayer from '../../components/YouTubeLecturePlayer';

const BUNNY_VIDEO_ID_PATTERN = /^[A-Fa-f0-9-]{32,40}$/;

const emptyLecture = {
  courseId: '',
  title: '',
  description: '',
  durationText: '',
  order: 1,
  isFree: false,
  published: true,
  thumbnailUrl: '',
  thumbnailPath: '',
  videoPath: '',
  videoName: '',
  videoProvider: 'bunny',
  youtubeUrl: '',
  youtubeVideoId: '',
  bunnyVideoId: '',
};

function normalizeBunnyVideoId(value = '') {
  const clean = String(value || '').trim();
  const uuid = clean.match(/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}/)?.[0];
  return uuid || clean;
}

function mapLecture(lecture, sourceByLectureId) {
  const source = sourceByLectureId.get(lecture.id);
  const sourceProvider = source?.provider || (lecture.video_path ? 'storage' : 'bunny');
  const youtubeVideoId = sourceProvider === 'youtube' ? source.provider_video_id : '';
  const bunnyVideoId = sourceProvider === 'bunny' ? source.provider_video_id : '';

  return {
    ...lecture,
    courseId: lecture.course_id,
    durationText: lecture.duration_text,
    order: lecture.sort_order,
    isFree: lecture.is_free,
    videoPath: lecture.video_path,
    videoName: lecture.video_name,
    thumbnailPath: lecture.thumbnail_path,
    thumbnailUrl: lecture.thumbnail_url,
    videoProvider: sourceProvider,
    youtubeVideoId,
    youtubeUrl: buildYouTubeWatchUrl(youtubeVideoId),
    bunnyVideoId,
  };
}

function mapMaterial(material) {
  return {
    ...material,
    lectureId: material.lecture_id,
    filePath: material.file_path,
    fileName: material.file_name,
    fileSize: material.file_size,
    contentType: material.mime_type,
  };
}

export default function AdminLectures() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyLecture);
  const [editingId, setEditingId] = useState('');
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [filterCourse, setFilterCourse] = useState('all');
  const [materialForm, setMaterialForm] = useState({ lectureId: '', title: '', file: null });
  const [materialProgress, setMaterialProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesResult, lecturesResult, materialsResult, sourcesResult] = await Promise.all([
        supabase.from('courses').select('id, title, published').order('created_at', { ascending: false }),
        supabase.from('lectures').select('*').order('sort_order', { ascending: true }),
        supabase.from('materials').select('*').order('created_at', { ascending: false }),
        supabase.from('lecture_video_sources').select('lecture_id, provider, provider_video_id'),
      ]);

      const firstError = [coursesResult, lecturesResult, materialsResult, sourcesResult]
        .find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const sourceByLectureId = new Map(
        (sourcesResult.data || []).map((source) => [source.lecture_id, source]),
      );

      setCourses(coursesResult.data || []);
      setLectures((lecturesResult.data || []).map((lecture) => mapLecture(lecture, sourceByLectureId)));
      setMaterials((materialsResult.data || []).map(mapMaterial));
    } catch (error) {
      const message = error?.code === '42P01'
        ? 'شغّل Migrations مصادر الفيديو أولًا.'
        : formatError(error);
      setToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => lectures
    .filter((lecture) => filterCourse === 'all' || lecture.courseId === filterCourse)
    .sort((a, b) => (a.order || 0) - (b.order || 0)), [lectures, filterCourse]);

  const previewVideoId = useMemo(
    () => extractYouTubeVideoId(form.youtubeUrl) || form.youtubeVideoId || '',
    [form.youtubeUrl, form.youtubeVideoId],
  );

  const normalizedBunnyVideoId = useMemo(
    () => normalizeBunnyVideoId(form.bunnyVideoId),
    [form.bunnyVideoId],
  );

  const sourceIsValid = useMemo(() => {
    if (form.videoProvider === 'youtube') return Boolean(previewVideoId);
    if (form.videoProvider === 'bunny') return BUNNY_VIDEO_ID_PATTERN.test(normalizedBunnyVideoId);
    if (form.videoProvider === 'storage') return Boolean(form.videoPath);
    return false;
  }, [form.videoPath, form.videoProvider, normalizedBunnyVideoId, previewVideoId]);

  useEffect(() => {
    setPreviewReady(false);
    setPreviewError(null);
  }, [previewVideoId]);

  const handlePreviewReady = useCallback(() => {
    setPreviewReady(true);
  }, []);

  const handlePreviewError = useCallback((message, code) => {
    setPreviewReady(false);
    setPreviewError({ message, code });
  }, []);

  function courseName(id) {
    return courses.find((course) => course.id === id)?.title || 'بدون كورس';
  }

  function resetLectureForm() {
    setForm(emptyLecture);
    setEditingId('');
    setThumbFile(null);
    setThumbProgress(0);
  }

  function editLecture(lecture) {
    setEditingId(lecture.id);
    setForm({ ...emptyLecture, ...lecture });
    setThumbFile(null);
    setThumbProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitLecture(event) {
    event.preventDefault();
    if (!form.courseId) return setToast({ type: 'error', message: 'اختار الكورس.' });

    const youtubeVideoId = extractYouTubeVideoId(form.youtubeUrl) || form.youtubeVideoId;
    const bunnyVideoId = normalizeBunnyVideoId(form.bunnyVideoId);

    if (form.videoProvider === 'youtube' && !youtubeVideoId) {
      return setToast({ type: 'error', message: 'حط رابط فيديو YouTube صحيح.' });
    }
    if (form.videoProvider === 'bunny' && !BUNNY_VIDEO_ID_PATTERN.test(bunnyVideoId)) {
      return setToast({ type: 'error', message: 'حط Bunny Video ID الصحيح من صفحة الفيديو.' });
    }
    if (form.videoProvider === 'storage' && !form.videoPath) {
      return setToast({ type: 'error', message: 'لا يوجد فيديو مرفوع قديم لهذه المحاضرة.' });
    }

    setBusy(true);
    let createdLectureId = '';

    try {
      let thumb = { path: form.thumbnailPath || '', url: form.thumbnailUrl || '' };

      if (thumbFile) {
        thumb = await uploadFile({
          bucket: 'public-assets',
          folder: 'lecture-thumbnails',
          file: thumbFile,
          publicUrl: true,
          onProgress: setThumbProgress,
        });
      }

      const payload = {
        course_id: form.courseId,
        title: form.title.trim(),
        description: form.description.trim(),
        duration_text: form.durationText.trim(),
        sort_order: Number(form.order || 1),
        is_free: Boolean(form.isFree),
        published: Boolean(form.published),
        // Keep any old direct-upload video intact as a fallback. Nothing is deleted automatically.
        video_path: form.videoPath || '',
        video_name: form.videoName || '',
        thumbnail_path: thumb.path || '',
        thumbnail_url: thumb.url || (form.videoProvider === 'youtube' ? buildYouTubeThumbnailUrl(youtubeVideoId) : '') || '',
      };

      let lectureId = editingId;

      if (editingId) {
        const { error } = await supabase.from('lectures').update(payload).eq('id', editingId);
        if (error) throw error;

        if (thumbFile && form.thumbnailPath && form.thumbnailPath !== thumb.path) {
          await removeStoredFile('public-assets', form.thumbnailPath);
        }
      } else {
        const { data, error } = await supabase
          .from('lectures')
          .insert({ ...payload, created_by: user?.id || null })
          .select('id')
          .single();
        if (error) throw error;
        lectureId = data.id;
        createdLectureId = lectureId;
      }

      if (form.videoProvider === 'youtube' || form.videoProvider === 'bunny') {
        const providerVideoId = form.videoProvider === 'youtube' ? youtubeVideoId : bunnyVideoId;
        const { error: sourceError } = await supabase.from('lecture_video_sources').upsert({
          lecture_id: lectureId,
          provider: form.videoProvider,
          provider_video_id: providerVideoId,
          created_by: user?.id || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lecture_id' });
        if (sourceError) throw sourceError;
      } else if (form.videoProvider === 'storage') {
        const { error: sourceDeleteError } = await supabase
          .from('lecture_video_sources')
          .delete()
          .eq('lecture_id', lectureId);
        if (sourceDeleteError) throw sourceDeleteError;
      }

      const wasEditing = Boolean(editingId);
      const providerLabel = form.videoProvider === 'bunny' ? 'Bunny Stream' : form.videoProvider === 'youtube' ? 'YouTube' : 'الفيديو القديم';
      resetLectureForm();
      await loadData();
      setToast({
        type: 'success',
        message: wasEditing
          ? `تم تحديث المحاضرة وربط ${providerLabel}.`
          : `تمت إضافة المحاضرة وربط ${providerLabel}.`,
      });
    } catch (error) {
      if (createdLectureId) {
        await supabase.from('lectures').delete().eq('id', createdLectureId);
      }
      const message = String(error?.message || '').includes('lecture_video_sources_provider')
        ? 'شغّل Migration رقم 009 الخاصة بـ Bunny Stream ثم جرّب مرة أخرى.'
        : formatError(error);
      setToast({ type: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  async function removeExternalSource() {
    if (!editingId || !['youtube', 'bunny'].includes(form.videoProvider)) return;
    const label = form.videoProvider === 'bunny' ? 'Bunny Stream' : 'YouTube';
    if (!window.confirm(`إزالة مصدر ${label} من المحاضرة؟ لن يتم حذف المحاضرة أو الماتريال.`)) return;

    try {
      const { error } = await supabase
        .from('lecture_video_sources')
        .delete()
        .eq('lecture_id', editingId);
      if (error) throw error;

      setForm((current) => ({
        ...current,
        videoProvider: current.videoPath ? 'storage' : 'bunny',
        youtubeUrl: '',
        youtubeVideoId: '',
        bunnyVideoId: '',
      }));
      await loadData();
      setToast({ type: 'success', message: `تمت إزالة رابطة ${label}.` });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  async function submitMaterial(event) {
    event.preventDefault();
    const lecture = lectures.find((item) => item.id === materialForm.lectureId);
    if (!lecture || !materialForm.file) return setToast({ type: 'error', message: 'اختار المحاضرة والملف.' });

    try {
      const uploaded = await uploadFile({
        bucket: 'course-materials',
        folder: `${lecture.courseId}/${lecture.id}`,
        file: materialForm.file,
        publicUrl: false,
        onProgress: setMaterialProgress,
      });
      const { error } = await supabase.from('materials').insert({
        lecture_id: lecture.id,
        title: materialForm.title.trim() || uploaded.name,
        file_path: uploaded.path,
        file_name: uploaded.name,
        file_size: uploaded.size,
        mime_type: uploaded.contentType,
        created_by: user?.id || null,
      });
      if (error) {
        await removeStoredFile('course-materials', uploaded.path);
        throw error;
      }
      setMaterialForm({ lectureId: '', title: '', file: null });
      setMaterialProgress(0);
      await loadData();
      setToast({ type: 'success', message: 'تم رفع الماتريال وربطها بالمحاضرة.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  async function removeLecture(lecture) {
    if (!window.confirm(`حذف محاضرة «${lecture.title}»؟`)) return;
    try {
      const lectureMaterials = materials.filter((material) => material.lectureId === lecture.id);
      const { error } = await supabase.from('lectures').delete().eq('id', lecture.id);
      if (error) throw error;
      if (lecture.videoPath) await removeStoredFile('lecture-videos', lecture.videoPath);
      if (lecture.thumbnailPath) await removeStoredFile('public-assets', lecture.thumbnailPath);
      await Promise.all(lectureMaterials.map((material) => removeStoredFile('course-materials', material.filePath)));
      await loadData();
      setToast({ type: 'success', message: 'تم حذف المحاضرة.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  async function removeMaterial(material) {
    if (!window.confirm(`حذف ملف «${material.title}»؟`)) return;
    try {
      const { error } = await supabase.from('materials').delete().eq('id', material.id);
      if (error) throw error;
      await removeStoredFile('course-materials', material.filePath);
      await loadData();
      setToast({ type: 'success', message: 'تم حذف الماتريال.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Lectures & Materials</span>
          <h1>المحاضرات والماتريال</h1>
          <p>استخدم Bunny Stream للمحاضرات المحمية، مع إبقاء YouTube للمحتوى القديم أو المجاني عند الحاجة.</p>
        </div>
      </div>

      <form className="admin-form-card" onSubmit={submitLecture}>
        <div className="panel-heading compact">
          <h2>{editingId ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}</h2>
          {editingId && <button type="button" className="btn text compact" onClick={resetLectureForm}>إلغاء</button>}
        </div>

        <div className="three-cols">
          <label>
            الكورس
            <select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>
              <option value="">اختار الكورس</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label>اسم المحاضرة<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>الترتيب<input type="number" min="1" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} /></label>
        </div>

        <label>الوصف<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

        <div className="three-cols">
          <label>المدة المكتوبة<input placeholder="مثال: 25 دقيقة" value={form.durationText} onChange={(event) => setForm({ ...form, durationText: event.target.value })} /></label>
          <label>
            مصدر الفيديو
            <select value={form.videoProvider} onChange={(event) => setForm({ ...form, videoProvider: event.target.value })}>
              <option value="bunny">Bunny Stream — محمي</option>
              <option value="youtube">YouTube</option>
              {form.videoPath && <option value="storage">رفع مباشر قديم</option>}
            </select>
          </label>
          <label className="toggle-field"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /><span>منشورة ومتاحة</span></label>
        </div>

        <div className="two-cols">
          <label className="toggle-field"><input type="checkbox" checked={form.isFree} onChange={(event) => setForm({ ...form, isFree: event.target.checked })} /><span>محاضرة مجانية تظهر في الرئيسية</span></label>
          <label className="file-field">
            الصورة المصغرة
            <input type="file" accept="image/*" onChange={(event) => setThumbFile(event.target.files?.[0] || null)} />
            <span>{thumbFile?.name || (form.thumbnailUrl ? 'الصورة الحالية محفوظة' : 'اختيار صورة')}</span>
          </label>
        </div>

        {form.videoProvider === 'bunny' && (
          <>
            <div className="youtube-admin-note">
              <b>Bunny Stream Secure</b>
              <span>حط Video ID فقط. مفتاح Bunny السري يفضل داخل Supabase Edge Function ولا يظهر في الداشبورد أو المتصفح.</span>
            </div>
            <label>
              Bunny Video ID
              <input
                type="text"
                dir="ltr"
                placeholder="664b2489-f8b3-490e-8094-a8ead426c191"
                value={form.bunnyVideoId}
                onChange={(event) => setForm({ ...form, bunnyVideoId: event.target.value })}
              />
              <small className="field-help">تقدر تلصق الـVideo ID أو رابط Bunny يحتوي على الـUUID.</small>
            </label>
            {form.bunnyVideoId && !BUNNY_VIDEO_ID_PATTERN.test(normalizedBunnyVideoId) && (
              <div className="youtube-url-error">Bunny Video ID غير صحيح.</div>
            )}
          </>
        )}

        {form.videoProvider === 'youtube' && (
          <>
            <div className="youtube-admin-note">
              <b>{form.isFree ? 'YouTube للمحاضرة المجانية' : 'YouTube — حماية أقل'}</b>
              <span>{form.isFree ? 'مناسب للمحتوى المجاني.' : 'للمحاضرات المدفوعة يفضل Bunny Stream لأن رابط YouTube يمكن استخراجه من الـiframe.'}</span>
            </div>
            <label>
              رابط فيديو YouTube
              <input
                type="url"
                dir="ltr"
                placeholder="https://youtu.be/xxxxxxxxxxx"
                value={form.youtubeUrl}
                onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })}
              />
              <small className="field-help">يقبل روابط watch وyoutu.be وShorts وLive وEmbed.</small>
            </label>

            {form.youtubeUrl && !previewVideoId && (
              <div className="youtube-url-error">الرابط غير صحيح. انسخ رابط الفيديو كاملًا من YouTube.</div>
            )}

            {previewVideoId && (
              <div className="youtube-admin-preview">
                <div><b>معاينة YouTube</b><small>Video ID: {previewVideoId}</small></div>
                <div className="youtube-admin-player-wrap">
                  <YouTubeLecturePlayer
                    key={previewVideoId}
                    videoId={previewVideoId}
                    title="معاينة فيديو المحاضرة"
                    onReady={handlePreviewReady}
                    onError={handlePreviewError}
                  />
                  <div className={`youtube-preview-status ${previewError ? 'error' : previewReady ? 'ready' : ''}`}>
                    {previewError
                      ? `${previewError.message}${previewError.code ? ` — رمز ${previewError.code}` : ''}`
                      : previewReady
                        ? 'المشغل جاهز.'
                        : 'جاري تجهيز اختبار الفيديو...'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {form.videoProvider === 'storage' && (
          <div className="youtube-admin-note"><b>فيديو مرفوع قديم</b><span>هيفضل شغال من Supabase Storage من غير حذف الملف.</span></div>
        )}

        {editingId && ['youtube', 'bunny'].includes(form.videoProvider) && (
          <button type="button" className="btn danger compact" onClick={removeExternalSource}>إزالة مصدر الفيديو الحالي</button>
        )}

        {thumbProgress > 0 && (
          <div className="upload-progresses">
            <div><span>الصورة</span><div className="progress-line"><i><em style={{ width: `${thumbProgress}%` }} /></i><b>{thumbProgress}%</b></div></div>
          </div>
        )}

        <button className="btn primary" disabled={busy || !sourceIsValid}>
          {busy ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة المحاضرة'}
        </button>
      </form>

      <form className="admin-form-card material-form" onSubmit={submitMaterial}>
        <div className="panel-heading compact"><h2>رفع ماتريال للمحاضرة</h2><span>PDF / ZIP / PSD / AI وأي ملف</span></div>
        <div className="three-cols">
          <label>
            المحاضرة
            <select required value={materialForm.lectureId} onChange={(event) => setMaterialForm({ ...materialForm, lectureId: event.target.value })}>
              <option value="">اختار المحاضرة</option>
              {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{courseName(lecture.courseId)} — {lecture.title}</option>)}
            </select>
          </label>
          <label>اسم الملف للطالب<input required value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} /></label>
          <label className="file-field">الملف<input type="file" required onChange={(event) => setMaterialForm({ ...materialForm, file: event.target.files?.[0] || null })} /><span>{materialForm.file?.name || 'اختيار ملف'}</span></label>
        </div>
        {materialProgress > 0 && <div className="progress-line"><i><em style={{ width: `${materialProgress}%` }} /></i><span>{materialProgress}%</span></div>}
        <button className="btn ghost">رفع الماتريال</button>
      </form>

      <div className="admin-table-card">
        <div className="panel-heading compact">
          <h2>كل المحاضرات</h2>
          <select value={filterCourse} onChange={(event) => setFilterCourse(event.target.value)}>
            <option value="all">كل الكورسات</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </div>
        <div className="lecture-admin-list">
          {filtered.map((lecture) => {
            const lectureMaterials = materials.filter((material) => material.lectureId === lecture.id);
            return (
              <article key={lecture.id}>
                <img src={lecture.thumbnailUrl || '/assets/cover-default.svg'} alt="" />
                <div className="lecture-admin-info">
                  <div><span>{courseName(lecture.courseId)}</span><h3>{lecture.title}</h3><p>{lecture.description}</p></div>
                  <div className="lecture-flags">
                    {lecture.isFree && <span className="status approved">مجانية</span>}
                    <span className={`status ${lecture.published ? 'approved' : 'pending'}`}>{lecture.published ? 'منشورة' : 'مسودة'}</span>
                    {lecture.videoProvider === 'bunny' && lecture.bunnyVideoId && <span className="status approved">Bunny Secure</span>}
                    {lecture.videoProvider === 'youtube' && lecture.youtubeVideoId && <span className="status youtube-status">YouTube</span>}
                    {lecture.videoProvider === 'storage' && lecture.videoPath && <span className="status pending">رفع مباشر قديم</span>}
                    {!lecture.bunnyVideoId && !lecture.youtubeVideoId && !lecture.videoPath && <span className="status rejected">بدون فيديو</span>}
                    <small>ترتيب {lecture.order || 1}</small>
                  </div>
                  <div className="material-chips">
                    {lectureMaterials.map((material) => <span key={material.id}>⇩ {material.title} <small>{formatBytes(material.fileSize)}</small><button type="button" onClick={() => removeMaterial(material)}>×</button></span>)}
                  </div>
                </div>
                <div className="row-actions"><button type="button" onClick={() => editLecture(lecture)}>تعديل</button><button type="button" className="danger-text" onClick={() => removeLecture(lecture)}>حذف</button></div>
              </article>
            );
          })}
          {!loading && !filtered.length && <div className="empty-state">لا توجد محاضرات في هذا القسم.</div>}
        </div>
      </div>
    </section>
  );
}
