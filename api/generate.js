// Vercel Serverless Function — /api/generate
// يستقبل نص الطلب (prompt) من واجهة استوديو النشرة، يتصل بـ Claude API
// باستخدام مفتاح سري مخزَّن في إعدادات Vercel (لا يظهر أبدًا في المتصفح)،
// ويُعيد استجابة Claude كما هي.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة — استخدم POST' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'ANTHROPIC_API_KEY غير معرّف. أضفه من Vercel → Project Settings → Environment Variables'
    });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'الحقل prompt مفقود أو غير صالح' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: data?.error?.message || 'فشل الاتصال بـ Claude API'
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
