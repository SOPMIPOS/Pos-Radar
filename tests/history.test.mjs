import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { HEADERS,rollingDates,previousYear,recordsForDay,malaysiaToday } from '../public/history-core.mjs';
import { normalizeDate,normalizeRecord,reviewRows,recordKey } from '../netlify/functions/lib/history-validation.mjs';
import { readHistoricalWorkbook } from '../netlify/functions/lib/history-xlsx.mjs';
import { createHistoryHandler } from '../netlify/functions/lib/history-handler.mjs';
import seed from '../netlify/functions/lib/history-seed.mjs';
const base={source_agency:'NADMA',source_document:'Dated report',source_url:'https://example.gov.my/report.pdf',source_page:'2',observation_date:'',event_start_date:'2025-11-01',event_end_date:'',disaster_type:'flood',state:'Selangor',district:'Klang',location:'Area A',date_basis:'event_date',notes:'Documented location',review_required:'no'};
const opts={today:'2026-10-29'};
test('Malaysia calendar rolls over at local midnight, not host midnight',()=>{
 assert.equal(malaysiaToday(new Date('2026-12-31T16:00:00Z')),'2027-01-01');
 const dates=rollingDates('2026-12-20');assert.equal(dates.length,30);assert.equal(dates[29],'2027-01-18');
 assert.equal(previousYear('2027-01-01'),'2026-01-01');
 assert.equal(previousYear('2024-02-29'),null);
 assert.equal(previousYear('2025-02-28'),'2024-02-28');
});
test('historical matching uses correct previous year and inclusive event intervals',()=>{
 const interval={...base,event_start_date:'2025-12-30',event_end_date:'2026-01-02'};
 assert.equal(recordsForDay([interval],'2027-01-01').length,1);
 assert.equal(recordsForDay([interval],'2026-12-31').length,1);
 assert.equal(recordsForDay([interval],'2027-01-03').length,0);
 assert.equal(recordsForDay([interval],'2027-01-01','Sarawak').length,0);
 assert.equal(recordsForDay([interval],'2027-01-01','','earthquake').length,0);
 assert.equal(recordsForDay([{...base,event_start_date:'2024-11-01'}],'2026-11-01').length,0);
});
test('observation records only match their observation day, never inferred event spans',()=>{
 const row={...base,date_basis:'observation_date',observation_date:'2025-11-02',event_start_date:'2025-11-01'};
 assert.equal(recordsForDay([row],'2026-11-01').length,0);assert.equal(recordsForDay([row],'2026-11-02').length,1);
});
test('Excel date systems, ISO starter strings, blanks and ambiguous dates',()=>{
 assert.equal(normalizeDate(1),'1900-01-01');assert.equal(normalizeDate(61),'1900-03-01');
 assert.equal(normalizeDate(0,true),'1904-01-01');assert.equal(normalizeDate(45292),'2024-01-01');
 assert.equal(normalizeDate('2025-11-01T00:00:00.000Z'),'2025-11-01');assert.equal(normalizeDate(''),'');
 for(const bad of ['01/02/2025','2025-02-29',60,45292.5,'2025-01-01T08:00:00Z'])assert.throws(()=>normalizeDate(bad));
});
test('validation preserves geographic blanks and refuses invented/unsafe field values',()=>{
 assert.equal(normalizeRecord({...base,location:'',district:''},opts).district,'');
 assert.throws(()=>normalizeRecord({...base,source_url:'javascript:alert(1)'},opts));
 assert.throws(()=>normalizeRecord({...base,event_end_date:'2024-01-01'},opts));
 assert.throws(()=>normalizeRecord({...base,event_start_date:'2027-01-01'},opts));
 assert.throws(()=>normalizeRecord({...base,review_required:'maybe'},opts));
 assert.throws(()=>normalizeRecord({...base,state:'Unknown'},opts));
 assert.throws(()=>normalizeRecord({...base,date_basis:'publication_date'},opts));
});
test('append only: exact duplicates skipped, conflicts held, flags held, invalid rejected',()=>{
 const rows=[base,{...base,notes:'Different account'}, {...base,location:'Area B'}, {...base,location:'Area B'}, {...base,location:'Area C',review_required:'yes'}, {...base,source_url:'bad'}];
 const result=reviewRows(rows,[base],opts);
 assert.deepEqual(result.counts,{total:6,accepted:1,held:2,duplicates:2,invalid:1});
 assert.equal(result.held[0].review_required,'yes');assert.equal(base.notes,'Documented location');
});
test('initial workbook parses to all 1047 records, 1017 published and 30 held',async()=>{
 const workbook=await readHistoricalWorkbook(readFileSync(new URL('../admin-data/Malaysia-Historical-Disaster-Starter.xlsx',import.meta.url)));
 const result=reviewRows(workbook.rows,[],{...opts,date1904:workbook.date1904});
 assert.deepEqual(result.counts,{total:1047,accepted:1017,held:30,duplicates:0,invalid:0});
 assert.deepEqual(seed.records,result.accepted);assert.deepEqual(seed.review,result.held);
 const again=reviewRows(workbook.rows,seed.records,opts);assert.equal(again.counts.accepted,0);assert.equal(again.counts.duplicates,1017);
});
// Minimal OOXML fixtures exercise the parser, without generating deliverable workbooks.
async function fixture({headers=HEADERS,cell='',properties='',shared='',macro=false}={}){
 const zip=new JSZip();zip.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr '+properties+'/><sheets><sheet name="Historical_Events" r:id="rId1"/></sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
 zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1">'+headers.map((h,i)=>'<c r="'+String.fromCharCode(65+i)+'1" t="inlineStr"><is><t>'+h+'</t></is></c>').join('')+'</row><row r="2">'+cell+'</row></sheetData></worksheet>');
 if(shared)zip.file('xl/sharedStrings.xml',shared);if(macro)zip.file('xl/vbaProject.bin','invalid');
 return zip.generateAsync({type:'nodebuffer'});
}
test('OOXML accepts shared strings, numeric cells and the 1904 date flag',async()=>{
 const bytes=await fixture({properties:'date1904="1"',shared:'<sst><si><t>NADMA</t></si></sst>',cell:'<c r="A2" t="s"><v>0</v></c><c r="F2"><v>44500</v></c>'});
 const parsed=await readHistoricalWorkbook(bytes);assert.equal(parsed.date1904,true);assert.equal(parsed.rows[0].record.source_agency,'NADMA');assert.equal(parsed.rows[0].record.event_start_date,44500);
});
test('OOXML rejects wrong headers, macros, corrupt archives and formulas',async()=>{
 await assert.rejects(readHistoricalWorkbook(await fixture({headers:[...HEADERS].reverse()})),/tajuk/);
 await assert.rejects(readHistoricalWorkbook(await fixture({macro:true})),/bermakro/);
 await assert.rejects(readHistoricalWorkbook(Buffer.from('bad')),/xlsx/);
 const parsed=await readHistoricalWorkbook(await fixture({cell:'<c r="A2"><f>1+1</f><v>2</v></c>'}));assert.match(parsed.rows[0].cellError,/Formula/);
});
function harness({role='admin',active=true,now=Date.parse('2026-10-29T03:00:00Z'),parser,store:given}={}){
 const blobs=given||new Map();let serial=0;
 const storage={async getWithMetadata(key){return blobs.get(key)||null;},async get(key){return blobs.get(key)?.data||null;},async setJSON(key,data,condition={}){const old=blobs.get(key);if(condition.onlyIfNew&&old||condition.onlyIfMatch&&old?.etag!==condition.onlyIfMatch)return {modified:false};blobs.set(key,{data:structuredClone(data),etag:String(++serial)});return {modified:true};},async delete(key){blobs.delete(key);}};
 const handler=createHistoryHandler({getStore:()=>storage,seed:{...seed,records:[base],review:[]},env:{SUPABASE_SECRET_KEY:'test-only-secret'},clock:()=>now,readWorkbook:parser||(async()=>({rows:[{...base,location:'New location'}]})),request:async url=>url.includes('/auth/')?Response.json({id:'test-admin'}):Response.json([{id:'test-admin',username:'qa',role,active}])});
 const call=(action='',{method='GET',data,token=true,origin='https://app.example',contentType='application/json'}={})=>handler(new Request('https://app.example/api/historical-data'+(action?'?action='+action:''),{method,headers:{...(token?{Authorization:'Bearer test-only-token'}:{}),Origin:origin,'Content-Type':contentType},...(data===undefined?{}:{body:typeof data==='string'?data:JSON.stringify(data)})}));
 return {call,blobs,storage,setTime:t=>now=t};
}
const preview=async h=>{const response=await h.call('preview',{method:'POST',data:'mock-xlsx',contentType:'application/octet-stream'});assert.equal(response.status,200);return response.json();};
test('history GET is public but review details require an active admin',async()=>{
 const h=harness({role:'staff'});let r=await h.call('',{token:false});assert.equal(r.status,200);assert.equal((await r.json()).review,undefined);
 assert.equal((await h.call('admin')).status,403);
 assert.equal((await h.call('preview',{method:'POST',data:'x',token:false})).status,401);
 assert.equal((await h.call('preview',{method:'POST',data:'x'})).status,403);
 assert.equal((await harness({active:false}).call('admin')).status,403);
});
test('invalid token is rejected before file parsing or storage',async()=>{
 const handler=createHistoryHandler({getStore:()=>{throw Error('must not access');},seed,env:{SUPABASE_SECRET_KEY:'test'},request:async()=>Response.json({}, {status:401}),readWorkbook:()=>{throw Error('must not parse');}});
 const r=await handler(new Request('https://app.example/api/historical-data?action=preview',{method:'POST',headers:{Authorization:'Bearer wrong'},body:'x'}));assert.equal(r.status,401);
});
test('cross-origin import refused; request size enforced',async()=>{
 const h=harness();assert.equal((await h.call('preview',{method:'POST',data:'x',origin:'https://attacker.example'})).status,403);
 assert.equal((await h.call('preview',{method:'POST',data:'x'.repeat(2*1024*1024+1),contentType:'application/octet-stream'})).status,413);
});
test('preview does not publish; confirm persists, audits and keeps previous version',async()=>{
 const h=harness(),draft=await preview(h);assert.equal((await (await h.call()).json()).records.length,1);
 const confirmed=await h.call('confirm',{method:'POST',data:{previewId:draft.previewId,revision:draft.revision}});assert.equal(confirmed.status,200);
 const publicData=await (await h.call()).json();assert.equal(publicData.records.length,2);assert.equal(publicData.updatedBy,'qa');assert.notEqual(publicData.revision,draft.revision);
 assert(h.blobs.has('versions/starter-v1'));assert(!h.blobs.has('draft/'+draft.previewId));
 const reload=harness({store:h.blobs});assert.equal((await (await reload.call()).json()).records.length,2);
});
test('expired previews and stale concurrent imports cannot overwrite published records',async()=>{
 const h=harness(),one=await preview(h),two=await preview(h);
 assert.equal((await h.call('confirm',{method:'POST',data:one})).status,200);
 assert.equal((await h.call('confirm',{method:'POST',data:two})).status,409);
 const h2=harness(),old=await preview(h2);h2.setTime(Date.parse('2026-10-29T05:00:00Z'));
 assert.equal((await h2.call('confirm',{method:'POST',data:old})).status,410);
});
test('preview belongs to its creator and rejects forged preview IDs',async()=>{
 const h=harness();assert.equal((await h.call('confirm',{method:'POST',data:{previewId:'../../secret'}})).status,400);
 const draft=await preview(h);h.blobs.get('draft/'+draft.previewId).data.owner='another-admin';
 assert.equal((await h.call('confirm',{method:'POST',data:draft})).status,404);
});
test('held records are not published; corrected records can replace a held copy',async()=>{
 const held={...base,location:'Held area',review_required:'yes'};
 const h=harness({parser:async()=>({rows:[held]})});let d=await preview(h);
 assert.equal((await h.call('confirm',{method:'POST',data:d})).status,200);
 assert.equal((await (await h.call()).json()).records.length,1);
 assert.equal((await (await h.call('admin')).json()).review.length,1);
 const h2=harness({store:h.blobs,parser:async()=>({rows:[{...held,review_required:'no'}]})});d=await preview(h2);
 assert.equal((await h2.call('confirm',{method:'POST',data:d})).status,200);
 assert.equal((await (await h2.call('admin')).json()).review.length,0);
});
test('HTML integration keeps production features and contains no preview mocks',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 for(const id of ['page-admin','page-weather','page-reports','summaryFrame','branchesFrame','newOutlookTab','historyFile','confirmHistoryImport'])assert(html.includes('id="'+id+'"'));
 assert(html.includes('history-ui.mjs'));assert(!html.includes('__frameMock'));assert(!html.includes('__forecastSnapshot'));
 assert(!html.includes('mockDatabase'));
});
