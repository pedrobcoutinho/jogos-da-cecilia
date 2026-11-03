/* Generated asset inventory is refreshed by preparar-publicacao.ps1. */
'use strict';
importScripts('./precache-manifest.js');
const ROOT=self.registration.scope;
const PREFIX='cecilia-offline-'+encodeURIComponent(new URL(ROOT).pathname)+'-';
const CACHE=PREFIX+self.CECILIA_PRECACHE.version;
const ASSETS=new Map(self.CECILIA_PRECACHE.files.map(file=>[new URL(file.url,ROOT).href,file.sha256]));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try{
      // Bounded batches avoid overloading the local Windows server.
      const files=[...ASSETS];
      for(let i=0;i<files.length;i+=4){
        await Promise.all(files.slice(i,i+4).map(async([url,expected])=>{
          const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
          if(!response.ok||response.type==='opaque')throw Error('Asset unavailable: '+url);
          const hash=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
          const actual=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
          if(actual!==expected)throw Error('Version mismatch: '+url);
          await cache.put(url,response);
        }));
      }
    }catch(error){await caches.delete(CACHE);throw error}
    // Never skipWaiting: existing games keep their complete previous version.
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    // No clients.claim/reload: activation follows the native safe lifecycle.
    // localStorage and saved progress are never touched.
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==new URL(ROOT).origin||!url.href.startsWith(ROOT))return;
  url.search='';url.hash='';
  if(url.pathname.endsWith('/'))url.pathname+='index.html';
  if(!ASSETS.has(url.href))return;
  event.respondWith((async()=>{
    const response=await (await caches.open(CACHE)).match(url.href);
    // Do not silently mix a newer network file into an active older release.
    return response||new Response('Arquivo offline indisponível. Reconecte e reabra o jogo.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
