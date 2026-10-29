// Local QA only. This file is outside Netlify's public/functions directories.
// The deployed app never uses these identities, fixtures or in-memory storage.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import seed from '../netlify/functions/lib/history-seed.mjs';
import {createHistoryHandler} from '../netlify/functions/lib/history-handler.mjs';
import {rollingDates} from '../public/history-core.mjs';
const blobs=new Map();let version=0;
const store={getWithMetadata:async key=>blobs.get(key)||null,get:async key=>blobs.get(key)?.data||null,setJSON:async(key,data,condition={})=>{const old=blobs.get(key);if(condition.onlyIfNew&&old||condition.onlyIfMatch&&old?.etag!==condition.onlyIfMatch)return {modified:false};blobs.set(key,{data:structuredClone(data),etag:String(++version)});return {modified:true};},delete:async key=>blobs.delete(key)};
const admin={id:'qa-admin',name:'QA Admin',username:'qa',active:true,role:'admin'};
const history=createHistoryHandler({getStore:()=>store,seed,env:{SUPABASE_SECRET_KEY:'qa-only'},request:async url=>Response.json(url.includes('/auth/')?{id:admin.id}:[admin])});
const root=path.resolve('public');
const sdk=`<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'qa-admin'}}}),getSession:async()=>({data:{session:{access_token:'qa-only'}}}),signOut:async()=>({data:null})},from:table=>{const value=table==='report_profiles'?${JSON.stringify(admin)}:[];const query={select(){return this},eq(){return this},order(){return this},range(){return this},single(){return this},then(resolve){return Promise.resolve({data:value}).then(resolve)}};return query;}})};</script>`;
http.createServer(async(incoming,out)=>{
 try {
  const url=new URL(incoming.url,'http://localhost');let response;
  if(url.pathname==='/api/historical-data'){
   const data=[];for await(const c of incoming)data.push(c);
   const headers=new Headers(incoming.headers);headers.delete('origin');
   response=await history(new Request('http://localhost'+incoming.url,{method:incoming.method,headers,...(incoming.method==='POST'?{body:Buffer.concat(data)}:{})}));
  }else if(url.pathname==='/api/report-users')response=Response.json({users:[admin]});
  else if(url.pathname==='/api/data')response=Response.json({empty:true,serverNow:Date.now(),nextAllowedAt:Date.now()+1800000});
  else if(url.pathname==='/api/forecast'){
   const dates=rollingDates().slice(0,7),points=dates.map(date=>({date,time:date+'T04:00:00Z',temp:29,precip:2,period:6,symbol:'rain',wind:7,humidity:80}));
   response=Response.json({updatedAt:new Date().toISOString(),current:points[0],points,daily:dates.map(date=>({date,low:25,high:32,symbol:'rain',points:1}))});
  }else{
   let file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error('Invalid path');
   let content=await readFile(file);const ext=path.extname(file);
   if(ext==='.html'&&url.searchParams.get('qa')==='admin')content=Buffer.from(content.toString().replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]+><\/script>/,sdk));
   response=new Response(content,{headers:{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.txt':'text/plain','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})[ext]||'application/octet-stream'}});
  }
  out.writeHead(response.status,Object.fromEntries(response.headers));out.end(Buffer.from(await response.arrayBuffer()));
 }catch(err){out.writeHead(404,{'Content-Type':'text/plain'});out.end(err.message);}
}).listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0');
