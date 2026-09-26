import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { createPrivateFileUrl } from '../lib/storage';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';
import ReviewsSection from '../components/ReviewsSection';
import { useMembership } from '../lib/membership';
import { courseCover, trackFor } from '../lib/tracks';

const tabs = [
  ['overview', 'الرئيسية'],
  ['courses', 'كورساتي'],
  ['payments', 'مدفوعاتي'],
  ['materials', 'الماتريال'],
  ['activate', 'تفعيل كود'],
  ['profile', 'الملف الشخصي'],
];

function mapCourse(item) {
  return { ...item, thumbnailUrl: item.thumbnail_url };
}
function mapLecture(item) {
  return { ...item, courseId: item.course_id, thumbnailUrl: item.thumbnail_url, isFree: item.is_free, order: item.sort_order };
}
function mapMaterial(item) {
  return { ...item, lectureId: item.lecture_id, fileName: item.file_name };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasAccess: isMember, refresh: refreshMembership } = useMembership(user?.id);
  const [tab, setTab] = useState('overview');
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [payments, setPayments] = useState([]);
  const [code, setCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [toast, setToast] = useState(null);
  const [profile, setProfile] = useState({ displayName: user?.displayName || '', experience: '', phone: '' });

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;
    const [courseResult, lectureResult, materialResult, enrollmentResult, progressResult, paymentResult, profileResult] = await Promise.all([
      supabase.from('courses').select('*').eq('published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('lectures').select('*').eq('published', true).order('sort_order', { ascending: true }),
      supabase.from('materials').select('*').order('created_at', { ascending: false }),
      supabase.from('enrollments').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('lecture_progress').select('*').eq('user_id', user.id),
      supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ]);

    const error = [courseResult, lectureResult, materialResult, enrollmentResult, progressResult, paymentResult, profileResult].find((result) => result.error)?.error;
    if (error) throw error;

    const mappedCourses = (courseResult.data || []).map(mapCourse);
    const mappedLectures = (lectureResult.data || []).map(mapLecture);
    const courseMap = new Map(mappedCourses.map((item) => [item.id, item]));
    const lectureMap = new Map(mappedLectures.map((item) => [item.id, item]));

    setCourses(mappedCourses);
    setLectures(mappedLectures);
    setMaterials((materialResult.data || []).map((item) => ({
      ...mapMaterial(item),
      courseId: lectureMap.get(item.lecture_id)?.courseId,
    })));
    setEnrollments(enrollmentResult.data || []);
    setProgress((progressResult.data || []).map((item) => ({ ...item, lectureId: item.lecture_id })));
    setPayments((paymentResult.data || []).map((item) => ({
      ...item,
      courseTitle: item.plan_id ? 'اشتراك نقلة مدى الحياة' : (courseMap.get(item.course_id)?.title || 'كورس'),
      createdAt: item.created_at,
    })));
    if (profileResult.data) {
      setProfile({
        displayName: profileResult.data.display_name || user.displayName || '',
        experience: profileResult.data.experience || '',
        phone: profileResult.data.phone || '',
      });
    }
  }, [user?.id, user?.displayName]);

  useEffect(() => {
    loadDashboard().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [loadDashboard]);

  const enrolledIds = useMemo(
    () => (isMember ? new Set(courses.map((item) => item.id)) : new Set(enrollments.map((item) => item.course_id))),
    [isMember, courses, enrollments],
  );
  const enrolledCourses = courses.filter((course) => enrolledIds.has(course.id));
  const accessibleLectures = lectures.filter((lecture) => lecture.isFree || enrolledIds.has(lecture.courseId));
  const accessibleMaterials = materials.filter((material) => !material.courseId || enrolledIds.has(material.courseId));
  const completedIds = useMemo(() => new Set(progress.filter((item) => item.completed).map((item) => item.lectureId)), [progress]);
  const completion = accessibleLectures.length ? Math.round((accessibleLectures.filter((item) => completedIds.has(item.id)).length / accessibleLectures.length) * 100) : 0;
  const nextLecture = accessibleLectures.find((lecture) => !completedIds.has(lecture.id)) || accessibleLectures[0];

  async function activateCode(event) {
    event.preventDefault();
    if (loadingCode) return;

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setToast({ type: 'error', message: 'اكتب كود التفعيل أولًا.' });
      return;
    }

    setLoadingCode(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        const authError = new Error('جلسة الدخول غير موجودة. سجّل الدخول مرة أخرى ثم فعّل الكود.');
        authError.code = 'authentication_required';
        throw authError;
      }

      const {
        data: { user: authenticatedUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authenticatedUser?.id) {
        const authError = new Error('جلسة الدخول انتهت. سجّل الدخول مرة أخرى ثم فعّل الكود.');
        authError.code = 'authentication_required';
        throw authError;
      }

      const { data, error } = await supabase.rpc('redeem_activation_code', { p_code: normalizedCode });
      if (error) throw error;

      setCode('');
      refreshMembership();
      await loadDashboard();
      const isMembershipCode = data?.kind === 'membership';
      setToast({
        type: 'success',
        message: isMembershipCode
          ? (data?.already_enrolled ? 'اشتراكك في نقلة فعّال بالفعل.' : 'تم تفعيل اشتراكك في نقلة. الكورسات الثلاثة مفتوحة لك.')
          : (data?.already_enrolled
            ? `الكورس ${data?.course_title || ''} مفعّل بالفعل على حسابك.`
            : `تم تفعيل كورس ${data?.course_title || ''} بنجاح.`),
      });
      setTab('courses');
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoadingCode(false);
    }
  }

  async function downloadMaterial(material) {
    try {
      const url = await createPrivateFileUrl('course-materials', material.file_path, 300);
      if (!url) throw new Error('تعذر إنشاء رابط التحميل.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: profile.displayName,
        experience: profile.experience,
        phone: profile.phone,
      }).eq('id', user.id);
      if (error) throw error;
      setToast({ type: 'success', message: 'تم حفظ بياناتك.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    }
  }

  return (
    <main className="dashboard-page section-pad">
      <Toast {...toast} onClose={() => setToast(null)} />
      <header className="dashboard-welcome">
        <div><span className="eyebrow">لوحة الطالب</span><h1>أهلًا، {profile.displayName || user.displayName || 'صانع المحتوى'}</h1><p>كل محاضراتك، ملفاتك، تقدمك ومشاريعك في مكان واحد.</p></div>
        {nextLecture && <button type="button" className="btn primary" onClick={() => navigate(`/watch/${nextLecture.id}`)}>كمّل آخر محاضرة</button>}
      </header>

      <div className="dashboard-layout">
        <aside className="student-tabs">
          {tabs.map(([id, label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}</button>)}
          <div className="mini-progress"><span>نسبة إنجازك</span><b>{completion}%</b><i><em style={{ width: `${completion}%` }} /></i></div>
        </aside>

        <section className="dashboard-content">
          {tab === 'overview' && (
            <>
              {isMember ? (
                <div className="member-banner"><div><b>اشتراكك فعّال</b><span>الكورسات الثلاثة مفتوحة لك مدى الحياة، وأي كورس جديد يظهر هنا تلقائيًا.</span></div><span className="member-badge">✓ عضو في نقلة</span></div>
              ) : (
                <div className="member-banner"><div><b>ابدأ بالاشتراك</b><span>دفعة واحدة تفتح لك الكورسات الثلاثة مدى الحياة. لو معاك كود، فعّله من تاب «تفعيل كود».</span></div><Link className="btn primary" to="/join">شوف الاشتراك</Link></div>
              )}
              {enrolledCourses.length > 0 && (
                <div className="track-progress-grid">
                  {enrolledCourses.slice(0, 3).map((course, index) => {
                    const list = accessibleLectures.filter((lecture) => String(lecture.courseId) === String(course.id));
                    const done = list.filter((lecture) => completedIds.has(lecture.id)).length;
                    const percent = list.length ? Math.round((done / list.length) * 100) : 0;
                    return (
                      <div className="track-progress" key={course.id} style={{ '--tc': trackFor(course, index).color }}>
                        <b>{course.title}</b>
                        <div className="bar"><i style={{ width: `${percent}%` }} /></div>
                        <small>{done} من {list.length} محاضرة · {percent}%</small>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="stats-grid">
                <div><span>الكورسات المفعلة</span><b>{enrolledCourses.length}</b><small>كورس متاح</small></div>
                <div><span>المحاضرات المكتملة</span><b>{completedIds.size}</b><small>من {accessibleLectures.length}</small></div>
                <div><span>ملفات التحميل</span><b>{accessibleMaterials.length}</b><small>ملف وماتريال</small></div>
              </div>
              {nextLecture && <div className="continue-card"><img src={nextLecture.thumbnailUrl || '/assets/cover-default.svg'} alt="" /><div><span>التالي ليك</span><h2>{nextLecture.title}</h2><p>{nextLecture.description}</p><button type="button" className="btn primary" onClick={() => navigate(`/watch/${nextLecture.id}`)}>ابدأ المشاهدة</button></div></div>}
              <div className="student-features-grid">
                <article><i>☆</i><h3>المفضلة</h3><p>احفظ المحاضرات المهمة للرجوع السريع.</p><span>قريبًا</span></article>
                <article><i>✓</i><h3>الشهادات</h3><p>الشهادة تظهر بعد إكمال متطلبات الكورس.</p><span>{completion === 100 ? 'متاحة' : 'أكمل المسار'}</span></article>
                <article><i>?</i><h3>الدعم</h3><p>تواصل مع فريق المنصة عند وجود مشكلة.</p><a href="/#community">تواصل الآن</a></article>
              </div>
            </>
          )}

          {tab === 'courses' && (
            <div><div className="panel-heading"><h2>كورساتي</h2><p>الكورسات التي تم تفعيلها بالدفع أو الكود.</p></div><div className="card-grid small-grid">
              {enrolledCourses.length ? enrolledCourses.map((course) => {
                const courseLectures = accessibleLectures.filter((lecture) => String(lecture.courseId) === String(course.id));
                const done = courseLectures.filter((lecture) => completedIds.has(lecture.id)).length;
                const percent = courseLectures.length ? Math.round((done / courseLectures.length) * 100) : 0;
                const targetLecture = courseLectures.find((lecture) => !completedIds.has(lecture.id)) || courseLectures[0] || null;
                return (
                  <article
                    className={`course-card student-course-card ${targetLecture ? 'is-clickable' : ''}`}
                    key={course.id}
                    role={targetLecture ? 'link' : undefined}
                    tabIndex={targetLecture ? 0 : undefined}
                    onClick={() => targetLecture && navigate(`/watch/${targetLecture.id}`)}
                    onKeyDown={(event) => {
                      if (targetLecture && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        navigate(`/watch/${targetLecture.id}`);
                      }
                    }}
                  >
                    <div className="course-thumb"><img src={courseCover(course)} alt="" /></div>
                    <div className="course-body">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="progress-line"><i><em style={{ width: `${percent}%` }} /></i><span>{percent}%</span></div>
                      {targetLecture ? (
                        <button
                          type="button"
                          className="btn primary full"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/watch/${targetLecture.id}`);
                          }}
                        >دخول الكورس</button>
                      ) : <div className="course-no-lectures">لا توجد محاضرات منشورة داخل هذا الكورس حاليًا.</div>}
                      <ReviewsSection courseId={course.id} compact />
                    </div>
                  </article>
                );
              }) : <div className="empty-state"><h3>لسه مفيش كورسات مفعلة</h3><p>اشترك مرة واحدة لتفتح الكورسات الثلاثة، أو استخدم كود التفعيل.</p><div className="row-actions"><Link className="btn primary" to="/join">الاشتراك</Link><button className="btn ghost" onClick={() => setTab('activate')}>تفعيل كود</button></div></div>}
            </div></div>
          )}

          {tab === 'payments' && (
            <div><div className="panel-heading"><h2>مدفوعاتي</h2><p>تابع كل محاولات الدفع وحالة تفعيل الكورسات.</p></div><div className="student-payment-list">
              {payments.length ? payments.map((payment) => {
                const pending = ['created', 'pending', 'awaiting_transfer'].includes(payment.status);
                const labels = { paid: 'مدفوعة', pending: 'معلقة', created: 'جديدة', awaiting_transfer: 'بانتظار التحويل', failed: 'فشلت', cancelled: 'ملغاة' };
                const date = payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('ar-EG') : '';
                return <article key={payment.id}><span className={`payment-provider-badge ${payment.provider}`}>{payment.provider === 'trc20' ? 'TRC20' : payment.provider}</span><div><b>{payment.courseTitle}</b><small>{Number(payment.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} {payment.currency} · {date}</small></div><span className={`status ${payment.status}`}>{labels[payment.status] || payment.status}</span>{pending && <Link className="btn ghost compact" to={`/payment-return?provider=${payment.provider}&paymentId=${payment.id}`}>متابعة</Link>}</article>;
              }) : <div className="empty-state">لم تنفذ أي عمليات دفع حتى الآن.</div>}
            </div></div>
          )}

          {tab === 'materials' && (
            <div><div className="panel-heading"><h2>ماتريال الكورسات</h2><p>حمّل الملفات المرفقة بمحاضراتك.</p></div><div className="data-list">
              {accessibleMaterials.length ? accessibleMaterials.map((material) => <div key={material.id}><i className="file-icon">⇩</i><div><b>{material.title}</b><small>{material.fileName || 'ملف مرفق'}</small></div><button className="btn ghost compact" onClick={() => downloadMaterial(material)}>تحميل</button></div>) : <div className="empty-state">لا توجد ماتريال متاحة حاليًا.</div>}
            </div></div>
          )}

          {tab === 'activate' && (
            <div className="activate-panel"><span className="big-hash">#</span><span className="eyebrow">وصول فوري</span><h2>فعّل كود الكورس</h2><p>كل كود صالح للاستخدام مرة واحدة فقط، ويرتبط بحساب الطالب الذي استخدمه.</p><form onSubmit={activateCode}><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HD-XXXX-XXXX" required /><button className="btn primary large" disabled={loadingCode}>{loadingCode ? 'جاري التفعيل...' : 'تفعيل الكود'}</button></form><small>الكود لا يمكن استخدامه مرة ثانية بعد نجاح التفعيل.</small></div>
          )}

          {tab === 'profile' && (
            <div><div className="panel-heading"><h2>الملف الشخصي</h2><p>بياناتك التي تظهر في مشاريعك وشهاداتك.</p></div><form className="stack-form profile-form" onSubmit={saveProfile}><label>الاسم<input value={profile.displayName || ''} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></label><label>مدة الخبرة<input value={profile.experience || ''} onChange={(e) => setProfile({ ...profile, experience: e.target.value })} /></label><label>رقم الهاتف<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label><label>البريد الإلكتروني<input value={user.email} disabled /></label><button className="btn primary">حفظ البيانات</button></form></div>
          )}
        </section>
      </div>
    </main>
  );
}
