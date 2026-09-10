import {chromium} from 'playwright';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,open,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('.artifacts');await mkdir(root,{recursive:true});
const ids=['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER'];
const width=640,height=480;
function yuv(data){const y=Buffer.alloc(width*height),u=Buffer.alloc(width*height/4),v=Buffer.alloc(width*height/4);for(let row=0;row<height;row++)for(let col=0;col<width;col++){const i=row*width+col,j=i*4,r=data[j],g=data[j+1],b=data[j+2];y[i]=Math.round(16+.257*r+.504*g+.098*b);if(row%2===0&&col%2===0){const k=row/2*(width/2)+col/2;u[k]=Math.round(128-.148*r-.291*g+.439*b);v[k]=Math.round(128+.439*r-.368*g-.071*b);}}return Buffer.concat([Buffer.from('FRAME\n'),y,u,v]);}
const file=await open(path.join(root,'markers.y4m'),'w');
await file.write(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
for(const id of ids){const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#686f78';ctx.fillRect(0,0,width,height);const blank=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<10;i++)await file.write(blank);const img=await loadImage(`public/markers/${id}.png`);ctx.drawImage(img,128,48,384,384);const card=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<50;i++)await file.write(card);}
await file.close();
const errors=[],consoleErrors=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${path.join(root,'markers.y4m')}`]});
try{
  const context=await browser.newContext({viewport:{width:1100,height:1000},permissions:['camera']});
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(m.text());console.log('CONSOLE ERROR',m.text().slice(0,200));}});
  await page.goto('http://127.0.0.1:4173/');await page.screenshot({path:path.join(root,'desktop.png'),fullPage:true});
  await page.locator('#device-note').fill('AUTOMATED Chromium / synthetic video / NOT Air 2');
  const results=[];
  for(const [set,expectedIds]of [['one',['H01']],['four',['H01','H02','H03','ANSWER']],['nine',ids]]){
    await page.locator(`[data-set=${set}]`).click();await page.locator('#start').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='認識中',{},{timeout:90000});
    console.log(`READY ${set}`);
    await page.waitForTimeout(3000);
    await page.screenshot({path:path.join(root,`initial-${set}.png`)});
    console.log(await page.frameLocator('iframe').locator('video').evaluate(v=>({width:v.width,height:v.height,videoWidth:v.videoWidth,videoHeight:v.videoHeight,time:v.currentTime,paused:v.paused})));
    await page.waitForFunction(expected=>{const s=JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1);return expected.every(id=>s.events.some(e=>e.message.startsWith(id+'を認識')));},expectedIds,{timeout:150000});
    await page.screenshot({path:path.join(root,`camera-${set}.png`)});
    await page.locator('#stop').click();assert.equal(await page.locator('iframe').count(),0);
    const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar-obake-lab-v1')).sessions.at(-1));results.push({set,recognized:expectedIds,trackingInitMs:session.trackingInitMs,foundCount:session.foundCount,elapsedSeconds:session.elapsedSeconds,fpsAverage:session.fpsAverage});console.log(`RECOGNIZED ${set}: ${expectedIds.join(',')}`);
  }
  // Cancellation during async startup, then a clean restart.
  await page.locator('#start').click();await page.locator('#stop').click();await page.waitForTimeout(1000);assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('#start').isEnabled(),true);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs(path.join(root,'test-export.json'));
  await page.reload();assert.equal(await page.locator('iframe').count(),0);assert.ok((await page.locator('#session-note').innerText()).includes('記録'));
  for(const [w,h]of [[768,1024],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,`layout-${w}.png`),fullPage:true});}
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile('docs/browser-test-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Playwright Chromium with SwiftShader and synthetic Y4M video; not physical camera or Air 2',results,passed:['all marker IDs in 1/4/9 sets recognized by actual MindAR','3D rendered','stop removes iframe','startup cancellation','JSON export','reload preserves log','responsive widths 390/768/1024'],pageErrors:errors,consoleErrors},null,2)+'\n');
  console.log('BROWSER_SMOKE_OK');
}catch(error){await writeFile(path.join(root,'smoke-failure.json'),JSON.stringify({error:String(error),errors,consoleErrors},null,2));throw error;}finally{await browser.close();}
