const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export const malaysiaDate=t=>new Date(new Date(t).getTime()+8*3600000).toISOString().slice(0,10);
export function normaliseForecast(raw,now=Date.now()){
 const input=raw?.properties?.timeseries;
 if(!Array.isArray(input)||!input.length)throw Error('Format ramalan tidak sah.');
 const points=input.map(row=>{
  const d=row.data||{},i=d.instant?.details||{};
  const period=d.next_1_hours?1:d.next_6_hours?6:d.next_12_hours?12:null;
  const interval=period?d['next_'+period+'_hours']:null;
  return {time:row.time,date:malaysiaDate(row.time),temp:finite(i.air_temperature),feels:finite(i.apparent_air_temperature),humidity:finite(i.relative_humidity),wind:finite(i.wind_speed)===null?null:Math.round(i.wind_speed*36)/10,symbol:interval?.summary?.symbol_code||null,precip:finite(interval?.details?.precipitation_amount),period,high:finite(interval?.details?.air_temperature_max),low:finite(interval?.details?.air_temperature_min)};
 }).filter(p=>Number.isFinite(Date.parse(p.time))&&p.temp!==null).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(!points.length)throw Error('Ramalan suhu tidak tersedia.');
 const firstDate=malaysiaDate(now),dates=[...new Set(points.map(p=>p.date))].filter(d=>d>=firstDate).slice(0,7);
 const daily=dates.map(date=>{
  const rows=points.filter(p=>p.date===date),temps=rows.flatMap(p=>[p.temp,p.high,p.low].filter(v=>v!==null));
  // Daily card summarises available forecast points, not observed daily extremes.
  const representative=rows.find(p=>new Date(Date.parse(p.time)+8*3600000).getUTCHours()>=12)||rows[0];
  return {date,high:Math.max(...temps),low:Math.min(...temps),symbol:representative.symbol,points:rows.length};
 });
 const current=points.find(p=>Date.parse(p.time)>=now-3600000)||points[points.length-1];
 if(Date.parse(points[points.length-1].time)<now)throw Error('Ramalan sudah luput.');
 return {provider:'MET Norway',updatedAt:raw.properties.meta?.updated_at||null,coordinates:raw.geometry?.coordinates||null,current,daily,points};
}

export function createForecastHandler({getStore,request=fetch,now=Date.now}={}){
 return async req=>{
  const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':status===200?'public, max-age=60, s-maxage=300':'no-store','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='GET')return json({error:'Kaedah tidak dibenarkan.'},405);
  const u=new URL(req.url),a=u.searchParams.get('lat'),b=u.searchParams.get('lon'),lat=Number(a),lon=Number(b);
  if(!a||!b||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<0||lat>8||lon<99||lon>120)return json({error:'Koordinat Malaysia tidak sah.'},400);
  const coordinate=lat.toFixed(4)+','+lon.toFixed(4),key='forecast/'+coordinate,clock=now();
  let store,previous;
  try{
   store=getStore();previous=await store.get(key,{type:'json'});
   if(previous?.expiresAt>clock)return json({...normaliseForecast(previous.raw,clock),fetchedAt:previous.fetchedAt,cached:true});
   const headers={'User-Agent':'PantauCawangan/1.0 (https://github.com/hudahaz/Weather-App)','Accept':'application/json','Accept-Encoding':'gzip, deflate'};
   if(previous?.lastModified)headers['If-Modified-Since']=previous.lastModified;
   const r=await request('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4),{headers,signal:AbortSignal.timeout(20000)});
   const expiry=Date.parse(r.headers.get('expires'));
   const expiresAt=Math.max(clock+60000,Number.isFinite(expiry)?expiry:clock+1800000);
   if(r.status===304&&previous){previous.expiresAt=expiresAt;await store.setJSON(key,previous);return json({...normaliseForecast(previous.raw,clock),fetchedAt:previous.fetchedAt,cached:true});}
   if(!r.ok)throw Error('Sumber ramalan: HTTP '+r.status);
   const raw=await r.json(),forecast=normaliseForecast(raw,clock);
   await store.setJSON(key,{raw,fetchedAt:clock,expiresAt,lastModified:r.headers.get('last-modified')});
   return json({...forecast,fetchedAt:clock,cached:false});
  }catch(error){
   // Retain a usable cached forecast with an explicit stale indicator.
   if(previous?.raw){try{return json({...normaliseForecast(previous.raw,clock),fetchedAt:previous.fetchedAt,stale:true,message:'Sambungan sumber gagal; memaparkan ramalan tersimpan.'});}catch{}}
   return json({error:'Ramalan tidak dapat dimuatkan. Cuba Muat semula. ('+(error.message||'Tiada sambungan')+')'},502);
  }
 };
}
