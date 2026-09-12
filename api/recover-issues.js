// Temporary recovery endpoint: scans Redis for orphaned newsletter issues and repairs the index.
// Safe behavior: never deletes or overwrites issue records; it only adds discovered issue IDs to the archive index.

function getCreds(){
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}
async function cmd(url, token, command){
  const r = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command)});
  const data = await r.json();
  if(!r.ok || data.error) throw new Error(data.error || `Redis command failed (${r.status})`);
  return data.result;
}
module.exports = async function handler(req,res){
  const {url,token}=getCreds();
  if(!url || !token){ res.status(500).json({error:'Missing Redis credentials'}); return; }
  try{
    const prefix='arabicmag:issue:'; let cursor='0'; const keys=[];
    do{ const result=await cmd(url,token,['SCAN',cursor,'MATCH',prefix+'*','COUNT','200']); cursor=String(result?.[0]??'0'); keys.push(...(Array.isArray(result?.[1])?result[1]:[])); }while(cursor!=='0');
    const discovered=[];
    for(const key of keys){ try{ const raw=await cmd(url,token,['GET',key]); if(!raw) continue; const issue=JSON.parse(raw); discovered.push({id:issue.id||key.slice(prefix.length),key,title:issue?.meta?.title||'',week:issue?.meta?.week||'',date:issue?.meta?.date||'',status:issue?.status||'draft',createdAt:issue?.createdAt||''}); }catch(e){} }
    let existing=[]; try{ const raw=await cmd(url,token,['GET','arabicmag:index']); existing=raw?JSON.parse(raw):[]; if(!Array.isArray(existing)) existing=[]; }catch(e){ existing=[]; }
    const foundIds=discovered.map(x=>x.id).filter(Boolean);
    const missingIndexIds=existing.filter(id=>!foundIds.includes(id));
    const recoveredIds=foundIds.filter(id=>!existing.includes(id));
    const repaired=[...existing]; for(const id of foundIds) if(!repaired.includes(id)) repaired.push(id);
    if(recoveredIds.length) await cmd(url,token,['SET','arabicmag:index',JSON.stringify(repaired)]);
    discovered.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    res.status(200).json({ok:true,existingCount:existing.length,existingIds:existing,discoveredCount:discovered.length,missingIndexIds,recoveredCount:recoveredIds.length,recoveredIds,issues:discovered});
  }catch(err){ res.status(500).json({error:String(err?.message||err)}); }
};
