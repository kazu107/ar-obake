const VERSION='0.6.0';
const CACHE=`ar-obake-${VERSION}`;
const READY=new URL('./offline-ready.json',self.registration.scope).href;

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('ar-obake-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));

function dependencies(text,base,contentType){
  const urls=[];
  const patterns=contentType.includes('text/html')?[/\b(?:src|href)=["']([^"']+)["']/g]:contentType.includes('text/css')?[/url\(["']?([^"')]+)["']?\)/g]:[/(?:\bfrom\s*|\bimport\s*\()\s*["']([^"']+)["']/g];
  for(const pattern of patterns){let match;while((match=pattern.exec(text))){
    if(contentType.includes('javascript')&&!match[1].startsWith('.'))continue;
    try{const url=new URL(match[1],base);if(url.origin===self.location.origin&&!url.href.startsWith('data:'))urls.push(url.href);}catch{}
  }}
  return urls;
}

async function cacheTree(initial){
  const cache=await caches.open(CACHE),queue=[...initial],seen=new Set();
  while(queue.length){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    const request=new Request(url,{cache:'reload'}),response=await fetch(request);
    if(!response.ok)throw new Error(`Unable to cache ${url}`);
    await cache.put(request,response.clone());
    const type=response.headers.get('content-type')??'';
    if(type.includes('text/html')||type.includes('text/css')||type.includes('javascript'))queue.push(...dependencies(await response.clone().text(),url,type));
  }
  await cache.put(READY,new Response(JSON.stringify({version:VERSION,preparedAt:Date.now()}),{headers:{'content-type':'application/json'}}));
}

self.addEventListener('message',event=>{
  const reply=value=>event.ports[0]?.postMessage(value);
  if(event.data?.type==='status')event.waitUntil((async()=>reply(await (await caches.open(CACHE)).match(READY)?{state:'ready',detail:'このiPadはオフラインでも起動できます。'}:{state:'not-ready',detail:'通信があるうちに「オフライン準備」を押してください。'}))());
  if(event.data?.type==='prepare')event.waitUntil(cacheTree(event.data.urls).then(()=>reply({state:'ready',detail:'オフライン準備が完了しました。'})).catch(()=>reply({state:'error',detail:'必要なデータを保存できませんでした。'})));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    if(event.request.mode==='navigate'){
      try{const response=await fetch(event.request);if(response.ok)(await caches.open(CACHE)).put(event.request,response.clone());return response;}
      catch{
        const path=new URL(event.request.url).pathname;
        const fallback=path.endsWith('/ar.html')?'./ar.html':path.endsWith('/lab.html')?'./lab.html':'./index.html';
        return (await caches.match(new URL(fallback,self.registration.scope).href))??Response.error();
      }
    }
    const cached=await caches.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    try{const response=await fetch(event.request);if(response.ok)(await caches.open(CACHE)).put(event.request,response.clone());return response;}
    catch{throw new Error('offline');}
  })());
});
