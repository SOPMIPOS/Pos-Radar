/* Pantau Cawangan — enjin data bersama (dipakai oleh index.html dan cawangan.html) */
(function(){
"use strict";
const DATA=window.POS_DATA;
const OUT=DATA.outlets, DIST=DATA.districts, SLA=DATA.sla;
const OUT_BY=Object.fromEntries(OUT.map(o=>[o.n,o]));
const STATES=[...new Set(OUT.map(o=>o.s))].sort();
const LVL_TXT=["Normal","Waspada","Buruk","Bahaya"];
const HOUR=3600e3, DAY=24*HOUR;
const HIST_KEY="pantau-cawangan-hist-v1";

/* ---------- sumber ---------- */
function mytStamp(t){const d=new Date(t+8*HOUR);const p=n=>String(n).padStart(2,"0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`}
const SRC={
  met:()=>`https://api.data.gov.my/weather/warning?limit=500&timestamp_start=${encodeURIComponent(mytStamp(Date.now()-7*DAY)+"@warning_issue__issued")}`,
  ipu:()=>"https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID%2CSTATION_LOCATION%2CPLACE%2CSTATE_NAME%2CAPI%2CCLASS%2CDATETIME%2CLATITUDE%2CLONGITUDE&returnGeometry=false&f=json",
  jps:()=>"https://publicinfobanjir.water.gov.my/cerapan/amaran-semasa/"
};

/* ---------- utiliti ---------- */
function e(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/w\.\s?p\./g,"wp ").replace(/[^a-z0-9()\:]+/g," ").replace(/\s+/g," ")}
function fmtT(t){if(t==null||isNaN(t))return"—";return new Date(t).toLocaleString("ms-MY",{timeZone:"Asia/Kuala_Lumpur",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}
function fmtHM(t){return new Date(t).toLocaleTimeString("ms-MY",{timeZone:"Asia/Kuala_Lumpur",hour:"numeric",minute:"2-digit"})}
function mytParse(s){if(!s)return null;if(typeof s==="number")return s;const x=String(s).trim().replace(" ","T");const t=Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(x)?x:x+"+08:00");return isNaN(t)?null:t}
function startOfTodayMYT(){const n=Date.now()+8*HOUR;return n-(n%DAY)-8*HOUR}
function hav(a,b){const R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function ls(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||"null");localStorage.setItem(k,JSON.stringify(v))}catch(_){return null}}

/* ---------- padanan negeri & daerah (MET) ---------- */
const STATE_PAT=[
  ["Perlis",/\bperlis\b/g],["Kedah",/\bkedah\b/g],["Pulau Pinang",/\b(pulau pinang|penang)\b/g],
  ["Perak",/(?<!hulu |hilir )\bperak\b(?! tengah)/g],["Selangor",/(?<!kuala |hulu )\bselangor\b/g],
  ["Kuala Lumpur",/\bkuala lumpur\b/g],["Putrajaya",/\bputrajaya\b/g],["Labuan",/\blabuan\b/g],
  ["Negeri Sembilan",/\bnegeri sembilan\b/g],["Melaka",/\b(melaka|malacca)\b(?! tengah)/g],
  ["Johor",/\bjohor\b(?! bahru)/g],["Pahang",/(?<!sungai )\bpahang\b/g],["Terengganu",/(?<!kuala |hulu )\bterengganu\b/g],
  ["Kelantan",/(?<!sungai )\bkelantan\b/g],["Sabah",/\bsabah\b/g],["Sarawak",/\bsarawak\b/g]
];
const ALIAS_RE=new Map();
function aliasRe(a){if(!ALIAS_RE.has(a))ALIAS_RE.set(a,new RegExp("\\b"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b"));return ALIAS_RE.get(a)}
function districtsOf(token){
  if(token==="Putrajaya")return DIST.filter(d=>d.n==="Putrajaya");
  if(token==="Labuan")return DIST.filter(d=>d.n==="Labuan");
  return DIST.filter(d=>d.s===token&&d.n!=="Putrajaya"&&d.n!=="Labuan");
}
function outletsOfToken(token){ // seluruh negeri
  if(token==="Kuala Lumpur")return OUT.filter(o=>o.s==="Kuala Lumpur").map(o=>o.n);
  return [...new Set(districtsOf(token).flatMap(d=>d.o))];
}
/** Pulangkan [{token, districts:[nama], outlets:[nama], whole, approx}] daripada teks amaran */
function parseAreas(text){
  const t=norm(text); const hits=[];
  STATE_PAT.forEach(([tok,re])=>{re.lastIndex=0;let m;while((m=re.exec(t))){hits.push({tok,i:m.index,len:m[0].length})}});
  hits.sort((a,b)=>a.i-b.i);
  const firstOf=[];const seen=new Set();
  hits.forEach((h,k)=>{const end=k+1<hits.length?hits[k+1].i:t.length;h.scope=t.slice(h.i+h.len,end);});
  // gabung skop untuk token yang sama
  const by={};hits.forEach(h=>{(by[h.tok]=by[h.tok]||[]).push(h.scope)});
  return Object.entries(by).map(([tok,scopes])=>{
    const scope=scopes.join(" ");
    const ds=districtsOf(tok);
    const hasList=/^\s*[(:]/.test(scopes[0])||/\(/.test(scope.slice(0,40));
    if(/\bseluruh\b/.test(scope)&&!hasList||!hasList||tok==="Putrajaya"||tok==="Labuan"||tok==="Kuala Lumpur"||tok==="Perlis"){
      return {tok,districts:["Seluruh "+tok],outlets:outletsOfToken(tok),whole:true};
    }
    const listPart=scope.slice(0,Math.max(scope.indexOf(")")+1,60)); // kandungan kurungan pertama dan sekitarnya
    let matched=ds.filter(d=>d.a.some(a=>aliasRe(a).test(scope)));
    const divs=(DATA.divs[tok]||{});
    Object.entries(divs).forEach(([dv,als])=>{
      if(als.some(a=>aliasRe(a).test(scope))){
        const members=ds.filter(d=>d.d===dv);
        if(!members.some(m=>matched.includes(m)))matched=matched.concat(members);
      }});
    if(!matched.length)return {tok,districts:["Seluruh "+tok+" (daerah tidak dikenal pasti)"],outlets:outletsOfToken(tok),whole:true,approx:true};
    return {tok,districts:[...new Set(matched.map(d=>d.n))],outlets:[...new Set(matched.flatMap(d=>d.o))]};
  });
}
function metKind(w){
  const title=norm((w.warning_issue&&(w.warning_issue.title_bm||w.warning_issue.title_en))+" "+(w.heading_bm||"")+" "+(w.heading_en||""));
  const body=norm((w.text_bm||"")+" "+(w.text_en||""));
  // Buletin laut, siklon, gempa: bukan amaran darat — abaikan
  if(/laut bergelora|rough sea|strong winds? and|tiada nasihat|no advisory|siklon|cyclone|gempa|tsunami|earthquake/.test(title))return null;
  if(/\bperairan\b|\bwaters\b|batu nautika|nautical/.test(body))return null;
  if(/hujan berterusan|continuous rain/.test(title)){
    const lv=/bahaya|danger/.test(title)?3:/buruk|severe/.test(title)?2:1;
    return {label:"Hujan berterusan ("+LVL_TXT[lv]+")",lvl:lv};
  }
  if(/ribut petir|thunderstorm/.test(title))return {label:"Ribut petir",lvl:1};
  if(/hujan lebat|heavy rain/.test(title))return {label:"Hujan lebat",lvl:1};
  return null;
}

/* ---------- state ---------- */
const st={RAW:{met:null,ipu:null,jps:null},STATUS:{met:{s:"idle"},ipu:{s:"idle"},jps:{s:"idle"}},EVENTS:[],lastRefresh:null,busy:false};
const RAW=st.RAW, STATUS=st.STATUS; // EVENTS: {src, lvl, label, detail, outlets[], t0, t1, key}
const CACHE_KEY="pantau-cawangan-cache-v1";
const listeners=[];function emit(type){listeners.forEach(f=>{try{f(type||"status")}catch(_){}})}

function buildEvents(){
  const ev=[];
  // MET
  (RAW.met||[]).forEach((w,i)=>{
    const k=metKind(w); if(!k)return;
    const areas=parseAreas(w.text_bm||w.text_en||"");
    const issued=mytParse(w.warning_issue&&w.warning_issue.issued);
    const t0=mytParse(w.valid_from)??issued, t1=mytParse(w.valid_to)??((t0??issued)+6*HOUR);
    areas.forEach(a=>{
      if(!a.outlets.length)return;
      ev.push({src:"MET",lvl:k.lvl,label:k.label,detail:(a.tok+": "+a.districts.join(", ")),approx:!!a.approx,outlets:a.outlets,t0,t1,issued,key:"met"+i+a.tok,text:w.text_bm||w.text_en});
    });
  });
  // IPU semasa + sejarah tempatan
  const ipuRows=(RAW.ipu||[]).concat(histRows("ipu"));
  const seenI=new Set();
  ipuRows.forEach(r=>{
    const v=+r.api; if(!(v>100))return;
    const k=r.id+"|"+Math.round(r.t/HOUR); if(seenI.has(k))return; seenI.add(k);
    const lv=v>200?3:v>150?2:1;
    ev.push({src:"IPU",lvl:lv,label:"IPU "+Math.round(v),detail:r.name,outlets:ipuOutlets(r),t0:r.t,t1:r.t+HOUR,key:"ipu"+k});
  });
  // JPS
  const jpsRows=(RAW.jps||[]).concat(histRows("jps"));
  const seenJ=new Set();
  jpsRows.forEach(r=>{
    const k=r.station+"|"+r.t; if(seenJ.has(k))return; seenJ.add(k);
    ev.push({src:"JPS",lvl:r.lvl,label:r.kind+" "+["","Waspada","Amaran","Bahaya"][r.lvl],detail:r.station,outlets:r.outlets,t0:r.t,t1:r.t+3*HOUR,key:"jps"+k,approx:!r.outlets.length});
  });
  st.EVENTS=ev;
}
function inWindow(ev,win){
  const now=Date.now();
  if(win==="now"){
    if(ev.src==="MET")return ev.t1>=now-15*60e3&&ev.t0<=now+24*HOUR;
    if(ev.src==="IPU")return ev.t0>=now-4*HOUR;
    return ev.t0>=now-6*HOUR;
  }
  const from=win==="today"?startOfTodayMYT():now-7*DAY;
  return ev.t1>=from;
}
function ipuOutlets(r){
  if(r.lat==null||r.lon==null)return [];
  const d=OUT.filter(o=>o.c).map(o=>({n:o.n,km:hav([r.lat,r.lon],o.c)})).sort((a,b)=>a.km-b.km);
  const near=d.filter(x=>x.km<=20).map(x=>x.n);
  if(near.length)return near;
  return d[0]&&d[0].km<=60?[d[0].n]:[];
}

/* ---------- penarikan ---------- */
// Mod "kongsi": data diambil daripada /api/data (satu salinan untuk semua pengguna, had 30 minit di pelayan).
// Mod "tempatan": jika fungsi Netlify tiada (cth. drag-and-drop), pelayar tarik sendiri dengan had 30 minit setempat.
const API="/api/data", MIN_GAP=30*60e3, POLL_MS=2*60e3, LOCAL_NEXT_KEY="pantau-cawangan-next-v1";
Object.assign(st,{mode:null,nextAllowedAt:0,serverIpuHist:[],skew:0});
const canRefresh=()=>!st.busy&&Date.now()>=st.nextAllowedAt;

function parseMet(data){
  const arr=Array.isArray(data)?data:(data&&data.data)||[];
  const latest=Math.max(0,...arr.map(w=>mytParse(w.warning_issue&&w.warning_issue.issued)||0));
  return {rows:arr,n:arr.length,t:latest||null};
}
function ipuRow(a){return {id:a.STATION_ID,name:(a.STATION_LOCATION||a.PLACE||a.STATION_ID||"").replace(/\s+/g," ").trim(),state:a.STATE_NAME,
  api:+a.API,cls:a.CLASS,t:+a.DATETIME||null,lat:a.LATITUDE!=null?+a.LATITUDE:null,lon:a.LONGITUDE!=null?+a.LONGITUDE:null}}
function parseIpu(data){
  const rows=((data&&data.features)||[]).map(x=>x.attributes||{}).filter(a=>a.API!=null&&+a.API>0).map(ipuRow);
  return {rows,n:rows.length,t:Math.max(0,...rows.map(r=>r.t||0))||null};
}
function parseJps(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  const upd=((doc.body&&doc.body.textContent||"").match(/Kemaskini Terakhir\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/i));
  const updT=upd?Date.parse(`${upd[3]}-${upd[2].padStart(2,"0")}-${upd[1].padStart(2,"0")}T${upd[4].padStart(2,"0")}:${upd[5]}:00+08:00`):null;
  const rows=[];
  doc.querySelectorAll("table tr").forEach(tr=>{
    const tds=[...tr.querySelectorAll("td")]; if(tds.length<4)return;
    const txt=tds.map(td=>(td.textContent||"").replace(/\s+/g," ").trim());
    const imgs=[...tr.querySelectorAll("img")].map(i=>(i.getAttribute("src")||"")+" "+(i.getAttribute("alt")||"")+" "+(i.getAttribute("title")||"")).join(" ");
    const all=norm(txt.join(" ")+" "+imgs);
    const dt=(txt[0].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/));
    if(!dt)return; // bukan baris data (cth. jadual legenda)
    const lvl=/bahaya|danger/.test(all)?3:/\bamaran\b|warning/.test(all)?2:/waspada|alert/.test(all)?1:/sangat lebat|very ?heavy/.test(all)?1:0;
    if(!lvl)return;
    const station=txt[1]||txt[0];
    const head=norm(tableHeading(tr.closest("table")));
    const kind=/hujan|rain/.test(head)&&!/aras|water/.test(head)?"Hujan lebat":"Aras air";
    const t=Date.parse(`${dt[3]}-${dt[2].padStart(2,"0")}-${dt[1].padStart(2,"0")}T${dt[4].padStart(2,"0")}:${dt[5]}:00+08:00`);
    if(rows.some(x=>x.station===station&&x.t===t&&x.kind===kind))return;
    rows.push({station,lvl,kind,t,outlets:jpsOutlets(station),reading:txt[3]||""});
  });
  return {rows,n:rows.length,t:updT};
}
const PARSE={met:parseMet,ipu:parseIpu,jps:parseJps};

function applySnapshot(snap){
  if(!snap||snap.empty)return false;
  ["met","ipu","jps"].forEach(k=>{
    const s=snap.sources&&snap.sources[k];
    if(!s){STATUS[k]={s:"idle"};return}
    if(s.data!=null){
      try{const p=PARSE[k](s.data);RAW[k]=p.rows;
        STATUS[k]={s:s.ok?"ok":"err",via:"pelayan",n:p.n,t:p.t,stale:!!s.stale,msg:s.ok?"":(s.err||"gagal")+" — memaparkan data terakhir"}}
      catch(err){STATUS[k]={s:"err",msg:"format data berubah"}}
    } else STATUS[k]={s:"err",msg:s.err||"gagal"};
  });
  st.serverIpuHist=(snap.ipuHist||[]).map(ipuRow);
  st.lastRefresh=snap.fetchedAt||null;
  saveHist(); buildEvents(); return true;
}
function applyMeta(r){
  if(r&&r.serverNow)st.skew=r.serverNow-Date.now(); // beza jam pelayar vs pelayan
  if(r&&r.nextAllowedAt!=null)st.nextAllowedAt=r.nextAllowedAt-st.skew;
}
async function apiCall(method,qs){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),60000);
  try{const r=await fetch(API+(qs||""),{method,signal:c.signal,cache:"no-store"});
    let body=null;try{body=await r.json()}catch(_){}
    return {status:r.status,body}}
  finally{clearTimeout(t)}
}

/** Mula: baca data kongsi. Pulangkan mode. */
async function init(){
  let r=null;
  try{r=await apiCall("GET")}catch(_){}
  if(r&&r.body&&(r.status===200)){
    st.mode="shared"; applyMeta(r.body);
    if(applySnapshot(r.body))emit("data");
    else if(canRefresh())await refresh(); // tiada data langsung (deploy pertama): tarik sekali
    setInterval(poll,POLL_MS);
  }else{
    st.mode="local";
    st.nextAllowedAt=+(ls(LOCAL_NEXT_KEY)||0);
    const age=loadCache(); if(age!=null)emit("data");
    if(age==null&&canRefresh())await refresh();
  }
  emit("status");
  return st.mode;
}
/** Semak senyap setiap 2 minit — ambil data baharu jika pengguna lain sudah kemas kini */
async function poll(){
  if(st.busy||document.hidden)return;
  try{const r=await apiCall("GET",st.lastRefresh?"?since="+st.lastRefresh:"");
    if(r.status!==200||!r.body)return;
    applyMeta(r.body);
    if(!r.body.unchanged&&applySnapshot(r.body))emit("data"); else emit("status");
  }catch(_){}
}
/** Kemas kini. Pulangkan {ok, refused, busy} */
async function refresh(){
  if(st.busy)return {busy:true};
  if(!canRefresh())return {refused:true};
  st.busy=true; ["met","ipu","jps"].forEach(k=>{STATUS[k]={...STATUS[k],s:"load"}}); emit("status");
  let out={};
  try{
    if(st.mode==="shared"){
      const r=await apiCall("POST");
      const b=r.body||{}; applyMeta(b);
      if(r.status===409){ // orang lain sedang menarik — tunggu sebentar dan ambil hasilnya
        await new Promise(res=>setTimeout(res,8000));
        const g=await apiCall("GET"); applyMeta(g.body); applySnapshot(g.body); out={busy:true};
      }else{
        applySnapshot(b);
        out={ok:["met","ipu","jps"].filter(k=>b.sources&&b.sources[k]&&b.sources[k].ok).length,refused:r.status===429};
      }
    }else{
      await Promise.all(["met","ipu","jps"].map(loadLocal));
      st.lastRefresh=Date.now(); saveHist(); saveCache(); buildEvents();
      st.nextAllowedAt=Date.now()+MIN_GAP; ls(LOCAL_NEXT_KEY,st.nextAllowedAt);
      out={ok:["met","ipu","jps"].filter(k=>STATUS[k].s==="ok").length};
    }
  }catch(err){
    ["met","ipu","jps"].forEach(k=>{if(STATUS[k].s==="load")STATUS[k]={s:"err",msg:"tiada sambungan"}});out={ok:0};
  }
  st.busy=false; emit("data"); emit("status");
  return out;
}
// Mod tempatan sahaja: tarik terus dari sumber (hanya berjaya jika sumber benarkan CORS)
async function loadLocal(k){
  const urls={met:()=>`https://api.data.gov.my/weather/warning?limit=500&timestamp_start=${encodeURIComponent(mytStamp(Date.now()-7*DAY)+"@warning_issue__issued")}`,
    ipu:()=>SRC.ipu(),jps:()=>SRC.jps()};
  try{
    const r=await fetch(urls[k](),{cache:"no-store"}); if(!r.ok)throw new Error("HTTP "+r.status);
    const p=PARSE[k](k==="jps"?await r.text():await r.json());
    RAW[k]=p.rows; STATUS[k]={s:"ok",via:"terus",n:p.n,t:p.t};
  }catch(err){STATUS[k]={s:"err",msg:"perlu fungsi Netlify",needsProxy:true}}
}
/** Butang "Kemas kini data": dikunci untuk semua pengguna sehingga 30 minit selepas tarikan terakhir */
function bindRefreshButton(btn,toast){
  const label=()=>{
    if(st.busy){btn.disabled=true;btn.innerHTML='<span class="spin" aria-hidden="true"></span>Menarik data…';return}
    if(!canRefresh()){
      const m=Math.max(1,Math.ceil((st.nextAllowedAt-Date.now())/60e3));
      btn.disabled=true; btn.textContent=`Boleh kemas kini dalam ${m} min`;
      btn.title=`Data dikemas kini ${st.lastRefresh?fmtT(st.lastRefresh):""}. Kemas kini dihadkan sekali setiap 30 minit untuk semua pengguna — dibuka semula ${fmtHM(st.nextAllowedAt)}.`;
    }else{btn.disabled=false;btn.textContent="Kemas kini data";btn.title="Tarik data terkini dari MET, APIMS dan JPS"}
  };
  btn.onclick=async()=>{
    const r=await refresh();
    if(r.refused)toast(`Data baru sahaja dikemas kini oleh pengguna lain. Dibuka semula ${fmtHM(st.nextAllowedAt)}.`);
    else if(r.busy)toast("Pengguna lain sedang mengemas kini. Data terbaru dipaparkan.");
    else toast(r.ok===3?"Data dikemas kini":r.ok?`${r.ok} daripada 3 sumber berjaya`:"Kemas kini gagal. Cuba lagi sebentar.");
  };
  listeners.push(label); setInterval(label,15000); label();
}
function modeNote(){
  return st.mode==="local"?"Mod tempatan: fungsi Netlify tidak aktif, jadi data tidak dikongsi dan had 30 minit hanya untuk pelayar ini. Deploy guna Netlify CLI atau Git.":"";
}
function saveCache(){
  const keep={};["met","ipu","jps"].forEach(k=>{if(STATUS[k].s==="ok")keep[k]=RAW[k]});
  const prev=ls(CACHE_KEY)||{};
  const raw=Object.assign({},prev.RAW||{},keep), stat=Object.assign({},prev.STATUS||{});
  ["met","ipu","jps"].forEach(k=>{if(STATUS[k].s==="ok")stat[k]=STATUS[k]});
  ls(CACHE_KEY,{t:st.lastRefresh,RAW:raw,STATUS:stat});
}
function loadCache(){
  const c=ls(CACHE_KEY); if(!c||!c.t)return null;
  ["met","ipu","jps"].forEach(k=>{if(c.RAW&&c.RAW[k]){RAW[k]=c.RAW[k];STATUS[k]=c.STATUS[k]||{s:"ok"}}});
  st.lastRefresh=c.t; buildEvents();
  return Date.now()-c.t;
}
function tableHeading(tb){let n=tb;for(let i=0;i<6&&n;i++){n=n.previousElementSibling||n.parentElement;if(n&&/H[1-6]|STRONG|B|P|DIV/.test(n.tagName)&&(n.textContent||"").trim().length<80&&(n.textContent||"").trim())return n.textContent}return ""}
function jpsOutlets(text){
  // Nama sungai (cth. "Sg. Muar") selalunya sama dengan nama daerah lain — guna lokasi stesen sahaja
  const paren=(String(text).match(/\(([^)]+)\)/)||[])[1];
  const base=paren||String(text).replace(/^\s*(sg|sungai|s)\.?\s+.*?\s+di\s+/i,"");
  const t=norm(base);
  let st=null; STATE_PAT.forEach(([tok,re])=>{re.lastIndex=0;if(!st&&re.test(t))st=tok});
  const pool=st?districtsOf(st):DIST;
  const m=pool.filter(d=>d.a.some(a=>a.length>3&&aliasRe(a).test(t)));
  return [...new Set(m.flatMap(d=>d.o))];
}

/* ---------- sejarah tempatan (untuk IPU & JPS) ---------- */
function histRows(kind){const h=ls(HIST_KEY)||{};const loc=h[kind]||[];return kind==="ipu"?loc.concat(st.serverIpuHist||[]):loc}
function saveHist(){
  const h=ls(HIST_KEY)||{ipu:[],jps:[]}; const cut=Date.now()-8*DAY;
  if(RAW.ipu)h.ipu=(h.ipu||[]).concat(RAW.ipu.filter(r=>r.api>100)).filter(r=>r.t>cut);
  if(RAW.jps)h.jps=(h.jps||[]).concat(RAW.jps).filter(r=>r.t>cut);
  // buang pendua
  const u=(arr,f)=>{const s=new Set();return arr.filter(x=>{const k=f(x);if(s.has(k))return false;s.add(k);return true})};
  h.ipu=u(h.ipu,r=>r.id+"|"+r.t).slice(-3000); h.jps=u(h.jps,r=>r.station+"|"+r.t).slice(-1000);
  ls(HIST_KEY,h);
}

/* ---------- pengiraan cawangan terjejas ---------- */
function affected(win,state){
  const m=new Map();
  st.EVENTS.filter(ev=>inWindow(ev,win)).forEach(ev=>{
    ev.outlets.forEach(n=>{
      const o=OUT_BY[n]; if(!o)return; if(state&&o.s!==state)return;
      const a=m.get(n)||{o,lvl:0,ev:[]};
      a.lvl=Math.max(a.lvl,ev.lvl); a.ev.push(ev); m.set(n,a);
    });
  });
  return [...m.values()].sort((a,b)=>b.lvl-a.lvl||b.o.k-a.o.k);
}
function slaMix(o){const c=new Array(SLA.length).fill(0);o.r.forEach(([s,e,i])=>c[i]+=e-s+1);return c}
function pcRanges(o){return o.r.map(([s,e])=>s===e?pad(s):pad(s)+"–"+pad(e))}
function pad(n){return String(n).padStart(5,"0")}
function reasonsDedup(evs){
  const by=new Map();
  evs.forEach(ev=>{const k=ev.src+"|"+ev.label+"|"+ev.detail;const x=by.get(k);if(!x||ev.t0>x.t0)by.set(k,ev)});
  return [...by.values()].sort((a,b)=>b.lvl-a.lvl||b.t0-a.t0);
}


window.Pantau={DATA,OUT,DIST,SLA,OUT_BY,STATES,LVL_TXT,HOUR,DAY,st,
  e,norm,fmtT,fmtHM,mytParse,startOfTodayMYT,hav,ls,
  parseAreas,metKind,ipuOutlets,jpsOutlets,buildEvents,inWindow,affected,
  init,refresh,canRefresh,MIN_GAP,bindRefreshButton,modeNote,onChange:f=>listeners.push(f),
  slaMix,pcRanges,pad,reasonsDedup};
})();
