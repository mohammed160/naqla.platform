import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatError } from '../../lib/helpers';
import Toast from '../../components/Toast';

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const digits = Math.floor(100 + Math.random() * 900);
  return `Naqla@${randomPart}${digits}`;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [deletingId, setDeletingId] = useState('');

  // Password reset modal state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetSuccessData, setResetSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [usersResult, enrollmentsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('enrollments').select('user_id,active'),
      ]);
      const error = usersResult.error || enrollmentsResult.error;
      if (error) throw error;
      setUsers(usersResult.data || []);
      setEnrollments(enrollmentsResult.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [loadData]);

  const filtered = useMemo(() => {
    return users.filter((item) => `${item.display_name || ''} ${item.email || ''}`.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  async function toggleAdmin(profile) {
    const isAdmin = profile.role === 'admin';
    if (profile.id === currentUser?.id && isAdmin) {
      return setToast({ type: 'error', message: 'لا يمكنك إلغاء صلاحية حسابك الإداري الحالي.' });
    }
    if (!window.confirm(`${isAdmin ? 'إلغاء' : 'منح'} صلاحية الأدمن لهذا الحساب؟`)) return;
    const { error } = await supabase.from('profiles').update({ role: isAdmin ? 'student' : 'admin' }).eq('id', profile.id);
    if (error) return setToast({ type: 'error', message: formatError(error) });
    await loadData();
    setToast({ type: 'success', message: 'تم تحديث الصلاحية. يُفضّل أن يسجّل المستخدم الدخول من جديد.' });
  }

  async function deleteStudent(profile) {
    if (profile.role === 'admin') {
      return setToast({ type: 'error', message: 'لا يمكن حذف حساب Admin من شاشة الطلاب.' });
    }

    const label = profile.display_name || profile.email || 'هذا الطالب';
    const confirmed = window.confirm(
      `حذف حساب ${label} نهائيًا؟\n\nسيتم حذف الحساب بالكامل وكل بياناته المرتبطة بما فيها المشاريع والتقدم. لا يمكن التراجع عن هذه الخطوة.`,
    );
    if (!confirmed) return;

    setDeletingId(profile.id);
    try {
      // 1. Try Postgres RPC
      let rpcSuccess = false;
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_user', {
          target_user_id: profile.id,
        });
        if (!rpcError && rpcData?.success) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }

      // 2. Fallback to Edge Function if RPC not deployed yet
      if (!rpcSuccess) {
        const { data, error } = await supabase.functions.invoke('admin-delete-user', {
          body: { userId: profile.id },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'تعذر حذف الطالب.');
      }

      await loadData();
      setToast({ type: 'success', message: `تم حذف حساب ${label} نهائيًا من المنصة.` });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setDeletingId('');
    }
  }

  function openResetModal(profile) {
    setSelectedStudent(profile);
    setNewPassword(generateRandomPassword());
    setResetSuccessData(null);
    setCopied(false);
    setShowPassword(true);
  }

  function closeResetModal() {
    setSelectedStudent(null);
    setNewPassword('');
    setResetSuccessData(null);
    setCopied(false);
  }

  async function handleResetPassword(e) {
    e?.preventDefault();
    if (!selectedStudent) return;
    if (!newPassword || newPassword.trim().length < 6) {
      return setToast({ type: 'error', message: 'يجب أن لا تقل كلمة المرور عن 6 أحرف.' });
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: selectedStudent.id,
        new_password: newPassword.trim(),
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'تعذر تحديث كلمة المرور.');
      }

      setResetSuccessData({
        name: selectedStudent.display_name || 'طالب',
        email: selectedStudent.email,
        password: newPassword.trim(),
      });
      setToast({ type: 'success', message: 'تم تعيين كلمة المرور بنجاح للطالب.' });
    } catch (err) {
      setToast({ type: 'error', message: formatError(err) });
    } finally {
      setResetting(false);
    }
  }

  async function copyLoginCredentials() {
    if (!resetSuccessData) return;
    const loginUrl = window.location.origin + '/login';
    const textToCopy = `مرحباً ${resetSuccessData.name}،\nبيانات تسجيل الدخول لحسابك على منصة التدريب:\n• البريد: ${resetSuccessData.email}\n• كلمة المرور: ${resetSuccessData.password}\n• رابط الدخول: ${loginUrl}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setToast({ type: 'error', message: 'تعذر النسخ إلى الحافظة تلقائياً.' });
    }
  }

  return (
    <motion.section 
      className="admin-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <Toast {...toast} onClose={() => setToast(null)} />
      
      <div className="admin-page-heading">
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="eyebrow">Users</span>
          <h1>الطلاب والصلاحيات</h1>
          <p>إدارة حسابات الطلاب، تعيين كلمات المرور، منح صلاحيات الأدمن، أو حذف الحسابات.</p>
        </motion.div>
        <motion.input
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, delay: 0.08 }}
          className="admin-search"
          placeholder="ابحث بالاسم أو البريد"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <motion.div 
        className="admin-table-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.12 }}
      >
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>البريد</th>
                <th>الخبرة</th>
                <th>الكورسات</th>
                <th>تاريخ التسجيل</th>
                <th>الصلاحية</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td className="table-skeleton-cell">
                      <div className="user-cell">
                        <div className="skeleton-line avatar" />
                        <div className="skeleton-line medium" style={{ minWidth: 90 }} />
                      </div>
                    </td>
                    <td className="table-skeleton-cell"><div className="skeleton-line full" /></td>
                    <td className="table-skeleton-cell"><div className="skeleton-line short" /></td>
                    <td className="table-skeleton-cell"><div className="skeleton-line short" /></td>
                    <td className="table-skeleton-cell"><div className="skeleton-line medium" /></td>
                    <td className="table-skeleton-cell"><div className="skeleton-line short" /></td>
                    <td className="table-skeleton-cell"><div className="skeleton-line full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                    لا توجد حسابات تطابق البحث.
                  </td>
                </tr>
              ) : (
                filtered.map((profile, index) => {
                  const isAdmin = profile.role === 'admin';
                  const coursesCount = enrollments.filter((item) => item.user_id === profile.id && item.active !== false).length;
                  const isDeleting = deletingId === profile.id;

                  return (
                    <motion.tr 
                      key={profile.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: Math.min(index * 0.028, 0.3) }}
                    >
                      <td>
                        <div className="user-cell">
                          <span>{(profile.display_name || profile.email || 'U').slice(0, 1)}</span>
                          <b>{profile.display_name || 'بدون اسم'}</b>
                        </div>
                      </td>
                      <td>{profile.email}</td>
                      <td>{profile.experience || '—'}</td>
                      <td>{coursesCount}</td>
                      <td>{formatDate(profile.created_at)}</td>
                      <td>
                        <span className={`status ${isAdmin ? 'approved' : 'pending'}`}>
                          {isAdmin ? 'Admin' : 'Student'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          <button
                            className="table-button"
                            title="تعيين كلمة المرور مباشرة"
                            onClick={() => openResetModal(profile)}
                          >
                            🔑 كلمة المرور
                          </button>
                          <button
                            className="table-button"
                            disabled={profile.id === currentUser?.id && isAdmin}
                            onClick={() => toggleAdmin(profile)}
                          >
                            {isAdmin ? 'إلغاء الأدمن' : 'جعله Admin'}
                          </button>
                          {!isAdmin && (
                            <button
                              className="table-button danger-text"
                              title="حذف الحساب نهائياً"
                              disabled={isDeleting}
                              onClick={() => deleteStudent(profile)}
                            >
                              {isDeleting ? 'جاري الحذف…' : '🗑️ حذف'}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Password Reset Modal with Motion */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div 
            className="dialog-backdrop" 
            onMouseDown={closeResetModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="dialog-card reset-pwd-dialog" 
              onMouseDown={(e) => e.stopPropagation()}
              initial={{ scale: 0.93, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 360 }}
            >
              <div className="dialog-icon key-icon">🔑</div>
              <h3>تعيين كلمة مرور جديدة</h3>
              <p>
                تغيير كلمة المرور مباشرة لحساب: <b>{selectedStudent.display_name || selectedStudent.email}</b>
              </p>

              {!resetSuccessData ? (
                <form onSubmit={handleResetPassword}>
                  <div className="pwd-field-group">
                    <div className="pwd-field-header">
                      <span>كلمة المرور الجديدة</span>
                      <button
                        type="button"
                        className="pwd-gen-btn"
                        onClick={() => setNewPassword(generateRandomPassword())}
                      >
                        ⚡ توليد عشوائي
                      </button>
                    </div>
                    <div className="pwd-input-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="اكتب كلمة المرور (6 أحرف فأكثر)"
                        required
                        minLength={6}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="table-button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'إخفاء' : 'إظهار'}
                      >
                        {showPassword ? '👁️' : '🙈'}
                      </button>
                    </div>
                  </div>

                  <div className="dialog-actions">
                    <button className="btn ghost" type="button" onClick={closeResetModal} disabled={resetting}>
                      إلغاء
                    </button>
                    <button className="btn primary" type="submit" disabled={resetting}>
                      {resetting ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="pwd-copy-box">
                    <div>✅ تم تغيير كلمة المرور بنجاح!</div>
                    <div>البريد: <b>{resetSuccessData.email}</b></div>
                    <div>كلمة المرور: <code>{resetSuccessData.password}</code></div>
                  </div>

                  <div className="dialog-actions" style={{ marginTop: '18px' }}>
                    <button className="btn primary full" type="button" onClick={copyLoginCredentials}>
                      {copied ? '✓ تم النسخ للحافظة!' : '📋 نسخ رسالة الدخول للطالب'}
                    </button>
                    <button className="btn ghost" type="button" onClick={closeResetModal}>
                      إغلاق
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
