import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function Stars({ value, onChange, disabled = false, size = 'normal' }) {
  return (
    <div className={`review-stars ${size === 'small' ? 'small' : ''}`} aria-label={`${value || 0} من 5 نجوم`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= Number(value || 0) ? 'active' : ''}
          onClick={() => onChange?.(star)}
          disabled={disabled}
          aria-label={`${star} نجوم`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewList({ reviews, compact, salesMode = false }) {
  const reducedMotion = useReducedMotion();
  const limit = salesMode ? 2 : compact ? 3 : 8;
  const visible = reviews.filter((item) => !item.is_hidden).slice(0, limit);

  if (!visible.length) {
    if (salesMode) return null;
    return <div className="reviews-empty">لسه مفيش آراء منشورة. خليك أول طالب يشارك تجربته.</div>;
  }

  return (
    <div className={`reviews-list ${salesMode ? 'sales-list' : ''}`}>
      {visible.map((review, index) => (
        <motion.article
          className={`review-item ${salesMode ? 'sales-review-item' : ''}`}
          key={review.id}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.38, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="review-avatar">{String(review.reviewer_name || 'ط').trim().slice(0, 1)}</div>
          <div className="review-content">
            <div className="review-item-head">
              <div>
                <b>{review.reviewer_name || 'طالب في المنصة'}</b>
                <small>{salesMode ? 'طالب جرّب المحتوى' : new Date(review.created_at).toLocaleDateString('ar-EG')}</small>
              </div>
              <Stars value={review.rating} disabled size="small" />
            </div>
            <p>{review.comment}</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function RatingDistribution({ reviews }) {
  const total = reviews.length;
  if (!total) return null;

  return (
    <div className="review-rating-distribution" aria-label="توزيع تقييمات الطلبة">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = reviews.filter((item) => Number(item.rating) === star).length;
        const percent = Math.round((count / total) * 100);
        return (
          <div className="review-rating-row" key={star}>
            <span>{star}★</span>
            <i><em style={{ width: `${percent}%` }} /></i>
            <small>{percent}%</small>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewsSection({
  courseId = null,
  lectureId = null,
  compact = false,
  readOnly = false,
}) {
  const { user } = useAuth();
  const targetType = courseId ? 'course' : 'lecture';
  const targetId = courseId || lectureId;
  const targetColumn = courseId ? 'course_id' : 'lecture_id';
  const hasValidTargetId = isValidUuid(targetId);
  const salesMode = Boolean(compact && readOnly);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const loadReviews = useCallback(async () => {
    if (!hasValidTargetId) {
      setReviews([]);
      setMessage('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.rpc('get_student_reviews', {
      p_course_id: courseId || null,
      p_lecture_id: lectureId || null,
    });

    if (error) {
      setMessageType('error');
      setMessage(formatError(error));
      setLoading(false);
      return;
    }

    setReviews(data || []);
    setLoading(false);
  }, [courseId, lectureId, hasValidTargetId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const ownReview = useMemo(
    () => reviews.find((item) => item.is_own) || null,
    [reviews],
  );

  useEffect(() => {
    if (ownReview) {
      setRating(Number(ownReview.rating || 5));
      setComment(ownReview.comment || '');
    }
  }, [ownReview]);

  const visibleReviews = useMemo(() => reviews.filter((item) => !item.is_hidden), [reviews]);
  const average = useMemo(() => {
    if (!visibleReviews.length) return 0;
    return visibleReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / visibleReviews.length;
  }, [visibleReviews]);
  const recommendationRate = useMemo(() => {
    if (!visibleReviews.length) return 0;
    const positive = visibleReviews.filter((item) => Number(item.rating) >= 4).length;
    return Math.round((positive / visibleReviews.length) * 100);
  }, [visibleReviews]);

  async function submitReview(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!user || submitting) return;

    const cleanComment = comment.trim();
    if (cleanComment.length < 3) {
      setMessageType('error');
      setMessage('اكتب رأيًا قصيرًا من 3 حروف على الأقل.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    const payload = {
      user_id: user.id,
      rating: Number(rating),
      comment: cleanComment,
      [targetColumn]: targetId,
    };

    const result = ownReview
      ? await supabase
        .from('student_reviews')
        .update({ rating: payload.rating, comment: payload.comment })
        .eq('id', ownReview.id)
      : await supabase.from('student_reviews').insert(payload);

    setSubmitting(false);
    if (result.error) {
      setMessageType('error');
      setMessage(formatError(result.error));
      return;
    }

    setMessageType('success');
    setMessage(ownReview ? 'تم تحديث رأيك.' : 'شكرًا! تم نشر رأيك.');
    await loadReviews();
  }

  async function deleteOwnReview(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!ownReview || !window.confirm('حذف رأيك نهائيًا؟')) return;
    setSubmitting(true);
    const { error } = await supabase.from('student_reviews').delete().eq('id', ownReview.id);
    setSubmitting(false);
    if (error) {
      setMessageType('error');
      setMessage(formatError(error));
      return;
    }
    setComment('');
    setRating(5);
    setMessageType('success');
    setMessage('تم حذف رأيك.');
    await loadReviews();
  }

  const title = targetType === 'course' ? 'آراء الطلبة عن الكورس' : 'آراء الطلبة عن المحاضرة';

  if (!hasValidTargetId) return null;

  if (salesMode) {
    if (loading) {
      return <div className="reviews-sales-skeleton" aria-label="جاري تحميل تقييمات الطلبة" />;
    }

    // Social proof should never invent demand. Hide the public sales block until real feedback exists.
    if (!visibleReviews.length) return null;

    return (
      <section className="reviews-section reviews-sales-proof" onClick={(event) => event.stopPropagation()}>
        <div className="reviews-sales-topline">
          <div className="reviews-sales-score">
            <strong>{average.toFixed(1)}</strong>
            <div>
              <Stars value={Math.round(average)} disabled size="small" />
              <span>من {visibleReviews.length} تقييم حقيقي</span>
            </div>
          </div>
          <div className="reviews-sales-trust">
            <b>{recommendationRate}%</b>
            <span>قيّموا التجربة 4 أو 5 نجوم</span>
          </div>
        </div>

        <RatingDistribution reviews={visibleReviews} />

        <div className="reviews-sales-label">
          <span>✓</span>
          <div><b>آراء من طلاب عندهم وصول فعلي للمحتوى</b><small>التقييم مرتبط بحساب الطالب داخل المنصة.</small></div>
        </div>

        <ReviewList reviews={reviews} compact salesMode />
      </section>
    );
  }

  const body = (
    <div className="reviews-body">
      {!loading && (
        <div className="reviews-summary-row">
          <div className="reviews-average">
            <strong>{average ? average.toFixed(1) : '—'}</strong>
            <div><Stars value={Math.round(average)} disabled size="small" /><span>{visibleReviews.length} رأي</span></div>
          </div>
          {!readOnly && user && ownReview && <span className="your-review-badge">رأيك منشور</span>}
        </div>
      )}

      {loading ? <div className="reviews-loading">جاري تحميل آراء الطلبة...</div> : <ReviewList reviews={reviews} compact={compact} />}

      {!readOnly && (
        user ? (
          <form className="review-form" onSubmit={submitReview}>
            <div className="review-form-head">
              <div><b>{ownReview ? 'عدّل رأيك' : 'شارك رأيك'}</b><small>تقييمك بيساعد أعضاء جداد ياخدوا القرار الصح.</small></div>
              <Stars value={rating} onChange={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="قول لنا إيه أكتر حاجة استفدت منها..."
              required
            />
            <div className="review-form-actions">
              <small>{comment.length}/1000</small>
              <div>
                {ownReview && <button className="btn ghost compact danger-text" type="button" onClick={deleteOwnReview} disabled={submitting}>حذف رأيي</button>}
                <button className="btn primary compact" type="submit" disabled={submitting}>{submitting ? 'جاري الحفظ...' : ownReview ? 'تحديث الرأي' : 'نشر الرأي'}</button>
              </div>
            </div>
          </form>
        ) : (
          <div className="review-login-note">سجّل دخولك علشان تكتب رأيك. <Link to="/login">تسجيل الدخول</Link></div>
        )
      )}

      {message && <div className={`review-message ${messageType}`}>{message}</div>}
    </div>
  );

  if (compact) {
    return (
      <details
        className="reviews-section compact"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <summary>
          <span>{title}</span>
          <span className="review-compact-score">{average ? `${average.toFixed(1)} ★` : 'اكتب أول تقييم'}</span>
        </summary>
        {body}
      </details>
    );
  }

  return (
    <section className="reviews-section" onClick={(event) => event.stopPropagation()}>
      <div className="reviews-heading"><span className="eyebrow">تجارب حقيقية</span><h3>{title}</h3></div>
      {body}
    </section>
  );
}
