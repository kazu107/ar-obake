import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1500,height:920}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5184/');
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {createGhostVariant}=await import('/src/ar/ghost-variations.ts');const {orientMarkerContent}=await import('/src/ar/marker-orientation.ts');
    const template=(await new GLTFLoader().parseAsync(await fetch('/models/ghost-gestures-v1.glb').then(r=>r.arrayBuffer()),'/')).scene;
    const ids=['TUTORIAL','H01','H02','H03','H04','H05','H06','H07','H08','ANSWER'];
    const labels=['TUTORIAL：手振り','H01：かぼちゃ','H02：こうもり','H03：まくら','H04：おかし','H05：本','H06：鈴','H07：ほうき','H08：驚き','ANSWER：メモ帳'];
    document.body.innerHTML='<h1 id="state">実際の3Dモデル</h1><p>白い体は固定し、手・小物・表情だけを動かします。</p><div id="models"></div>';
    document.body.style.cssText='margin:0;text-align:center;background:#eef1f7;color:#152443;font:17px sans-serif';
    const container=document.querySelector('#models');container.style.cssText='position:relative;width:1500px;height:780px';
    labels.forEach((label,i)=>{const element=document.createElement('strong');element.textContent=label;element.style.cssText=`position:absolute;left:${i%5*300}px;top:${Math.floor(i/5)*390+10}px;width:300px;z-index:1`;container.append(element);});
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,780);renderer.setClearColor(0xeef1f7);container.append(renderer.domElement);
    const camera=new T.OrthographicCamera(-2.75,2.75,1.43,-1.43,.1,10);camera.position.z=4;
    const scene=new T.Scene(),entries=[];
    for(let i=0;i<ids.length;i++){
      const {model,gesture}=createGhostVariant(template,ids[i]);const anchor=new T.Group(),content=new T.Group();anchor.position.set((i%5-2)*1.1,Math.floor(i/5)===0?.60:-.83,0);
      content.add(model);anchor.add(content);scene.add(anchor);model.updateMatrix();gesture.setVisible(true,0);
      entries.push({id:ids[i],model,gesture,anchor,content,original:model.matrix.toArray()});
    }
    window.renderVariants=(now,orientation='parallel')=>{
      document.querySelector('#state').textContent=`実際の3Dモデル：${orientation==='parallel'?'正面':'机向けの角度'}／${now===2000?'静止':'動作中'}`;
      // Tilt the preview camera relative to each marker to see upright content.
      for(const {content} of entries){orientMarkerContent(content,orientation);if(orientation==='perpendicular'){content.rotation.x-=.65;content.scale.setScalar(.9);content.position.z=0;}}
      for(const {gesture} of entries)gesture.update(now);renderer.render(scene,camera);
      return {orientation,now,proof:entries.map(({id,model,gesture,original})=>{model.updateMatrix();return {id,kind:gesture.kind,rootUnchanged:JSON.stringify(original)===JSON.stringify(model.matrix.toArray()),active:gesture.isActive(now)};}),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,gpuError:renderer.getContext().getError()};
    };
  });
  await mkdir('.artifacts/ghost-variations',{recursive:true});const renders=[];
  for(const [name,now,orientation] of [['rest',2000,'parallel'],['motion',700,'parallel'],['perpendicular',700,'perpendicular']]){
    const result=await page.evaluate(({now,orientation})=>window.renderVariants(now,orientation),{now,orientation});
    assert.equal(result.gpuError,0);assert.ok(result.proof.every(p=>p.rootUnchanged&&p.active===(now<2000)));assert.equal(new Set(result.proof.map(p=>p.kind)).size,10);
    assert.ok(result.triangles<40000);renders.push(result);await page.screenshot({path:`.artifacts/ghost-variations/actual-models-${name}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);const {version}=JSON.parse(await readFile('package.json','utf8'));
  await writeFile('docs/ghost-variation-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),appVersion:version,environment:'Chromium SwiftShader; actual GLB and runtime geometry; front and tilted upright previews, not physical iPad',renders,pageErrors:errors},null,2)+'\n');console.log('GHOST_VARIATION_RENDER_OK');
}finally{await browser.close();await server.close();}
