import { createHash } from 'node:crypto';
import { HEADERS, STATES, validDate, malaysiaToday } from '../../../public/history-core.mjs';
export { HEADERS };
export const LIMIT_ROWS = 10000;
const fail = message => { throw Error(message); };
export function normalizeDate(value, date1904=false) {
 if (value===null || value===undefined || value==='') return '';
 if (typeof value==='number') {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value<0 || (!date1904 && value===60)) fail('Tarikh Excel tidak sah atau mempunyai masa.');
  const base = date1904 ? Date.UTC(1904,0,1) : Date.UTC(1899,11,31);
  const days = date1904 ? value : value>60 ? value-1 : value;
  value = new Date(base+days*86400000).toISOString().slice(0,10);
 }
 if (typeof value!=='string') fail('Format tarikh tidak sah.');
 value=value.trim();
 // Older starter exports stored ISO midnight strings instead of numeric Excel dates.
 if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value)) value=value.slice(0,10);
 if (!validDate(value)) fail('Gunakan tarikh Excel atau YYYY-MM-DD yang sah.');
 return value;
}
export function normalizeRecord(input, {date1904=false,today=malaysiaToday()}={}) {
 const record = {};
 for (const key of HEADERS) {
  const value=input[key];
  if (['observation_date','event_start_date','event_end_date'].includes(key)) record[key]=normalizeDate(value,date1904);
  else {
   if (value!==null && value!==undefined && !['string','number','boolean'].includes(typeof value)) fail(key+': nilai sel tidak disokong.');
   record[key]=String(value??'').trim();
   if (record[key].length>(key==='notes'?6000:2000)) fail(key+': teks terlalu panjang.');
  }
 }
 for(const key of ['source_agency','source_document','source_url','state','disaster_type','date_basis','review_required']) if (!record[key]) fail(key+' diperlukan.');
 let url; try { url=new URL(record.source_url); } catch { fail('source_url tidak sah.'); }
 if (!['https:','http:'].includes(url.protocol) || url.username || url.password) fail('source_url mesti pautan HTTP/HTTPS tanpa kata laluan.');
 record.disaster_type=record.disaster_type.toLowerCase();
 if (!/^[a-z][a-z_ -]{0,59}$/.test(record.disaster_type)) fail('disaster_type tidak sah.');
 if (!STATES.includes(record.state)) fail('Negeri tidak dikenali; gunakan nama negeri Malaysia.');
 if (!['event_date','observation_date'].includes(record.date_basis)) fail('date_basis mesti event_date atau observation_date.');
 const flag=record.review_required.toLowerCase();
 if (!['yes','no','true','false','1','0'].includes(flag)) fail('review_required mesti yes atau no.');
 record.review_required=['yes','true','1'].includes(flag)?'yes':'no';
 if (record.date_basis==='event_date' && !record.event_start_date) fail('event_start_date diperlukan untuk event_date.');
 if (record.date_basis==='observation_date' && !record.observation_date) fail('observation_date diperlukan untuk observation_date.');
 if (record.event_end_date && (!record.event_start_date || record.event_end_date<record.event_start_date)) fail('Tarikh tamat mesti pada atau selepas tarikh mula.');
 for (const key of ['observation_date','event_start_date','event_end_date']) if(record[key] && record[key]>today) fail(key+': rekod sejarah tidak boleh bertarikh masa hadapan.');
 return record;
}
const folded = value => String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function recordKey(r) {
 return JSON.stringify(['source_url','disaster_type','state','district','location','date_basis','observation_date','event_start_date'].map(k=>folded(r[k])));
}
export const recordHash = r => createHash('sha256').update(JSON.stringify(HEADERS.map(k=>r[k]||''))).digest('hex');
export function reviewRows(rows, current=[], settings={}) {
 if (!Array.isArray(rows)||!rows.length||rows.length>LIMIT_ROWS) fail('Fail mesti mengandungi 1–10,000 rekod.');
 const existing = new Map(current.map(r=>[recordKey(r),r]));
 const accepted=[],held=[],issues=[]; let duplicates=0,invalid=0;
 for (let i=0;i<rows.length;i++) {
  const row=rows[i],number=row.rowNumber||i+2;
  let record;
  try { if(row.cellError) fail(row.cellError); record=normalizeRecord(row.record||row,settings); }
  catch(e) {invalid++;issues.push({row:number,status:'invalid',reason:e.message});continue;}
  const key=recordKey(record),old=existing.get(key);
  if (record.review_required==='yes') {
   held.push(record);issues.push({row:number,status:'held',reason:'Ditandakan review_required=yes dalam Excel.'});continue;
  }
  if(old) {
   if(recordHash(old)===recordHash(record)) {duplicates++;issues.push({row:number,status:'duplicate',reason:'Rekod yang sama sudah wujud.'});}
   else {held.push({...record,review_required:'yes'});issues.push({row:number,status:'held',reason:'Maklumat berbeza untuk rekod yang sama. Rekod sedia ada dikekalkan.'});}
   continue;
  }
  accepted.push(record);existing.set(key,record);
 }
 return {accepted,held,issues,counts:{total:rows.length,accepted:accepted.length,held:held.length,duplicates,invalid}};
}
export function summary(records) {
 const dates=records.map(r=>r.date_basis==='event_date'?r.event_start_date:r.observation_date).filter(Boolean).sort();
 return {count:records.length,from:dates[0]||null,to:dates.at(-1)||null,states:[...new Set(records.map(r=>r.state))].sort(),coverage:'partial'};
}
// Keep stored originals intact; expose uncertain entries with their flags and notes.
// Same-source/location/date alternatives share one card, rather than inflating counts.
export function publishedRecords(snapshot) {
 const records=new Map();
 for(const record of [...snapshot.records,...(snapshot.review||[])]) {
  const key=recordKey(record),old=records.get(key);
  if(!old){records.set(key,{...record});continue;}
  const same=recordHash({...old,review_required:'no'})===recordHash({...record,review_required:'no'});
  if(!same) {
   const detail=[record.source_document,record.source_page&&'Halaman: '+record.source_page,
    record.observation_date&&'Pemerhatian: '+record.observation_date,
    record.event_start_date&&'Mula: '+record.event_start_date,
    record.event_end_date&&'Tamat: '+record.event_end_date,record.notes].filter(Boolean).join(' · ');
   const note='Maklumat alternatif belum disahkan: '+detail;
   if(!old.notes.includes(note))old.notes+=(old.notes?'\n':'')+note;
  }
  if(!same||record.review_required==='yes')old.review_required='yes';
 }
 return [...records.values()];
}
