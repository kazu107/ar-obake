import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:880}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5184/');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {createGhostVariant}=await import('/src/ar/ghost-variations.ts');
    const template=(await new GLTFLoader().parseAsync(await fetch('/models/ghost-gestures-v1.glb').then(r=>r.arrayBuffer()),'/')).scene;
    document.body.innerHTML='<h1>実際の3Dモデル：上段は静止／下段は動作中</h1><p>TUTORIAL（手振り）　／　H01（かぼちゃ）　／　H08（驚き）</p>';
    document.body.style.cssText='margin:0;text-align:center;background:#f3f5fa;color:#152443;font:16px sans-serif';
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,740);renderer.setClearColor(0xf3f5fa);document.body.append(renderer.domElement);
    const camera=new T.OrthographicCamera(-1.65,1.65,1.02,-1.02,.1,10);camera.position.z=4;
    const scene=new T.Scene(),ids=['TUTORIAL','H01','H08'],proof=[];
    for(let row=0;row<2;row++)for(let i=0;i<3;i++){
      const {model,gesture}=createGhostVariant(template,ids[i]);model.position.set((i-1)*1.1,row===0?.5:-.5,0);model.updateMatrix();const original=model.matrix.toArray();
      scene.add(model);gesture.setVisible(true,0);gesture.update(row===0?2000:700);model.updateMatrix();proof.push({id:ids[i],kind:gesture.kind,rootUnchanged:JSON.stringify(original)===JSON.stringify(model.matrix.toArray()),active:gesture.isActive(row===0?2000:700)});
    }
    renderer.render(scene,camera);return {proof,gpuError:renderer.getContext().getError()};
  });
  assert.equal(result.gpuError,0);assert.ok(result.proof.every(p=>p.rootUnchanged));assert.ok(result.proof.slice(0,3).every(p=>!p.active));assert.ok(result.proof.slice(3).every(p=>p.active));assert.deepEqual(errors,[]);
  await mkdir('.artifacts/ghost-variations',{recursive:true});await page.screenshot({path:'.artifacts/ghost-variations/actual-models.png',fullPage:true});
  await writeFile('docs/ghost-variation-browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Chromium SwiftShader; actual GLB and runtime geometry; not physical iPad',...result,pageErrors:errors},null,2)+'\n');console.log('GHOST_VARIATION_RENDER_OK');
}finally{await browser.close();await server.close();}
