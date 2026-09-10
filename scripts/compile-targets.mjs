import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { decode, encode } from '@msgpack/msgpack';

const server=await createServer({server:{port:5181,strictPort:true,host:'127.0.0.1'},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5181/');
  const gpu=await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));
  if(!gpu)throw Error('WebGL2 unavailable for offline compilation');
  await page.exposeFunction('reportCompile',value=>console.log(`Compile ${value}%`));
  const compiled=await page.evaluate(async()=>{
    const {Compiler}=await import('/node_modules/mind-ar/dist/mindar-image.prod.js');
    const manifest=await fetch('/targets/manifest.json').then(r=>r.json());
    const images=await Promise.all(manifest.markers.map(m=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='/'+m.file;})));
    const compiler=new Compiler();let last=-1;
    await compiler.compileImageTargets(images,progress=>{const n=Math.floor(progress/10)*10;if(n!==last){last=n;window.reportCompile(n);}});
    const bytes=compiler.exportData();let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);
  });
  const nine=decode(Buffer.from(compiled,'base64'));
  if(nine.v!==2||nine.dataList.length!==9)throw Error('Invalid compiled output');
  await mkdir('public/targets',{recursive:true});
  const sets={one:[0],four:[0,1,2,8],nine:[0,1,2,3,4,5,6,7,8]};
  for(const [name,indexes]of Object.entries(sets)) {
    const data=encode({v:nine.v,dataList:indexes.map(i=>nine.dataList[i])});
    await writeFile(`public/targets/${name}.mind`,data);
    console.log(`${name}: ${indexes.length} targets, ${data.length} bytes`);
  }
} finally {await browser.close();await server.close();}
