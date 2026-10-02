import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const url='http://127.0.0.1:5173/?simulate=1&windowed=1',key='ar-obake-game-v1:obake-mission-01';
const appVersion=JSON.parse(await readFile('package.json','utf8')).version;
const legacyKey='ar-obake-game-v1',legacy={schemaVersion:1,missionId:'obake-prototype',missionVersion:2,markerIds:['H01'],phase:'exploring',attempts:[],tutorialComplete:true};
const browser=await chromium.launch({headless:true}),errors=[],passed=[];
await mkdir('.artifacts/nine-game',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({legacyKey,legacy})=>{if(!localStorage.getItem(legacyKey))localStorage.setItem(legacyKey,JSON.stringify(legacy));},{legacyKey,legacy});
  const action=name=>page.locator(`[data-action="${name}"]`).first();
  const marker=async id=>{await page.locator(`[data-sim="${id}"]`).click();await page.waitForTimeout(600);};
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const hiragana=async()=>{const copy=await page.evaluate(()=>{const root=document.querySelector('#app').cloneNode(true);root.querySelectorAll('.dev-controls').forEach(e=>e.remove());return root.textContent+Array.from(root.querySelectorAll('[aria-label]')).map(e=>e.getAttribute('aria-label')).join('')+document.title;});assert.doesNotMatch(copy,/[\p{Script=Han}\p{Script=Katakana}A-Za-z]/u);};
  const option=(field,value)=>page.locator(`[data-memo-field="${field}"][data-memo-value="${value}"]`);
  await page.goto(url);await action('new').waitFor();assert.equal(await page.locator('.edition').innerText(),'10まいの おはなし');assert.ok((await page.locator('h1').innerText()).includes('8にん'));assert.equal(await page.locator('.notice.error').count(),0);await hiragana();
  await page.screenshot({path:'.artifacts/nine-game/home.png',fullPage:true});
  await action('new').click();assert.equal(await page.locator('.game-header').count(),0);assert.equal(await page.locator('.hud-memo').count(),0);await marker('TUTORIAL');await page.locator('.hud-memo').waitFor({timeout:5000});assert.equal((await saved()).tutorialComplete,true);assert.deepEqual((await saved()).markerIds,[]);
  // No clues: all eight options must be possible, including the eventual answer.
  for(const button of await page.locator('.hud-memo-option').all()){await button.click();assert.ok((await page.locator('#memo-feedback').innerText()).includes('かも しれないよ'));await hiragana();}
  await action('close-memo-state').click();assert.equal(await page.locator('#memo-feedback').count(),0);
  await option('color','green').click();await page.waitForTimeout(3000);assert.equal(await page.locator('#memo-feedback').count(),1);
  await option('color','blue').click();await page.waitForTimeout(2300);assert.equal(await page.locator('#memo-feedback strong').innerText(),'あお');
  await page.waitForFunction(()=>!document.querySelector('#memo-feedback'),{},{timeout:4000});assert.equal(await option('color','blue').getAttribute('aria-expanded'),'false');
  passed.push('memo feedback closes automatically after five seconds; choosing another option restarts the timer and leaves the camera running');
  await option('color','green').click();await page.locator('[data-sim="H01"]').evaluate(button=>button.click());await page.waitForTimeout(600);assert.ok((await page.locator('#memo-feedback').innerText()).includes('この いろでは ないよ。'));assert.equal(await option('color','green').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#memo-feedback').count(),0);
  for(const id of ['H01','H02','H03'])await marker(id);
  assert.equal(await page.locator('.hud-memo-option.yes').count(),0);assert.equal((await saved()).markerIds.length,3);assert.equal(await page.locator('.saved-clue,.hint-bubble,.hint-stamps').count(),0);
  await marker('H03');assert.equal(await action('collect').count(),0);assert.equal((await saved()).markerIds.filter(id=>id==='H03').length,1);await marker('ANSWER');assert.equal(await page.locator('[data-color]').count(),0);
  await page.reload();await action('continue').click();assert.deepEqual((await saved()).markerIds,['H01','H02','H03']);
  await page.goto('http://127.0.0.1:5173/?mission=practice&simulate=1&windowed=1');await action('continue').waitFor();assert.equal(await page.locator('.edition').innerText(),'4まいの おはなし');await action('continue').click();assert.equal(await page.locator('.hud-memo').count(),1);assert.equal(await page.locator('.hud-memo-option.no').count(),2);await hiragana();
  await page.goto(url);await action('continue').click();
  // Deliberately omit H04: the other seven must still identify both answer components.
  for(const id of ['H05','H06','H07','H08'])await marker(id);
  assert.equal((await saved()).markerIds.length,7);assert.equal(await page.locator('.hud-memo-option.yes').count(),2);
  for(const [w,h]of [[768,1024],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});await option('item','hat').click();assert.ok((await page.locator('#memo-feedback').innerText()).includes('この もちものだよ！'));await hiragana();await noOverflow();const bounds=await page.locator('#memo-feedback').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=w);await page.screenshot({path:`.artifacts/nine-game/memo-feedback-${w}.png`});await option('item','hat').click();assert.equal(await page.locator('#memo-feedback').count(),0);}
  await page.screenshot({path:'.artifacts/nine-game/seven-hints.png',fullPage:true});
  await action('share').click();assert.equal(await page.locator('.saved-clue').count(),7);assert.equal(await page.locator('iframe').count(),0);
  for(const [w,h]of [[768,1024],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});await noOverflow();await hiragana();await page.screenshot({path:`.artifacts/nine-game/share-${w}.png`,fullPage:true});}
  await action('answer-scan').click();await marker('H08');assert.equal(await page.locator('[data-color]').count(),0);await marker('ANSWER');
  assert.equal(await page.locator('[data-color]').count(),0);await action('home').click();await page.waitForTimeout(1600);assert.equal(await page.locator('[data-color]').count(),0);
  await action('continue').click();await action('answer-scan').click();await marker('ANSWER');await page.locator('[data-color="blue"]').waitFor({timeout:5000});passed.push('leaving the camera during the detective nod cancels the pending answer transition; scanning again resumes normally');
  await page.screenshot({path:'.artifacts/nine-game/answer-colors.png',fullPage:true});
  await page.locator('[data-color="blue"]').click();await action('next-item').click();await page.screenshot({path:'.artifacts/nine-game/answer-items.png',fullPage:true});await page.locator('[data-item="hat"]').click();await action('confirm-answer').click();await action('submit-answer').click();assert.equal((await saved()).phase,'complete');
  await page.reload();await action('continue').click();assert.equal(await page.locator('h1').innerText(),'せいかい！');await action('reset').click();await action('cancel-reset').click();assert.equal((await saved()).phase,'complete');await action('reset').click();await action('confirm-reset').click();assert.deepEqual((await saved()).markerIds,[]);
  await page.goto('http://127.0.0.1:5173/?staff=1');await page.locator('.staff-screen').waitFor();assert.ok((await page.locator('.staff-screen').innerText()).includes(appVersion));assert.ok((await page.locator('.staff-screen').innerText()).includes('Mission'));assert.equal(await page.locator('[data-action="staff-reset"]').count(),1);await page.screenshot({path:'.artifacts/nine-game/staff.png',fullPage:true});
  const orientation=id=>page.locator(`[data-marker-orientation="${id}"]`);
  assert.equal(await orientation('H01').inputValue(),'perpendicular');assert.equal(await orientation('H03').inputValue(),'perpendicular');assert.equal(await orientation('H04').inputValue(),'parallel');
  await orientation('H01').selectOption('parallel');await orientation('H04').selectOption('perpendicular');await page.reload();await page.locator('.staff-screen').waitFor();assert.equal(await orientation('H01').inputValue(),'parallel');assert.equal(await orientation('H04').inputValue(),'perpendicular');
  await action('staff-reset').click();await action('confirm-reset').click();assert.equal(await orientation('H01').inputValue(),'parallel');assert.equal(await orientation('H04').inputValue(),'perpendicular');
  await action('reset-orientations').click();assert.equal(await orientation('H01').inputValue(),'perpendicular');assert.equal(await orientation('H04').inputValue(),'parallel');
  assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),legacyKey),legacy);
  passed.push('participant text and accessible labels use hiragana in both missions','all eight memo buttons explain possible, excluded or confirmed state; open feedback updates with new clues; toggle/close/Escape work','feedback fits 390/768/1024 viewports','staff per-marker orientations default H01-H03 to perpendicular, survive reload and game reset, and reset independently','ten-card home starts with a tutorial marker and advances without recording it','full-viewport camera hides page chrome and only shows the compact deduction memo','stable recognition automatically records hints; duplicates and early ANSWER rejected','reload restores tutorial and clue progress independently of legacy four-card progress','seven hints excluding H04 identify both answer components','seven clues displayed in consultation at 390/768/1024 without overflow','ANSWER, correct answer, completion restore, and confirmed reset','reset of ten-card mission preserves original four-card save');
  assert.deepEqual(errors,[]);await writeFile('docs/nine-game-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Chromium, development-only simulated recognition; physical iPad not tested',passed,pageErrors:errors},null,2)+'\n');console.log('NINE_GAME_BROWSER_OK');
}finally{await browser.close();}
