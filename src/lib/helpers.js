export function isEmailNotConfirmed(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('email_not_confirmed') || message.includes('email not confirmed');
}

export function formatError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (isEmailNotConfirmed(error)) {
    return 'أكد بريدك الإلكتروني أولًا، ثم سجّل الدخول.';
  }
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'البريد الإلكتروني مستخدم بالفعل.';
  }
  if (message.includes('new password should be different') || message.includes('password should be different')) {
    return 'اختار كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.';
  }
  if (message.includes('password should be') || message.includes('weak password')) {
    return 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.';
  }
  if (message.includes('email address not authorized') || code.includes('email_address_not_authorized')) {
    return 'خدمة البريد الحالية لا تسمح بإرسال رابط الاسترجاع لهذا البريد. تواصل مع إدارة المنصة.';
  }
  if (
    code.includes('bad_code_verifier')
    || message.includes('code verifier')
    || message.includes('pkce')
  ) {
    return 'رابط الاسترجاع لم يبدأ بشكل صحيح. اطلب رابطًا جديدًا وحاول مرة أخرى.';
  }
  if (
    code.includes('otp_expired')
    || code.includes('otp_disabled')
    || message.includes('token has expired')
    || message.includes('otp expired')
    || message.includes('invalid token')
    || message.includes('invalid jwt')
  ) {
    return 'رابط الاسترجاع انتهت صلاحيته أو تم استخدامه من قبل. اطلب رابطًا جديدًا.';
  }
  if (
    message.includes('auth session missing')
    || message.includes('session missing')
    || message.includes('session not found')
  ) {
    return 'جلسة تغيير كلمة المرور غير موجودة أو انتهت. اطلب رابط استرجاع جديد.';
  }
  if (message.includes('duplicate key') || code === '23505') {
    return 'القيمة مستخدمة بالفعل. غيّر الترتيب أو البيانات وحاول مرة أخرى.';
  }
  if (message.includes('row-level security') || message.includes('permission denied') || code === '42501') {
    return 'ليس لديك صلاحية لتنفيذ هذا الإجراء. تأكد أن الحساب Admin.';
  }
  if (
    code.includes('authentication_required')
    || message.includes('authentication required')
    || message.includes('جلسة الدخول غير موجودة')
    || message.includes('جلسة الدخول انتهت')
  ) {
    return 'جلسة الدخول انتهت أو لم تبدأ بشكل صحيح. سجّل الدخول مرة أخرى ثم فعّل الكود.';
  }
  if (message.includes('invalid activation code')) {
    return 'كود التفعيل غير صحيح. انسخه كاملًا من غير مسافات زائدة.';
  }
  if (message.includes('activation code was already used')) {
    return 'هذا الكود استُخدم بالفعل على حساب آخر.';
  }
  if (message.includes('activation code is disabled')) {
    return 'هذا الكود موقوف. اطلب كودًا جديدًا من الإدارة.';
  }
  if (message.includes('activation code has expired')) {
    return 'انتهت صلاحية هذا الكود. اطلب كودًا جديدًا من الإدارة.';
  }
  if (message.includes('course is not available')) {
    return 'الكورس المرتبط بهذا الكود غير متاح حاليًا.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'محاولات كثيرة. انتظر قليلًا ثم جرّب مرة أخرى.';
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت.';
  }

  return error?.message || 'حدث خطأ غير متوقع.';
}

export function slugifyFileName(name = 'file') {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
