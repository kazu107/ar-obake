import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url='http://127.0.0.1:5173/?simulate=1',key='ar-obake-game-v1:obake-mission-01';
const legacyKey='ar-obake-game-v1',legacy={schemaVersion:1,missionId:'obake-prototype',missionVersion:1,markerIds:['H01'],phase:'exploring',attempts:[]};
const browser=await chromium.launch({headless:true}),errors=[],passed=[];
await mkdir('.artifacts/nine-game',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({legacyKey,legacy})=>{if(!localStorage.getItem(legacyKey))localStorage.setItem(legacyKey,JSON.stringify(legacy));},{legacyKey,legacy});
  const action=name=>page.locator(`[data-action="${name}"]`).first();
  const marker=async id=>{await page.locator(`[data-sim="${id}"]`).click();await page.waitForTimeout(600);};
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(url);await action('new').waitFor();assert.equal(await page.locator('.edition').innerText(),'9枚のミッション');assert.ok((await page.locator('h1').innerText()).includes('8にん'));assert.equal(await page.locator('.notice.error').count(),0);
  await page.screenshot({path:'.artifacts/nine-game/home.png',fullPage:true});
  await action('new').click();assert.equal(await page.locator('.hint-stamps li').count(),8);assert.equal(await page.locator('.hint-stamps .obtained').count(),0);
  for(const id of ['H01','H02','H03'])await marker(id);
  assert.equal(await page.locator('.memo-option.yes').count(),0);assert.equal(await page.locator('.hint-stamps .obtained').count(),3);
  await marker('H03');assert.equal(await action('collect').count(),0);assert.equal((await saved()).markerIds.filter(id=>id==='H03').length,1);await marker('ANSWER');assert.equal(await page.locator('[data-color]').count(),0);
  await page.reload();await action('continue').click();assert.deepEqual((await saved()).markerIds,['H01','H02','H03']);
  await page.goto('http://127.0.0.1:5173/?mission=practice&simulate=1');await action('continue').waitFor();assert.equal(await page.locator('.edition').innerText(),'4枚のミッション');await action('continue').click();assert.equal(await page.locator('.hint-stamps li').count(),3);assert.equal(await page.locator('.hint-stamps .obtained').count(),1);
  await page.goto(url);await action('continue').click();
  // Deliberately omit H04: the other seven must still identify both answer components.
  for(const id of ['H05','H06','H07','H08'])await marker(id);
  assert.equal(await page.locator('.hint-stamps .obtained').count(),7);assert.equal(await page.locator('.memo-option.yes').count(),2);
  await page.screenshot({path:'.artifacts/nine-game/seven-hints.png',fullPage:true});
  await action('share').click();assert.equal(await page.locator('.saved-clue').count(),7);assert.equal(await page.locator('iframe').count(),0);
  for(const [w,h]of [[768,1024],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});await noOverflow();await page.screenshot({path:`.artifacts/nine-game/share-${w}.png`,fullPage:true});}
  await action('answer-scan').click();await marker('H08');assert.equal(await page.locator('[data-color]').count(),0);await marker('ANSWER');
  await page.locator('[data-color="blue"]').click();await action('next-item').click();await page.locator('[data-item="hat"]').click();await action('confirm-answer').click();await action('submit-answer').click();assert.equal((await saved()).phase,'complete');
  await page.reload();await action('continue').click();assert.equal(await page.locator('h1').innerText(),'せいかい！');await action('reset').click();await action('cancel-reset').click();assert.equal((await saved()).phase,'complete');await action('reset').click();await action('confirm-reset').click();assert.deepEqual((await saved()).markerIds,[]);
  assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),legacyKey),legacy);
  passed.push('nine-card home and eight acquired-status indicators','stable recognition automatically records hints; duplicates and early ANSWER rejected','reload restores nine-card progress independently of legacy four-card progress','seven hints excluding H04 identify both answer components','seven clues displayed in consultation at 390/768/1024 without overflow','ANSWER, correct answer, completion restore, and confirmed reset','reset of nine-card mission preserves original four-card save');
  assert.deepEqual(errors,[]);await writeFile('docs/nine-game-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Chromium, development-only simulated recognition; physical iPad not tested',passed,pageErrors:errors},null,2)+'\n');console.log('NINE_GAME_BROWSER_OK');
}finally{await browser.close();}
