// Vercel Serverless Function — /api/kv
// Reliable Upstash Redis REST wrapper.
// Uses JSON command bodies so large newsletter payloads are NOT placed in the URL.

function getCreds(){
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

async function redisCommand(url, token, command){
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  const data = await upstream.json().catch(()=>({}));
  if(!upstream.ok || data.error){
    throw new Error(data.error || `Redis request failed (${upstream.status})`);
  }
  return data.result;
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
      const result = await redisCommand(url, token, ['GET', key]);
      if (result === null || result === undefined) {
        res.status(404).json({ error: 'غير موجود' });
        return;
      }
      res.status(200).json({ key, value: result });
      return;
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) { res.status(400).json({ error: 'الحقل key مفقود' }); return; }
      if (value === undefined) { res.status(400).json({ error: 'الحقل value مفقود' }); return; }
      await redisCommand(url, token, ['SET', key, String(value)]);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const key = req.query.key;
      if (!key) { res.status(400).json({ error: 'الحقل key مفقود' }); return; }
      await redisCommand(url, token, ['DEL', key]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'الطريقة غير مسموحة — استخدم GET أو POST أو DELETE' });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
};
