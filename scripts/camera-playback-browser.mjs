import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}),errors=[];
try{
  const context=await browser.newContext({permissions:['camera'],viewport:{width:768,height:1024}});
  await context.addInitScript(()=>{
    if(window===window.parent)return;
    const originalPlay=HTMLMediaElement.prototype.play,paused=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'paused');
    const originalCapture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let allowed=false,started=false;window.captureRequests=0;
    navigator.mediaDevices.getUserMedia=async constraints=>{window.captureRequests++;return originalCapture(constraints);};
    Object.defineProperty(HTMLMediaElement.prototype,'paused',{configurable:true,get(){return started?paused.get.call(this):true;}});
    document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest('.playback-panel button'))allowed=true;},true);
    HTMLMediaElement.prototype.play=function(){if(!allowed)return Promise.reject(new DOMException('Injected Safari playback policy','NotAllowedError'));started=true;return originalPlay.call(this);};
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent==='かめらを うつしてね',{},{timeout:90000});
  assert.equal(await page.locator('.welcome,.game-header,.hud-memo').count(),0);assert.ok(await page.locator('#camera-cover').isHidden());
  const frame=page.frames().find(frame=>frame.url().includes('/ar.html'));assert.ok(frame);assert.ok(await frame.locator('.playback-panel button').isVisible());assert.equal(await frame.evaluate(()=>window.captureRequests),1);
  await page.locator('#camera-settings summary').click();assert.ok(await page.locator('[data-action="reset"]').isVisible());await page.keyboard.press('Escape');
  await frame.locator('.playback-panel button').click();await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent==='さがしています',{},{timeout:90000});assert.equal(await frame.evaluate(()=>window.captureRequests),1);
  assert.equal(await frame.locator('.playback-panel').count(),0);assert.equal(await frame.locator('video').evaluate(video=>video.srcObject.getVideoTracks()[0].readyState),'live');
  assert.equal(await page.locator('[data-action="stop-camera"],#camera-stop').count(),0);
  await page.locator('#camera-settings summary').click();await page.locator('[data-action="home"]').click();await page.locator('.welcome').waitFor();assert.equal(await page.locator('iframe').count(),0);
  assert.deepEqual(errors,[]);const {version}=JSON.parse(await readFile('package.json','utf8'));
  await writeFile('docs/camera-playback-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),appVersion:version,environment:'Production build in Chromium with injected Safari playback rejection and a synthetic camera; physical Safari not tested',passed:['root entry requests camera without title/start gesture','playback rejection keeps the live camera and shows a direct tap button in the camera screen','settings remain available during the playback prompt','trusted button tap starts MindAR without asking for capture again; no pause button is displayed; title navigation releases the frame'],pageErrors:errors},null,2)+'\n');console.log('CAMERA_PLAYBACK_BROWSER_OK');
}finally{await browser.close();}
