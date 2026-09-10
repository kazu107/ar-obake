import './style.css';
import {APP_VERSION,ASSET_VERSION,SETS,type SetId} from './data/sets';
import {beginTrial,observeTrial,finishTrial,summarizeTrials,type Trial} from './lab/measurements';
import {trackingConfig,type TrackingConfig} from './ar/tracking-config';
import {mount,el} from './ui/layout';
mount();
type LogEntry={at:string;message:string};
interface Session {id:string;tracking?:TrackingConfig;appVersion?:string;lastStartupStage?:string;startedAt:string;endedAt?:string;reason?:string;running:boolean;set:SetId;device:string;userAgent:string;requestedResolution:string;actualResolution?:string;totalStartupMs?:number;trackingInitMs?:number;elapsedSeconds:number;foundCount:number;fpsAverage?:number;fpsMin?:number;trials:Trial[];events:LogEntry[]}
let setId:SetId='one',frame:HTMLIFrameElement|undefined,active:Session|undefined,sessions:Session[]=[];
let readyAt=0,clickAt=0,lastFpsAt=0,frameSamples=0,fpsSum=0,isReady=false,trial:Trial|undefined;
const visible=new Set<string>(),STORAGE='ar-obake-lab-v1';
function notice(message:string){el('notice').textContent=message;el('notice').hidden=false;}
try{const raw=localStorage.getItem(STORAGE);if(raw){const parsed=JSON.parse(raw);if(parsed.schemaVersion===1&&Array.isArray(parsed.sessions)){sessions=parsed.sessions.filter((s:Session)=>s&&typeof s.id==='string'&&Array.isArray(s.events)&&Array.isArray(s.trials)).slice(-10);for(const s of sessions)if(s.running){s.running=false;s.reason='interrupted';s.events.push({at:new Date().toISOString(),message:'前回のページ終了を検出。再読み込み・強制終了などの区別はできません。'});}if(sessions.length)el('session-note').textContent=`この端末に${sessions.length}回分の記録があります。保存ボタンで書き出せます。`;}}}catch{notice('前回の記録を読み込めませんでした。今回の検証は開始できます。');}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({schemaVersion:1,appVersion:APP_VERSION,assetVersion:ASSET_VERSION,sessions:sessions.slice(-10)}));}catch{notice('端末に記録を保存できません。「記録を保存」で書き出してください。');}}
persist();
function renderEvents(){const list=el('events');list.replaceChildren();const latest=active??sessions[sessions.length-1];for(const event of (latest?.events??[]).slice(-8).reverse()){const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.textContent=new Date(event.at).toLocaleTimeString('ja-JP');text.textContent=event.message;li.append(time,text);list.append(li);}if(!list.children.length){const li=document.createElement('li');li.className='empty-log';li.textContent='カメラを開始すると記録が表示されます。';list.append(li);}}
function log(message:string){if(!active)return;active.events.push({at:new Date().toISOString(),message});active.events=active.events.slice(-200);renderEvents();persist();}
function setup(){el('set-description').textContent=SETS[setId].description;el('camera-label').textContent=`${SETS[setId].label}セット / ${setId==='nine'?'H01〜H08 · ANSWER':SETS[setId].ids.join(' · ')}`;el<HTMLSelectElement>('expected').replaceChildren(...SETS[setId].ids.map(id=>new Option(id,id)));el('overlay-text').textContent=`印刷した${SETS[setId].ids[0]}を用意して、カメラを開始してください。`;document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(b=>{b.classList.toggle('selected',b.dataset.set===setId);b.setAttribute('aria-pressed',String(b.dataset.set===setId));});}
function lock(running:boolean){el<HTMLButtonElement>('start').disabled=running;el<HTMLButtonElement>('stop').disabled=!running;el<HTMLSelectElement>('resolution').disabled=running;el<HTMLSelectElement>('tracking-mode').disabled=running;el<HTMLSelectElement>('ghost-motion').disabled=running;el<HTMLInputElement>('device-note').disabled=running;document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(b=>b.disabled=running);el<HTMLButtonElement>('trial-start').disabled=!isReady;}
function showOverlay(title:string,text:string){el('overlay').hidden=false;el('overlay-title').textContent=title;el('overlay-text').textContent=text;}
function updateTrialSummary(){const s=summarizeTrials(active?.trials??[]);el('trial-summary').textContent=s.attempts?`${s.attempts}回中 ${s.within3s}回が3秒以内 / 未検出 ${s.timeouts}回 / 別マーカー検出 ${s.wrongDetections}回`:'まだ計測していません。';}
function completeTrial(result:Trial){trial=undefined;active?.trials.push(result);el<HTMLSelectElement>('expected').disabled=false;el<HTMLButtonElement>('trial-start').disabled=!isReady;const seconds=((result.durationMs??0)/1000).toFixed(2);el('trial-result').textContent=result.outcome==='recognized'?`${result.expected}を ${seconds}秒で認識しました。`:result.outcome==='timeout'?`${result.expected}：10秒以内に認識できませんでした。`:'計測を中止しました。';log(`読取計測 ${result.expected}: ${result.outcome} (${seconds}s)`);updateTrialSummary();}
function stop(reason:string,message='カメラを停止しました。'){
  if(!frame)return;if(trial)completeTrial(finishTrial(trial,performance.now(),'cancelled'));isReady=false;
  if(active){if(readyAt)active.elapsedSeconds=(performance.now()-readyAt)/1000;active.running=false;active.endedAt=new Date().toISOString();active.reason=reason;}
  // The frame owns all AR resources, including upstream TensorFlow and Worker instances.
  frame.remove();frame=undefined;visible.clear();el('found-badge').hidden=true;el('status').textContent='停止中';el('status').classList.remove('live');lock(false);showOverlay('カメラは停止中です',message);el('guidance').textContent=message;log(message);persist();
}
function start(){
  if(frame)return;if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){showOverlay('カメラを使用できません','HTTPSのURLをSafariで開いてください。');return;}
  clickAt=performance.now();readyAt=0;frameSamples=0;fpsSum=0;isReady=false;trial=undefined;
  active={id:`${Date.now()}-${Math.random().toString(16).slice(2,8)}`,startedAt:new Date().toISOString(),appVersion:APP_VERSION,tracking:trackingConfig(el<HTMLSelectElement>('tracking-mode').value,el<HTMLSelectElement>('ghost-motion').value),running:true,set:setId,device:el<HTMLInputElement>('device-note').value.trim(),userAgent:navigator.userAgent,requestedResolution:el<HTMLSelectElement>('resolution').value,elapsedSeconds:0,foundCount:0,trials:[],events:[]};
  sessions.push(active);sessions=sessions.slice(-10);log(`${SETS[setId].label}セットの検証を開始`);
  for(const [id,value]of Object.entries({startup:'—',elapsed:'00:00',fps:'—','found-count':'0'}))el(id).textContent=value;
  el('trial-result').textContent='ARの準備ができると計測できます。';updateTrialSummary();
  frame=document.createElement('iframe');frame.title='マーカー認識カメラ';frame.allow='camera; autoplay';frame.className='ar-frame';frame.src=`./ar.html?set=${setId}&resolution=${encodeURIComponent(active.requestedResolution)}&tracking=${active.tracking!.mode}&motion=${active.tracking!.ghostMotion}&v=${APP_VERSION}`;
  el('stage').prepend(frame);lock(true);el('status').textContent='準備中';showOverlay('カメラを準備しています','確認が表示されたら、カメラの使用を許可してください。');el('guidance').textContent='準備中でも「停止する」で中止できます。';
}
window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='obake-lab'||!active)return;
  const d=event.data;
  switch(d.type){
    case 'loading':showOverlay('カメラを準備しています',String(d.stage));break;
    case 'diagnostic':active.lastStartupStage=String(d.stage);log(`開始確認 ${JSON.stringify(d)}`);break;
    case 'playback-required':el('overlay').hidden=true;el('status').textContent='映像の再生待ち';el('guidance').textContent='カメラ欄の「映像を表示」を押してください。';break;
    case 'tracking-config':active.tracking=d.config;log(`追従設定 ${JSON.stringify(d.config)}`);break;
    case 'camera':active.actualResolution=`${d.width} × ${d.height}`;log(`カメラ開始 ${active.actualResolution}`);break;
    case 'ready':isReady=true;readyAt=performance.now();lastFpsAt=readyAt;active.totalStartupMs=readyAt-clickAt;active.trackingInitMs=d.trackingInitMs;el('startup').textContent=`${(d.trackingInitMs/1000).toFixed(1)}s`;el('status').textContent='認識中';el('status').classList.add('live');el('overlay').hidden=true;el('guidance').textContent='印刷したカード全体を、カメラに向けてください。';el('trial-result').textContent='カードを画面の外に出してから、計測開始を押してください。';lock(true);log(`AR準備完了 ${active.actualResolution} / 許可後 ${(d.trackingInitMs/1000).toFixed(2)}s / 開始操作から ${(active.totalStartupMs/1000).toFixed(2)}s`);break;
    case 'found':if(!(SETS[setId].ids as readonly string[]).includes(d.id))return;visible.add(d.id);active.foundCount++;el('found-count').textContent=String(active.foundCount);el('found-badge').hidden=false;el('found-badge').textContent=`${d.id} を認識`;el('guidance').textContent=`${d.id}のおばけがカードに追従するか、角度をゆっくり変えてください。`;log(`${d.id}を認識（targetIndex ${d.targetIndex}）`);if(trial){trial=observeTrial(trial,d.id,performance.now());if(trial.outcome)completeTrial(trial);}break;
    case 'lost':visible.delete(d.id);if(!visible.size){el('found-badge').hidden=true;el('guidance').textContent='カードを探しています。全体が映るように向けてください。';}log(`${d.id}を見失いました`);break;
    case 'fps':if(isReady&&Number.isFinite(d.value)){lastFpsAt=performance.now();frameSamples++;fpsSum+=d.value;active.fpsAverage=fpsSum/frameSamples;active.fpsMin=Math.min(active.fpsMin??Infinity,d.value);el('fps').textContent=d.value.toFixed(0);}break;
    case 'restart-required':stop('orientation',String(d.reason));break;
    case 'error':{const message=d.name==='NotAllowedError'?'Safariがカメラの開始を許可しませんでした。サイト設定でカメラを許可し、許可済みならSafariを開き直して試してください。':d.name==='AbortError'?'カメラ映像の開始が中断されました。もう一度開始し、改善しない場合はSafariを開き直してください。':d.name==='NotFoundError'?'カメラを見つけられませんでした。カメラのある端末で試してください。':String(d.message||'カメラの開始に失敗しました。');log(`エラー [${d.stage??active.lastStartupStage??'unknown'}] ${d.name}: ${d.message}`);stop('error',message);showOverlay('カメラを開始できませんでした',message);el('status').textContent='要確認';break;}
  }
});
el('start').addEventListener('click',start);el('stop').addEventListener('click',()=>stop('user'));
document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(b=>b.addEventListener('click',()=>{if(!frame){setId=b.dataset.set as SetId;setup();}}));
el('trial-start').addEventListener('click',()=>{if(!isReady||trial)return;if(visible.size){el('trial-result').textContent='いったんカードを画面の外へ出し、認識表示が消えてから開始してください。';return;}trial=beginTrial(el<HTMLSelectElement>('expected').value,performance.now());el<HTMLSelectElement>('expected').disabled=true;el<HTMLButtonElement>('trial-start').disabled=true;el('trial-result').textContent='計測中… カードをカメラに向けてください。';log(`読取計測開始 ${trial.expected}`);});
el('export').addEventListener('click',()=>{if(!sessions.length){notice('まだ記録がありません。カメラを開始してから保存してください。');return;}persist();const blob=new Blob([JSON.stringify({schemaVersion:1,appVersion:APP_VERSION,assetVersion:ASSET_VERSION,exportedAt:new Date().toISOString(),measurementNote:'Recognition time includes manual card presentation. FPS is rendering, not tracking. Air 2 qualification requires physical tests.',sessions},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ar-obake-test-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('background','画面を離れたため停止しました。戻ったらカメラを開始してください。');});
window.addEventListener('pagehide',()=>stop('pagehide','ページを離れたため停止しました。'));
let ticks=0;
setInterval(()=>{const now=performance.now();if(frame&&!isReady&&now-clickAt>90000)stop('startup-timeout','準備に時間がかかっています。許可と通信を確認し、開始し直してください。');if(isReady&&active){active.elapsedSeconds=(now-readyAt)/1000;const s=Math.floor(active.elapsedSeconds);el('elapsed').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;if(now-lastFpsAt>15000)stop('unresponsive','描画の応答が止まりました。記録を保存して開始し直してください。');}if(trial&&now-trial.startedAtMs>=10000)completeTrial(finishTrial(trial,now,'timeout'));if(++ticks%5===0&&frame)persist();},1000);
setup();renderEvents();
