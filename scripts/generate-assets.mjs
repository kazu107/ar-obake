import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

for (const dir of ['public/markers', 'public/models', 'public/targets', 'assets/source']) await mkdir(dir, { recursive: true });
const ids = ['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER','TUTORIAL'];
const metadata = [];
for (let index = 0; index < ids.length; index++) {
  let seed = 260910 + index * 7919;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const canvas = createCanvas(800, 800), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,800,800);
  // Unique seeded, non-repeating geometric calibration patterns; no photographic assets.
  for (let k = 0; k < 100; k++) {
    const x = 30 + random()*700, y = 30 + random()*700, size = 18 + random()*87;
    ctx.save(); ctx.translate(x,y); ctx.rotate(random()*Math.PI);
    ctx.fillStyle = ['#101c35','#253e63','#e29c1e','#697e96'][Math.floor(random()*4)];
    const kind = Math.floor(random()*4);
    ctx.beginPath();
    if(kind===0) {ctx.moveTo(0,0);ctx.lineTo(size,8);ctx.lineTo(size*.2,size);ctx.closePath();ctx.fill();}
    else if(kind===1) {ctx.fillRect(0,0,size,size*.32);ctx.fillRect(0,0,size*.3,size);}
    else if(kind===2) {ctx.arc(0,0,size*.48,0,Math.PI*1.55);ctx.lineWidth=7;ctx.strokeStyle=ctx.fillStyle;ctx.stroke();}
    else {ctx.fillRect(0,0,size,size*.6);ctx.fillStyle='#fff';ctx.fillRect(8,8,size*.35,size*.2);}
    ctx.restore();
  }
  ctx.fillStyle='#fff';ctx.fillRect(225,317,350,155);
  ctx.strokeStyle='#101c35';ctx.lineWidth=5;ctx.strokeRect(235,327,330,135);
  ctx.fillStyle='#101c35';ctx.font=`bold ${ids[index]==='TUTORIAL'?42:index===8?64:95}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ids[index],400,400);
  ctx.fillStyle='#101c35';ctx.font='bold 20px sans-serif';ctx.fillText(`AR OBAKE / TEST CARD ${String(index+1).padStart(2,'0')}`,400,778);
  const png = canvas.toBuffer('image/png');
  await writeFile(`public/markers/${ids[index]}.png`,png);
  metadata.push({id:ids[index],file:`markers/${ids[index]}.png`,width:800,height:800,sha256:createHash('sha256').update(png).digest('hex')});
}

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {this.result=await blob.arrayBuffer();this.onloadend?.();}
  async readAsDataURL(blob) {this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.();}
};
const ghost = new THREE.Group(); ghost.name='Obake_Test_Ghost';
const white=new THREE.MeshBasicMaterial({color:0xf7fcff,side:THREE.DoubleSide});
const dark=new THREE.MeshBasicMaterial({color:0x101c35});
const gold=new THREE.MeshBasicMaterial({color:0xffcb59});
const positions=[],indices=[];const rings=20,segments=40;
for(let row=0;row<=rings;row++) {
  const t=row/rings;
  const r=t<.55?.27:(.27*Math.sqrt(Math.max(0,1-Math.pow((t-.55)/.45,2))));
  for(let col=0;col<=segments;col++) {
    const angle=col/segments*Math.PI*2;
    const y=-.32+t*.74+(1-t)**10*.045*Math.cos(angle*5);
    positions.push(Math.sin(angle)*r,y,Math.cos(angle)*r*.8);
    if(row<rings&&col<segments){const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
}
const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));body.setIndex(indices);body.computeVertexNormals();ghost.add(new THREE.Mesh(body,white));
const sphere=new THREE.SphereGeometry(1,16,12);
for(const x of [-.09,.09]) {const eye=new THREE.Mesh(sphere,dark);eye.scale.set(.032,.053,.021);eye.position.set(x,.18,.206);ghost.add(eye);}
const mouth=new THREE.Mesh(sphere,dark);mouth.scale.set(.025,.03,.013);mouth.position.set(0,.07,.216);ghost.add(mouth);
for(const x of [-.24,.24]) {const arm=new THREE.Mesh(sphere,white);arm.scale.set(.10,.065,.08);arm.position.set(x,-.035,0);arm.rotation.z=x>0?.5:-.5;ghost.add(arm);}
const badge=new THREE.Mesh(new THREE.CircleGeometry(.035,5),gold);badge.position.set(.12,-.105,.219);ghost.add(badge);
const model=await new GLTFExporter().parseAsync(ghost,{binary:true});
await writeFile('public/models/ghost.glb',Buffer.from(model));
await writeFile('public/targets/manifest.json',JSON.stringify({version:'tutorial-v1',mindar:'1.2.5',markers:metadata,sets:{one:['H01'],four:['H01','H02','H03','ANSWER'],nine:ids.slice(0,9),ten:ids}},null,2)+'\n');
await writeFile('assets/source/provenance.json',JSON.stringify({version:2,markers:{creator:'Original procedural calibration patterns',source:'scripts/generate-assets.mjs',seed:260910,license:'CC0-1.0',tutorialMarker:'TUTORIAL appended without changing the original nine marker seeds'},ghost:{creator:'Original procedural low-poly test model',source:'scripts/generate-assets.mjs',license:'CC0-1.0',bytes:model.byteLength},note:'Functional event prototype assets. The tutorial marker is part of tutorial-v1; the 3D ghost remains the accepted lightweight model.'},null,2)+'\n');
console.log(`Generated ${ids.length} markers; ghost.glb ${model.byteLength} bytes.`);
