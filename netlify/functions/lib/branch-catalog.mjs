import psm from './psm-catalog.mjs';
// Append the approved workbook catalogue; never overwrite operational master rows.
export async function syncPsmCatalog(api) {
 const fail=message=>{throw Object.assign(Error(message),{status:503});};
 const result=await api('/rest/v1/report_branches?select=name,state,office_type');
 if(!result.ok)fail('Senarai cawangan tidak dapat disemak.');
 const known=new Map(result.data.map(row=>[row.name,row]));
 for(const row of psm)if(known.has(row.name)&&known.get(row.name).state!==row.state)fail('Negeri cawangan berbeza daripada senarai PSM diluluskan. Hubungi penyelenggara.');
 const missing=psm.filter(row=>!known.has(row.name));
 if(missing.length){
  // Existing database enum uses Other for offices outside PLC/DC/LDC.
  // PSM identity is retained in the branch name and the published catalogue type.
  const saved=await api('/rest/v1/report_branches?on_conflict=name',{method:'POST',body:missing.map(r=>({name:r.name,state:r.state,office_type:'Other',districts:[]})),prefer:'resolution=ignore-duplicates,return=minimal'});
  if(!saved.ok)fail('PSM belum dapat disimpan dalam senarai cawangan. Hubungi penyelenggara.');
 }
 const ranges=[];
 for(let offset=0;;offset+=1000){const page=await api('/rest/v1/report_postcode_ranges?select=branch,postcode_from,postcode_to,sla&order=branch,postcode_from,postcode_to&limit=1000&offset='+offset);if(!page.ok)fail('Poskod cawangan tidak dapat disemak.');ranges.push(...page.data);if(page.data.length<1000)break;if(offset>50000)fail('Senarai poskod melebihi had semakan.');}
 const key=r=>r.branch+'|'+r.postcode_from+'|'+r.postcode_to;
 const existing=new Set(ranges.map(key));
 const additions=psm.flatMap(row=>row.postcodes.map(code=>({branch:row.name,postcode_from:code,postcode_to:code,sla:''}))).filter(row=>!existing.has(key(row)));
 if(additions.length){const saved=await api('/rest/v1/report_postcode_ranges',{method:'POST',body:additions,prefer:'resolution=ignore-duplicates,return=minimal'});if(!saved.ok)fail('Cawangan PSM telah disediakan tetapi poskod belum lengkap. Cuba semula penyelarasan.');}
 return {ok:true,branches:psm.length,postcodes:psm.reduce((n,r)=>n+r.postcodes.length,0),addedBranches:missing.length,addedRanges:additions.length};
}
