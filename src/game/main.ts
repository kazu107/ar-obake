import './style.css';
import './screens.css';
import { APP_VERSION, SETS } from '../data/sets';
import { correct, parseMission, type Answer, type Mission } from './mission';
import { collect, newProgress, submitAnswer, type Progress } from './progress';
import { loadProgress, saveProgress, type LoadResult } from '../storage/game-storage';
import { ScanGate } from './scan-gate';
import { escape as e, shell, welcome } from './ui';
import * as views from './screens';

type Screen='home'|'explore'|'memo'|'share'|'answer-scan'|'color'|'item'|'confirm'|'wrong'|'win'|'reset';
const app=document.querySelector<HTMLDivElement>('#app')!;
const simulation=import.meta.env.DEV && new URLSearchParams(location.search).has('simulate');
let mission:Mission, progress:Progress, gate:ScanGate, loaded:LoadResult, hasGame=false;
let screen:Screen='home',memoReturn:Screen='explore',resetReturn:Screen='home';
let selected:Partial<Answer>={},answerUnlocked=false,saveFailed=false;
let frame:HTMLIFrameElement|undefined,ready=false,simulating=false,openedAt=0,lastFrameAt=0;
let shownMarker:string|undefined;
let storage:Pick<Storage,'getItem'|'setItem'>;
try{storage=window.localStorage;}catch{storage={getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}};}
const byId=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const isScan=()=>screen==='explore'||screen==='answer-scan';
const isScanScreen=(s:Screen)=>s==='explore'||s==='answer-scan';

