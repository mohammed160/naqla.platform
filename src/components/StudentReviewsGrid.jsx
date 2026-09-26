import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Social proof from real student reviews only (table student_reviews).
// The section stays hidden until at least one visible review exists,
// so a new platform never shows invented testimonials or numbers.

const MAX_CARDS = 6;

const AVATAR_COLORS = [
  'linear-gradient(135deg, #54E6D4, #2aa99a)',
  'linear-gradient(135deg, #54E6D4, #16a34a)',
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
];

export default function StudentReviewsGrid({ courses = [] }) {
  const reducedMotion = useReducedMotion();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let active = true;
    if (!supabase || !courses.length) return undefined;

    async function loadReviews() {
      try {
        const results = await Promise.all(
          courses.map(async (course) => {
            const { data, error } = await supabase.rpc('get_student_reviews', { p_course_id: course.id });
            if (error) throw error;
            return (data || []).map((review) => ({ ...review, rating: Number(review.rating) || 5, course_title: course.title }));
          }),
        );
        if (!active) return;
        const visible = results
          .flat()
          .filter((review) => !review.is_hidden && String(review.comment || '').trim())
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setReviews(visible);
      } catch (error) {
        console.warn('Reviews grid loading error:', error);
      }
    }

    loadReviews();
    return () => { active = false; };
  }, [courses]);

  const stats = useMemo(() => {
    if (!reviews.length) return null;
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return { average: average.toFixed(1), count: reviews.length };
  }, [reviews]);

  if (!stats) return null;
  const displayReviews = reviews.slice(0, MAX_CARDS);

  return (
    <section className="reviews-grid-section section-pad section-block" id="reviews">
      <div className="reviews-grid-header">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="eyebrow">آراء الأعضاء</span>
          <h2>قالوا إيه عن نقلة</h2>
          <p>تقييمات كتبها أعضاء المنصة بعد ما اتفرجوا على المحاضرات.</p>
        </motion.div>

        <motion.div
          className="reviews-trust-bar"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="trust-item">
            <span className="trust-score">{stats.average}</span>
            <div>
              <div className="trust-stars">★★★★★</div>
              <small>متوسط التقييم</small>
            </div>
          </div>
          <div className="trust-divider" />
          <div className="trust-item">
            <span className="trust-stat">{stats.count}</span>
            <div>
              <b>تقييم</b>
              <small>من أعضاء المنصة</small>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Grid of Reviews */}
      <div className="reviews-bento-grid">
        {displayReviews.map((review, index) => {
          const avatarLetter = (review.reviewer_name || 'ط').trim().charAt(0);
          const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length];

          return (
            <motion.article
              key={review.id || index}
              className="review-bento-card"
              initial={reducedMotion ? false : { opacity: 0, y: 36, scale: 0.96, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.08 }}
              transition={{ duration: 0.88, delay: (index % 3) * 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={reducedMotion ? undefined : { y: -6, transition: { duration: 0.3 } }}
            >
              {/* Watermark Quote Mark */}
              <span className="review-card-quote">“</span>

              {/* Card Header: Avatar, Name, Verification */}
              <div className="review-card-top">
                <div className="review-author-avatar" style={{ background: avatarBg }}>
                  {avatarLetter}
                </div>
                <div className="review-author-info">
                  <div className="review-author-name-row">
                    <h3>{review.reviewer_name || 'طالب في المنصة'}</h3>
                    <span className="verified-student-badge" title="تقييم من حساب مشترك في المنصة">
                      ✓ عضو في نقلة
                    </span>
                  </div>
                </div>
              </div>

              {/* Stars & Course Tag */}
              <div className="review-card-meta-row">
                <div className="review-stars-gold" aria-label={`${review.rating} من 5 نجوم`}>
                  {'★'.repeat(review.rating)}
                  <span className="review-rating-num">{review.rating.toFixed(1)}</span>
                </div>
                <span className="review-course-tag">🎓 {review.course_title}</span>
              </div>

              {/* Review Text */}
              <p className="review-card-text">
                {review.comment}
              </p>

              {/* Card Footer */}
              <div className="review-card-footer">
                <span className="review-date-text">
                  {new Date(review.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </motion.article>
          );
        })}
      </div>

      <motion.div
        className="reviews-sales-cta-box"
        initial={reducedMotion ? false : { opacity: 0, y: 32, scale: 0.97, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="reviews-cta-content">
          <span className="reviews-cta-badge">اشتراك واحد مدى الحياة</span>
          <h3>جاهز تبدأ نقلتك؟</h3>
          <p>دفعة واحدة تفتح لك المسارات الثلاثة، وأي كورس بنضيفه بعد كده.</p>
        </div>

        <div className="reviews-cta-action">
          <Link to="/join" className="btn primary large reviews-cta-btn">
            شوف الاشتراك <span>←</span>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
