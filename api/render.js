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

  const visitorArchivePatch = `
<script>
(function(){
  document.addEventListener('click', async function(e){
    const btn = e.target && e.target.closest ? e.target.closest('#visitorBtn') : null;
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{
      DB.role = 'visitor';
      const all = await loadAllIssues();
      DB.issues = all.filter(iss => !iss.status || iss.status === 'published');
      DB.currentIssue = null;
      DB.view = 'archive';
      render();
    }catch(err){
      console.error(err);
      DB.role = 'visitor';
      DB.issues = [];
      DB.currentIssue = null;
      DB.view = 'archive';
      render();
    }
  }, true);
})();
</script>`;

  if (!html.includes('visitorArchivePatchApplied')) {
    html = html.replace('</body>', '<!-- visitorArchivePatchApplied -->' + visitorArchivePatch + '\n</body>');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
