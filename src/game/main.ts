import './style.css';
import './screens.css';
import { APP_VERSION, SETS } from '../data/sets';
import { correct, parseMission, type Answer, type Mission } from './mission';
import { collect, newProgress, submitAnswer, type Progress } from './progress';
import { loadProgress, saveProgress, type LoadResult } from '../storage/game-storage';
import { ScanGate } from './scan-gate';
import { escape as e, shell as pageShell, welcome } from './ui';
import * as views from './screens';
import { playRecordedSound, playSuccessSound, primeSound } from './sound';
import { prepareOffline, registerOffline, type OfflineStatus } from './offline';
import { numberLabel } from './participant-text';
import { defaultMarkerSettings, loadMarkerSettings, saveMarkerSettings, type MarkerSettings } from '../storage/marker-settings';

type Screen='home'|'staff'|'tutorial'|'explore'|'memo'|'share'|'answer-scan'|'color'|'item'|'confirm'|'wrong'|'win'|'reset';
const app=document.querySelector<HTMLDivElement>('#app')!;
const params=new URLSearchParams(location.search);
const practice=params.get('mission')==='practice';
const missionFile=practice?'./missions/prototype.json':'./missions/main.json';
const homeUrl=practice?'./?mission=practice':'./';
const simulation=import.meta.env.DEV && params.has('simulate');
const staffMode=params.has('staff');
const requestBrowserFullscreen=!import.meta.env.DEV||!params.has('windowed');
let mission:Mission, progress:Progress, gate:ScanGate, loaded:LoadResult, hasGame=false;
let screen:Screen='home',memoReturn:Screen='explore',resetReturn:Screen='home';
let selected:Partial<Answer>={},answerUnlocked=false,saveFailed=false;
let frame:HTMLIFrameElement|undefined,ready=false,simulating=false,openedAt=0,lastFrameAt=0;
let shownMarker:string|undefined;
let tutorialTimer:number|undefined;
let answerTimer:number|undefined;
let memoSelection:views.MemoSelection|undefined;
let markerSettings:MarkerSettings=defaultMarkerSettings(),settingsMessage='';
let offlineStatus:OfflineStatus={state:'checking',detail:'オフライン準備の状態を確認しています。'};
let storage:Pick<Storage,'getItem'|'setItem'>;
try{storage=window.localStorage;}catch{storage={getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}};}
const byId=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T|null;
const isScan=()=>isScanScreen(screen);
const isScanScreen=(s:Screen)=>s==='tutorial'||s==='explore'||s==='answer-scan';
const shell=(content:string,count=0,active=false)=>pageShell(content,count,active,mission,practice,isScan(),screen==='staff'||screen==='reset'&&resetReturn==='staff');
function saveOrientations() {
  settingsMessage=saveMarkerSettings(storage,markerSettings)?'角度を保存しました。次にカメラを開始すると反映します。':'角度を保存できません。このページを閉じると設定が戻ることがあります。';
  const status=byId('orientation-status');if(status)status.textContent=settingsMessage;
}
function updateMiniMemo() {
  const memo=byId('mini-memo');if(memo)memo.innerHTML=views.scanMemo(mission,progress,memoSelection);
}
function closeMemoFeedback() {
  if(!memoSelection)return;memoSelection=undefined;updateMiniMemo();
}

