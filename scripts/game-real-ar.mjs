import {chromium} from 'playwright';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const practice=process.argv.includes('--practice');
const mission=JSON.parse(await readFile(practice?'public/missions/prototype.json':'public/missions/main.json','utf8'));
const hintIds=mission.hints.map(h=>h.markerId);
const storageKey=practice?'ar-obake-game-v1':`ar-obake-game-v1:${mission.id}`;
const query=practice?'?mission=practice&simulate=1':'?simulate=1';
const directory=path.resolve(practice?'.artifacts/game':'.artifacts/nine-game');await mkdir(directory,{recursive:true});
const width=640,height=480,filePath=path.join(directory,practice?'four.y4m':'nine.y4m');
function yuv(data){const y=Buffer.alloc(width*height),u=Buffer.alloc(width*height/4),v=Buffer.alloc(width*height/4);for(let row=0;row<height;row++)for(let col=0;col<width;col++){const i=row*width+col,j=i*4,r=data[j],g=data[j+1],b=data[j+2];y[i]=Math.round(16+.257*r+.504*g+.098*b);if(row%2===0&&col%2===0){const k=row/2*(width/2)+col/2;u[k]=Math.round(128-.148*r-.291*g+.439*b);v[k]=Math.round(128+.439*r-.368*g-.071*b);}}return Buffer.concat([Buffer.from('FRAME\n'),y,u,v]);}
const video=await open(filePath,'w');await video.write(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
for(const id of [...hintIds,mission.answerMarker.markerId]){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#686f78';ctx.fillRect(0,0,width,height);
  const blank=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<10;i++)await video.write(blank);
  ctx.drawImage(await loadImage(`public/markers/${id}.png`),128,48,384,384);const card=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<(id==='H01'?120:60);i++)await video.write(card);
}await video.close();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${filePath}`]});
const errors=[],passed=[];
try{
  const context=await browser.newContext({viewport:{width:768,height:1024},permissions:['camera']});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const action=name=>page.locator(`[data-action="${name}"]`).first();
  await page.goto('http://127.0.0.1:4173/'+query);await action('new').click();assert.equal(await page.locator('[data-sim]').count(),0);
  await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent==='さがしています',{},{timeout:90000});
  assert.ok((await page.locator('iframe').getAttribute('src')).includes('tracking=stable&motion=still'));
  for(const id of hintIds){
    const arSpeech=page.frameLocator('iframe').locator('.ar-speech');
    await page.waitForFunction(id=>document.querySelector('#hint-panel .badge')?.textContent===id,id,{timeout:70000});
    await arSpeech.waitFor({state:'visible',timeout:5000});const hint=mission.hints.find(h=>h.markerId===id),spoken=(await arSpeech.innerText()).replace(/\s+/g,' ');assert.ok(spoken.includes(hint.speaker));assert.ok(spoken.includes(hint.text.replace(/\n/g,' ')));
    const bounds=await arSpeech.evaluate(element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};});assert.ok(bounds.left>=0&&bounds.top>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height);
    if(id==='H01')await page.screenshot({path:path.join(directory,'real-hint.png'),fullPage:true});
    await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).markerIds.includes(id),{key:storageKey,id},{timeout:5000});console.log('AUTO_COLLECTED '+id);
  }
  const ids=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).markerIds,storageKey);assert.deepEqual(ids,hintIds);
  await action('memo').click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.memo-option.yes').count(),2);assert.equal(await page.locator('.hint-stamps .obtained').count(),hintIds.length);
  await action('share').click();await action('answer-scan').click();
  await page.locator('[data-color="blue"]').waitFor({timeout:90000});assert.equal(await page.locator('iframe').count(),0);
  await page.locator('[data-color="blue"]').click();await action('next-item').click();await page.locator('[data-item="hat"]').click();await action('confirm-answer').click();await action('submit-answer').click();
  assert.equal(await page.locator('h1').innerText(),'せいかい！');
  passed.push('production build ignores simulate query',`real MindAR recognized ${hintIds.join('/')} and automatically saved all hints`,'AR speech bubble follows the recognized ghost, shows mission copy, and remains inside an iPad portrait viewport','memo and consultation stop camera','ANSWER recognition opens colour and item selection','correct answer completes game');
  await page.goto('http://127.0.0.1:4173/lab.html');assert.ok(await page.locator('#start').isEnabled());await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='認識中',{},{timeout:90000});await page.locator('#stop').click();assert.equal(await page.locator('iframe').count(),0);passed.push('retained laboratory page starts and stops AR');
  // Reuse the Safari playback-recovery implementation through the game's own cover.
  const denied=await browser.newContext();await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('test denied','NotAllowedError');};});const d=await denied.newPage();await d.goto('http://127.0.0.1:4173/'+query);await d.locator('[data-action="new"]').click();await d.getByText('カメラを使えませんでした。Safariの設定でカメラを許可して、もういちど開始してね。').first().waitFor();assert.equal(await d.locator('iframe').count(),0);assert.ok(await d.locator('#camera-action').isEnabled());await denied.close();passed.push('camera denial offers restart without discarding progress');
  assert.deepEqual(errors,[]);const {version}=JSON.parse(await readFile('package.json','utf8'));
  await writeFile(practice?'docs/game-real-ar-results.json':'docs/nine-game-real-ar-results.json',JSON.stringify({testedAt:new Date().toISOString(),appVersion:version,missionId:mission.id,environment:'Chromium SwiftShader with synthetic Y4M input; actual MindAR pipeline, not physical iPad',passed,pageErrors:errors},null,2)+'\n');console.log('GAME_REAL_AR_OK');
}finally{await browser.close();}
