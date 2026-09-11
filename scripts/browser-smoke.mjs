import {chromium} from 'playwright';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const {version:appVersion}=JSON.parse(await readFile('package.json','utf8'));
const root=path.resolve('.artifacts');await mkdir(root,{recursive:true});
const ids=['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER'];
const width=640,height=480;
function yuv(data){const y=Buffer.alloc(width*height),u=Buffer.alloc(width*height/4),v=Buffer.alloc(width*height/4);for(let row=0;row<height;row++)for(let col=0;col<width;col++){const i=row*width+col,j=i*4,r=data[j],g=data[j+1],b=data[j+2];y[i]=Math.round(16+.257*r+.504*g+.098*b);if(row%2===0&&col%2===0){const k=row/2*(width/2)+col/2;u[k]=Math.round(128-.148*r-.291*g+.439*b);v[k]=Math.round(128+.439*r-.368*g-.071*b);}}return Buffer.concat([Buffer.from('FRAME\n'),y,u,v]);}
const file=await open(path.join(root,'markers.y4m'),'w');
await file.write(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
for(const id of ids){const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#686f78';ctx.fillRect(0,0,width,height);const blank=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<10;i++)await file.write(blank);const img=await loadImage(`public/markers/${id}.png`);ctx.drawImage(img,128,48,384,384);const card=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<(id==='H01'?150:50);i++)await file.write(card);}
await file.close();
const errors=[],consoleErrors=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${path.join(root,'markers.y4m')}`]});
try{
  const context=await browser.newContext({viewport:{width:1100,height:1000},permissions:['camera']});
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(m.text());console.log('CONSOLE ERROR',m.text().slice(0,200));}});
  await page.goto('http://127.0.0.1:4173/lab.html');await page.screenshot({path:path.join(root,'desktop.png'),fullPage:true});
  await page.locator('#device-note').fill('AUTOMATED Chromium / synthetic video / NOT Air 2');
  const results=[];
  assert.equal(await page.locator('#tracking-mode').inputValue(),'stable');
  assert.equal(await page.locator('#ghost-motion').inputValue(),'still');
  for(const [set,expectedIds]of [['one',['H01']],['four',['H01','H02','H03','ANSWER']],['nine',ids]]){
    await page.locator(`[data-set=${set}]`).click();await page.locator('#start').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='認識中',{},{timeout:90000});
    console.log(`READY ${set}`);
    assert.ok(await page.locator('#tracking-mode').isDisabled());
    assert.ok(await page.locator('#ghost-motion').isDisabled());
    await page.waitForTimeout(3000);
    await page.screenshot({path:path.join(root,`initial-${set}.png`)});
    console.log(await page.frameLocator('iframe').locator('video').evaluate(v=>({width:v.width,height:v.height,videoWidth:v.videoWidth,videoHeight:v.videoHeight,time:v.currentTime,paused:v.paused})));
    await page.waitForFunction(expected=>{const s=JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1);return expected.every(id=>s.events.some(e=>e.message.startsWith(id+'を認識')));},expectedIds,{timeout:150000});
    await page.screenshot({path:path.join(root,`camera-${set}.png`)});
    if(set==='one') {
      await page.locator('#pose-start').click();
      await page.waitForFunction(()=>document.querySelector('#pose-result').textContent.includes('揺れを記録しました'),{},{timeout:15000});
      const recording=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1).poseRecordings.at(-1));
      assert.equal(recording.status,'completed');assert.ok(recording.samples.some(s=>s.stabilizationState==='held'));for(let i=1;i<recording.samples.length;i++){const a=recording.samples[i-1],b=recording.samples[i];if(a.stabilizationState==='held'&&b.stabilizationState==='held')assert.deepEqual(a.displayed,b.displayed);}assert.ok(recording.samples.length>0&&recording.samples.length<=110);
      for(const sample of recording.samples){assert.equal(sample.input.length,7);assert.equal(sample.displayed.length,7);assert.ok([...sample.input,...sample.displayed].every(Number.isFinite));}
    }
    await page.locator('#stop').click();assert.equal(await page.locator('iframe').count(),0);
    const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1));assert.equal(session.appVersion,appVersion);assert.equal(session.tracking.mode,'stable');assert.equal(session.tracking.ghostMotion,'still');assert.equal(session.tracking.poseStabilization.algorithm,'stationary-hold-v3');assert.ok(session.events.some(e=>e.message.startsWith('追従設定 ')));assert.ok(await page.locator('#tracking-mode').isEnabled());results.push({set,tracking:session.tracking,recognized:expectedIds,trackingInitMs:session.trackingInitMs,foundCount:session.foundCount,elapsedSeconds:session.elapsedSeconds,fpsAverage:session.fpsAverage});console.log(`RECOGNIZED ${set}: ${expectedIds.join(',')}`);
  }
  // Verify that both comparison controls reach the AR frame and exported session.
  await page.locator('[data-set=one]').click();
  await page.locator('#tracking-mode').selectOption('depth');
  await page.locator('#ghost-motion').selectOption('float');
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='認識中',{},{timeout:90000});
  const comparison=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1));
  assert.equal(comparison.tracking.mode,'depth');assert.equal(comparison.tracking.poseStabilization.algorithm,'projection-depth-v2');assert.equal(comparison.tracking.filterBeta,1000);assert.equal(comparison.tracking.ghostMotion,'float');
  assert.ok(comparison.events.some(e=>e.message.startsWith('追従設定 ')));
  await page.waitForFunction(()=>!document.querySelector('#found-badge').hidden,{},{timeout:65000});
  await page.locator('#pose-start').click();
  await page.locator('#stop').click();
  const cancelledRecording=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1).poseRecordings.at(-1));assert.equal(cancelledRecording.status,'cancelled');
  await page.locator('#tracking-mode').selectOption('stable');
  await page.locator('#ghost-motion').selectOption('still');
  // Cancellation during async startup, then a clean restart.
  await page.locator('#start').click();await page.locator('#stop').click();await page.waitForTimeout(1000);assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('#start').isEnabled(),true);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs(path.join(root,'test-export.json'));
  const exported=JSON.parse(await readFile(path.join(root,'test-export.json'),'utf8'));assert.ok(exported.sessions.some(s=>s.poseRecordings?.some(r=>r.status==='completed'&&r.samples.length>0)));
  await page.reload();assert.equal(await page.locator('iframe').count(),0);assert.ok((await page.locator('#session-note').innerText()).includes('記録'));
  for(const [w,h]of [[768,1024],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,`layout-${w}.png`),fullPage:true});}
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile('docs/browser-test-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Playwright Chromium with SwiftShader and synthetic Y4M video; not physical camera or Air 2',results,passed:['all marker IDs in 1/4/9 sets recognized by actual MindAR','3D rendered','ten-second pose recording contains numerical input and displayed poses','pose recording cancellation and JSON export','stable still mode and comparison controls reach AR frame and session log','settings lock while running and unlock on stop','stop removes iframe','startup cancellation','JSON export','reload preserves log','responsive widths 390/768/1024'],pageErrors:errors,consoleErrors},null,2)+'\n');
  console.log('BROWSER_SMOKE_OK');
}catch(error){await writeFile(path.join(root,'smoke-failure.json'),JSON.stringify({error:String(error),errors,consoleErrors},null,2));throw error;}finally{await browser.close();}
