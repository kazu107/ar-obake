import type { Mission } from './mission';
export const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const icon = (kind: string) => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${({
  hat: '<path d="M18 39l5-23h18l5 23M9 40h46v8H9zM22 29h20"/>',
  glasses: '<circle cx="18" cy="34" r="12"/><circle cx="46" cy="34" r="12"/><path d="M30 33q2-4 4 0M6 32l-2-8m54 8 2-8"/>',
  tie: '<path d="M24 9h16l-4 12 8 28-12 9-12-9 8-28zM28 21h8"/>',
  ribbon: '<path d="M27 25L9 15v34l18-10m10-14 18-10v34L37 39"/><rect x="25" y="23" width="14" height="18" rx="5"/>',
  note: '<rect x="14" y="9" width="40" height="48" rx="5"/><path d="M9 19h10M9 32h10M9 45h10M29 23h14M29 34h14M29 45h9"/>',
  scan: '<path d="M9 24V10h15m16 0h15v14M9 40v14h15m16 0h15V40M18 32h28"/>',
  chat: '<path d="M10 13h44v31H30L17 55V44h-7zM21 24h22M21 33h15"/>',
} as Record<string,string>)[kind]??''}</svg>`;

export function hintMarkerLabel(m:Mission):string {
  const ids=m.hints.map(h=>h.markerId);return ids.length<=4?ids.join('・'):`${ids[0]}〜${ids[ids.length-1]}`;
}

export function shell(content: string, count = 0, active = false, mission?:Mission, practice=false) {
  const home=practice?'./?mission=practice':'./';
  return `<header class="game-header"><a class="brand" href="${home}">ARおばけ探偵団</a>${active?`<button class="memo-shortcut" data-action="memo">${icon('note')}そうさメモ <span>${count}</span></button>`:`<span class="edition">${mission?mission.hints.length+1:practice?4:9}枚のミッション</span>`}</header><main id="game-main" class="game-shell">${content}</main><footer class="game-footer"><span>試作版 · <span id="game-version"></span></span><a href="${practice?'./':'./?mission=practice'}">${practice?'9枚であそぶ':'4枚の試作であそぶ'}</a><a href="./lab.html">カメラの検証</a><a href="./guide.html#reader" target="_blank" rel="noopener">表示でこまったら</a></footer>`;
}

export function welcome(m:Mission,hasSave = false, completed = false) {
  return `<section class="welcome"><div class="welcome-main"><p class="kicker">きみも、おばけたんてい。</p><h1 tabindex="-1">${escape(m.title)}</h1><p class="lead">おばけが みにつけているのは、<br><strong>なにいろの、どんなアイテム？</strong></p><p>カードの おばけから ヒントをあつめて、<br>みんなと いっしょに かんがえよう。</p><div class="start-actions"><button class="primary" data-action="${hasSave?'continue':'new'}">${hasSave?completed?'せいかいを もういちど見る':'つづきから あそぶ':'たんけんを はじめる'} <span aria-hidden="true">→</span></button>${hasSave?'<button class="text-button" data-action="reset">さいしょから あそぶ</button>':''}</div><p class="small">カメラの きょかが出たら「許可」をおしてね。</p></div><div class="how-to"><h2>あそびかた</h2><ol class="steps"><li>${icon('scan')}<div><strong>カードを さがそう</strong><p>${escape(hintMarkerLabel(m))}を よむと、<br>おばけが ヒントをくれるよ。</p></div></li><li>${icon('note')}<div><strong>ヒントを メモしよう</strong><p>「ヒントを記録する」を おして、<br>じぶんの メモに のこそう。</p></div></li><li>${icon('chat')}<div><strong>みんなと そうだん</strong><p>メモを 見せあったら、<br>だいひょうが ANSWERを よもう。</p></div></li></ol><a class="print-link" href="./print.html" target="_blank" rel="noopener">スタッフの方へ：${m.hints.length+1}枚のカードを印刷 ↗</a></div></section>`;
}
