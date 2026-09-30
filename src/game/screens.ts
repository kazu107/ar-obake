import type { Answer, Mission } from './mission';
import { candidates, memoMark, type Progress } from './progress';
import { escape as e, icon } from './ui';
import type { OfflineStatus } from './offline';
import { markerLabel, numberLabel } from './participant-text';
import type { MarkerSettings } from '../storage/marker-settings';
export type MemoSelection={field:'color'|'item';value:string};
const symbols={yes:'○',no:'×',unknown:'？'}, meanings={yes:'これだ！',no:'ちがう',unknown:'まだ わからない'};
export function memo(m:Mission,p:Progress,compact=false):string {
  const remaining=candidates(m,p.markerIds);
  const fields=(['color','item'] as const).map(field=>`<section class="memo-field"><h3>${field==='color'?'なにいろ？':'どんな もちもの？'}</h3><div class="memo-options">${(field==='color'?m.colors:m.items).map(c=>{
    const mark=memoMark(remaining,field,c.id);
    return `<div class="memo-option ${mark}" aria-label="${e(c.label)}：${meanings[mark]}">${'hex' in c?`<span class="color-dot" style="background:${c.hex}"></span>`:icon(c.icon)}<span class="choice-label">${e(c.label)}</span><strong class="mark">${symbols[mark]}</strong></div>`;
  }).join('')}</div></section>`).join('');
  return `<div class="notebook ${compact?'compact':''}"><div class="notebook-top"><span>${icon('note')}そうさめも</span><strong>${numberLabel(p.markerIds.length)} / ${numberLabel(m.hints.length)}</strong></div>${fields}${hintStamps(m,p)}${compact?'<button class="text-button" data-action="memo">めもを おおきく みる →</button>':`<p class="legend">○ これだ！　× ちがう　？ まだ わからない</p><p class="small">この たんまつで あつめた ひんとだけが のっているよ。</p>`}</div>`;
}
export function hintList(m:Mission,p:Progress):string {
  const hints=m.hints.filter(h=>p.markerIds.includes(h.markerId));
  return `<section class="clue-list"><h2>あつめた ひんと <span class="badge">${numberLabel(hints.length)}こ</span></h2>${hints.length?hints.map(h=>`<article class="saved-clue"><span class="badge">${markerLabel(h.markerId)}</span><div><h3>${e(h.speaker)}</h3><p>${e(h.text).replace(/\n/g,'<br>')}</p></div></article>`).join(''):'<p class="empty">まだ ひんとは ないよ。おばけの かーどを さがそう！</p>'}</section>`;
}
export function memoFeedback(m:Mission,p:Progress,selection:MemoSelection):string {
  const choice=(selection.field==='color'?m.colors:m.items).find(c=>c.id===selection.value);
  if(!choice)return '';
  const mark=memoMark(candidates(m,p.markerIds),selection.field,choice.id),noun=selection.field==='color'?'いろ':'もちもの';
  const choices=selection.field==='color'?m.colors:m.items,tail=(choices.findIndex(c=>c.id===choice.id)+.5)/choices.length*100;
  const state=mark==='no'?`この ${noun}では ないよ。`:mark==='yes'?`この ${noun}だよ！`:`この ${noun}かも しれないよ。`;
  const reason=p.markerIds.length===0?'まだ ひんとが ないよ。':mark==='unknown'?'ほかの ひんとも あつめてみよう。':'あつめた ひんとから わかったよ。';
  return `<aside id="memo-feedback" class="memo-feedback" style="--memo-tail:${tail}%" role="status"><strong>${e(choice.label)}</strong><p>${state}<br><small>${reason}</small></p><button data-action="close-memo-state" aria-label="ふきだしを とじる">×</button></aside>`;
}
export function scanMemo(m:Mission,p:Progress,selection?:MemoSelection):string {
  const remaining=candidates(m,p.markerIds);
  const row=(field:'color'|'item')=>`<div class="hud-memo-row" aria-label="${field==='color'?'いろ':'もちもの'}">${(field==='color'?m.colors:m.items).map(c=>{const mark=memoMark(remaining,field,c.id),open=selection?.field===field&&selection.value===c.id;return `<button type="button" class="hud-memo-option ${mark}" data-action="memo-state" data-memo-field="${field}" data-memo-value="${e(c.id)}" aria-label="${e(c.label)}：${meanings[mark]}" aria-expanded="${open}"${open?' aria-controls="memo-feedback"':''}>${'hex' in c?`<i class="color-dot" style="background:${c.hex}"></i>`:icon(c.icon)}<b>${symbols[mark]}</b></button>`;}).join('')}</div>`;
  return `${selection?memoFeedback(m,p,selection):''}<section class="hud-memo" aria-label="いろと もちものの そうさめも">${row('color')}${row('item')}</section>`;
}
export function scan(m:Mission,p:Progress,mode:'tutorial'|'explore'|'answer-scan'):string {
  const tutorial=mode==='tutorial',answerMode=mode==='answer-scan';
  return `<section class="immersive-scanner" aria-label="おばけの かめら"><div class="game-camera" id="game-camera"><div class="camera-hud"><button class="hud-button" data-action="home" aria-label="かめらを おわる">おわる</button><span id="scan-status" role="status">${tutorial?'れんしゅう':'かめらを はじめてね'}</span>${tutorial?'<span></span>':`<button class="hud-button" data-action="share">${answerMode?'そうだんへ もどる':'そうだんする'}</button>`}</div><div class="camera-cover" id="camera-cover"><div class="scan-symbol">${icon('scan')}</div><h2 id="camera-title">${tutorial?'「れんしゅう」を うつしてね':answerMode?'「こたえ」を うつしてね':'かーどを うつしてね'}</h2><p id="camera-message">かめらの おねがいが でたら、つかって よいほうを おしてね。</p><button class="primary" id="camera-action" data-action="camera">かめらを はじめる</button></div><div id="hint-panel" class="sr-only" aria-live="polite"></div>${tutorial?'':`<div id="mini-memo" class="immersive-memo">${scanMemo(m,p)}</div>`}<p class="sr-only" id="scan-message" role="status">かーどの ぜんたいを うつしてね。</p><button class="hud-pause" id="camera-stop" data-action="stop-camera" disabled>かめらを やすむ</button></div></section>`;
}
export function share(m:Mission,p:Progress):string {
  return `<div class="screen-top"><div><p class="kicker">かめらは おやすみ</p><h1 tabindex="-1">めもを みせあおう</h1></div><button class="secondary" data-action="explore">もっと さがす</button></div><div class="sharing-intro"><span>${icon('chat')}</span><p>きみの ひんとと、みんなの ひんと。<br><strong>あわせたら、なにが わかるかな？</strong></p></div><div class="share-layout">${memo(m,p)}${hintList(m,p)}</div><div class="representative card"><div><h2>こたえが きまったら</h2><p>だいひょうの ひとりが、「こたえ」の かーどを うつしてね。</p></div><button class="primary" data-action="answer-scan">「こたえ」を うつす →</button></div>`;
}
export function choose(m:Mission,field:'color'|'item',selected:Partial<Answer>):string {
  return `<section class="answer-screen"><p class="kicker">こたえを えらぼう　${field==='color'?'いち':'に'} / に</p><h1 tabindex="-1">${field==='color'?'もちものは なにいろ？':'どんな もちもの？'}</h1><p>みんなと そうだんした こたえを おしてね。</p><div class="answer-options">${(field==='color'?m.colors:m.items).map(c=>`<button class="answer-option ${selected[field]===c.id?'selected':''}" data-${field}="${e(c.id)}" aria-pressed="${selected[field]===c.id}">${'hex' in c?`<span class="color-dot" style="background:${c.hex}"></span>`:icon(c.icon)}<strong>${e(c.label)}</strong></button>`).join('')}</div><div class="button-row"><button class="secondary" data-action="${field==='color'?'share':'back-color'}">${field==='color'?'そうだんに もどる':'いろを えらびなおす'}</button><button class="primary" id="answer-next" data-action="${field==='color'?'next-item':'confirm-answer'}" ${selected[field]?'':'disabled'}>${field==='color'?'つぎへ':'こたえを かくにん'} →</button></div></section>`;
}
export function answerCard(m:Mission,a:Answer):string {
  const color=m.colors.find(c=>c.id===a.color)!,item=m.items.find(i=>i.id===a.item)!;
  return `<div class="answer-picture" style="color:${color.hex}">${icon(item.icon)}</div><p class="answer-name"><span class="color-dot" style="background:${color.hex}"></span>${e(color.label)}の ${e(item.label)}</p>`;
}
export function confirm(m:Mission,a:Answer):string {
  return `<section class="centered card"><p class="kicker">みんなの こたえ</p><h1 tabindex="-1">これで いいかな？</h1>${answerCard(m,a)}<div class="button-row"><button class="secondary" data-action="back-item">えらびなおす</button><button class="primary" data-action="submit-answer">このこたえに する！</button></div></section>`;
}
export function wrong(m:Mission,a:Answer):string {
  return `<section class="centered card"><p class="kicker">もういちど かんがえよう</p><h1 tabindex="-1">ちょっと ちがうみたい</h1>${answerCard(m,a)}<p>そうさめもを みて、みんなと そうだんしよう。<br>なんどでも こたえられるよ。</p><div class="button-row"><button class="secondary" data-action="share">そうだんに もどる</button><button class="primary" data-action="retry-answer">もういちど こたえる</button></div></section>`;
}
export function win(m:Mission):string {
  return `<section class="centered success"><p class="success-seal">○</p><p class="kicker">みんなの すいり、だいせいこう！</p><h1 tabindex="-1">せいかい！</h1>${answerCard(m,m.answer)}<p>おばけの ひみつが わかったね。<br><strong>すたっふに せいかいの がめんを みせよう！</strong></p><p class="small">つぎの ぼーるでの おばけたいじは、すたっふの あんないを きいてね。</p><div class="button-row"><button class="secondary" data-action="memo">あつめた めもを みる</button><button class="primary" data-action="reset">もういちど あそぶ</button></div></section>`;
}

