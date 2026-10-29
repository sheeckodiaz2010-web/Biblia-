const C='biblia-v3';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','biblia.json','icon-192.png','apple-touch-icon.png'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.hostname.includes('groq')||u.searchParams.has('v')||u.searchParams.has('u'))return;
  if(u.pathname.endsWith('biblia.json')){e.respondWith(caches.match(r).then(h=>h||fetch(r).then(x=>{const cp=x.clone();caches.open(C).then(c=>c.put(r,cp));return x})));return}
  e.respondWith(caches.match(r).then(hit=>{
    const net=fetch(r).then(x=>{if(x.ok||x.type==='opaque'){const cp=x.clone();caches.open(C).then(c=>c.put(r,cp))}return x}).catch(()=>hit);
    return hit||net;
  }));
});
