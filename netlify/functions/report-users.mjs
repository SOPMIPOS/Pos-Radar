const URL_DEFAULT='https://orbevdrvkmnddkzuqiuj.supabase.co';
const PUBLIC_DEFAULT='sb_publishable_5ybYDImMD1M_5JoHVhCOJg_QM388v0X';
export function createHandler({env=process.env,request=fetch}={}){
 return async req=>{
  const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
  try{
   const root=(env.SUPABASE_URL||URL_DEFAULT).replace(/\/$/,'');const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;const pub=env.SUPABASE_PUBLISHABLE_KEY||PUBLIC_DEFAULT;
   if(!secret)return respond({error:'Pengurusan pengguna belum disambungkan. Admin perlu menetapkan SUPABASE_SECRET_KEY dalam Netlify.'},503);
   if(!['GET','POST','PATCH','DELETE'].includes(req.method))return respond({error:'Kaedah tidak dibenarkan.'},405);
   const origin=req.headers.get('origin');if(origin&&origin!==new globalThis.URL(req.url).origin)return respond({error:'Permintaan tidak dibenarkan.'},403);
   const token=req.headers.get('authorization');if(!/^Bearer [^\s]+$/i.test(token||''))return respond({error:'Sila log masuk.'},401);
   const api=async(path,{method='GET',body,publicKey=false,bearer,prefer}={})=>{
    const key=publicKey?pub:secret;
    const r=await request(root+path,{method,headers:{apikey:key,Authorization:bearer||'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    let data;try{data=await r.json();}catch{data=null;}return {ok:r.ok,status:r.status,data};
   };
   const identity=await api('/auth/v1/user',{publicKey:true,bearer:token});if(!identity.ok||!identity.data?.id)return respond({error:'Sesi tamat. Sila log masuk semula.'},401);
   const callerId=identity.data.id;
   const authz=await api('/rest/v1/report_profiles?id=eq.'+encodeURIComponent(callerId)+'&select=id,role,active');if(!authz.ok)fail('Tidak dapat menyemak akses.',503);
   if(!authz.data?.[0]?.active||authz.data[0].role!=='admin')return respond({error:'Akses admin diperlukan.'},403);
   if(req.method==='GET'){const r=await api('/rest/v1/report_profiles?select=id,email,name,username,role,branch,active,created_at&order=name');if(!r.ok)fail('Pengguna tidak dapat dimuatkan.',502);return respond({users:r.data});}
   const raw=await req.text();if(Buffer.byteLength(raw)>20000)fail('Permintaan terlalu besar.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Maklumat tidak sah.');}if(!body||Array.isArray(body)||typeof body!=='object')fail('Maklumat tidak sah.');
   const clean=(v,label,max=120)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(label+' tidak sah.');return v.trim();};
   let existing;
   if(req.method!=='POST'){
    const id=clean(body.id,'ID',36);if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))fail('ID tidak sah.');
    const r=await api('/rest/v1/report_profiles?id=eq.'+id+'&select=*');if(!r.ok)fail('Pengguna tidak dapat disemak.',502);existing=r.data?.[0];if(!existing)fail('Pengguna tidak dijumpai.',404);
    if(req.method==='DELETE'){
     if(id===callerId)fail('Akaun yang sedang digunakan tidak boleh dipadam.');
     const inactive=await api('/rest/v1/report_profiles?id=eq.'+id,{method:'PATCH',body:{active:false}});if(!inactive.ok)fail('Akaun tidak boleh dipadam. Pastikan sekurang-kurangnya seorang admin aktif dikekalkan.');
     const removed=await api('/auth/v1/admin/users/'+id,{method:'DELETE'});if(!removed.ok)fail('Akaun telah dinyahaktifkan tetapi belum dipadam. Ia mungkin masih memiliki gambar dalam Storage. Hubungi admin projek.',502);
     return respond({ok:true});
    }
   }
   const name=clean(body.name,'Nama'),username=clean(body.username,'Username',40).toLowerCase();if(!/^[-a-z0-9._]{3,40}$/.test(username))fail('Username mesti 3–40 aksara: huruf kecil, nombor, titik, sengkang atau garis bawah.');
   const role=body.role;if(!['admin','staff'].includes(role))fail('Pilih Admin atau User.');if(typeof body.active!=='boolean')fail('Status akaun tidak sah.');
   const branch=role==='admin'?null:clean(body.branch,'Cawangan');
   if(branch){const r=await api('/rest/v1/report_branches?name=eq.'+encodeURIComponent(branch)+'&select=name');if(!r.ok||!r.data?.length)fail('Pilih cawangan yang disenaraikan.');}
   const duplicate=await api('/rest/v1/report_profiles?username=eq.'+encodeURIComponent(username)+'&select=id');if(!duplicate.ok)fail('Username tidak dapat disemak.',502);if(duplicate.data?.some(u=>u.id!==existing?.id))fail('Username telah digunakan.');
   const password=body.password;if(password!==undefined&&(typeof password!=='string'||password.length<12||password.length>128))fail('Password mesti 12–128 aksara.');
   if(req.method==='POST'){
    const email=clean(body.email,'E-mel',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)fail('Masukkan e-mel dan password.');
    const created=await api('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});if(!created.ok||!created.data?.id)fail('Akaun gagal dicipta. E-mel mungkin telah digunakan atau password ditolak.');
    const id=created.data.id;
    const saved=await api('/rest/v1/report_profiles',{method:'POST',body:{id,email,name,username,role,branch,active:body.active}});
    if(!saved.ok){const cleanup=await api('/auth/v1/admin/users/'+id,{method:'DELETE'});fail(cleanup.ok?'Profil gagal disimpan; akaun baharu dibatalkan.':'Profil gagal disimpan. Semak akaun baharu dalam Supabase Authentication.',502);}
    return respond({ok:true,id},201);
   }
   if(existing.id===callerId&&(role!=='admin'||!body.active))fail('Akaun yang sedang digunakan mesti kekal Admin aktif.');
   const saved=await api('/rest/v1/report_profiles?id=eq.'+existing.id,{method:'PATCH',body:{name,username,role,branch,active:body.active}});if(!saved.ok)fail('Profil gagal dikemas kini. Pastikan admin aktif terakhir dikekalkan.');
   if(password){const changed=await api('/auth/v1/admin/users/'+existing.id,{method:'PUT',body:{password}});if(!changed.ok)fail('Profil telah disimpan tetapi password gagal dikemas kini.',502);}
   return respond({ok:true});
  }catch(e){return respond({error:e.status?e.message:'Perkhidmatan tidak tersedia. Cuba semula.'},e.status||503);}
 };
}
export default createHandler();
export const config={path:'/api/report-users'};