function persist(next:Progress) {
  progress=next;hasGame=true;saveFailed=!saveProgress(storage,mission,progress);showSaveWarning();
}
function showSaveWarning() {
  const notice=byId('save-warning');if(!notice)return;notice.hidden=!saveFailed;
  notice.textContent='このiPadに メモを ほぞんできません。あそぶことはできますが、ページをとじると メモがきえることがあります。スタッフに つたえてね。';
}
function stopCamera() {
  frame?.remove();frame=undefined;ready=false;simulating=false;shownMarker=undefined;gate?.reset();
}
function go(next:Screen,activateCamera=false) {
  stopCamera();screen=next;render();if(activateCamera&&isScan())startCamera();
  byId('game-main')?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});window.scrollTo(0,0);
}
function loadNotice() {
  if(loaded.kind==='invalid'||loaded.kind==='incompatible')return `<div class="notice error" role="alert">${loaded.kind==='incompatible'?'べつの問題・版のメモが のこっています。':'前のメモを よみこめませんでした。'}<br>スタッフに つたえてから、「さいしょから」で 新しいメモを つくってね。前のメモは、まだ けしていません。</div>`;
  if(loaded.kind==='unavailable')return '<div class="notice" role="alert">このiPadでは メモの ほぞんを使えません。ページをとじずに あそんでね。</div>';
  return '';
}
function render() {
  let content='';
  switch(screen){
    case 'home':content=loadNotice()+welcome(hasGame,progress.phase==='complete');break;
    case 'explore':case 'answer-scan':content=views.scan(mission,progress,screen==='answer-scan');break;
    case 'memo':content=`<div class="screen-top"><div><p class="kicker">きみだけの ヒント</p><h1 tabindex="-1">そうさメモ</h1></div></div><div class="memo-page-layout">${views.memo(mission,progress)}${views.hintList(mission,progress)}</div><div class="button-row memo-back"><button class="secondary" data-action="memo-back">もとの画面に もどる</button>${progress.phase!=='complete'?'<button class="primary" data-action="share">みんなと そうだんする →</button>':''}</div>`;break;
    case 'share':content=views.share(mission,progress);break;
    case 'color':case 'item':content=views.choose(mission,screen,selected);break;
    case 'confirm':content=views.confirm(mission,selected as Answer);break;
    case 'wrong':content=views.wrong(mission,selected as Answer);break;
    case 'win':content=views.win(mission);break;
    case 'reset':content='<section class="centered card"><h1 tabindex="-1">さいしょから あそぶ？</h1><p>このiPadの ゲームのメモと こたえを けして、<br>あたらしく はじめるよ。</p><div class="button-row"><button class="secondary" data-action="cancel-reset">もどる</button><button class="danger" data-action="confirm-reset">メモをけして はじめる</button></div></section>';break;
  }
  app.innerHTML=shell(`<div id="save-warning" class="notice" role="alert" hidden></div>${content}`,progress.markerIds.length,hasGame&&screen!=='home'&&screen!=='reset'&&screen!=='memo');
  byId('game-version')!.textContent=APP_VERSION;showSaveWarning();if(isScan())updateHint();
  if(import.meta.env.DEV && simulation && isScan()){
    const panel=document.createElement('details');panel.className='dev-controls';panel.open=true;
    panel.innerHTML='<summary>開発用：認識の代わり（実機試験ではありません）</summary>'+[...SETS[mission.markerSet].ids,'なし'].map(id=>`<button data-sim="${id}">${id}</button>`).join('');
    byId('game-main')!.append(panel);
  }
}
function cameraStatus(title:string,message:string,cover:boolean) {
  if(!isScan())return;
  byId('scan-status')!.textContent=title;byId('camera-title')!.textContent=title;byId('camera-message')!.textContent=message;
  byId('camera-cover')!.hidden=!cover;byId('scan-message')!.textContent=message;
  const running=!!frame||simulating;
  byId<HTMLButtonElement>('camera-action')!.disabled=running;byId('camera-action')!.textContent=running?'カメラを使用中':'カメラを開始';
  byId<HTMLButtonElement>('camera-stop')!.disabled=!running;
}
function pauseCamera(message:string) {
  if(!isScan())return;stopCamera();updateHint(true);cameraStatus('カメラは おやすみ中',message,true);
}
function startCamera() {
  if(!isScan()||frame||simulating)return;
  gate.reset();shownMarker=undefined;openedAt=lastFrameAt=performance.now();
  if(import.meta.env.DEV && simulation){simulating=true;ready=true;cameraStatus('開発用の認識','下の開発用ボタンで認識を再現します。',true);return;}
  if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){cameraStatus('カメラを使えません','HTTPSのURLを、iPadのSafariで ひらいてね。',true);return;}
  frame=document.createElement('iframe');frame.title='おばけをさがすカメラ';frame.allow='camera; autoplay';
  frame.src=`./ar.html?set=${mission.markerSet}&resolution=960&tracking=stable&motion=still&v=${APP_VERSION}`;
  byId('game-camera')!.prepend(frame);cameraStatus('じゅんび中','カメラの きょかが出たら「許可」をおしてね。',true);
}
function updateHint(force=false) {
  if(!isScan())return;
  const marker=ready?gate.eligible(performance.now()):undefined;
  if(!force&&marker===shownMarker&&byId('hint-panel')!.innerHTML)return;shownMarker=marker;
  const panel=byId('hint-panel')!;
  if(!marker){panel.innerHTML=`<p class="hint-placeholder">${screen==='answer-scan'?'ANSWERの カードを しばらく うつしてね。':'カードを しばらく うつすと、ヒントが出るよ。'}</p>`;return;}
  if(screen==='answer-scan'){
    if(marker===mission.answerMarker.markerId){answerUnlocked=true;selected={};go('color');}
    else panel.innerHTML='<p class="hint-placeholder">これは ヒントのカードだよ。ANSWERを さがしてね。</p>';
    return;
  }
  if(marker===mission.answerMarker.markerId){panel.innerHTML='<p class="hint-placeholder">これは こたえのカードだよ。<br>「みんなと そうだんする」から すすんでね。</p>';return;}
  const hint=mission.hints.find(h=>h.markerId===marker);if(!hint)return;
  const obtained=progress.markerIds.includes(marker);
  panel.innerHTML=`<section class="hint-bubble ${obtained?'recorded':''}"><span class="badge">${e(marker)}</span><h2>${e(hint.speaker)}</h2><p class="hint-text">${e(hint.text).replace(/\n/g,'<br>')}</p><button class="primary" data-action="collect" ${obtained?'disabled':''}>${obtained?'✓ メモに 記録ずみ':'ヒントを記録する'}</button></section>`;
}
app.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||button.disabled||!mission)return;
  try{
    if(import.meta.env.DEV && simulation && button.dataset.sim && simulating){gate.reset();if(button.dataset.sim!=='なし')gate.found(button.dataset.sim,performance.now());shownMarker=undefined;updateHint(true);return;}
    if(button.dataset.color&&screen==='color'&&answerUnlocked&&mission.colors.some(c=>c.id===button.dataset.color)){selected.color=button.dataset.color;render();return;}
    if(button.dataset.item&&screen==='item'&&answerUnlocked&&mission.items.some(c=>c.id===button.dataset.item)){selected.item=button.dataset.item;render();return;}
    switch(button.dataset.action){
      case 'new':if(screen!=='home')break;if(loaded.kind==='invalid'||loaded.kind==='incompatible'){resetReturn='home';go('reset');}else{persist(newProgress(mission));loaded={kind:'missing'};go('explore',true);}break;
      case 'continue':if(screen==='home'&&hasGame)go(progress.phase==='complete'?'win':progress.phase==='sharing'?'share':'explore',progress.phase==='exploring');break;
      case 'home':go('home');break;
      case 'reset':resetReturn=screen;go('reset');break;
      case 'cancel-reset':go(resetReturn,isScanScreen(resetReturn));break;
      case 'confirm-reset':if(screen==='reset'){selected={};answerUnlocked=false;loaded={kind:'missing'};persist(newProgress(mission));go('explore',true);}break;
      case 'explore':if(hasGame&&progress.phase!=='complete'){answerUnlocked=false;persist({...progress,phase:'exploring'});go('explore',true);}break;
      case 'camera':startCamera();break;
      case 'stop-camera':pauseCamera('また さがすときは「カメラを開始」をおしてね。');break;
      case 'collect':{if(screen!=='explore'||!ready)break;const id=gate.eligible(performance.now());if(!id||!mission.hints.some(h=>h.markerId===id))break;persist(collect(mission,progress,id));byId('mini-memo')!.innerHTML=views.memo(mission,progress,true);const badge=document.querySelector('.memo-shortcut span');if(badge)badge.textContent=String(progress.markerIds.length);shownMarker=undefined;updateHint();break;}
      case 'memo':if(hasGame&&screen!=='memo'){memoReturn=screen;go('memo');}break;
      case 'memo-back':go(memoReturn,isScanScreen(memoReturn));break;
      case 'share':if(hasGame&&progress.phase!=='complete'){answerUnlocked=false;persist({...progress,phase:'sharing'});go('share');}break;
      case 'answer-scan':if(screen==='share'){answerUnlocked=false;go('answer-scan',true);}break;
      case 'next-item':if(screen==='color'&&answerUnlocked&&selected.color)go('item');break;
      case 'confirm-answer':if(screen==='item'&&answerUnlocked&&selected.color&&selected.item)go('confirm');break;
      case 'back-color':if(answerUnlocked)go('color');break;
      case 'back-item':if(answerUnlocked)go('item');break;
      case 'submit-answer':if(screen==='confirm'&&answerUnlocked){persist(submitAnswer(mission,progress,selected as Answer));go(correct(mission,selected as Answer)?'win':'wrong');}break;
      case 'retry-answer':if(screen==='wrong'&&answerUnlocked){selected={};go('color');}break;
    }
  }catch{stopCamera();app.innerHTML=shell('<section class="centered card"><h1>メモを ひらけませんでした</h1><p>スタッフに つたえてね。前の保存は のこっています。</p><a class="secondary" href="./">はじめの画面に もどる</a></section>');}
});
window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='obake-lab'||!isScan())return;
  const d=event.data;
  switch(d.type){
    case 'loading':cameraStatus('じゅんび中',String(d.stage),true);break;
    case 'playback-required':cameraStatus('映像の再生待ち','カメラの中の「映像を表示」をおしてね。',false);break;
    case 'ready':ready=true;lastFrameAt=performance.now();cameraStatus('さがしています','カードの ぜんたいを うつしてね。',false);break;
    case 'found':if((SETS[mission.markerSet].ids as readonly unknown[]).includes(d.id))gate.found(d.id,performance.now());break;
    case 'lost':gate.lost(d.id);updateHint();break;
    case 'fps':if(ready&&Number.isFinite(d.value))lastFrameAt=performance.now();break;
    case 'restart-required':pauseCamera('画面の むきが かわりました。もういちど「カメラを開始」をおしてね。');break;
    case 'error':pauseCamera(d.name==='NotAllowedError'?'カメラを使えませんでした。Safariの設定でカメラを許可して、もういちど開始してね。':'カメラの じゅんびが できませんでした。通信を確認して、もういちど開始してね。');break;
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseCamera('画面をはなれたので、とめたよ。「カメラを開始」で つづけられるよ。');});
window.addEventListener('pagehide',stopCamera);
setInterval(()=>{
  if(!isScan())return;const now=performance.now();
  if(frame&&!ready&&now-openedAt>90000)pauseCamera('じゅんびに 時間がかかっています。通信とカメラの許可を確認してね。');
  if(frame&&ready&&now-lastFrameAt>15000)pauseCamera('カメラが とまったようです。もういちど 開始してね。');
  if(ready)updateHint();
},100);
async function boot(){
  app.innerHTML=shell('<section class="loading"><h1>ミッションを じゅんび中…</h1></section>');
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch(new URL('./missions/prototype.json',document.baseURI),{signal:abort.signal});if(!response.ok)throw Error('Mission unavailable');
    mission=parseMission(await response.json());gate=new ScanGate(SETS[mission.markerSet].ids);
    loaded=loadProgress(storage,mission);hasGame=loaded.kind==='valid';progress=loaded.kind==='valid'?loaded.progress:newProgress(mission);render();
  }catch{app.innerHTML=shell('<section class="centered card"><h1>ミッションを よみこめません</h1><p>通信を確認して、もういちど ひらいてね。<br>なおらないときは スタッフに つたえてね。</p><a class="primary" href="./">もういちど よみこむ</a></section>');}
  finally{clearTimeout(timeout);}
}
void boot();