export function staff(m:Mission,p:Progress,appVersion:string,offline:OfflineStatus,online:boolean,settings:MarkerSettings,settingsMessage:string):string {
  const phase={exploring:'探索中',sharing:'相談中',complete:'正解済み'}[p.phase];
  const started=new Date(p.startedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const elapsed=Math.max(0,Math.floor((Date.now()-p.startedAt)/60000));
  const offlineLabel={checking:'確認中',preparing:'準備中',ready:'準備完了','not-ready':'未準備',unavailable:'利用不可',error:'エラー'}[offline.state];
  const markers=[...(m.tutorialMarker?[m.tutorialMarker.markerId]:[]),...m.hints.map(h=>h.markerId),m.answerMarker.markerId];
  const orientationPanel=`<section class="card staff-orientations"><h2>マーカーごとのおばけの角度</h2><p>平行：壁に貼ったカード向け。垂直：机に置いたカードから立ち上がり、カードの下辺を向きます。吹き出しも同じ角度になります。</p><p class="small">この端末に保存し、次にカメラを開始すると反映します。グループのリセットでは消えません。初期設定はH01〜H03のみ垂直です。</p><div class="orientation-list">${markers.map(id=>`<label><span><strong>${e(id)}</strong> <small>${markerLabel(id)}</small></span><select data-marker-orientation="${e(id)}" aria-label="${e(id)}の角度"><option value="parallel" ${settings[id]==='parallel'?'selected':''}>平行（壁向け）</option><option value="perpendicular" ${settings[id]==='perpendicular'?'selected':''}>垂直（机向け）</option></select></label>`).join('')}</div><p id="orientation-status" role="status" class="small">${e(settingsMessage)}</p><button class="secondary" data-action="reset-orientations">角度を初期設定に戻す</button></section>`;
  const resourcesPanel=`<section class="card staff-resources"><h2>印刷・資料</h2><p>設置確認表はA4横で印刷し、設置場所と実際の角度、読み取り、設置・回収を記入できます。比較イラストは全10体のデザイン案です。</p><div class="button-row"><a class="secondary" href="./staff-checklist.pdf" target="_blank" rel="noopener">設置確認表を印刷（PDF）</a><a class="secondary" href="./ghost-variants-concept.png" target="_blank" rel="noopener">おばけの比較イラスト</a></div><p class="small">全10体を実装しました。H02〜H07にはこうもり・まくら・おかし・本・鈴・ほうき、ANSWERにはメモ帳とうなずきがあります。カードは0.8.0と同じです。</p></section>`;
  return `<section class="staff-screen"><div class="screen-top"><div><p class="kicker">STAFF</p><h1 tabindex="-1">スタッフ画面</h1></div><a class="secondary" href="./">ゲーム画面へ</a></div><div class="staff-grid"><article class="card"><h2>ゲームの状態</h2><dl class="staff-stats"><div><dt>進行</dt><dd>${phase}</dd></div><div><dt>練習</dt><dd>${p.tutorialComplete?'完了':'未完了'}</dd></div><div><dt>ヒント</dt><dd>${p.markerIds.length} / ${m.hints.length}</dd></div><div><dt>回答回数</dt><dd>${p.attempts.length}</dd></div><div><dt>開始</dt><dd>${e(started)}</dd></div><div><dt>経過</dt><dd>${elapsed}分</dd></div></dl><p class="staff-ids">${p.markerIds.length?e(p.markerIds.join('・')):'ヒント未取得'}</p></article><article class="card"><h2>端末の準備</h2><dl class="staff-stats"><div><dt>アプリ</dt><dd>${e(appVersion)}</dd></div><div><dt>Mission</dt><dd>v${m.version}</dd></div><div><dt>通信</dt><dd>${online?'オンライン':'オフライン'}</dd></div><div><dt>オフライン</dt><dd><span class="status-pill ${offline.state}">${offlineLabel}</span></dd></div></dl><p class="small">${e(offline.detail)}</p><button class="primary" data-action="prepare-offline" ${offline.state==='preparing'?'disabled':''}>${offline.state==='ready'?'オフラインデータを更新':'オフライン準備'}</button></article></div>${orientationPanel}${resourcesPanel}<section class="card staff-actions"><div><h2>次のグループ</h2><p>現在のヒントと回答を消し、TUTORIALから始められる状態にします。</p></div><button class="danger" data-action="staff-reset">次のグループへリセット</button></section></section>`;
}

function hintStamps(m:Mission,p:Progress):string {
  return `<section class="hint-record"><h3>ひんとの きろく</h3><ul class="hint-stamps">${m.hints.map(h=>{const obtained=p.markerIds.includes(h.markerId);return `<li class="${obtained?'obtained':'missing'}" aria-label="${markerLabel(h.markerId)}：${obtained?'きろくずみ':'まだ あつめていない'}"><span>${markerLabel(h.markerId)}</span><strong aria-hidden="true">${obtained?'✓':'−'}</strong></li>`;}).join('')}</ul></section>`;
}
