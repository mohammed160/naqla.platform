import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../../lib/helpers';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';

function Stars({ value }) {
  return <span className="admin-review-stars">{'★'.repeat(Number(value || 0))}{'☆'.repeat(Math.max(0, 5 - Number(value || 0)))}</span>;
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('student_reviews')
      .select('*, courses(title), lectures(title)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setReviews(data || []);
  }, []);

  useEffect(() => {
    loadReviews().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [loadReviews]);

  const filtered = useMemo(() => reviews.filter((item) => {
    if (filter === 'course' && !item.course_id) return false;
    if (filter === 'lecture' && !item.lecture_id) return false;
    if (filter === 'hidden' && !item.is_hidden) return false;
    const haystack = `${item.reviewer_name || ''} ${item.comment || ''} ${item.courses?.title || ''} ${item.lectures?.title || ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [filter, reviews, search]);

  const average = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
    : 0;

  async function toggleHidden(review) {
    const { error } = await supabase
      .from('student_reviews')
      .update({ is_hidden: !review.is_hidden, updated_at: new Date().toISOString() })
      .eq('id', review.id);
    if (error) {
      setToast({ type: 'error', message: formatError(error) });
      return;
    }
    setToast({ type: 'success', message: review.is_hidden ? 'تم نشر الرأي.' : 'تم إخفاء الرأي.' });
    await loadReviews();
  }

  async function deleteReview() {
    if (!pendingDelete) return;
    const { error } = await supabase.from('student_reviews').delete().eq('id', pendingDelete.id);
    setPendingDelete(null);
    if (error) {
      setToast({ type: 'error', message: formatError(error) });
      return;
    }
    setToast({ type: 'success', message: 'تم حذف الرأي نهائيًا.' });
    await loadReviews();
  }

  return (
    <div className="admin-page admin-reviews-page">
      <div className="admin-page-heading">
        <div><span className="eyebrow">STUDENT FEEDBACK</span><h1>آراء وتعليقات الطلبة</h1><p>راجع التقييمات، اخفِ التعليقات غير المناسبة، واعرض التجارب الحقيقية داخل المنصة.</p></div>
      </div>

      <div className="admin-stats review-admin-stats">
        <article><span>إجمالي الآراء</span><b>{reviews.length}</b><small>رأي مسجل</small></article>
        <article><span>متوسط التقييم</span><b>{average ? average.toFixed(1) : '—'}</b><small>من 5 نجوم</small></article>
        <article><span>آراء الكورسات</span><b>{reviews.filter((item) => item.course_id).length}</b><small>تقييم كورس</small></article>
        <article><span>المخفية</span><b>{reviews.filter((item) => item.is_hidden).length}</b><small>غير ظاهرة للطلبة</small></article>
      </div>

      <div className="admin-panel review-admin-toolbar">
        <input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الطالب أو نص الرأي..." />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">كل الآراء</option>
          <option value="course">آراء الكورسات</option>
          <option value="lecture">آراء المحاضرات</option>
          <option value="hidden">الآراء المخفية</option>
        </select>
      </div>

      <div className="admin-reviews-list">
        {filtered.length ? filtered.map((review) => (
          <article className={`admin-review-card ${review.is_hidden ? 'is-hidden' : ''}`} key={review.id}>
            <div className="admin-review-card-head">
              <div className="review-avatar">{String(review.reviewer_name || 'ط').slice(0, 1)}</div>
              <div><b>{review.reviewer_name || 'طالب في المنصة'}</b><small>{review.course_id ? `كورس: ${review.courses?.title || 'كورس'}` : `محاضرة: ${review.lectures?.title || 'محاضرة'}`}</small></div>
              <Stars value={review.rating} />
              <span className={`status ${review.is_hidden ? 'rejected' : 'approved'}`}>{review.is_hidden ? 'مخفي' : 'منشور'}</span>
            </div>
            <p>{review.comment}</p>
            <div className="admin-review-card-actions">
              <small>{new Date(review.created_at).toLocaleString('ar-EG')}</small>
              <div>
                <button className="btn ghost compact" type="button" onClick={() => toggleHidden(review)}>{review.is_hidden ? 'إظهار' : 'إخفاء'}</button>
                <button className="btn ghost compact danger-text" type="button" onClick={() => setPendingDelete(review)}>حذف</button>
              </div>
            </div>
          </article>
        )) : <div className="empty-state">لا توجد آراء مطابقة للبحث.</div>}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="حذف الرأي؟"
          open
          text="سيتم حذف التعليق والتقييم نهائيًا من المنصة."
          confirmText="حذف نهائي"
          danger
          onConfirm={deleteReview}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
