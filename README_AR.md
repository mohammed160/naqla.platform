# نقلة (Naqla)

منصة كورسات باشتراك واحد مدى الحياة يفتح ثلاثة مسارات: تصميم المحتوى الجرافيكي، وبناء المنصات بالـ Vibe Coding، والإعلانات الممولة.
مبنية على React + Vite + Supabase، ومحوّلة من منصة Design Tips.

## التشغيل المحلي

بدون `.env` الموقع يفتح في **وضع العرض**: الصفحات العامة تظهر ببيانات تجريبية وفي أعلاها شريط تنبيه، لكن تسجيل الدخول والدفع والمحتوى الحقيقي يحتاجون Supabase.

```bash
npm install
cp .env.example .env      # ثم املأ القيم
npm run dev
```

المتغيرات في `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
VITE_APP_URL=http://localhost:5173
VITE_ADMIN_PORTAL_PATH=/غيّر-هذا-المسار-السري
```

لا تضع `service_role` أو أي Secret داخل Vite.

## قاعدة البيانات والأدمن

الخطوات الكاملة في **`SUPABASE_SETUP_AR.md`**.
باختصار: في Supabase SQL Editor الصق ملف **`supabase/naqla_full_setup.sql`** كله واضغط Run. الملف آمن لو اتعاد.

الملف ده متجمّع تلقائيًا من `supabase/migrations`. لو عدّلت أو ضفت migration، شغّل:

```bash
npm run db:bundle
```

والـ build بيرفض يكمل لو الملف المجمّع مش متطابق مع الـ migrations.
**السعر المبدئي 1999 ج.م placeholder**: غيّره من الأدمن ← «الاشتراك والأعضاء».

## كيف يعمل الاشتراك

- `plans`: الخطة المعروضة للبيع. `memberships`: صف لكل عضو، و`expires_at` فارغ للخطة مدى الحياة.
- `can_access_course()` تسمح بالوصول للأدمن، أو لصاحب اشتراك فعّال، أو لمن عنده تسجيل فردي في كورس.
  المحاضرات والماتريال والفيديو كلها تعتمد عليها، فأي كورس جديد يُفتح للأعضاء تلقائيًا.
- الدفع اليدوي (اعتماد الأدمن) وأكواد التفعيل وFawry webhook تمنح الاشتراك عبر `grant_membership()`.
- أكواد `NQ-XXXX-XXXX` تفتح الاشتراك كله، وأكواد `HD-…` القديمة تفتح كورسًا واحدًا.

## Edge Functions: مهم قبل تفعيل الدفع

الـ Checkout يرسل `planId` بدل `courseId` عند شراء الاشتراك. المعدّل في هذا المشروع:
`fawry-wallet-charge` و`fawry-webhook`.

الدوال التالية يستدعيها الـ Checkout لكنها **غير موجودة في الريبو**، وإن كانت منشورة عندك فلازم تُعدّل بنفس الفكرة
(قبول `planId`، وحفظ `plan_id` في `payments`، واستدعاء `grant_membership` عند نجاح الدفع):

```text
create-payment-session
verify-trc20-payment
capture-paypal-order
```

## الهوية

الألوان والخطوط في `src/naqla.css`، والشعار والباترن في `public/brand`.
ألوان المسارات وأشكالها في `src/lib/tracks.js`، ويمكن تغيير لون كورس من عمود `accent` في جدول `courses`.
