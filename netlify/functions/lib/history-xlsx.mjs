import JSZip from 'jszip';
import sax from 'sax';
import { HEADERS, LIMIT_ROWS } from './history-validation.mjs';
const MAX_BYTES=2*1024*1024, MAX_XML=16*1024*1024;
export const MAX_FILE_BYTES=MAX_BYTES;
// Check the ZIP directory before decompressing. No macros, encrypted files or ZIP64.
function inspectZip(bytes) {
 if(bytes.length>MAX_BYTES || bytes.length<22) throw Error('Pilih fail .xlsx sehingga 2 MB.');
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) if(bytes.readUInt32LE(p)===0x06054b50 && p+22+bytes.readUInt16LE(p+20)===bytes.length){end=p;break;}
 if(end<0 || bytes.readUInt16LE(end+4)!==0 || bytes.readUInt16LE(end+6)!==0) throw Error('Arkib Excel tidak disokong.');
 const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16),total=0;
 if(count>2000 || count===65535 || offset===0xffffffff) throw Error('Fail Excel terlalu kompleks.');
 for(let i=0;i<count;i++) {
  if(offset+46>end || bytes.readUInt32LE(offset)!==0x02014b50) throw Error('Arkib Excel rosak.');
  const size=bytes.readUInt32LE(offset+24),n=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32);
  if(bytes.readUInt16LE(offset+8)&1 || size===0xffffffff || (total+=size)>MAX_XML) throw Error('Fail Excel terlalu besar selepas dinyahmampat.');
  const name=bytes.subarray(offset+46,offset+46+n).toString('utf8');
  if(/vbaProject|\.bin$|externalLinks\//i.test(name)) throw Error('Fail bermakro atau pautan luaran tidak disokong. Simpan sebagai .xlsx biasa.');
  offset+=46+n+extra+comment;
 }
 if(offset!==end) throw Error('Direktori Excel tidak sah.');
}
function xml(text, handlers) {
 if(text.length>MAX_XML || /<!DOCTYPE|<!ENTITY/i.test(text)) throw Error('XML Excel tidak disokong.');
 const parser=sax.parser(true,{trim:false,xmlns:true});
 parser.onopentag=node=>handlers.open?.(node.local,Object.fromEntries(Object.values(node.attributes).map(a=>[a.name,a.value])));
 parser.ontext=parser.oncdata=value=>handlers.text?.(value);
 parser.onclosetag=name=>handlers.close?.(name.split(':').at(-1));
 parser.write(text).close();
}
export async function readHistoricalWorkbook(bytes) {
 inspectZip(bytes);
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:false});
 const read=async path=>{const file=zip.file(path);if(!file)throw Error('Komponen Excel tiada: '+path);const text=await file.async('string');if(text.length>MAX_XML)throw Error('XML terlalu besar.');return text;};
 let sheetId,date1904=false;
 xml(await read('xl/workbook.xml'),{open:(tag,a)=>{if(tag==='workbookPr')date1904=['1','true'].includes(a.date1904);if(tag==='sheet' && a.name==='Historical_Events')sheetId=a['r:id'];}});
 if(!sheetId)throw Error('Lembaran Historical_Events tidak dijumpai.');
 let target;
 xml(await read('xl/_rels/workbook.xml.rels'),{open:(tag,a)=>{if(tag==='Relationship'&&a.Id===sheetId&&a.TargetMode!=='External')target=a.Target;}});
 if(!target || target.includes('..') || target.includes('\\'))throw Error('Lembaran Excel tidak sah.');
 target=target.startsWith('/')?target.slice(1):'xl/'+target;
 const shared=[];
 if(zip.file('xl/sharedStrings.xml')) {
  let content='',inItem=false,inText=false;
  xml(await read('xl/sharedStrings.xml'),{open:tag=>{if(tag==='si'){content='';inItem=true;}if(tag==='t')inText=true;},text:v=>{if(inItem&&inText)content+=v;},close:tag=>{if(tag==='t')inText=false;if(tag==='si'){shared.push(content);inItem=false;}}});
 }
 const rows=[];let row,cell,capture=false;
 xml(await read(target),{
  open:(tag,a)=>{
   if(tag==='row'){if(rows.length>LIMIT_ROWS)throw Error('Maksimum 10,000 rekod.');row={rowNumber:Number(a.r),cells:[]};}
   if(tag==='c'&&row){const col=(a.r||'').match(/^[A-Z]+/)?.[0];if(!col)throw Error('Rujukan sel tidak sah.');let index=0;for(const c of col)index=index*26+c.charCodeAt(0)-64;cell={index:index-1,type:a.t,text:'',formula:false};}
   if(tag==='f'&&cell)cell.formula=true;
   if(['v','t'].includes(tag))capture=true;
  },
  text:value=>{if(capture&&cell){cell.text+=value;if(cell.text.length>12000)throw Error('Nilai sel terlalu panjang.');}},
  close:tag=>{
   if(['v','t'].includes(tag))capture=false;
   if(tag==='c'&&cell){let value=cell.type==='s'?shared[Number(cell.text)]:cell.text;
    if((!cell.type || cell.type==='n') && cell.text!=='')value=Number(cell.text);
    if(cell.formula || cell.type==='e')row.cellError='Formula atau ralat sel tidak dibenarkan; tampal nilai sahaja.';
    if(cell.index>13 && String(value??'').trim())throw Error('Historical_Events mesti mempunyai 14 lajur sahaja.');
    if(cell.index<14)row.cells[cell.index]=value??'';cell=null;
   }
   if(tag==='row'&&row){rows.push(row);row=null;}
  }
 });
 const header=rows.shift();
 if(!header || header.rowNumber!==1 || header.cellError || HEADERS.some((h,i)=>header.cells[i]!==h))throw Error('Baris 1 mesti mempunyai 14 tajuk lajur yang ditetapkan, dalam susunan asal.');
 return {date1904,rows:rows.filter(r=>r.cells.some(v=>String(v??'').trim())).map(r=>({rowNumber:r.rowNumber,cellError:r.cellError,record:Object.fromEntries(HEADERS.map((h,i)=>[h,r.cells[i]??'']))}))};
}
