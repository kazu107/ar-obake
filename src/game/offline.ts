import { APP_VERSION } from '../data/sets';

export type OfflineState='checking'|'not-ready'|'preparing'|'ready'|'unavailable'|'error';
export interface OfflineStatus { state:OfflineState; detail:string }

const requiredPaths=[
  './','./index.html','./ar.html','./manifest.webmanifest',
  './missions/main.json','./missions/prototype.json','./models/ghost.glb',
  './targets/ten.mind','./targets/four.mind',
];

function sameOriginResources():string[]{
  return performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>{
    try{return new URL(url).origin===location.origin;}catch{return false;}
  });
}

async function send(type:'status'|'prepare',urls:string[]=[]):Promise<OfflineStatus>{
  const registration=await navigator.serviceWorker.ready;
  const worker=registration.active??registration.waiting??registration.installing;
  if(!worker)throw new Error('Service Worker is not active');
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timer=window.setTimeout(()=>reject(new Error('Offline preparation timed out')),120000);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data as OfflineStatus);};
    worker.postMessage({type,version:APP_VERSION,urls},[channel.port2]);
  });
}

export async function registerOffline():Promise<OfflineStatus>{
  if(!('serviceWorker' in navigator)||!isSecureContext)return {state:'unavailable',detail:'この環境ではオフライン準備を使えません。'};
  try{
    await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
    return await send('status');
  }catch{return {state:'error',detail:'オフライン準備の状態を確認できませんでした。'};}
}

export async function prepareOffline():Promise<OfflineStatus>{
  if(!('serviceWorker' in navigator)||!isSecureContext)return {state:'unavailable',detail:'この環境ではオフライン準備を使えません。'};
  try{
    await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
    const urls=[...new Set([...requiredPaths.map(path=>new URL(path,document.baseURI).href),...sameOriginResources()])];
    return await send('prepare',urls);
  }catch{return {state:'error',detail:'必要なデータを保存できませんでした。通信を確認してもう一度試してください。'};}
}
