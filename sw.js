/* 離線快取：模型與函式庫優先用快取（秒開），網頁與程式優先抓最新版（改版立即生效） */
const CACHE='bonewalker-v0.4.0';
const CORE=['./','index.html','css/style.css','js/config.js','js/data.js','js/game.js','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.includes('script.google')||u.hostname.includes('googleusercontent'))return;
  const heavy=/\.(glb|png)$/.test(u.pathname)||u.hostname!==location.hostname;
  if(heavy){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return res})));return}
  e.respondWith(fetch(e.request).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return res}).catch(()=>caches.match(e.request)))});
