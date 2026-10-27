// Current public JPS notifications table. No page scripts are executed.
const text=html=>String(html).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const level=cell=>/\bbahaya\b/i.test(cell)?3:/\bamaran\b/i.test(cell)?2:/\bwaspada\b|\bsangat\s+lebat\b/i.test(cell)?1:0;
function timestamp(cell){
 const m=text(cell).match(/(?:Tarikh:\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/i);
 return m?Date.parse(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00+08:00`):null;
}
function stateName(value){
 const s=text(value).replace(/^NEGERI:\s*/i,'').trim();
 if(/KUALA LUMPUR/i.test(s))return 'Kuala Lumpur';
 if(/PUTRAJAYA/i.test(s))return 'Putrajaya';
 if(/LABUAN/i.test(s))return 'Labuan';
 return s;
}
export function parseJpsNotifications(html){
 const clean=String(html).replace(/<!--[\s\S]*?-->/g,'');
 const table=clean.match(/<tbody\b[^>]*\bid=["']palertList["'][^>]*>([\s\S]*?)<\/tbody>/i);
 if(!table)throw Error('Format notifikasi JPS berubah');
 const rows=[];let state='';
 for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map(m=>m[0]);
  if(cells.length===1&&/NEGERI:/i.test(text(cells[0]))){state=stateName(cells[0]);continue;}
  if(cells.length<5)continue;
  const station=text(cells[0]);
  for(const [statusIndex,valueIndex,kind] of [[1,2,'Aras air'],[3,4,'Hujan lebat']]){
   const lvl=level(cells[statusIndex]),t=timestamp(cells[valueIndex]);
   if(lvl&&station&&t)rows.push({station,state,kind,lvl,t,reading:text(cells[valueIndex])});
  }
 }
 return {format:'jps-current-alerts-v1',rows};
}
