import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

for (const dir of ['public/markers', 'public/models', 'public/targets', 'assets/source']) await mkdir(dir, { recursive: true });
const ids = ['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER','TUTORIAL'];
const metadata = [];

const markerPalette=['#17142f','#34245f','#f07824','#6a3fb4','#526476','#51915d'];
function drawBat(ctx,size){
  ctx.beginPath();ctx.moveTo(-size*.5,0);ctx.quadraticCurveTo(-size*.35,-size*.42,-size*.12,-size*.12);ctx.lineTo(0,-size*.35);ctx.lineTo(size*.12,-size*.12);ctx.quadraticCurveTo(size*.35,-size*.42,size*.5,0);ctx.quadraticCurveTo(size*.28,-size*.08,size*.2,size*.25);ctx.quadraticCurveTo(0,size*.08,-size*.2,size*.25);ctx.quadraticCurveTo(-size*.28,-size*.08,-size*.5,0);ctx.fill();
}
function drawPumpkin(ctx,size){
  ctx.fillStyle='#f07824';ctx.beginPath();ctx.ellipse(0,0,size*.45,size*.36,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#9b4318';ctx.lineWidth=Math.max(3,size*.05);for(const x of [-.18,0,.18]){ctx.beginPath();ctx.ellipse(0,0,size*(.22+Math.abs(x)),size*.35,0,-Math.PI/2,Math.PI/2);ctx.stroke();}
  ctx.fillStyle='#17142f';for(const x of [-.16,.16]){ctx.beginPath();ctx.moveTo(size*x,-size*.07);ctx.lineTo(size*(x+.08),size*.06);ctx.lineTo(size*(x-.08),size*.06);ctx.closePath();ctx.fill();}
  ctx.fillRect(-size*.24,size*.16,size*.48,size*.06);ctx.fillStyle='#51915d';ctx.fillRect(-size*.045,-size*.48,size*.09,size*.14);
}
function drawGhost(ctx,size){
  ctx.fillStyle='#fffaf2';ctx.strokeStyle='#17142f';ctx.lineWidth=Math.max(4,size*.055);ctx.beginPath();ctx.moveTo(-size*.36,size*.38);ctx.lineTo(-size*.36,-size*.02);ctx.bezierCurveTo(-size*.36,-size*.42,size*.36,-size*.42,size*.36,-size*.02);ctx.lineTo(size*.36,size*.38);ctx.lineTo(size*.18,size*.25);ctx.lineTo(0,size*.4);ctx.lineTo(-size*.18,size*.25);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#17142f';ctx.beginPath();ctx.arc(-size*.12,-size*.05,size*.045,0,Math.PI*2);ctx.arc(size*.12,-size*.05,size*.045,0,Math.PI*2);ctx.fill();
}
function drawWeb(ctx,size){
  ctx.strokeStyle='#34245f';ctx.lineWidth=Math.max(3,size*.04);for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*size*.5,Math.sin(a)*size*.5);ctx.stroke();}for(const r of [.18,.34,.5]){ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*2);ctx.stroke();}
}
function drawCandy(ctx,size){
  ctx.fillStyle='#6a3fb4';ctx.fillRect(-size*.23,-size*.18,size*.46,size*.36);ctx.fillStyle='#f07824';ctx.beginPath();ctx.moveTo(-size*.23,-size*.16);ctx.lineTo(-size*.5,-size*.34);ctx.lineTo(-size*.48,size*.3);ctx.lineTo(-size*.23,size*.16);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(size*.23,-size*.16);ctx.lineTo(size*.5,-size*.34);ctx.lineTo(size*.48,size*.3);ctx.lineTo(size*.23,size*.16);ctx.closePath();ctx.fill();ctx.fillStyle='#fffaf2';ctx.fillRect(-size*.04,-size*.18,size*.08,size*.36);
}
function drawMoon(ctx,size){
  ctx.fillStyle='#f0b52f';ctx.beginPath();ctx.arc(0,0,size*.45,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffaf2';ctx.beginPath();ctx.arc(size*.18,-size*.13,size*.43,0,Math.PI*2);ctx.fill();
}
function drawTombstone(ctx,size){
  ctx.fillStyle='#526476';ctx.strokeStyle='#17142f';ctx.lineWidth=Math.max(3,size*.04);ctx.beginPath();ctx.moveTo(-size*.34,size*.42);ctx.lineTo(-size*.34,-size*.08);ctx.arc(0,-size*.08,size*.34,Math.PI,0);ctx.lineTo(size*.34,size*.42);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#fffaf2';ctx.beginPath();ctx.moveTo(-size*.13,size*.05);ctx.lineTo(size*.13,size*.05);ctx.moveTo(0,-size*.08);ctx.lineTo(0,size*.25);ctx.stroke();
}
function drawStar(ctx,size){
  ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.2:size*.48;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
}
for (let index = 0; index < ids.length; index++) {
  let seed = 261031 + index * 7919;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const canvas = createCanvas(800, 800), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf2'; ctx.fillRect(0,0,800,800);
  // Unique, seeded Halloween silhouettes keep strong local features for image tracking.
  for (let k = 0; k < 86; k++) {
    const x = 34 + random()*732, y = 34 + random()*704, size = 22 + random()*82;
    ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*Math.PI*1.5);ctx.globalAlpha=.96;
    ctx.fillStyle=markerPalette[Math.floor(random()*markerPalette.length)];
    const kind=Math.floor(random()*8);
    if(kind===0)drawBat(ctx,size);else if(kind===1)drawPumpkin(ctx,size);else if(kind===2)drawGhost(ctx,size);else if(kind===3)drawWeb(ctx,size);else if(kind===4)drawCandy(ctx,size);else if(kind===5)drawMoon(ctx,size);else if(kind===6)drawTombstone(ctx,size);else drawStar(ctx,size);
    ctx.restore();
  }
  ctx.strokeStyle='#17142f';ctx.lineWidth=10;ctx.strokeRect(14,14,772,772);
  ctx.fillStyle='#fffaf2';ctx.fillRect(214,310,372,170);
  ctx.strokeStyle=index===8?'#f07824':index===9?'#51915d':'#6a3fb4';ctx.lineWidth=11;ctx.strokeRect(226,322,348,146);
  ctx.fillStyle='#17142f';ctx.font=`bold ${ids[index]==='TUTORIAL'?42:index===8?64:95}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ids[index],400,397);
  ctx.fillStyle='#17142f';ctx.font='bold 20px sans-serif';ctx.fillText(`AR OBAKE / HALLOWEEN CARD ${String(index+1).padStart(2,'0')}`,400,767);
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
const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));body.setIndex(indices);body.computeVertexNormals();const bodyMesh=new THREE.Mesh(body,white);bodyMesh.name='ghost-body';ghost.add(bodyMesh);
const sphere=new THREE.SphereGeometry(1,16,12);
for(const x of [-.09,.09]) {const eye=new THREE.Mesh(sphere,dark);eye.name=x<0?'ghost-eye-left':'ghost-eye-right';eye.scale.set(.032,.053,.021);eye.position.set(x,.18,.206);ghost.add(eye);}
const mouth=new THREE.Mesh(sphere,dark);mouth.name='ghost-mouth';mouth.scale.set(.025,.03,.013);mouth.position.set(0,.07,.216);ghost.add(mouth);
for(const x of [-.24,.24]) {const arm=new THREE.Mesh(sphere,white);arm.name=x<0?'ghost-arm-left':'ghost-arm-right';arm.scale.set(.10,.065,.08);arm.position.set(x,-.035,0);arm.rotation.z=x>0?.5:-.5;ghost.add(arm);}
const badge=new THREE.Mesh(new THREE.CircleGeometry(.035,5),gold);badge.position.set(.12,-.105,.219);ghost.add(badge);
const model=await new GLTFExporter().parseAsync(ghost,{binary:true});
await writeFile('public/models/ghost-gestures-v1.glb',Buffer.from(model));
await writeFile('public/targets/manifest.json',JSON.stringify({version:'halloween-v1',mindar:'1.2.5',markers:metadata,sets:{one:['H01'],four:['H01','H02','H03','ANSWER'],nine:ids.slice(0,9),ten:ids}},null,2)+'\n');
await writeFile('assets/source/provenance.json',JSON.stringify({version:6,markers:{creator:'Original procedural Halloween calibration patterns',source:'scripts/generate-assets.mjs',seed:261031,license:'CC0-1.0',theme:'Halloween silhouettes with H01-H08, ANSWER and TUTORIAL labels',font:'sans-serif'},ghost:{creator:'Original procedural low-poly model with named gesture parts',file:'models/ghost-gestures-v1.glb',source:'scripts/generate-assets.mjs',license:'CC0-1.0',bytes:model.byteLength},note:'Restored the original Halloween marker labels and matching target data for 0.8.5. The previous hiragana markers are retained as compatibility fixtures. Gesture model and targetIndex ordering stay unchanged.'},null,2)+'\n');
console.log(`Generated ${ids.length} markers; ghost-gestures-v1.glb ${model.byteLength} bytes.`);
