import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError, formatDate } from '../../lib/helpers';
import Toast from '../../components/Toast';

function isExpired(code) {
  return Boolean(code.expires_at && new Date(code.expires_at) <= new Date());
}

function codeStatus(code) {
  if (code.used_at) return 'redeemed';
  if (!code.is_active || isExpired(code)) return 'disabled';
  return 'unused';
}

function statusLabel(status) {
  if (status === 'redeemed') return 'مستخدم';
  if (status === 'unused') return 'متاح';
  return 'موقوف/منتهي';
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsvFile(rows, filename) {
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const MEMBERSHIP = '__membership__';

export default function AdminCodes() {
  const [courses, setCourses] = useState([]);
  const [codes, setCodes] = useState([]);
  const [courseId, setCourseId] = useState(MEMBERSHIP);
  const [count, setCount] = useState(10);
  const [generated, setGenerated] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyCodeId, setBusyCodeId] = useState('');
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    const [courseResult, codeResult] = await Promise.all([
      supabase.from('courses').select('id,title,published').order('created_at', { ascending: false }),
      supabase.from('activation_codes').select('*').order('created_at', { ascending: false }),
    ]);
    const error = courseResult.error || codeResult.error;
    if (error) throw error;
    setCourses(courseResult.data || []);
    setCodes((codeResult.data || []).map((item) => ({ ...item, status: codeStatus(item) })));
  }, []);

  useEffect(() => {
    loadData().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [loadData]);

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const courseName = useCallback(
    (id) => courseMap.get(id) || (id ? id : 'اشتراك نقلة (كل الكورسات)'),
    [courseMap],
  );

  const visibleCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return codes.filter((code) => {
      if (filter !== 'all' && code.status !== filter) return false;
      if (courseFilter === MEMBERSHIP && code.course_id) return false;
      if (courseFilter !== 'all' && courseFilter !== MEMBERSHIP && code.course_id !== courseFilter) return false;
      if (!query) return true;

      const haystack = [
        code.code_value,
        code.code_preview,
        courseMap.get(code.course_id),
        code.course_id ? '' : 'اشتراك نقلة',
        code.used_by,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [codes, courseFilter, courseMap, filter, search]);

  const downloadableVisibleCodes = useMemo(
    () => visibleCodes.filter((code) => Boolean(code.code_value)),
    [visibleCodes],
  );

  async function generate(event) {
    event.preventDefault();
    if (!courseId) return setToast({ type: 'error', message: 'اختار نوع الكود.' });
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('generate_activation_codes', {
        p_course_id: courseId === MEMBERSHIP ? null : courseId,
        p_quantity: Number(count),
        p_expires_at: null,
      });
      if (error) throw error;
      const created = (data || []).map((item) => item.code);
      const batch = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      setGenerated(created);
      setBatchId(batch);
      await loadData();
      setToast({ type: 'success', message: `تم توليد ${created.length} كود. الأكواد محفوظة الآن ويمكنك الرجوع لها في أي وقت.` });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  function downloadGeneratedCsv() {
    if (!generated.length) return;
    const rows = [
      'code,course,batch',
      ...generated.map((code) => [code, courseName(courseId === MEMBERSHIP ? null : courseId), batchId].map(csvCell).join(',')),
    ];
    downloadCsvFile(rows, `naqla-codes-${batchId || Date.now()}.csv`);
  }

  function downloadVisibleCsv() {
    if (!downloadableVisibleCodes.length) {
      setToast({ type: 'error', message: 'لا توجد أكواد كاملة قابلة للتحميل ضمن النتائج الحالية.' });
      return;
    }

    const rows = [
      'code,course,status,created_at,used_by',
      ...downloadableVisibleCodes.map((code) => [
        code.code_value,
        courseName(code.course_id),
        statusLabel(code.status),
        code.created_at,
        code.used_by || '',
      ].map(csvCell).join(',')),
    ];
    downloadCsvFile(rows, `naqla-codes-${Date.now()}.csv`);
  }

  async function copyCode(code) {
    if (!code.code_value) {
      setToast({ type: 'error', message: 'ده كود قديم والنص الكامل لم يكن محفوظًا وقت توليده.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(code.code_value);
      setToast({ type: 'success', message: 'تم نسخ الكود.' });
    } catch {
      const input = document.createElement('textarea');
      input.value = code.code_value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setToast({ type: 'success', message: 'تم نسخ الكود.' });
    }
  }

  async function toggleCode(code) {
    if (code.used_at) {
      setToast({ type: 'error', message: 'الكود مستخدم بالفعل ولا يمكن إعادة تفعيله.' });
      return;
    }
    if (isExpired(code)) {
      setToast({ type: 'error', message: 'الكود منتهي الصلاحية.' });
      return;
    }

    setBusyCodeId(code.id);
    try {
      const nextActive = !code.is_active;
      const { error } = await supabase
        .from('activation_codes')
        .update({ is_active: nextActive })
        .eq('id', code.id);
      if (error) throw error;
      await loadData();
      setToast({
        type: 'success',
        message: nextActive ? 'تم تفعيل الكود.' : 'تم إيقاف الكود.',
      });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyCodeId('');
    }
  }

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />

      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">One-Time Codes</span>
          <h1>أكواد التفعيل</h1>
          <p>الأكواد الجديدة تُحفظ كاملة للأدمن فقط، وتظل صالحة للاستخدام مرة واحدة.</p>
        </div>
      </div>

      <form className="admin-form-card codes-generator" onSubmit={generate}>
        <div className="panel-heading compact">
          <h2>توليد دفعة أكواد</h2>
          <span>الحد الأقصى 500 كود</span>
        </div>
        <div className="three-cols">
          <label>
            نوع الكود
            <select required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value={MEMBERSHIP}>اشتراك نقلة (يفتح الكورسات الثلاثة)</option>
              {courses.map((course) => <option key={course.id} value={course.id}>كورس واحد: {course.title}</option>)}
            </select>
          </label>
          <label>
            عدد الأكواد
            <input type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <button className="btn primary align-end" disabled={busy}>
            {busy ? 'جاري التوليد...' : 'Generate Codes'}
          </button>
        </div>
      </form>

      {!!generated.length && (
        <div className="generated-codes-panel">
          <div>
            <span className="eyebrow">آخر دفعة</span>
            <h2>تم حفظ الأكواد بنجاح</h2>
            <p>تقدر تحمل الدفعة الآن، وهتفضل الأكواد الكاملة موجودة في السجل بعد أي Refresh.</p>
          </div>
          <div className="generated-code-grid">
            {generated.map((code) => <code key={code}>{code}</code>)}
          </div>
          <button type="button" className="btn primary" onClick={downloadGeneratedCsv}>تحميل الدفعة CSV</button>
        </div>
      )}

      <div className="admin-table-card">
        <div className="panel-heading compact">
          <h2>سجل الأكواد</h2>
          <button type="button" className="btn ghost compact" onClick={downloadVisibleCsv}>
            تحميل الأكواد الظاهرة CSV
          </button>
        </div>

        <div className="three-cols" style={{ marginBottom: 16 }}>
          <label>
            الحالة
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="unused">غير مستخدمة</option>
              <option value="redeemed">مستخدمة</option>
              <option value="disabled">موقوفة/منتهية</option>
            </select>
          </label>
          <label>
            النوع
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value={MEMBERSHIP}>اشتراك نقلة</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label>
            بحث
            <input
              type="search"
              placeholder="ابحث بالكود أو الكورس..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الكورس</th>
                <th>الحالة</th>
                <th>تاريخ التوليد</th>
                <th>استخدم بواسطة</th>
                <th>التحكم</th>
              </tr>
            </thead>
            <tbody>
              {visibleCodes.map((code) => (
                <tr key={code.id}>
                  <td>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <code>{code.code_value || code.code_preview}</code>
                      {!code.code_value && <small style={{ opacity: 0.65 }}>كود قديم — النص الكامل غير محفوظ</small>}
                    </div>
                  </td>
                  <td>{courseName(code.course_id)}</td>
                  <td>
                    <span className={`status ${code.status === 'redeemed' ? 'approved' : code.status === 'unused' ? 'pending' : 'rejected'}`}>
                      {statusLabel(code.status)}
                    </span>
                  </td>
                  <td>{formatDate(code.created_at)}</td>
                  <td>{code.used_by || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="table-button" onClick={() => copyCode(code)} disabled={!code.code_value}>
                        نسخ
                      </button>
                      {!code.used_at && !isExpired(code) && (
                        <button
                          type="button"
                          className={`table-button ${code.is_active ? 'danger-text' : ''}`}
                          onClick={() => toggleCode(code)}
                          disabled={busyCodeId === code.id}
                        >
                          {busyCodeId === code.id ? '...' : code.is_active ? 'إيقاف' : 'تفعيل'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleCodes.length && (
                <tr><td colSpan="6">لا توجد أكواد مطابقة للفلاتر الحالية.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
