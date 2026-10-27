export function createHandler({env=process.env,request=fetch}={}){
 return async req=>{
  const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const invalid=()=>respond({error:'Username atau password tidak betul, atau akaun tidak aktif.'},401);
  try{
   if(req.method!=='POST')return respond({error:'Kaedah tidak dibenarkan.'},405);
   const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return respond({error:'Permintaan tidak dibenarkan.'},403);
   const root=(env.SUPABASE_URL||'https://orbevdrvkmnddkzuqiuj.supabase.co').replace(/\/$/,'');const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;const pub=env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_5ybYDImMD1M_5JoHVhCOJg_QM388v0X';
   if(!secret)return respond({error:'Log masuk username belum dipasang. Gunakan e-mel akaun untuk log masuk.'},503);
   const raw=await req.text();if(Buffer.byteLength(raw)>10000)return invalid();let b;try{b=JSON.parse(raw);}catch{return invalid();}
   if(typeof b?.username!=='string'||!/^[-a-z0-9._]{3,40}$/.test(b.username)||typeof b.password!=='string'||!b.password||b.password.length>128)return invalid();
   const lookup=await request(root+'/rest/v1/report_profiles?username=eq.'+encodeURIComponent(b.username)+'&select=email,active',{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!lookup.ok)return invalid();const p=(await lookup.json())?.[0];
   // Send invalid identities through Auth too, so normal Auth rate limits also apply.
   const auth=await request(root+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:JSON.stringify({email:p?.active?p.email:'unknown@invalid.example',password:b.password}),signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!auth.ok||!p?.active)return invalid();const session=await auth.json();
   return respond({access_token:session.access_token,refresh_token:session.refresh_token});
  }catch{return respond({error:'Log masuk tidak tersedia. Cuba semula.'},503);}
 };
}
export default createHandler();
export const config={path:'/api/report-login',rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};
