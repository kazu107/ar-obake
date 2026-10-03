import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const origin='http://127.0.0.1:5173/',query='?simulate=1&windowed=1';
const key='ar-obake-game-v1:obake-mission-01',legacyKey='ar-obake-game-v1',angleKey='ar-obake-marker-settings-v1';
const base={schemaVersion:1,missionId:'obake-mission-01',missionVersion:2,markerIds:[],phase:'exploring',attempts:[],tutorialComplete:false,startedAt:Date.now(),updatedAt:Date.now()};
const legacy={...base,missionId:'obake-prototype',tutorialComplete:true,markerIds:['H01']},angles={H01:'parallel',H04:'perpendicular'};
const browser=await chromium.launch({headless:true}),passed=[],errors=[];
await mkdir('.artifacts/camera-entry',{recursive:true});
const context=await browser.newContext({viewport:{width:768,height:1024}}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
const action=name=>page.locator(`[data-action="${name}"]`).first();
const menu=()=>page.locator('#camera-settings'),gear=()=>menu().locator('summary');
const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const raw=()=>page.evaluate(key=>localStorage.getItem(key),key);
const seed=async value=>{await page.evaluate(({key,value})=>value===null?localStorage.removeItem(key):localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value)),{key,value});await page.goto(origin+query);};
const scanner=async tutorial=>{await page.locator('.immersive-scanner').waitFor();assert.equal(await page.locator('.welcome,.game-header,.game-footer').count(),0);assert.equal(await page.locator('.hud-memo').count(),tutorial?0:1);};
const openMenu=async()=>{await gear().click();assert.equal(await menu().getAttribute('open'),'');};
try{
  await page.goto(origin+query);await scanner(true);assert.equal(await page.locator('#scan-status').innerText(),'ためす かめら');
  assert.equal((await saved()).tutorialComplete,false);assert.deepEqual((await saved()).markerIds,[]);
  await page.evaluate(({legacyKey,legacy,angleKey,angles})=>{localStorage.setItem(legacyKey,JSON.stringify(legacy));localStorage.setItem(angleKey,JSON.stringify(angles));},{legacyKey,legacy,angleKey,angles});
  for(const [width,height]of [[768,1024],[1024,768],[390,844]]){
    await page.setViewportSize({width,height});await openMenu();
    assert.equal(await action('home').innerText(),'たいとるへ もどる');assert.ok(await action('reset').isVisible());assert.ok(await action('staff').isVisible());
    const bounds=await page.locator('.settings-dropdown').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`.artifacts/camera-entry/menu-${width}.png`});await page.keyboard.press('Escape');assert.equal(await menu().getAttribute('open'),null);assert.ok(await gear().evaluate(element=>document.activeElement===element));
  }
  await openMenu();await page.locator('#camera-title').click();assert.equal(await menu().getAttribute('open'),null);assert.equal(await page.locator('#scan-status').innerText(),'ためす かめら');
  await openMenu();const beforeTitle=await raw();await action('home').click();await action('continue').waitFor();assert.ok(new URL(page.url()).searchParams.has('title'));assert.equal(await page.locator('.immersive-scanner,iframe').count(),0);assert.equal(await raw(),beforeTitle);await page.screenshot({path:'.artifacts/camera-entry/legacy-title.png',fullPage:true});
  passed.push('fresh root entry immediately starts the tutorial camera; the gear dropdown fits 390/768/1024 viewports, closes with outside tap or Escape, and links to the unchanged title without resetting progress');
  await page.goto(origin+query);await scanner(true);await page.locator('[data-sim="TUTORIAL"]').click();await page.locator('.hud-memo').waitFor({timeout:5000});await page.locator('[data-sim="H01"]').click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).markerIds.includes('H01'),key);
  await page.reload();await scanner(false);assert.deepEqual((await saved()).markerIds,['H01']);assert.equal((await saved()).tutorialComplete,true);
  await openMenu();await action('reset').click();await action('cancel-reset').click();await scanner(false);assert.deepEqual((await saved()).markerIds,['H01']);assert.equal(await page.locator('#scan-status').innerText(),'ためす かめら');
  await openMenu();await action('reset').click();await action('confirm-reset').click();await scanner(true);assert.deepEqual((await saved()).markerIds,[]);assert.equal((await saved()).tutorialComplete,false);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),legacyKey),legacy);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),angleKey),angles);
  await openMenu();await action('staff').click();await page.locator('.staff-screen').waitFor();assert.equal(await page.locator('iframe,.immersive-scanner').count(),0);
  passed.push('reload resumes exploration with saved hints; reset cancel preserves progress and restarts camera, confirmed reset starts TUTORIAL and preserves the other mission and per-marker angles; staff can be opened from the gear');
  await seed({...base,tutorialComplete:true,markerIds:['H01'],phase:'sharing'});await scanner(false);assert.ok((await action('share').innerText()).includes('もどる'));
  await seed({...base,tutorialComplete:true,markerIds:['H01'],phase:'complete',attempts:[{color:'blue',item:'hat'}]});await page.getByRole('heading',{name:'せいかい！',exact:true}).waitFor();assert.equal(await page.locator('iframe,.immersive-scanner').count(),0);
  passed.push('saved consultation opens the ANSWER camera; completed games keep their result instead of silently resetting');
  for(const value of ['{broken',JSON.stringify({...base,missionVersion:999})]){
    await seed(value);await scanner(true);assert.equal(await page.locator('#scan-status').innerText(),'めもを かくにんしてね');assert.equal(await page.locator('iframe').count(),0);assert.equal(await raw(),value);
    await page.locator('#camera-action').click();assert.equal(await raw(),value);assert.equal(await page.locator('iframe').count(),0);
    await openMenu();await action('reset').click();await action('cancel-reset').click();await scanner(true);assert.equal(await raw(),value);
    await openMenu();await action('reset').click();await action('confirm-reset').click();await scanner(true);assert.equal(await page.locator('#scan-status').innerText(),'ためす かめら');assert.deepEqual((await saved()).markerIds,[]);
  }
  passed.push('damaged or incompatible saves are retained until a confirmed reset and do not open the camera or accept new hints');
  await page.evaluate(key=>localStorage.removeItem(key),key);await page.goto(origin+'?title=1');await action('new').waitFor();assert.equal(await raw(),null);assert.equal(await page.locator('iframe,.immersive-scanner').count(),0);
  await page.goto(origin+'?staff=1');await page.locator('.staff-screen').waitFor();assert.equal(await raw(),null);assert.equal(await page.locator('iframe,.immersive-scanner').count(),0);
  await page.goto(origin+'?mission=practice&simulate=1&windowed=1');await scanner(false);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).markerIds,legacyKey),['H01']);await openMenu();assert.equal(await action('home').getAttribute('href'),'./?mission=practice&title=1');
  passed.push('explicit title and staff entry do not create a game or request camera; practice defaults to its own saved camera and links to its own title');
  const restricted=await browser.newContext();await restricted.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('storage blocked');}});});const r=await restricted.newPage();r.on('pageerror',error=>errors.push(error.message));await r.goto(origin+query);await r.locator('.immersive-scanner').waitFor();assert.ok(await r.locator('#save-warning').isVisible());assert.equal(await r.locator('#scan-status').innerText(),'ためす かめら');await restricted.close();
  passed.push('unavailable storage still permits the tutorial and explains that progress cannot be saved');
  assert.deepEqual(errors,[]);const {version}=JSON.parse(await readFile('package.json','utf8'));
  await writeFile('docs/camera-entry-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),appVersion:version,environment:'Chromium with development-only simulated recognition; separate real MindAR and physical iPad validation',passed,pageErrors:errors},null,2)+'\n');console.log('CAMERA_ENTRY_BROWSER_OK');
}finally{await browser.close();}
