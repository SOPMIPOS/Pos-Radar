const URL_DEFAULT='https://orbevdrvkmnddkzuqiuj.supabase.co';
const PUBLIC_DEFAULT='sb_publishable_5ybYDImMD1M_5JoHVhCOJg_QM388v0X';
export function createHandler({env=process.env,request=fetch}={}){
 return async req=>{
  const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  try{
   if(req.method!=='DELETE')return respond({error:'Kaedah tidak dibenarkan.'},405);
   const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return respond({error:'Permintaan tidak dibenarkan.'},403);
   const token=req.headers.get('authorization');if(!/^Bearer [^\s]+$/i.test(token||''))return respond({error:'Sila log masuk.'},401);
   const text=await req.text();if(Buffer.byteLength(text)>2000)return respond({error:'Permintaan terlalu besar.'},413);
   let body;try{body=JSON.parse(text);}catch{return respond({error:'Maklumat tidak sah.'},400);}
   const id=body?.id,version=body?.version;
   if(typeof id!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)||!Number.isSafeInteger(version)||version<1)return respond({error:'ID atau versi laporan tidak sah.'},400);
   const root=(env.SUPABASE_URL||URL_DEFAULT).replace(/\/$/,''),pub=env.SUPABASE_PUBLISHABLE_KEY||PUBLIC_DEFAULT,secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
   if(!secret)return respond({error:'Fungsi padam laporan belum disambungkan di Netlify.'},503);
   const api=async(path,{method='GET',body,caller=false,prefer}={})=>{
    const r=await request(root+path,{method,headers:{apikey:caller?pub:secret,Authorization:caller?token:'Bearer '+secret,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000),redirect:'error'});
    let data=null;try{data=await r.json();}catch{}return {ok:r.ok,status:r.status,data};
   };
   const identity=await api('/auth/v1/user',{caller:true});if(!identity.ok||!identity.data?.id)return respond({error:'Sesi tamat. Sila log masuk semula.'},401);
   const existing=await api('/rest/v1/operation_reports?id=eq.'+id+'&select=id,branch,version');
   if(!existing.ok)return respond({error:'Laporan tidak dapat disemak.'},502);
   const report=existing.data?.[0];if(!report)return respond({error:'Laporan sudah dipadam. Muat semula senarai.'},404);
   // Ask the protected database function using the caller's JWT, never client-supplied scope.
   const allowed=await api('/rest/v1/rpc/reporting_can_edit',{method:'POST',caller:true,body:{branch_name:report.branch}});
   if(!allowed.ok)return respond({error:'Akses cawangan tidak dapat disemak. Cuba semula.'},503);
   if(allowed.data!==true)return respond({error:'Anda tidak dibenarkan memadam laporan cawangan ini.'},403);
   if(report.version!==version)return respond({error:'Laporan telah disunting oleh pengguna lain. Muat semula sebelum memadam.'},409);
   const removed=await api('/rest/v1/operation_reports?id=eq.'+id+'&version=eq.'+version+'&select=id,photo_path',{method:'DELETE',prefer:'return=representation'});
   if(!removed.ok)return respond({error:'Laporan gagal dipadam. Cuba semula.'},502);
   const deleted=removed.data?.[0];if(!deleted)return respond({error:'Laporan telah berubah. Muat semula sebelum memadam.'},409);
   let warning;
   if(deleted.photo_path){
    try{
     if(!new RegExp('^'+id+'/[0-9a-f-]+\\.(?:jpg|jpeg|png|webp)$','i').test(deleted.photo_path))throw Error('Invalid photo path');
     const cleaned=await api('/storage/v1/object/report-photos',{method:'DELETE',body:{prefixes:[deleted.photo_path]}});if(!cleaned.ok)throw Error('Storage unavailable');
    }catch{warning='Laporan dipadam, tetapi gambar belum dapat dibersihkan daripada Storage.';}
   }
   return respond({ok:true,id:deleted.id,...(warning?{warning}:{})});
  }catch{return respond({error:'Perkhidmatan padam laporan tidak tersedia. Muat semula senarai sebelum mencuba lagi.'},503);}
 };
}
export default createHandler();
export const config={path:'/api/report-delete'};
