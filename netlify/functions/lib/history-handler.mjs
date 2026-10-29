import { randomUUID } from 'node:crypto';
import { readHistoricalWorkbook, MAX_FILE_BYTES } from './history-xlsx.mjs';
import { reviewRows, recordHash, recordKey, summary, publishedRecords } from './history-validation.mjs';
const DEFAULT_URL='https://orbevdrvkmnddkzuqiuj.supabase.co';
const DEFAULT_PUBLIC='sb_publishable_5ybYDImMD1M_5JoHVhCOJg_QM388v0X';
const KEY='historical-events-v1', TTL=3600000;
export function createHistoryHandler({getStore,seed,env=process.env,request=fetch,clock=()=>Date.now(),readWorkbook=readHistoricalWorkbook}) {
 return async req=>{
  const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
  try {
   if(!['GET','POST'].includes(req.method))return respond({error:'Kaedah tidak dibenarkan.'},405);
   const url=new URL(req.url),action=url.searchParams.get('action')||'';
   // Admin authentication happens before reading or parsing uploaded bytes.
   let caller;
   if(req.method==='POST'||action==='admin') {
    const origin=req.headers.get('origin');if(origin&&origin!==url.origin)fail('Permintaan tidak dibenarkan.',403);
    const token=req.headers.get('authorization');if(!/^Bearer [^\s]+$/i.test(token||''))fail('Sila log masuk.',401);
    const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)fail('Sambungan admin belum tersedia.',503);
    const root=(env.SUPABASE_URL||DEFAULT_URL).replace(/\/$/,'');
    const identity=await request(root+'/auth/v1/user',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY||DEFAULT_PUBLIC,Authorization:token},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!identity.ok)fail('Sesi tamat. Sila log masuk semula.',401);
    const user=await identity.json();if(!user?.id)fail('Sesi tidak sah.',401);
    const result=await request(root+'/rest/v1/report_profiles?id=eq.'+encodeURIComponent(user.id)+'&select=id,username,name,role,active',{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!result.ok)fail('Akses tidak dapat disemak.',503);
    caller=(await result.json())?.[0];if(!caller?.active||caller.role!=='admin')fail('Akses admin aktif diperlukan.',403);
   }
   const store=getStore({name:'pantau-cawangan-history',consistency:'strong'});
   const stored=await store.getWithMetadata(KEY,{type:'json'}),current=stored?.data||seed;
   if(!current?.records||!current.revision)fail('Data sejarah tidak dapat dibaca.',503);
   const visible=publishedRecords(current);
   const meta={revision:current.revision,updatedAt:current.updatedAt,updatedBy:current.updatedBy,summary:summary(visible),reviewCount:visible.filter(r=>r.review_required==='yes').length};
   if(req.method==='GET')return respond({...meta,records:visible,...(action==='admin'?{review:current.review||[]}:{}),coverageNote:'Liputan separa. Rekod berflag belum disahkan. Tiada rekod bukan bermakna tiada bencana.'});
   const length=Number(req.headers.get('content-length'));if(length>MAX_FILE_BYTES)fail('Pilih fail .xlsx sehingga 2 MB.',413);
   // Bound the stream even when Content-Length is absent or inaccurate.
   const reader=req.body?.getReader();if(!reader)fail('Fail atau permintaan kosong.');
   const chunks=[];let size=0;
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE_BYTES){await reader.cancel();fail('Pilih fail .xlsx sehingga 2 MB.',413);}chunks.push(Buffer.from(value));}
   const bytes=Buffer.concat(chunks);
   if(action==='preview') {
    if(!/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream/.test(req.headers.get('content-type')||''))fail('Pilih fail .xlsx.');
    let workbook;try{workbook=await readWorkbook(bytes);}catch(e){fail(e.message);}
    const review=reviewRows(workbook.rows,current.records,{date1904:workbook.date1904});
    const previewId=randomUUID(),draft={...review,owner:caller.id,revision:current.revision,createdAt:clock(),filename:decodeURIComponent(req.headers.get('x-file-name')||'historical.xlsx').slice(0,180)};
    await store.setJSON('draft/'+previewId,draft);
    return respond({previewId,revision:current.revision,expiresAt:clock()+TTL,counts:review.counts,issues:review.issues,acceptedSample:review.accepted.slice(0,10),heldSample:review.held.slice(0,10),summary:summary(review.accepted)});
   }
   if(action!=='confirm')fail('Tindakan tidak dikenali.');
   let body;try{body=JSON.parse(bytes.toString());}catch{fail('Permintaan tidak sah.');}
   if(!/^[0-9a-f-]{36}$/.test(body?.previewId||''))fail('Pratonton tidak sah.');
   const draft=await store.get('draft/'+body.previewId,{type:'json'});
   if(!draft||draft.owner!==caller.id)fail('Pratonton tidak dijumpai.',404);
   if(clock()-draft.createdAt>TTL)fail('Pratonton tamat tempoh. Pilih fail semula.',410);
   if(draft.revision!==current.revision||body.revision!==current.revision)fail('Data telah berubah. Pratonton fail semula sebelum mengesahkan.',409);
   if(!draft.accepted.length&&!draft.held.length)fail('Tiada rekod baharu atau rekod semakan untuk disimpan.');
   if(current.records.length+draft.accepted.length>50000)fail('Had 50,000 rekod dicapai. Hubungi pentadbir projek.',413);
   const records=[...current.records,...draft.accepted],approved=new Set(draft.accepted.map(recordKey));
   const held=new Map([...(current.review||[]).filter(r=>!approved.has(recordKey(r))),...draft.held].map(r=>[recordHash(r),r]));
   if(held.size>10000)fail('Had rekod semakan dicapai. Semak fail sebelum mengimport.',413);
   const revision=randomUUID(),snapshot={revision,records,review:[...held.values()],updatedAt:new Date(clock()).toISOString(),updatedBy:caller.username||caller.name||caller.id,coverage:'partial',lastImport:{filename:draft.filename,counts:draft.counts}};
   if(Buffer.byteLength(JSON.stringify(snapshot))>4*1024*1024)fail('Set data melebihi had saiz. Hubungi penyelenggara sebelum mengimport lagi.',413);
   if(stored&&!stored.etag)fail('Versi simpanan tidak dapat disahkan. Muat semula sebelum mengimport.',503);
   // Keep the previous version for recovery; publish with a compare-and-swap write.
   await store.setJSON('versions/'+current.revision,current);
   const written=await store.setJSON(KEY,snapshot,stored?{onlyIfMatch:stored.etag}:{onlyIfNew:true});
   if(!written.modified)fail('Admin lain telah mengimport data. Pratonton semula fail anda.',409);
   // Confirm durable state rather than trusting a write acknowledgement alone.
   const check=await store.get(KEY,{type:'json'});if(check?.revision!==revision)fail('Simpanan belum dapat disahkan. Muat semula status sebelum mencuba lagi.',503);
   await store.delete('draft/'+body.previewId).catch(()=>{});
   const published=publishedRecords(snapshot);
   return respond({ok:true,revision,counts:draft.counts,summary:summary(published),reviewCount:published.filter(r=>r.review_required==='yes').length,updatedAt:snapshot.updatedAt,updatedBy:snapshot.updatedBy});
  }catch(e){return respond({error:e.status?e.message:'Perkhidmatan sejarah tidak tersedia. Cuba semula.'},e.status||503);}
 };
}
