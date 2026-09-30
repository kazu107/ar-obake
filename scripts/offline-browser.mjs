import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const origin=process.env.AR_OBAKE_TEST_ORIGIN??'http://127.0.0.1:4173/';
if(!origin.endsWith('/'))throw new Error('AR_OBAKE_TEST_ORIGIN must end with /');
const browser=await chromium.launch({headless:true});
const errors=[],passed=[];
try{
  const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'?staff=1');await page.locator('.staff-screen').waitFor();
  await page.locator('[data-action="prepare-offline"]').click();
  await page.locator('.status-pill.ready').waitFor({timeout:120000});
  assert.ok((await page.locator('.staff-screen').innerText()).includes('映像が出てから通信を切ってください'));
  await page.reload();await page.locator('.status-pill.ready').waitFor();assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller?.state),'activated');
  passed.push('staff screen downloads the complete offline game bundle and shows the accepted disconnect timing');
  await context.setOffline(true);await page.goto(origin+'?staff=1',{waitUntil:'domcontentloaded'});await page.locator('.staff-screen').waitFor();
  assert.ok((await page.locator('.staff-screen').innerText()).includes('オフライン'));
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('[data-action="new"]').waitFor();
  const mission=await page.evaluate(async()=>fetch('./missions/main.json').then(response=>response.json()));
  assert.deepEqual(mission.colors.map(color=>color.id),['green','pink','blue','yellow']);assert.deepEqual(mission.items.map(item=>item.id),['glasses','ribbon','hat','gloves']);assert.deepEqual(mission.answer,{color:'blue',item:'hat'});
  const arPage=await page.evaluate(async()=>fetch('./ar.html?set=ten&mission=main').then(response=>response.text()));assert.ok(arPage.includes('<title>おばけの かめら</title>'));const arScript=arPage.match(/src="([^"]*\/assets\/ar-[^"]+)"/)?.[1];assert.ok(arScript);
  const offlineAssets=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{const response=await fetch(path);return {path,status:response.status,bytes:(await response.arrayBuffer()).byteLength};})),[arScript,'./targets/ten.mind','./models/ghost-gestures-v1.glb','./staff-checklist.pdf','./ghost-variants-concept.png']);assert.ok(offlineAssets.every(asset=>asset.status===200&&asset.bytes>1000));
  passed.push('offline reload restores the staff page, Mission v2, AR runtime bundle, ten-marker target data, gesture ghost model, staff checklist PDF, and comparison illustration');
  assert.deepEqual(errors,[]);
  await writeFile('docs/offline-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:`Playwright Chromium at ${origin} with network disabled after explicit preparation`,passed,pageErrors:errors},null,2)+'\n');
  console.log('OFFLINE_BROWSER_OK');
}finally{await browser.close();}