function persist(next:Progress) {
  progress={...next,updatedAt:Date.now()};hasGame=true;saveFailed=!saveProgress(storage,mission,progress);showSaveWarning();
}
function showSaveWarning() {
  const notice=byId('save-warning');if(!notice)return;notice.hidden=!saveFailed;
  notice.textContent='この たんまつに めもを ほぞんできません。あそぶことは できますが、とじると めもが きえることがあります。すたっふに つたえてね。';
}
function stopCamera() {
  if(tutorialTimer!==undefined){clearTimeout(tutorialTimer);tutorialTimer=undefined;}
  if(answerTimer!==undefined){clearTimeout(answerTimer);answerTimer=undefined;}
  frame?.remove();frame=undefined;ready=false;simulating=false;shownMarker=undefined;gate?.reset();
}
function enterFullscreen(){const root=document.documentElement;if(requestBrowserFullscreen&&!document.fullscreenElement&&root.requestFullscreen)void root.requestFullscreen().catch(()=>{});}
function leaveFullscreen(){if(document.fullscreenElement&&document.exitFullscreen)void document.exitFullscreen().catch(()=>{});}
function go(next:Screen,activateCamera=false) {
  const leavingCamera=isScan()&&!isScanScreen(next);stopCamera();memoSelection=undefined;screen=next;if(leavingCamera)leaveFullscreen();render();if(activateCamera&&isScan())startCamera();
  byId('game-main')?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});window.scrollTo(0,0);
}
function loadNotice() {
  if(loaded.kind==='invalid'||loaded.kind==='incompatible')return `<div class="notice error" role="alert">${loaded.kind==='incompatible'?'べつの おはなしの めもが のこっています。':'まえの めもを よみこめませんでした。'}<br>すたっふに つたえてから、「さいしょから」で あたらしい めもを つくってね。まえの めもは、まだ けしていません。</div>`;
  if(loaded.kind==='unavailable')return '<div class="notice" role="alert">この たんまつでは めもを ほぞんできません。とじずに あそんでね。</div>';
  return '';
}
function render() {
  let content='';
  switch(screen){
    case 'home':content=loadNotice()+welcome(mission,hasGame,progress.phase==='complete');break;
    case 'staff':content=views.staff(mission,progress,APP_VERSION,offlineStatus,navigator.onLine,markerSettings,settingsMessage);break;
    case 'tutorial':case 'explore':case 'answer-scan':content=views.scan(mission,progress,screen);break;
    case 'memo':content=`<div class="screen-top"><div><p class="kicker">きみだけの ひんと</p><h1 tabindex="-1">そうさめも</h1></div></div><div class="memo-page-layout">${views.memo(mission,progress)}${views.hintList(mission,progress)}</div><div class="button-row memo-back"><button class="secondary" data-action="memo-back">もとの がめんに もどる</button>${progress.phase!=='complete'?'<button class="primary" data-action="share">みんなと そうだんする →</button>':''}</div>`;break;
    case 'share':content=views.share(mission,progress);break;
    case 'color':case 'item':content=views.choose(mission,screen,selected);break;
    case 'confirm':content=views.confirm(mission,selected as Answer);break;
    case 'wrong':content=views.wrong(mission,selected as Answer);break;
    case 'win':content=views.win(mission);break;
    case 'reset':content=`<section class="centered card"><h1 tabindex="-1">${resetReturn==='staff'?'次のグループを始める？':'さいしょから あそぶ？'}</h1><p>この たんまつの めもと こたえを けして、<br>あたらしく はじめるよ。</p><div class="button-row"><button class="secondary" data-action="cancel-reset">もどる</button><button class="danger" data-action="confirm-reset">めもを けして はじめる</button></div></section>`;break;
  }
  document.body.classList.toggle('camera-mode',isScan());
  app.innerHTML=shell(`<div id="save-warning" class="notice" role="alert" hidden></div>${content}`,progress.markerIds.length,hasGame&&screen!=='home'&&screen!=='staff'&&screen!=='reset'&&screen!=='memo');
  const version=byId('game-version');if(version)version.textContent=APP_VERSION;showSaveWarning();if(isScan())updateHint();
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
  byId<HTMLButtonElement>('camera-action')!.disabled=running;byId('camera-action')!.textContent=running?'かめらを つかっているよ':'かめらを はじめる';
  byId<HTMLButtonElement>('camera-stop')!.disabled=!running;
}
function pauseCamera(message:string) {
  if(!isScan())return;stopCamera();updateHint(true);cameraStatus('かめらは おやすみ',message,true);
}
function startCamera() {
  if(!isScan()||frame||simulating)return;
  enterFullscreen();
  gate.reset();shownMarker=undefined;openedAt=lastFrameAt=performance.now();
  if(import.meta.env.DEV && simulation){simulating=true;ready=true;cameraStatus('ためす かめら','したの かくにんようの ぼたんで ためせるよ。',true);return;}
  if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){cameraStatus('かめらを つかえません','この がめんを ひらきなおしてね。なおらないときは、すたっふに きいてね。',true);return;}
  frame=document.createElement('iframe');frame.title='おばけを さがす かめら';frame.allow='camera; autoplay';
  frame.src=`./ar.html?set=${mission.markerSet}&mission=${practice?'practice':'main'}&resolution=960&tracking=stable&motion=still&v=${APP_VERSION}&orientations=${encodeURIComponent(JSON.stringify(markerSettings))}`;
  byId('game-camera')!.prepend(frame);cameraStatus('じゅんびちゅう','かめらの おねがいが でたら、つかって よいほうを おしてね。',true);
}
function updateHint(force=false) {
  if(!isScan())return;
  const marker=ready?gate.eligible(performance.now()):undefined;
  if(!force&&marker===shownMarker&&byId('hint-panel')!.innerHTML)return;shownMarker=marker;
  const panel=byId('hint-panel')!;
  if(!marker){panel.textContent=screen==='tutorial'?'「れんしゅう」の かーどを しばらく うつしてね。':screen==='answer-scan'?'「こたえ」の かーどを しばらく うつしてね。':'かーどを しばらく うつしてね。';return;}
  if(screen==='tutorial'){
    if(marker===mission.tutorialMarker?.markerId&&!progress.tutorialComplete&&tutorialTimer===undefined){
      persist({...progress,tutorialComplete:true});playRecordedSound();panel.textContent='れんしゅう せいこう。たんけんを はじめるよ。';
      tutorialTimer=window.setTimeout(()=>{tutorialTimer=undefined;if(screen==='tutorial')go('explore',true);},1500);
    }
    return;
  }
  if(screen==='answer-scan'){
    if(marker===mission.answerMarker.markerId){
      if(answerTimer===undefined){
        answerUnlocked=true;selected={};panel.textContent='こたえを かんがえよう。';
        // Leave time for the detective's short nod before closing the AR frame.
        answerTimer=window.setTimeout(()=>{answerTimer=undefined;if(screen==='answer-scan')go('color');},1500);
      }
    }
    else panel.innerHTML='<p class="hint-placeholder">これは ひんとの かーどだよ。「こたえ」を さがしてね。</p>';
    return;
  }
  if(marker===mission.answerMarker.markerId){panel.innerHTML='<p class="hint-placeholder">これは こたえの かーどだよ。<br>「みんなと そうだんする」から すすんでね。</p>';return;}
  const hint=mission.hints.find(h=>h.markerId===marker);if(!hint)return;
  const alreadyRecorded=progress.markerIds.includes(marker);
  if(!alreadyRecorded){
    persist(collect(mission,progress,marker));playRecordedSound();
    updateMiniMemo();
    const badge=document.querySelector('.memo-shortcut span');if(badge)badge.textContent=numberLabel(progress.markerIds.length);
  }
  panel.textContent=alreadyRecorded?'きろくずみの ひんとだよ。':'ひんとを じどうで きろくしたよ。';
}
app.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||button.disabled||!mission)return;
  primeSound();
  try{
    if(button.dataset.action==='memo-state'&&isScan()){
      const field=button.dataset.memoField,value=button.dataset.memoValue;
      if((field==='color'||field==='item')&&value&&(field==='color'?mission.colors:mission.items).some(c=>c.id===value)){
        const closing=memoSelection?.field===field&&memoSelection.value===value;
        memoSelection=closing?undefined:{field,value};updateMiniMemo();
        // Keep keyboard focus on the toggle after updating its current state.
        byId('mini-memo')?.querySelector<HTMLButtonElement>(`[data-memo-field="${field}"][data-memo-value="${value}"]`)?.focus({preventScroll:true});
      }
      return;
    }
    if(import.meta.env.DEV && simulation && button.dataset.sim && simulating){gate.reset();if(button.dataset.sim!=='なし')gate.found(button.dataset.sim,performance.now());shownMarker=undefined;updateHint(true);return;}
    if(button.dataset.color&&screen==='color'&&answerUnlocked&&mission.colors.some(c=>c.id===button.dataset.color)){selected.color=button.dataset.color;render();return;}
    if(button.dataset.item&&screen==='item'&&answerUnlocked&&mission.items.some(c=>c.id===button.dataset.item)){selected.item=button.dataset.item;render();return;}
    switch(button.dataset.action){
      case 'close-memo-state':closeMemoFeedback();break;
      case 'reset-orientations':if(screen==='staff'){markerSettings=defaultMarkerSettings();saveOrientations();render();}break;
      case 'new':if(screen!=='home')break;if(loaded.kind==='invalid'||loaded.kind==='incompatible'){resetReturn='home';go('reset');}else{persist(newProgress(mission));loaded={kind:'missing'};go(mission.tutorialMarker?'tutorial':'explore',true);}break;
      case 'continue':if(screen==='home'&&hasGame){const next=progress.phase==='complete'?'win':progress.phase==='sharing'?'share':progress.tutorialComplete?'explore':'tutorial';go(next,progress.phase==='exploring');}break;
      case 'home':go('home');break;
      case 'reset':resetReturn=screen;go('reset');break;
      case 'cancel-reset':go(resetReturn,isScanScreen(resetReturn));break;
      case 'confirm-reset':if(screen==='reset'){const returnToStaff=resetReturn==='staff';selected={};answerUnlocked=false;loaded={kind:'missing'};persist(newProgress(mission));go(returnToStaff?'staff':mission.tutorialMarker?'tutorial':'explore',!returnToStaff);}break;
      case 'staff-reset':if(screen==='staff'){resetReturn='staff';go('reset');}break;
      case 'prepare-offline':if(screen==='staff'){offlineStatus={state:'preparing',detail:'必要なデータをこのiPadへ保存しています。'};render();void prepareOffline().then(status=>{offlineStatus=status;if(screen==='staff')render();});}break;
      case 'explore':if(hasGame&&progress.phase!=='complete'){answerUnlocked=false;persist({...progress,phase:'exploring'});go('explore',true);}break;
      case 'camera':startCamera();break;
      case 'stop-camera':pauseCamera('また さがすときは「かめらを はじめる」をおしてね。');break;
      case 'memo':if(hasGame&&screen!=='memo'){memoReturn=screen;go('memo');}break;
      case 'memo-back':go(memoReturn,isScanScreen(memoReturn));break;
      case 'share':if(hasGame&&progress.phase!=='complete'){answerUnlocked=false;persist({...progress,phase:'sharing'});go('share');}break;
      case 'answer-scan':if(screen==='share'){answerUnlocked=false;go('answer-scan',true);}break;
      case 'next-item':if(screen==='color'&&answerUnlocked&&selected.color)go('item');break;
      case 'confirm-answer':if(screen==='item'&&answerUnlocked&&selected.color&&selected.item)go('confirm');break;
      case 'back-color':if(answerUnlocked)go('color');break;
      case 'back-item':if(answerUnlocked)go('item');break;
      case 'submit-answer':if(screen==='confirm'&&answerUnlocked){const solved=correct(mission,selected as Answer);persist(submitAnswer(mission,progress,selected as Answer));if(solved)playSuccessSound();go(solved?'win':'wrong');}break;
      case 'retry-answer':if(screen==='wrong'&&answerUnlocked){selected={};go('color');}break;
    }
  }catch{stopCamera();app.innerHTML=shell('<section class="centered card"><h1>めもを ひらけませんでした</h1><p>すたっふに つたえてね。まえの めもは のこっています。</p><a class="secondary" href="'+homeUrl+'">はじめの がめんに もどる</a></section>');}
});
app.addEventListener('change',event=>{
  const select=event.target as HTMLSelectElement,id=select.dataset.markerOrientation;
  if(screen!=='staff'||!id||!Object.prototype.hasOwnProperty.call(markerSettings,id)||(select.value!=='parallel'&&select.value!=='perpendicular'))return;
  markerSettings={...markerSettings,[id]:select.value};saveOrientations();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMemoFeedback();});
