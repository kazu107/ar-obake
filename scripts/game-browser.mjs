import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url='http://127.0.0.1:5173/?simulate=1';
const key='ar-obake-game-v1',errors=[],passed=[];
await mkdir('.artifacts/game',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const action=name=>page.locator(`[data-action="${name}"]`).first();
  const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const marker=async id=>{await page.locator(`[data-sim="${id}"]`).click();await page.waitForTimeout(600);};
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(url);await action('new').waitFor();await noOverflow();
  await page.screenshot({path:'.artifacts/game/welcome.png',fullPage:true});
  await action('new').click();await marker('H01');
  assert.equal((await saved()).markerIds.length,0);
  await marker('なし');assert.equal(await action('collect').count(),0);
  await marker('H01');await action('collect').click();assert.deepEqual((await saved()).markerIds,['H01']);assert.ok(await action('collect').isDisabled());
  assert.equal(await page.locator('.memo-option.no').count(),2);
  await action('stop-camera').click();assert.equal(await action('collect').count(),0);await action('camera').click();
  await marker('ANSWER');assert.ok((await page.locator('#hint-panel').innerText()).includes('そうだん'));assert.equal(await page.locator('[data-color]').count(),0);
  await page.screenshot({path:'.artifacts/game/explore.png',fullPage:true});
  passed.push('stable hint requires explicit collection; loss and stop hide unrecorded hint; duplicate collection prevented; early ANSWER does not skip consultation');
  await action('memo').click();assert.ok((await page.locator('.saved-clue').innerText()).includes('あかい'));await noOverflow();await action('memo-back').click();
  for(const id of ['H02','H03']){await marker(id);await action('collect').click();}
  assert.equal(await page.locator('.memo-option.yes').count(),2);
  await page.reload();await action('continue').click();assert.deepEqual((await saved()).markerIds,['H01','H02','H03']);
  const another=await browser.newContext(),second=await another.newPage();await second.goto(url);await second.locator('[data-action="new"]').waitFor();assert.equal(await second.evaluate(k=>localStorage.getItem(k),key),null);await another.close();
  passed.push('memo inference, three-clue solution, reload restoration, and isolated device storage');
  await action('share').click();await page.screenshot({path:'.artifacts/game/share.png',fullPage:true});
  await action('answer-scan').click();await marker('H01');assert.equal(await page.locator('[data-color]').count(),0);await marker('ANSWER');
  assert.ok(await page.locator('#answer-next').isDisabled());
  await page.locator('[data-color="red"]').click();await action('next-item').click();assert.ok(await page.locator('#answer-next').isDisabled());
  await page.locator('[data-item="glasses"]').click();await action('confirm-answer').click();await action('memo').click();await action('memo-back').click();assert.ok((await page.locator('.answer-name').innerText()).includes('あか'));await action('submit-answer').click();
  assert.ok((await page.locator('h1').innerText()).includes('ちがう'));assert.equal((await saved()).attempts.length,1);assert.equal((await saved()).phase,'sharing');
  await action('retry-answer').click();await page.locator('[data-color="blue"]').click();await action('next-item').click();await page.locator('[data-item="hat"]').click();await action('confirm-answer').click();await action('submit-answer').click();
  assert.equal((await saved()).phase,'complete');await page.screenshot({path:'.artifacts/game/win.png',fullPage:true});
  await page.reload();await action('continue').click();assert.equal(await page.locator('h1').innerText(),'せいかい！');await action('memo').click();await action('memo-back').click();assert.equal(await page.locator('h1').innerText(),'せいかい！');
  passed.push('ANSWER gate, required selections, memo from confirmation, wrong answer and retry, correct answer and persisted completion');
  await page.evaluate(()=>localStorage.setItem('ar-obake-lab-v1','preserved test log'));
  await action('reset').click();await action('cancel-reset').click();assert.equal((await saved()).phase,'complete');await action('reset').click();await action('confirm-reset').click();assert.equal((await saved()).markerIds.length,0);assert.equal(await page.evaluate(()=>localStorage.getItem('ar-obake-lab-v1')),'preserved test log');
  passed.push('reset confirmation and preservation of laboratory records');
  for(const [width,height] of [[768,1024],[1024,768],[390,844]]){
    await page.setViewportSize({width,height});await noOverflow();await marker('H01');await noOverflow();await page.screenshot({path:`.artifacts/game/scan-${width}.png`,fullPage:true});await action('memo').click();await noOverflow();await action('memo-back').click();
  }
  const invalid='{"schemaVersion":1,"missionId":"another","missionVersion":7}';
  await page.evaluate(({key,invalid})=>localStorage.setItem(key,invalid),{key,invalid});await page.reload();await action('new').waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),invalid);await action('new').click();await action('cancel-reset').click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),invalid);
  passed.push('incompatible save retained pending explicit reset; no horizontal overflow at 390, 768, 1024');
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});const b=await blocked.newPage();await b.goto(url);await b.locator('[data-action="new"]').click();assert.ok(await b.locator('#save-warning').isVisible());await blocked.close();
  const unavailable=await browser.newContext();const u=await unavailable.newPage();await u.route('**/missions/prototype.json',r=>r.fulfill({status:503,body:'unavailable'}));await u.goto(url);await u.getByText('ミッションを よみこめません',{exact:true}).waitFor();assert.equal(await u.locator('iframe').count(),0);await unavailable.close();
  passed.push('storage quota warning and mission loading failure');
  assert.deepEqual(errors,[]);await writeFile('docs/game-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Chromium, development-only simulated recognition; actual MindAR tested separately',passed,pageErrors:errors},null,2)+'\n');console.log('GAME_BROWSER_OK');
}finally{await browser.close();}
