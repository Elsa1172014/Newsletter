const TARGET = 'تجارب تفاعلية تجعل التعلم لحظات لا تُنسى';
const ISSUE_ID = 'mtyhb1jhe2ybo';

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
function has(x){
  if(typeof x==='string') return x.includes(TARGET);
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
  const key=`arabicmag:issue:${ISSUE_ID}`;
  try{
    const raw=await cmd(url,token,['GET',key]);
    if(!raw) return res.status(404).json({error:'issue missing'});
    const issue=JSON.parse(raw);
    const found=candidates(issue);
    if(found.length!==1) return res.status(409).json({error:'exactly one match required',matches:found.map(x=>x.path)});
    const before={id:issue.id,status:issue.status,title:issue.title,week:issue.week,date:issue.date};
    const hit=found[0];
    hit.parent.splice(hit.index,1);
    if(has(issue)) return res.status(409).json({error:'target remains; nothing saved'});
    await cmd(url,token,['SET',key,JSON.stringify(issue)]);
    const verifyRaw=await cmd(url,token,['GET',key]);
    const verify=JSON.parse(verifyRaw);
    if(has(verify) || verify.id!==before.id || verify.status!==before.status) throw new Error('verification failed');
    return res.status(200).json({ok:true,removed:TARGET,path:hit.path,preserved:before});
  }catch(e){ return res.status(500).json({error:String(e.message||e)}); }
};
