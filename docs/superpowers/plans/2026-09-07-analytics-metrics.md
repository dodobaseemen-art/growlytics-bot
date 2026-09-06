# Analytics Metrics Implementation Plan

**Goal:** إضافة حساب صحيح للمستخدمين النشطين الفريدين يوميًا، وساعة الذروة، ومؤشر Engagement إلى Growlytics مع إبقاء المسار الحالي للرسائل متوافقًا مع PostgreSQL وMini App.

**Architecture:** سيُسجّل كل حدث رسالة في جدول تفصيلي جديد `message_events` يحتوي المجموعة والمستخدم ووقت الرسالة، بينما يبقى جدول `analytics` جدولًا ملخصًا يوميًا. سيُحدّث الملخص يوميًا بزيادة الرسائل وعدّ المستخدمين الفريدين وإعادة حساب ساعة الذروة، ثم تُعرض المقاييس المجمعة عبر `/api/stats/:userId`.

**Tech Stack:** TypeScript، grammY، Express، PostgreSQL، HTML/CSS/JavaScript Mini App.

**Spec:** متطلبات المستخدم وملف `pasted_content.txt` المرفق.

## Global Constraints

- يجب أن يكون `active_users` عدد المستخدمين الفريدين لكل مجموعة ولكل يوم، لا قيمة ثابتة.
- يجب حساب `peak_hour` من ساعات الرسائل المسجلة فعليًا، مع إرجاع `null` عند عدم وجود رسائل.
- يجب أن يكون Engagement قابلًا للتفسير: `messages / active_users` على مستوى المجموعة/الفترة.
- يجب عدم كسر معالجات `new_chat_members` و`left_chat_member` والدفع وواجهات API الحالية.
- يجب عدم تضمين أسرار البيئة في commit.

---

### Task 1: توسيع مخطط قاعدة البيانات

**Files:**
- Modify: `src/db/schema.sql`
- Create: `src/db/migrations/001_message_events_and_analytics_metrics.sql`

**Changes:**
- إضافة `peak_hour INTEGER` إلى `analytics` مع قيد بين 0 و23.
- إضافة جدول `message_events` بالأعمدة `id`, `group_id`, `user_id`, `message_id`, `sent_at`.
- إضافة فهرس على `(group_id, sent_at)` وفهرس على `(group_id, user_id, sent_at)`.
- جعل إدخال حدث الرسالة idempotent قدر الإمكان باستخدام `message_id` و`group_id`.
- تحديث schema الأساسي والت migration معًا حتى تعمل البيئات الجديدة والقائمة.

### Task 2: تنفيذ حساب المقاييس في مسار الرسائل

**Files:**
- Modify: `src/bot.ts`

**Changes:**
- عند وصول رسالة في محادثة غير خاصة، إدخال حدث في `message_events` إذا كان `ctx.from?.id` موجودًا.
- داخل transaction، تحديث `analytics.messages_count`، ثم حساب `active_users` عبر `COUNT(DISTINCT user_id)` لذلك اليوم.
- حساب `peak_hour` من `EXTRACT(HOUR FROM sent_at)` باستخدام المنطقة الزمنية المحددة في `APP_TIMEZONE` أو UTC عند عدم وجودها.
- عدم إرسال رد تشخيصي لكل رسالة في الإنتاج؛ إبقاء السلوك الحالي دون تغيير إلا إذا كان الرد موجودًا بالفعل في المشروع.
- عدم اعتبار الرسائل التي لا تملك مستخدمًا معروفًا ضمن active users، مع استمرار عدّها في messages_count.

### Task 3: إضافة استعلامات API ومؤشرات Engagement

**Files:**
- Modify: `src/bot.ts`
- Modify: `public/miniapp/app.js`
- Modify: `public/miniapp/index.html`
- Modify: `public/miniapp/style.css`

**Changes:**
- توسيع `/api/stats/:userId` ليعيد لكل مجموعة `messages`, `activeUsers`, `peakHour`, `engagement`، ويعيد إجماليًا موحدًا للحساب.
- تعريف `engagement = messages / activeUsers`، مع صفر عند عدم وجود active users، وتقريب القيمة إلى منزلتين عشريتين.
- عرض المقاييس الجديدة في Mini App مع تسميات واضحة وعدم كسر العرض الحالي.
- إضافة صياغة مناسبة للساعة وعدم عرض `null` للمستخدم.

### Task 4: الاختبارات والتحقق

**Files:**
- Create: `tests/analytics-metrics.test.ts` أو اختبار وحدات مناسب حسب البنية المتاحة.
- Modify: `README.md`

**Checks:**
- اختبار أن مستخدمًا يرسل رسالتين في اليوم نفسه يُحسب مرة واحدة في active_users.
- اختبار أن رسائل ساعتين مختلفتين تنتج peak_hour المتوقعة.
- اختبار engagement عند active_users يساوي صفرًا وعند وجود مستخدمين.
- تشغيل `npm run build`، وأي test script متاح، ومراجعة `git diff` و`git status`.
- تحديث README بخطوات تطبيق migration ومتغير `APP_TIMEZONE`.

### Task 5: التسليم إلى GitHub

- إنشاء commit واضح بعد نجاح التحقق.
- دفع الفرع إلى GitHub فقط بعد مراجعة diff وعدم وجود أسرار.
- عدم تنفيذ نشر أو تغيير إعدادات الاستضافة تلقائيًا؛ تسليم migration وتعليمات التشغيل للمشروع الحقيقي.
