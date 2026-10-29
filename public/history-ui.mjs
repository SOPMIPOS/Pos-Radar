import { rollingDates, previousYear, recordsForDay, typeLabel, HEADERS, malaysiaToday } from './history-core.mjs';
const $=id=>document.getElementById(id);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=date=>new Date(date+'T00:00:00Z').toLocaleDateString('ms-MY',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
let snapshot=null,historyError='',selected=0,dates=rollingDates(),preview=null,busy=false,adminSnapshot=null;
const bridge=()=>window.__history;
function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?e(u.href):'#';}catch{return '#';}}
function showError(id,text=''){$(id).textContent=text;$(id).hidden=!text;}
function options(id,values,label,display=x=>x){const old=$(id).value;$(id).innerHTML='<option value="">'+label+'</option>'+values.map(v=>'<option value="'+e(v)+'">'+e(display(v))+'</option>').join('');if(values.includes(old))$(id).value=old;}
function metadata(value){const s=value.summary,counts={};for(const row of value.records||[])counts[row.state]=(counts[row.state]||0)+1;const dominant=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return s.count.toLocaleString()+' rekod diterbitkan · '+(s.from?format(s.from)+' – '+format(s.to):'Tiada tarikh')+' · '+value.reviewCount+' ditahan untuk semakan. Liputan separa.'+(dominant&&dominant[1]>s.count/2?' '+Math.round(100*dominant[1]/s.count)+'% rekod dalam set ini ialah '+dominant[0]+'. Liputan negeri lain belum lengkap; negeri yang tiada rekod tidak disahkan bebas bencana.':'');}
async function loadHistory(){
 $('historyReload').disabled=true;
 try {
  const response=await fetch('/api/historical-data',{cache:'no-store',signal:AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Data sejarah gagal dimuatkan.');
  snapshot=result;historyError='';
  options('outlookState',result.summary.states,'Semua negeri');options('outlookType',[...new Set(result.records.map(r=>r.disaster_type))].sort(),'Semua bencana',typeLabel);
 }catch(err){historyError=err.message||'Data sejarah gagal dimuatkan.';}
 finally{$('historyReload').disabled=false;render();}
}
function render(){
 const next=rollingDates();if(next[0]!==dates[0]){dates=next;selected=0;}
 const {forecast,city}=bridge()?.context()||{};
 $('historyCoverage').textContent=snapshot?metadata(snapshot)+(snapshot.updatedAt?' Dikemas kini '+new Date(snapshot.updatedAt).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'})+' oleh '+snapshot.updatedBy+'.':' Set permulaan telah dimuatkan.'):'Memuatkan rekod sejarah…';
 showError('outlookError',historyError+(historyError&&snapshot?' Memaparkan salinan terakhir yang berjaya dimuatkan.':''));
 $('outlookRange').textContent=format(dates[0])+' – '+format(dates.at(-1));
 const rows=snapshot?.records||[],state=$('outlookState').value,type=$('outlookType').value;
 $('outlookCalendar').innerHTML=dates.map((date,i)=>{
  const records=recordsForDay(rows,date,state,type),daily=i<7?forecast?.daily?.find(d=>d.date===date):null;
  return '<button type="button" class="outlook-day '+(i<7?'live':records.length?'history':'')+'" data-outlook-day="'+i+'" aria-pressed="'+(selected===i)+'"><span class="day-label">'+new Date(date+'T00:00:00Z').toLocaleDateString('ms-MY',{day:'numeric',month:'short',timeZone:'UTC'})+'</span><span class="day-source">'+(i<7?'Ramalan semasa':'Sejarah '+(Number(date.slice(0,4))-1))+'</span><b>'+(i<7?(daily?Math.round(daily.low)+'° – '+Math.round(daily.high)+'°':'Ramalan belum tersedia'):records.length?records.length+' rekod':snapshot?'Rekod belum tersedia':'Data belum tersedia')+'</b></button>';
 }).join('');
 const date=dates[selected],target=previousYear(date),list=recordsForDay(rows,date,state,type);
 $('outlookDate').textContent=format(date);
 $('outlookBasis').textContent=selected<7?'Ramalan cuaca untuk '+(city?.label||'lokasi dipilih')+' · pilihan negeri/bencana menapis sejarah sahaja.':target?'Rujukan sejarah pada '+format(target)+' · maklumat negeri/daerah/kawasan.':'Tiada tarikh 29 Februari yang sepadan pada tahun sebelumnya.';
 if(selected<7){const d=forecast?.daily?.find(x=>x.date===date);$('outlookRecords').innerHTML='<div class="outlook-empty"><h3>'+(d?Math.round(d.low)+'°C – '+Math.round(d.high)+'°C':'Ramalan belum tersedia')+'</h3><p>'+e(city?.label||'Lokasi dipilih')+'</p><p>Ramalan sebenar daripada MET Norway. Tempoh yang tidak disediakan sumber tidak diisi dengan anggaran.</p><button class="btn" id="openForecastDay">Lihat harian & setiap jam</button></div>';$('openForecastDay').onclick=()=>{selectTab(false);bridge()?.goToForecast(date);};}
 else $('outlookRecords').innerHTML=!snapshot?'<div class="outlook-empty">Data sejarah belum dapat dimuatkan. Cuba Muat semula.</div>':list.length?list.map(record=>'<article class="outlook-record"><span class="outlook-kicker">'+e(typeLabel(record.disaster_type))+' · '+e(record.state)+'</span><h3>'+e(record.location||record.district||record.state)+'</h3>'+(record.location&&record.district?'<p>'+e(record.district)+'</p>':'')+'<p>'+(record.date_basis==='observation_date'?'Tarikh pemerhatian: '+e(format(record.observation_date))+' (bukan tarikh mula kejadian)':'Tarikh kejadian: '+e(format(record.event_start_date))+(record.event_end_date?' hingga '+e(format(record.event_end_date)):''))+'</p><p>'+e(record.notes)+'</p><a href="'+safeLink(record.source_url)+'" target="_blank" rel="noopener noreferrer">'+e(record.source_agency)+' · '+e(record.source_document)+(record.source_page?' · '+e(record.source_page):'')+' ↗</a></article>').join(''):'<div class="outlook-empty"><h3>Rekod sejarah belum tersedia</h3><p>Tiada rekod yang dimuatkan untuk tarikh dan tapisan ini. Ini bukan pengesahan bahawa kawasan selamat atau tiada bencana pada tahun lepas.</p></div>';
}
function selectTab(outlook){$('existingForecast').hidden=outlook;$('newOutlook').hidden=!outlook;for(const [id,on] of [['existingForecastTab',!outlook],['newOutlookTab',outlook]]){$(id).classList.toggle('selected',on);$(id).setAttribute('aria-selected',String(on));}if(outlook)render();else window.dispatchEvent(new Event('resize'));}
function clearPreview(){preview=null;$('importPreview').hidden=true;$('confirmHistoryImport').disabled=true;showError('importError');$('importResult').textContent='';}
function controls(){const admin=bridge()?.context()?.profile?.role==='admin'&&bridge()?.context()?.profile?.active;$('historyFile').disabled=busy||!admin;$('previewHistory').disabled=busy||!admin||!$('historyFile').files.length;$('confirmHistoryImport').disabled=busy||!admin||!preview||!(preview.counts.accepted+preview.counts.held);$('importBusy').textContent=busy?'Sedang memproses…':'';}
function csvDownload(rows,filename){const cell=v=>'"'+(/^[=+\-@\t\r]/.test(String(v??''))?"'":'')+String(v??'').replace(/"/g,'""')+'"';const blob=new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderImportPreview(value){
 const c=value.counts; $('importCounts').innerHTML=[['Sedia diimport',c.accepted],['Ditahan untuk semakan',c.held],['Pendua dilangkau',c.duplicates],['Ralat / tidak diimport',c.invalid]].map(([label,n])=>'<div class="stat"><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
 $('importFileSummary').textContent=c.total+' baris diperiksa. Hanya '+c.accepted+' rekod sah baharu diterbitkan selepas pengesahan. '+c.held+' rekod ditahan disimpan untuk semakan; '+c.invalid+' baris ralat perlu dibetulkan dalam Excel. Pratonton sah selama satu jam.';
 $('importIssues').innerHTML=value.issues.length?'<table><thead><tr><th>Baris Excel</th><th>Status</th><th>Penjelasan</th></tr></thead><tbody>'+[...value.issues].sort((a,b)=>({invalid:0,held:1,duplicate:2})[a.status]-({invalid:0,held:1,duplicate:2})[b.status]).slice(0,100).map(i=>'<tr><td>'+i.row+'</td><td>'+e(({invalid:'Ralat',held:'Ditahan',duplicate:'Pendua'})[i.status])+'</td><td>'+e(i.reason)+'</td></tr>').join('')+'</tbody></table>'+(value.issues.length>100?'<p>100 baris pertama ditunjukkan. Muat turun semakan penuh di bawah.</p>':''):'<p>Tiada ralat atau pendua.</p>';
 $('importSamples').innerHTML='<h3>Contoh rekod sedia diimport (maksimum 10)</h3>'+(value.acceptedSample.length?value.acceptedSample.map(r=>'<p>'+e(r.state)+' · '+e(r.location||r.district||'Peringkat negeri')+' · '+e(r.event_start_date||r.observation_date)+' · '+e(typeLabel(r.disaster_type))+'</p>').join(''):'<p>Tiada rekod baharu sedia diimport.</p>');
 $('downloadHistoryIssues').disabled=!value.issues.length;$('importPreview').hidden=false;
}
async function refreshAdmin(){if(!bridge()?.context()?.profile?.active||bridge().context().profile.role!=='admin')return;try{adminSnapshot=await bridge().request('admin');$('historyAdminStatus').textContent=metadata(adminSnapshot)+(adminSnapshot.updatedBy?' Dikemas kini oleh '+adminSnapshot.updatedBy+'.':'');$('downloadHeldHistory').disabled=!adminSnapshot.review.length;}catch(err){showError('importError',err.message);}}
export async function initHistoryUI(){
 $('existingForecastTab').onclick=()=>selectTab(false);$('newOutlookTab').onclick=()=>selectTab(true);
 $('historyReload').onclick=loadHistory;$('outlookState').onchange=$('outlookType').onchange=render;
 $('outlookCalendar').onclick=event=>{const button=event.target.closest('[data-outlook-day]');if(button){selected=Number(button.dataset.outlookDay);render();}};
 $('historyFile').onchange=()=>{clearPreview();controls();};
 $('previewHistory').onclick=async()=>{clearPreview();const file=$('historyFile').files[0];if(!file)return;if(!/\.xlsx$/i.test(file.name)||file.size>2*1024*1024){showError('importError','Pilih fail .xlsx sehingga 2 MB.');return;}busy=true;controls();try{preview=await bridge().request('preview',file);renderImportPreview(preview);}catch(err){showError('importError',err.message);}finally{busy=false;controls();}};
 $('confirmHistoryImport').onclick=async()=>{if(!preview)return;busy=true;controls();showError('importError');try{const result=await bridge().request('confirm',{previewId:preview.previewId,revision:preview.revision});clearPreview();$('historyFile').value='';$('importResult').textContent='Import disimpan: '+result.counts.accepted+' rekod baharu diterbitkan; '+result.counts.held+' ditahan. Pendua dan baris ralat tidak diterbitkan.';await loadHistory();await refreshAdmin();}catch(err){showError('importError',err.message+' Muat semula status atau pratonton fail semula.');preview=null;}finally{busy=false;controls();}};
 $('downloadHistoryIssues').onclick=()=>preview&&csvDownload([['Baris Excel','Status','Penjelasan'],...preview.issues.map(i=>[i.row,i.status,i.reason])],'Semakan-Import-Sejarah.csv');
 $('downloadHeldHistory').onclick=()=>adminSnapshot&&csvDownload([HEADERS,...adminSnapshot.review.map(r=>HEADERS.map(h=>r[h]))],'Rekod-Sejarah-Perlu-Semakan.csv');
 $('reloadHistoryAdmin').onclick=refreshAdmin;
 document.addEventListener('pantau:identity',()=>{clearPreview();adminSnapshot=null;$('historyFile').value='';controls();if(bridge()?.context()?.profile?.role==='admin')refreshAdmin();});
 document.addEventListener('pantau:weather',render);
 document.addEventListener('pantau:page',event=>{if(event.detail==='admin')refreshAdmin();if(event.detail==='weather')render();});
 window.addEventListener('focus',()=>{render();if(!$('newOutlook').hidden)loadHistory();});
 setInterval(()=>{if(dates[0]!==malaysiaToday())render();},60000);
 controls();render();await loadHistory();if(bridge()?.context()?.profile?.role==='admin')await refreshAdmin();
}
initHistoryUI().catch(error=>showError('outlookError',error.message));
