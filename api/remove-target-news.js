const TARGET_HINT = 'تجارب تفاعلية تجعل التعلم لحظات لا تنسى';
const ISSUE_IDS = ['mtobaudwizkmi','mtyhb1jhe2ybo'];

function creds(){
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  };
}
async function cmd(url, token, command){
  const r = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command)});
  const j = await r.json();
  if(!r.ok || j.error) throw new Error(j.error || String(r.status));
  return j.result;
}
function norm(s){
  return String(s||'')
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
    .replace(/[أإآ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ة/g,'ه')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g,' ')
    .trim();
}
const TARGET = norm(TARGET_HINT);
function has(x){
  if(typeof x==='string') return norm(x).includes(TARGET);
  if(Array.isArray(x)) return x.some(has);
  if(x && typeof x==='object') return Object.values(x).some(has);
  return false;
}
function candidates(x,path='root',out=[]){
  if(Array.isArray(x)){
    x.forEach((v,i)=>{ if(has(v)) out.push({parent:x,index:i,path:`${path}[${i}]`}); else candidates(v,`${path}[${i}]`,out); });
  } else if(x && typeof x==='object') Object.entries(x).forEach(([k,v])=>candidates(v,`${path}.${k}`,out));
  return out;
}
module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  const {url,token}=creds();
  if(!url||!token) return res.status(500).json({error:'KV unavailable'});
  try{
    const matches=[];
    const loaded=[];
    for(const id of ISSUE_IDS){
      const key=`arabicmag:issue:${id}`;
      const raw=await cmd(url,token,['GET',key]);
      if(!raw) continue;
      const issue=JSON.parse(raw);
      loaded.push({id,key,issue});
      for(const c of candidates(issue)) matches.push({id,key,issue,...c});
    }
    if(matches.length!==1){
      return res.status(409).json({error:'exactly one matching news item required; no data changed',count:matches.length,matches:matches.map(m=>({issueId:m.id,path:m.path}))});
    }
    const hit=matches[0];
    const before={id:hit.issue.id,status:hit.issue.status,title:hit.issue.title,week:hit.issue.week,date:hit.issue.date};
    hit.parent.splice(hit.index,1);
    if(has(hit.issue)) return res.status(409).json({error:'target remains after planned removal; no data changed'});
    await cmd(url,token,['SET',hit.key,JSON.stringify(hit.issue)]);
    const verifyRaw=await cmd(url,token,['GET',hit.key]);
    const verify=JSON.parse(verifyRaw);
    if(has(verify) || verify.id!==before.id || verify.status!==before.status) throw new Error('verification failed');
    return res.status(200).json({ok:true,removed:'requested news item only',issueId:hit.id,path:hit.path,preserved:before});
  }catch(e){ return res.status(500).json({error:String(e.message||e)}); }
};
