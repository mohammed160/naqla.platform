# Supabase Edge Functions الخاصة بالدفع

الواجهة تدعم أسماء الوظائف التالية:

- `create-payment-session`
- `verify-trc20-payment`
- `capture-paypal-order`

لم تُضمّن أسرار أو مفاتيح تجار داخل React. طرق الدفع متوقفة افتراضيًا حتى يتم نشر Edge Functions وربط مفاتيح Paymob/Fawry/PayPal/TronGrid كـSupabase Secrets.

لا تفعّل أي طريقة دفع من صفحة المحتوى قبل اكتمال الربط التجريبي ثم التحويل إلى Live.
