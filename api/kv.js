// Vercel Serverless Function — /api/kv
// بديل حقيقي لـ window.storage (التي لا تعمل إلا داخل بيئة معاينة Claude.ai
// ولا وجود لها في أي موقع منشور فعليًا — هذا كان سبب فقدان كل البيانات).
//
// يتصل مباشرة عبر REST بقاعدة بيانات Upstash Redis (بديل Vercel KV الذي
// تم إيقافه) — بلا أي مكتبة خارجية، فقط fetch عادي، لتفادي الاعتماد على
// حزمة قد تتوقف صيانتها لاحقًا.

function getCreds(){
  // يدعم كِلا مسمّيَي متغيرات البيئة، لأن نوع التكامل (Upstash عبر
  // Marketplace) قد يضيف أيًا من الاسمين حسب وقت الربط.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

module.exports = async function handler(req, res) {
  const { url, token } = getCreds();
  if (!url || !token) {
    res.status(500).json({
      error: 'لم يتم العثور على بيانات اتصال قاعدة البيانات. تأكد من إنشاء قاعدة Upstash Redis من Vercel Marketplace وربطها بالمشروع، ثم أعد النشر (Redeploy).'
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const key = req.query.key;
      if (!key) { res.status(400).json({ error: 'الحقل key مفقود' }); return; }
      const upstream = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await upstream.json();
      if (!upstream.ok || data.result === null || data.result === undefined) {
        res.status(404).json({ error: 'غير موجود' });
        return;
      }
      res.status(200).json({ key, value: data.result });
      return;
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) { res.status(400).json({ error: 'الحقل key مفقود' }); return; }
      const upstream = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(()=>({}));
        res.status(upstream.status).json({ error: data.error || 'فشل الحفظ في قاعدة البيانات' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const key = req.query.key;
      if (!key) { res.status(400).json({ error: 'الحقل key مفقود' }); return; }
      const upstream = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(()=>({}));
        res.status(upstream.status).json({ error: data.error || 'فشل الحذف من قاعدة البيانات' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'الطريقة غير مسموحة — استخدم GET أو POST أو DELETE' });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
};
