// Vercel Serverless Function — /api/generate
// يستقبل نص الطلب (prompt) من واجهة استوديو النشرة، يتصل بـ Gemini API
// (المستوى المجاني من Google) باستخدام مفتاح سري مخزَّن في إعدادات Vercel
// (لا يظهر أبدًا في المتصفح)، ويُعيد النص المُولَّد بصيغة متوافقة مع الواجهة.

const GEMINI_MODEL = "gemini-2.5-flash"; // غيّر هذا السطر فقط إن رغبت باستخدام موديل Gemini آخر لاحقًا

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة — استخدم POST' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY غير معرّف. أضفه من Vercel → Project Settings → Environment Variables'
    });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'الحقل prompt مفقود أو غير صالح' });
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000 }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: data?.error?.message || 'فشل الاتصال بـ Gemini API'
      });
      return;
    }

    // نعيد الاستجابة بنفس الصيغة التي تتوقعها الواجهة (content: [{text: ...}])
    // حتى لا نحتاج لتعديل أي كود في index.html
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    if (!text) {
      res.status(502).json({ error: 'استجابة Gemini لم تحتوِ على نص — قد يكون المحتوى محجوبًا بواسطة فلاتر الأمان' });
      return;
    }

    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
