import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
  const denied=await browser.newContext();
  await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied for test','NotAllowedError');};});
  const p=await denied.newPage();await p.goto('http://127.0.0.1:4173/');await p.locator('#start').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='要確認');assert.ok((await p.locator('#guidance').textContent()).includes('許可'));assert.equal(await p.locator('iframe').count(),0);assert.equal(await p.locator('#overlay-title').textContent(),'カメラを開始できませんでした');assert.ok(await p.locator('#start').isEnabled());await denied.close();
  const missing=await browser.newContext();const m=await missing.newPage();await m.route('**/targets/one.mind',route=>route.fulfill({status:503,body:'Unavailable for test'}));await m.goto('http://127.0.0.1:4173/');await m.locator('#start').click();await m.waitForFunction(()=>document.querySelector('#status').textContent==='要確認');assert.equal(await m.locator('iframe').count(),0);assert.ok((await m.locator('#guidance').textContent()).includes('503'));await missing.close();
  const valid=await browser.newContext();const v=await valid.newPage();await v.goto('http://127.0.0.1:4173/');await v.locator('#start').click();await v.waitForFunction(()=>document.querySelector('#status').textContent==='認識中');await v.locator('#trial-start').click();await v.waitForFunction(()=>document.querySelector('#trial-result').textContent.includes('10秒以内'),{},{timeout:15000});assert.ok((await v.locator('#trial-summary').textContent()).includes('未検出 1回'));
  await v.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await v.locator('iframe').count(),0);assert.ok(await v.locator('#start').isEnabled());await valid.close();
  // Reproduce Safari playback failures after capture permission has succeeded.
  async function playbackCase(mode, stopInstead = false) {
    const context = await browser.newContext();
    await context.addInitScript(({mode}) => {
      if (window === window.parent) return;
      const originalPlay = HTMLMediaElement.prototype.play;
      const paused = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused');
      let attempts = 0, allowed = false, started = false;
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', {configurable: true, get() { return started ? paused.get.call(this) : true; }});
      document.addEventListener('click', event => {
        if (event.isTrusted && event.target.closest('.playback-panel button')) allowed = true;
      }, true);
      HTMLMediaElement.prototype.play = function () {
        attempts++;
        if (mode === 'abort' && attempts === 1) return Promise.reject(new DOMException('Injected Safari interruption', 'AbortError'));
        if (mode === 'tap' && !allowed) return Promise.reject(new DOMException('Injected playback policy', 'NotAllowedError'));
        started = true;
        return originalPlay.call(this);
      };
    }, {mode});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#start').click();
    if (mode === 'tap') {
      await page.waitForFunction(() => document.querySelector('#status').textContent === '映像の再生待ち');
      const videoFrame = page.frames().find(frame => frame.url().includes('/ar.html'));
      assert.ok(await videoFrame.locator('.playback-panel button').isVisible());
      assert.ok(await page.locator('#overlay').isHidden());
      assert.equal(await videoFrame.locator('video').evaluate(video => video.srcObject.getVideoTracks()[0].readyState), 'live');
      if (stopInstead) {
        await page.locator('#stop').click();
        assert.equal(await page.locator('iframe').count(), 0);
        assert.ok(await page.locator('#start').isEnabled());
        await context.close(); return;
      }
      await videoFrame.locator('.playback-panel button').click();
    }
    await page.waitForFunction(() => document.querySelector('#status').textContent === '認識中', {}, {timeout:60000});
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1));
    assert.equal(session.appVersion, '0.1.1');
    assert.equal(session.events.filter(event => event.message.includes('"stage":"camera-request"')).length, 1);
    assert.ok(session.events.some(event => event.message.includes(mode === 'abort' ? 'video-play-retry' : 'video-play-tap-required')));
    assert.ok(session.events.some(event => event.message.includes('video-playing')));
    await page.locator('#stop').click();
    assert.equal(await page.locator('iframe').count(), 0);
    await context.close();
  }
  await playbackCase('abort');
  await playbackCase('tap');
  await playbackCase('tap', true);
  const results={testedAt:new Date().toISOString(),environment:'Chromium; permission rejection, HTTP error, playback failures and visibility state injected for error-path testing',passed:['permission denial shows recovery message and allows retry','target download 503 releases camera frame','real recognition with blank fake video times out at 10 seconds and records failure','background notification stops AR context','transient play AbortError recovers without requesting capture twice','play NotAllowedError keeps live camera and resumes from a direct button click','stop during playback prompt removes the camera frame']};await writeFile('docs/browser-error-test-results.json',JSON.stringify(results,null,2)+'\n');console.log('BROWSER_ERROR_PATHS_OK');
}finally{await browser.close();}
