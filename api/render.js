const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  const filePath = path.join(process.cwd(), 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');

  html = html.replace(
    'position:absolute;inset:0;display:flex;align-items:center;gap:20px;padding:22px 24px 0;',
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;padding:22px 24px 0;'
  );

  html = html.replace(
    'width:250px;height:250px;border-radius:50%;overflow:hidden;flex:none;border:4px solid var(--gold);',
    'width:300px;height:300px;border-radius:50%;overflow:hidden;flex:none;border:4px solid var(--gold);'
  );

  html = html.replace(
    '.cInfo{flex:1;min-width:0;}',
    '.cInfo{flex:1;min-width:0;width:100%;text-align:center;}'
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
