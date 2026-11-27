/* Service worker: cache local da experiência, sem interceptar YouTube ou outros domínios. */
const VERSION = 'surpresa-noa-1263bd5f5d19';
const CACHE_PREFIX = 'noa:' + self.registration.scope + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const AUDIO = ["./assets/audio/3Xzb2uNlf0s.mp3","./assets/audio/Bm2Eg2X4kZA.mp3","./assets/audio/JBfAtRvW1Ao.mp3","./assets/audio/Oq-xMg1xbic.mp3","./assets/audio/tbYHzoBL8ec.mp3"];
const AUDIO_VERSION = '464c40035be97fb3';
const AUDIO_CACHE = CACHE_PREFIX + 'audio-' + AUDIO_VERSION;
const SHELL = ["./","./app-1263bd5f5d19.js","./assets/fonts/font-5d2286941a6b02a2.woff2","./assets/fonts/font-723cc14fe86bc9fa.woff2","./assets/fonts/font-8176ed854ef40b2c.woff2","./assets/fonts/font-92b56ef499fee20b.woff2","./assets/fonts/font-ac079950fd988526.woff2","./assets/fonts/font-cf3c285d1ec1ee93.woff2","./assets/images/image-013d0da76d63be7f.jpg","./assets/images/image-01fee62c67859e28.webp","./assets/images/image-09f7f38a5d363d48.jpg","./assets/images/image-193466e471c0ed00.jpg","./assets/images/image-1a5d4584d6d4c6d7.jpg","./assets/images/image-1b1a6f2d8727c7f2.jpg","./assets/images/image-2a3f7f254410aba7.jpg","./assets/images/image-2aa2b0c4930a26cd.webp","./assets/images/image-2af64cd80f17e41d.jpg","./assets/images/image-31d715e3aef6ac03.jpg","./assets/images/image-3cd4274e01a80fd4.jpg","./assets/images/image-3f05a939ec10c010.webp","./assets/images/image-3fdc3d9d21b5dedc.webp","./assets/images/image-4c2e6c781a57d71b.webp","./assets/images/image-5530e4ff0d14498b.jpg","./assets/images/image-5bf745eb397e534f.webp","./assets/images/image-5e31d7968433ac2c.jpg","./assets/images/image-60f0fa8a4b7bc4f8.jpg","./assets/images/image-6541f57c25377728.jpg","./assets/images/image-66526e1108eb0253.jpg","./assets/images/image-6c48825e8878c2f1.webp","./assets/images/image-6f3fefc4849a67ce.jpg","./assets/images/image-73e695ca7b132e25.webp","./assets/images/image-76e29a1896808306.webp","./assets/images/image-8997a649813e02dc.webp","./assets/images/image-9091a24cc044b376.webp","./assets/images/image-944ba8841ff4a8f9.jpg","./assets/images/image-97733a5f9429b1c9.webp","./assets/images/image-a1461a00fa5b46f8.jpg","./assets/images/image-a1d3cf40d0b56a88.webp","./assets/images/image-b7c8d1a3aa9659b8.gif","./assets/images/image-bc6d328bd9467067.webp","./assets/images/image-c03579f619c7b65a.jpg","./assets/images/image-c42ced20a651eb07.webp","./assets/images/image-c5c8b8dafb67e0a2.webp","./assets/images/image-cc1fc8443458e2db.webp","./assets/images/image-ce789c008a963e68.webp","./assets/images/image-deb2c119e2b0073a.webp","./assets/images/image-ea073a929cff673b.webp","./assets/images/image-edc58620c6ff18ef.webp","./assets/images/image-fd2acab3eafdc9c6.jpg","./assets/images/image-fe2b6e46d4717d53.jpg","./icons/icon-192.png","./icons/icon-512.png","./index.html","./manifest.webmanifest","./style-1263bd5f5d19.css"];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    // Large music files are cached only on explicit request, not during startup.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== AUDIO_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request,{cache:"no-cache"});
        // The precached shell remains version-consistent until the next worker installs.
        if (response.ok) return response;
        return (await (await caches.open(CACHE_NAME)).match('./')) || response;
      } catch {
        return (await (await caches.open(CACHE_NAME)).match(request)) || (await (await caches.open(CACHE_NAME)).match('./')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.includes('/assets/audio/') && /\.mp3$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const cached = await cache.match(request.url);
      const range = request.headers.get('Range');
      if (!cached) return fetch(request);
      if (!range) return cached;
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m || (!m[1] && !m[2])) return fetch(request);
      const blob = await cached.blob(), size = blob.size;
      const start = m[1] ? Number(m[1]) : Math.max(0,size-Number(m[2]));
      const end = m[1] && m[2] ? Math.min(size-1,Number(m[2])) : size-1;
      if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)
        return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
      return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}});
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (url.pathname.includes('/assets/') || /\.(?:js|css|woff2|png|webp|jpe?g|gif|svg|webmanifest)$/.test(url.pathname))) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  if (!['NOA_CACHE_AUDIO','NOA_AUDIO_STATUS'].includes(event.data?.type) || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    let done=0,failed=0;
    try { const cache=await caches.open(AUDIO_CACHE);
      if(event.data.type==='NOA_AUDIO_STATUS'){let available=0;for(const relative of AUDIO){if(await cache.match(new URL(relative,self.registration.scope).href))available++;}port.postMessage({type:'status',available,total:AUDIO.length});return;}
      for(const relative of AUDIO){
        const url=new URL(relative,self.registration.scope).href;
        try { if(!await cache.match(url)) { const response=await fetch(url); if(response.status!==200)throw Error('incomplete audio'); await cache.put(url,response); } } catch { failed++; }
        port.postMessage({type:'progress',done:++done,total:AUDIO.length});
      }
    } catch { failed=Math.max(1,AUDIO.length-done); }
    port.postMessage({type:'complete',failed});
  })());
});
