import type { Mission } from './mission';
import { markerLabel, numberLabel } from './participant-text';
export const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const icon = (kind: string) => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${({
  hat: '<path d="M18 39l5-23h18l5 23M9 40h46v8H9zM22 29h20"/>',
  glasses: '<circle cx="18" cy="34" r="12"/><circle cx="46" cy="34" r="12"/><path d="M30 33q2-4 4 0M6 32l-2-8m54 8 2-8"/>',
  tie: '<path d="M24 9h16l-4 12 8 28-12 9-12-9 8-28zM28 21h8"/>',
  ribbon: '<path d="M27 25L9 15v34l18-10m10-14 18-10v34L37 39"/><rect x="25" y="23" width="14" height="18" rx="5"/>',
  gloves: '<path d="M12 31V18c0-3 5-3 5 0v9-14c0-3 5-3 5 0v13-16c0-3 5-3 5 0v16-13c0-3 5-3 5 0v18l4-6c2-3 7 0 5 4L31 48v9H17v-8c-3-3-5-7-5-12zm31 4V22c0-3 5-3 5 0v9-14c0-3 5-3 5 0v20l3-5c2-3 7 0 5 4l-8 13v8H41v-8l-3-5"/>',
  note: '<rect x="14" y="9" width="40" height="48" rx="5"/><path d="M9 19h10M9 32h10M9 45h10M29 23h14M29 34h14M29 45h9"/>',
  scan: '<path d="M9 24V10h15m16 0h15v14M9 40v14h15m16 0h15V40M18 32h28"/>',
  chat: '<path d="M10 13h44v31H30L17 55V44h-7zM21 24h22M21 33h15"/>',
} as Record<string,string>)[kind]??''}</svg>`;

export function hintMarkerLabel(m:Mission):string {
  const ids=m.hints.map(h=>markerLabel(h.markerId));return ids.length<=4?ids.join('・'):`${ids[0]}〜${ids[ids.length-1]}`;
}

export function shell(content: string, count = 0, active = false, mission?:Mission, practice=false, immersive=false, staff=false) {
  if(immersive)return `<main id="game-main" class="game-shell immersive-shell">${content}</main>`;
  const home=practice?'./?mission=practice':'./';
  const total=mission?mission.hints.length+1+(mission.tutorialMarker?1:0):practice?4:10;
  return `<header class="game-header"><a class="brand" href="${home}">おばけたんていだん</a>${active?`<button class="memo-shortcut" data-action="memo">${icon('note')}そうさめも <span>${numberLabel(count)}</span></button>`:`<span class="edition">${numberLabel(total)}まいの おはなし</span>`}</header><main id="game-main" class="game-shell">${content}</main><footer class="game-footer"><span>${staff?'試作版 · <span id="game-version"></span>':'おばけたんていだん'}</span><a href="${practice?'./':'./?mission=practice'}">${practice?'10まいで あそぶ':'4まいで あそぶ'}</a><a href="./?staff=1">すたっふの がめん</a><a href="./lab.html">かめらの かくにん</a><a href="./guide.html#reader" target="_blank" rel="noopener">ひょうじで こまったら</a></footer>`;
}

export function welcome(m:Mission,hasSave = false, completed = false) {
  const first=m.tutorialMarker?'れんしゅうを はじめる':'たんけんを はじめる',total=m.hints.length+1+(m.tutorialMarker?1:0);
  return `<section class="welcome"><div class="welcome-main"><p class="kicker">きみも、おばけたんてい。</p><h1 tabindex="-1">${escape(m.title)}</h1><p class="lead">おばけが みにつけているのは、<br><strong>なにいろの、どんな もちもの？</strong></p><p>かーどの おばけから ひんとを あつめて、<br>みんなと いっしょに かんがえよう。</p><div class="start-actions"><button class="primary" data-action="${hasSave?'continue':'new'}">${hasSave?completed?'せいかいを もういちど みる':'つづきから あそぶ':first} <span aria-hidden="true">→</span></button>${hasSave?'<button class="text-button" data-action="reset">さいしょから あそぶ</button>':''}</div><p class="small">かめらの おねがいが でたら、つかって よいほうを おしてね。がめんを おおきく したいときは、すたっふに きいてね。</p></div><div class="how-to"><h2>あそびかた</h2><ol class="steps"><li>${icon('scan')}<div><strong>${m.tutorialMarker?'まず れんしゅう':'かーどを さがそう'}</strong><p>${m.tutorialMarker?'「れんしゅう」を うつして、<br>おばけの みつけかたを ためそう。':`${escape(hintMarkerLabel(m))}を うつそう。`}</p></div></li><li>${icon('note')}<div><strong>ひんとは じどうで めも</strong><p>${escape(hintMarkerLabel(m))}を しばらく うつすと、<br>いろと もちものの めもが かわるよ。</p></div></li><li>${icon('chat')}<div><strong>みんなと そうだん</strong><p>めもを みせあったら、<br>だいひょうが「こたえ」を うつそう。</p></div></li></ol><a class="print-link" href="./print.html" target="_blank" rel="noopener">すたっふへ：${numberLabel(total)}まいの かーどを いんさつ ↗</a></div></section>`;
}
