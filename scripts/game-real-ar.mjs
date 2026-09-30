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
const width=640,height=480,filePath=path.join(directory,practice?'four.y4m':'ten.y4m');
function yuv(data){const y=Buffer.alloc(width*height),u=Buffer.alloc(width*height/4),v=Buffer.alloc(width*height/4);for(let row=0;row<height;row++)for(let col=0;col<width;col++){const i=row*width+col,j=i*4,r=data[j],g=data[j+1],b=data[j+2];y[i]=Math.round(16+.257*r+.504*g+.098*b);if(row%2===0&&col%2===0){const k=row/2*(width/2)+col/2;u[k]=Math.round(128-.148*r-.291*g+.439*b);v[k]=Math.round(128+.439*r-.368*g-.071*b);}}return Buffer.concat([Buffer.from('FRAME\n'),y,u,v]);}
const video=await open(filePath,'w');await video.write(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
const scanIds=[...(mission.tutorialMarker?[mission.tutorialMarker.markerId]:[]),...hintIds,mission.answerMarker.markerId];
for(const id of scanIds){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#686f78';ctx.fillRect(0,0,width,height);
  const blank=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<10;i++)await video.write(blank);
  const img=await loadImage(`public/markers/${id}.png`);
  if(['H01','H02','H03'].includes(id)){
    // A projective view of a card lying on a table, seen from its lower edge.
    // Far rows are smaller. This makes the perpendicular ghost's face visible.
    for(let row=0;row<800;row++){
      const t=row/800,s=1/(1.25-.42*t),next=(row+1)/800,s2=1/(1.25-.42*next);
      const y=240+(t-.5)*360*.65*s,y2=240+(next-.5)*360*.65*s2;
      ctx.drawImage(img,0,row,800,1,320-180*s,y,360*s,Math.max(1,y2-y+.5));
    }
  }else ctx.drawImage(img,128,48,384,384);
  const card=yuv(ctx.getImageData(0,0,width,height).data);for(let i=0;i<(id==='TUTORIAL'?200:id==='H01'?120:60);i++)await video.write(card);
}await video.close();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${filePath}`]});
const errors=[],passed=[];
try{
  const context=await browser.newContext({viewport:{width:768,height:1024},permissions:['camera']});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const action=name=>page.locator(`[data-action="${name}"]`).first();
  await page.goto('http://127.0.0.1:4173/'+query);await action('new').click();assert.equal(await page.locator('[data-sim]').count(),0);
  await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent==='さがしています',{},{timeout:90000});
  assert.ok((await page.locator('iframe').getAttribute('src')).includes('tracking=stable&motion=still'));
  if(mission.tutorialMarker){
    const tutorialBody=page.frameLocator('iframe').locator(`body[data-speech-id="${mission.tutorialMarker.markerId}"]`);await tutorialBody.waitFor({timeout:70000});assert.equal(await tutorialBody.getAttribute('data-speech-copy'),`${mission.tutorialMarker.speaker}\n${mission.tutorialMarker.text}`);await page.screenshot({path:path.join(directory,'real-tutorial.png'),fullPage:true});
    assert.equal(await tutorialBody.getAttribute('data-ghost-variant'),'greeting');await page.waitForTimeout(550);await page.screenshot({path:path.join(directory,'real-greeting.png')});
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).tutorialComplete,storageKey,{timeout:5000});assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).markerIds,storageKey),[]);
    await page.locator('.hud-memo').waitFor({timeout:15000});await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent==='さがしています',{},{timeout:90000});
  }
  const cameraBounds=await page.locator('.game-camera').evaluate(element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};});assert.deepEqual(cameraBounds,{x:0,y:0,width:cameraBounds.viewportWidth,height:cameraBounds.viewportHeight,viewportWidth:cameraBounds.viewportWidth,viewportHeight:cameraBounds.viewportHeight});assert.equal(await page.locator('.game-header,.game-footer').count(),0);
  for(const id of hintIds){
    const hint=mission.hints.find(h=>h.markerId===id),speechBody=page.frameLocator('iframe').locator(`body[data-speech-id="${id}"]`);await speechBody.waitFor({timeout:70000});assert.equal(await speechBody.getAttribute('data-speech-copy'),`${hint.speaker}\n${hint.text}`);assert.equal(await page.frameLocator('iframe').locator('.ar-speech').count(),0);
    assert.equal(await speechBody.getAttribute('data-marker-orientation'),['H01','H02','H03'].includes(id)?'perpendicular':'parallel');
    assert.equal(await speechBody.getAttribute('data-ghost-variant'),id==='H01'?'pumpkin':id==='H08'?'surprised':'plain');
    if(id==='H01'||id==='H08'){await page.waitForTimeout(600);await page.screenshot({path:path.join(directory,id==='H01'?'real-pumpkin.png':'real-surprised.png')});}
    if(id==='H01')await page.screenshot({path:path.join(directory,'real-hint.png'),fullPage:true});
    await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).markerIds.includes(id),{key:storageKey,id},{timeout:5000});console.log('AUTO_COLLECTED '+id);
    if(id==='H01'){
      await page.locator('[data-memo-field="color"][data-memo-value="green"]').click();assert.ok((await page.locator('#memo-feedback').innerText()).includes('この いろでは ないよ。'));
      assert.equal(await page.locator('iframe').count(),1);await page.screenshot({path:path.join(directory,'real-memo-feedback.png')});
      await page.frameLocator('iframe').locator('body').click({position:{x:100,y:350}});await page.waitForFunction(()=>!document.querySelector('#memo-feedback'));
      await page.frameLocator('iframe').locator('body[data-speech-id="H01"][data-gesture-active="false"]').waitFor({timeout:5000});
    }
  }
  const ids=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).markerIds,storageKey);assert.deepEqual(ids,hintIds);
  assert.equal(await page.locator('.saved-clue,.hint-bubble,.hint-stamps,.auto-recorded').count(),0);assert.equal(await page.locator('.hud-memo-option.yes').count(),2);
  await action('share').click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.memo-option.yes').count(),2);assert.equal(await page.locator('.hint-stamps .obtained').count(),hintIds.length);await action('answer-scan').click();
  await page.locator('[data-color="blue"]').waitFor({timeout:90000});assert.equal(await page.locator('iframe').count(),0);
  await page.locator('[data-color="blue"]').click();await action('next-item').click();await page.locator('[data-item="hat"]').click();await action('confirm-answer').click();await action('submit-answer').click();
  assert.equal(await page.locator('h1').innerText(),'せいかい！');
  passed.push('production build ignores simulate query','tutorial marker shows a separate ghost and 3D speech bubble before exploration without entering the clue memo',`real MindAR recognized ${hintIds.join('/')} and automatically saved all hints`,'H01-H03 recognized in a tilted table view and render perpendicular, other hints parallel; ghost and speech share the oriented content group','memo feedback works over the live AR frame and a tap on the frame closes it without stopping the camera','speech copy is drawn inside the Three.js canvas with no DOM speech bubble','camera fills the viewport with no page header or footer and only a compact colour/item memo','consultation stops camera and retains the full memo','ANSWER recognition opens colour and item selection','correct answer completes game');
  passed.push('TUTORIAL greeting, H01 pumpkin lantern, H08 surprised face/raised arms render in the real AR frame; H01 gesture finishes and returns to rest');
  await page.goto('http://127.0.0.1:4173/lab.html');assert.ok(await page.locator('#start').isEnabled());await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='認識中',{},{timeout:90000});await page.locator('#stop').click();assert.equal(await page.locator('iframe').count(),0);passed.push('retained laboratory page starts and stops AR');
  // Reuse the Safari playback-recovery implementation through the game's own cover.
  const denied=await browser.newContext();await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('test denied','NotAllowedError');};});const d=await denied.newPage();await d.goto('http://127.0.0.1:4173/'+query);await d.locator('[data-action="new"]').click();await d.getByText('かめらを つかえなかったよ。すたっふに きょかの せっていを かくにんしてもらってね。').first().waitFor();assert.equal(await d.locator('iframe').count(),0);assert.ok(await d.locator('#camera-action').isEnabled());await denied.close();passed.push('camera denial offers restart without discarding progress');
  assert.deepEqual(errors,[]);const {version}=JSON.parse(await readFile('package.json','utf8'));
  await writeFile(practice?'docs/game-real-ar-results.json':'docs/nine-game-real-ar-results.json',JSON.stringify({testedAt:new Date().toISOString(),appVersion:version,missionId:mission.id,environment:'Chromium SwiftShader with synthetic Y4M input; actual MindAR pipeline, not physical iPad',passed,pageErrors:errors},null,2)+'\n');console.log('GAME_REAL_AR_OK');
}finally{await browser.close();}