document.addEventListener('pointerdown',event=>{if(!(event.target as Element).closest('#mini-memo'))closeMemoFeedback();});
window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='obake-lab'||!isScan())return;
  const d=event.data;
  switch(d.type){
    case 'interaction':closeMemoFeedback();break;
    case 'loading':cameraStatus('じゅんびちゅう','かめらと おばけを じゅんびしているよ。おねがいが でたら、つかって よいほうを おしてね。',true);break;
    case 'playback-required':cameraStatus('かめらを うつしてね','かめらの なかの「かめらを うつす」を おしてね。',false);break;
    case 'ready':ready=true;lastFrameAt=performance.now();cameraStatus('さがしています','かーどの ぜんたいを うつしてね。',false);break;
    case 'found':if((SETS[mission.markerSet].ids as readonly unknown[]).includes(d.id))gate.found(d.id,performance.now());break;
    case 'lost':gate.lost(d.id);updateHint();break;
    case 'fps':if(ready&&Number.isFinite(d.value))lastFrameAt=performance.now();break;
    case 'restart-required':pauseCamera('がめんの むきが かわったよ。もういちど「かめらを はじめる」をおしてね。');break;
    case 'error':pauseCamera(d.name==='NotAllowedError'?'かめらを つかえなかったよ。すたっふに きょかの せっていを かくにんしてもらってね。':'かめらの じゅんびが できなかったよ。すたっふに つうしんを かくにんしてもらってね。');break;
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseCamera('がめんを はなれたので、とめたよ。「かめらを はじめる」で つづけられるよ。');});
window.addEventListener('pagehide',stopCamera);
window.addEventListener('online',()=>{if(screen==='staff')render();});
window.addEventListener('offline',()=>{if(screen==='staff')render();});
setInterval(()=>{
  if(!isScan())return;const now=performance.now();
  if(frame&&!ready&&now-openedAt>90000)pauseCamera('じゅんびに じかんが かかっているよ。すたっふに つうしんと かめらの きょかを かくにんしてもらってね。');
  if(frame&&ready&&now-lastFrameAt>15000)pauseCamera('かめらが とまったみたい。もういちど はじめてね。');
  if(ready)updateHint();
},100);
async function boot(){
  app.innerHTML=shell('<section class="loading"><h1>おはなしを じゅんびちゅう…</h1></section>');
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch(new URL(missionFile,document.baseURI),{signal:abort.signal});if(!response.ok)throw Error('Mission unavailable');
    mission=parseMission(await response.json());gate=new ScanGate(SETS[mission.markerSet].ids);
    const settings=loadMarkerSettings(storage);markerSettings=settings.settings;settingsMessage=settings.kind==='unavailable'?'この端末で設定を保存できません。初期設定を使用します。':settings.kind==='invalid'?'保存された角度設定を読み込めません。初期設定を使用します。':'この端末の角度設定です。変更は自動保存されます。';
    loaded=loadProgress(storage,mission);hasGame=loaded.kind==='valid';progress=loaded.kind==='valid'?loaded.progress:newProgress(mission);screen=staffMode?'staff':'home';render();
    void registerOffline().then(status=>{offlineStatus=status;if(screen==='staff')render();});
  }catch{app.innerHTML=shell('<section class="centered card"><h1>おはなしを よみこめません</h1><p>つうしんを かくにんして、もういちど ひらいてね。<br>なおらないときは すたっふに つたえてね。</p><a class="primary" href="'+homeUrl+'">もういちど よみこむ</a></section>');}
  finally{clearTimeout(timeout);}
}
void boot();
