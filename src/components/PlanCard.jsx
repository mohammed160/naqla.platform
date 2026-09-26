import { Link } from 'react-router-dom';
import { trackFor } from '../lib/tracks';

/** The single lifetime membership: what it includes, its price and the buy button. */
export default function PlanCard({ plan, courses = [], owned = false, checkoutPath = '/join/checkout', light = true }) {
  const price = Number(plan?.price_egp || 0);
  return (
    <section className={`plan-card ${light ? 'light' : ''}`} id="plan">
      <div>
        <span className="eyebrow">اشتراك واحد</span>
        <h2>{plan?.title}</h2>
        <p>{plan?.description}</p>
        <ul className="plan-includes">
          {courses.map((course, index) => (
            <li key={course.id} style={{ '--tc': trackFor(course, index).color }}><i />{course.title}</li>
          ))}
          <li style={{ '--tc': '#54e6d4' }}><i />أي كورس جديد نضيفه لاحقًا بدون رسوم إضافية</li>
        </ul>
      </div>
      <div className="plan-buy">
        {owned ? (
          <>
            <span className="plan-owned">✓ اشتراكك فعّال مدى الحياة</span>
            <Link className="btn primary large full" to="/dashboard">ادخل لوحتي</Link>
          </>
        ) : (
          <>
            <small>دفعة واحدة، بدون تجديد</small>
            {price > 0 ? (
              <div className="plan-price"><b>{price.toLocaleString('ar-EG')}</b><span>ج.م</span></div>
            ) : (
              <div className="plan-price"><span>السعر يُعلن قريبًا</span></div>
            )}
            <Link className="btn primary large full" to={checkoutPath} aria-disabled={price <= 0}>اشترك الآن</Link>
            <p className="plan-note">وصول دائم للمحاضرات والماتريال والتحديثات. لو معاك كود تفعيل، فعّله من لوحتك بعد التسجيل.</p>
          </>
        )}
      </div>
    </section>
  );
}
