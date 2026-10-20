/* Offline shell cache. Never cache API requests, private admin pages or POST data. */
const CACHE="gorton-public-v1";
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/","/icons/icon-192.png","/icons/icon-512.png"])).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener("fetch",event=>{
  const r=event.request;const u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==self.location.origin||u.pathname.startsWith("/api/")||u.pathname.startsWith("/admin"))return;
  if(r.mode==="navigate"){
    event.respondWith(fetch(r).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put(r,clone));}return response;}).catch(()=>caches.match(r).then(hit=>hit||caches.match("/"))));
  }else{
    event.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(response=>{
      if(response.ok&&(u.pathname.startsWith("/_next/static/")||u.pathname.startsWith("/icons/")||u.pathname==="/manifest.webmanifest")){
        const clone=response.clone();caches.open(CACHE).then(c=>c.put(r,clone));
      }
      return response;
    })));
  }
});

self.addEventListener("message",event=>{
  if(event.data?.type!=="CACHE_ASSETS"||!Array.isArray(event.data.assets))return;
  const urls=event.data.assets.filter(raw=>{
    if(typeof raw!=="string")return false;
    try{const u=new URL(raw);return u.origin===self.location.origin&&u.pathname.startsWith("/_next/static/");}catch{return false;}
  }).slice(0,150);
  event.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(urls.map(url=>c.add(url)))));
});
