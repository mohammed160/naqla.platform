import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadFile, removeStoredFile } from '../../lib/storage';
import { formatError } from '../../lib/helpers';
import { useAuth } from '../../contexts/AuthContext';
import Toast from '../../components/Toast';

const empty = {
  title: '', description: '', price: '', paypalPriceUsd: '', trc20PriceUsdt: '',
  published: true, featured: false, thumbnailUrl: '', thumbnailPath: '',
};

function mapCourse(course) {
  return {
    ...course,
    paypalPriceUsd: course.paypal_price_usd,
    trc20PriceUsdt: course.trc20_price_usdt,
    thumbnailUrl: course.thumbnail_url,
    thumbnailPath: course.thumbnail_path,
  };
}

export default function AdminCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [thumb, setThumb] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (error) setToast({ type: 'error', message: formatError(error) });
    else setCourses((data || []).map(mapCourse));
    setLoading(false);
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  function edit(course) {
    setEditingId(course.id);
    setForm({
      ...empty,
      ...course,
      price: course.price ?? '',
      paypalPriceUsd: course.paypalPriceUsd ?? '',
      trc20PriceUsdt: course.trc20PriceUsdt ?? '',
    });
    setThumb(null);
    setProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm(empty);
    setEditingId('');
    setThumb(null);
    setProgress(0);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      let image = { url: form.thumbnailUrl, path: form.thumbnailPath };
      if (thumb) {
        image = await uploadFile({
          bucket: 'public-assets',
          folder: 'course-thumbnails',
          file: thumb,
          publicUrl: true,
          onProgress: setProgress,
        });
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price || 0),
        paypal_price_usd: form.paypalPriceUsd === '' ? null : Number(form.paypalPriceUsd),
        trc20_price_usdt: form.trc20PriceUsdt === '' ? null : Number(form.trc20PriceUsdt),
        published: Boolean(form.published),
        featured: Boolean(form.featured),
        thumbnail_url: image.url || '',
        thumbnail_path: image.path || '',
      };

      let error;
      if (editingId) {
        ({ error } = await supabase.from('courses').update(payload).eq('id', editingId));
        if (!error && thumb && form.thumbnailPath && form.thumbnailPath !== image.path) {
          await removeStoredFile('public-assets', form.thumbnailPath);
        }
      } else {
        ({ error } = await supabase.from('courses').insert({ ...payload, created_by: user?.id || null }));
      }
      if (error) throw error;

      const wasEditing = Boolean(editingId);
      resetForm();
      await loadCourses();
      setToast({ type: 'success', message: wasEditing ? 'تم تحديث الكورس.' : 'تم إنشاء الكورس.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(course) {
    if (!window.confirm(`حذف كورس «${course.title}» وكل المحاضرات والملفات المرتبطة به؟`)) return;
    try {
      const { data: courseLectures, error: lectureError } = await supabase
        .from('lectures')
        .select('id, video_path, thumbnail_path')
        .eq('course_id', course.id);
      if (lectureError) throw lectureError;

      const lectureIds = (courseLectures || []).map((lecture) => lecture.id);
      let courseMaterials = [];
      if (lectureIds.length) {
        const { data, error: materialError } = await supabase
          .from('materials')
          .select('file_path')
          .in('lecture_id', lectureIds);
        if (materialError) throw materialError;
        courseMaterials = data || [];
      }

      const { error } = await supabase.from('courses').delete().eq('id', course.id);
      if (error) throw error;

      const cleanup = [];
      if (course.thumbnailPath) cleanup.push(removeStoredFile('public-assets', course.thumbnailPath));
      for (const lecture of courseLectures || []) {
        if (lecture.video_path) cleanup.push(removeStoredFile('lecture-videos', lecture.video_path));
        if (lecture.thumbnail_path) cleanup.push(removeStoredFile('public-assets', lecture.thumbnail_path));
      }
      for (const material of courseMaterials) {
        if (material.file_path) cleanup.push(removeStoredFile('course-materials', material.file_path));
      }
      await Promise.all(cleanup);

      await loadCourses();
      setToast({ type: 'success', message: 'تم حذف الكورس وكل ملفاته.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading"><div><span className="eyebrow">Courses</span><h1>إدارة الكورسات</h1><p>إضافة وتعديل وحذف الكورسات مباشرة من Supabase.</p></div></div>

      <form className="admin-form-card" onSubmit={submit}>
        <div className="panel-heading compact"><h2>{editingId ? 'تعديل الكورس' : 'إضافة كورس جديد'}</h2>{editingId && <button className="btn text compact" type="button" onClick={resetForm}>إلغاء التعديل</button>}</div>
        <div className="two-cols"><label>اسم الكورس<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>السعر الأساسي بالجنيه<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label></div>
        <label>وصف الكورس<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="two-cols payment-price-fields">
          <label>سعر PayPal بالدولار<input type="number" min="0" step="0.01" value={form.paypalPriceUsd} onChange={(e) => setForm({ ...form, paypalPriceUsd: e.target.value })} /></label>
          <label>سعر USDT على TRC20<input type="number" min="0" step="0.01" value={form.trc20PriceUsdt} onChange={(e) => setForm({ ...form, trc20PriceUsdt: e.target.value })} /></label>
        </div>
        <div className="three-cols">
          <label className="file-field">الصورة المصغرة<input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)} /><span>{thumb?.name || (form.thumbnailUrl ? 'الصورة الحالية محفوظة' : 'اختيار صورة')}</span></label>
          <label className="toggle-field"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /><span>منشور للطلبة</span></label>
          <label className="toggle-field"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /><span>كورس مميز</span></label>
        </div>
        {progress > 0 && <div className="progress-line"><i><em style={{ width: `${progress}%` }} /></i><span>{progress}%</span></div>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة الكورس'}</button>
      </form>

      <div className="admin-table-card">
        <div className="panel-heading compact"><h2>كل الكورسات</h2><span>{loading ? 'جاري التحميل...' : `${courses.length} كورس`}</span></div>
        <div className="admin-cards-list">
          {courses.map((course) => (
            <article key={course.id}>
              <img src={course.thumbnailUrl || '/assets/cover-default.svg'} alt="" />
              <div><h3>{course.title}</h3><p>{course.description}</p><div className="course-price-list"><small>{Number(course.price || 0).toLocaleString('ar-EG')} ج.م</small>{Number(course.paypalPriceUsd) > 0 && <small>${Number(course.paypalPriceUsd).toFixed(2)} PayPal</small>}{Number(course.trc20PriceUsdt) > 0 && <small>{Number(course.trc20PriceUsdt).toFixed(2)} USDT</small>}</div></div>
              <span className={`status ${course.published ? 'approved' : 'pending'}`}>{course.published ? 'منشور' : 'مسودة'}</span>
              <div className="row-actions"><button type="button" onClick={() => edit(course)}>تعديل</button><button type="button" className="danger-text" onClick={() => remove(course)}>حذف</button></div>
            </article>
          ))}
          {!loading && !courses.length && <div className="empty-state">أضف أول كورس من النموذج بالأعلى.</div>}
        </div>
      </div>
    </section>
  );
}
