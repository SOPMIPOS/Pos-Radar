import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import psm from '../netlify/functions/lib/psm-catalog.mjs';
import {syncPsmCatalog} from '../netlify/functions/lib/branch-catalog.mjs';
import {createHandler} from '../netlify/functions/report-users.mjs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const data=JSON.parse(html.match(/const POS_DATA=(.*?);\nconst FRAMES=/s)[1]);
const frames=JSON.parse(html.match(/const FRAMES=(.*?);\n/)[1]);
test('approved catalogue contains 96 existing and 333 PSM branches with 937 postcode entries',()=>{
 assert.equal(data.outlets.length,429);assert.equal(psm.length,333);assert.equal(psm.reduce((n,row)=>n+row.postcodes.length,0),937);
 assert.equal(new Set(psm.map(r=>r.name)).size,333);
 for(const branch of data.outlets.filter(o=>o.type==='PSM')){assert.equal(branch.c,null);assert(branch.r.every(r=>r[0]===r[1]&&r[2]===null));}
 assert(data.outlets.some(o=>o.n==='Batu Caves (PSM)'));assert(data.outlets.some(o=>o.n==='Batu Caves (PLC)'));
});
test('both embedded branch views contain the full catalogue and explicit PSM no-SLA display',()=>{
 for(const page of Object.values(frames)){
  const included=JSON.parse(page.match(/window.POS_DATA=(.*?);?\s*<\/script>/s)[1].replace(/;$/,''));
  assert.equal(included.outlets.length,429);assert(page.includes('PSM'));assert(!page.includes('__frameMock'));
  for(const script of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script[1].trim())new vm.Script(script[1]);
 }
 assert(frames.branches.includes('PSM tidak mempunyai SLA'));
});
test('top-level selectors and validation support PSM without inventing forecast coordinates',()=>{
 const script=html.match(/<script>const POS_DATA=[\s\S]*?<\/script>/)[0].slice(8,-9);new vm.Script(script);
 const validation=script.slice(script.indexOf('function postcodeChoices'),script.indexOf('window.POS_DATA=POS_DATA;'));
 const context=vm.createContext({padPostcode:n=>String(n).padStart(5,'0')});vm.runInContext(validation,context);
 const outlet=data.outlets.find(o=>o.n==='Batu Caves (PSM)');
 const branches=data.outlets.map(o=>({name:o.n,state:o.s,office_type:o.type==='PSM'?'Other':'PLC'}));
 const ranges=outlet.r.map(([a,b])=>({branch:outlet.n,postcode_from:a,postcode_to:b}));
 assert.equal(context.postcodeChoices(ranges,outlet.n).length,outlet.r.length);
 const record=context.validateReport({state:outlet.s,branch:outlet.n,postcode:String(outlet.r[0][0]).padStart(5,'0'),report_date:'2026-10-29',locations:['Test location'],bit:'A1',remarks:'',status:'active',poslaju:'1',posdaftar:'0',mel:'0'},branches,ranges);
 assert.equal(record.branch,'Batu Caves (PSM)');assert.equal(record.office_type,'Other');
 assert(html.includes('cities.filter(c=>c.coordinates)'));assert(html.includes('Koordinat PSM belum disahkan'));
});
test('backend sync appends trusted catalogue and postcode rows, without modifying existing branches',async()=>{
 const writes=[];let branches=[{name:'Existing PLC',state:'Johor',office_type:'PLC'}],ranges=[];
 const api=async(path,options={})=>{if(options.method==='POST'){writes.push({path,...options});if(path.includes('report_branches'))branches.push(...options.body);else ranges.push(...options.body);return {ok:true,data:null};}return {ok:true,data:path.includes('report_branches')?branches:ranges};};
 const first=await syncPsmCatalog(api);assert.equal(first.addedBranches,333);assert.equal(first.addedRanges,937);
 assert(writes[0].body.every(row=>row.office_type==='Other'&&row.name.endsWith('(PSM)')));
 assert(writes[1].body.every(row=>row.sla===''&&row.postcode_from===row.postcode_to));
 const second=await syncPsmCatalog(api);assert.equal(second.addedBranches,0);assert.equal(second.addedRanges,0);assert.equal(writes.length,2);
 assert.deepEqual(branches[0],{name:'Existing PLC',state:'Johor',office_type:'PLC'});
});
test('backend sync stops on state conflicts and failed range writes',async()=>{
 await assert.rejects(syncPsmCatalog(async()=>({ok:true,data:[{name:psm[0].name,state:'Different state'}]})),/Negeri/);
 await assert.rejects(syncPsmCatalog(async(path,opts={})=>path.includes('report_postcode_ranges')&&opts.method==='POST'?{ok:false}:{ok:true,data:[]}),/poskod belum lengkap/);
});
test('sync action cannot be invoked by anonymous, inactive or non-admin accounts',async()=>{
 for(const role of ['staff','manager']){
  let calls=0;const handler=createHandler({env:{SUPABASE_SECRET_KEY:'test-only'},request:async url=>{calls++;return Response.json(url.includes('/auth/')?{id:'qa'}:[{id:'qa',active:true,role}]);}});
  const response=await handler(new Request('https://app.example/api/report-users',{method:'POST',headers:{Authorization:'Bearer qa'},body:JSON.stringify({action:'sync-branches'})}));assert.equal(response.status,403);assert.equal(calls,2);
 }
 const handler=createHandler({env:{SUPABASE_SECRET_KEY:'test-only'},request:()=>{throw Error('must not call');}});
 assert.equal((await handler(new Request('https://app.example/api/report-users',{method:'POST',body:JSON.stringify({action:'sync-branches'})}))).status,401);
});
