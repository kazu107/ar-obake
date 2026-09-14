import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decode} from '@msgpack/msgpack';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('public/targets/manifest.json','utf8'));
for(const marker of manifest.markers){const b=await readFile(`public/${marker.file}`);assert.equal(createHash('sha256').update(b).digest('hex'),marker.sha256);}
const master=decode(await readFile('public/targets/ten.mind'));
const features=[];
for(const [set,ids]of Object.entries(manifest.sets)){
  const compiled=decode(await readFile(`public/targets/${set}.mind`));assert.equal(compiled.v,2);assert.equal(compiled.dataList.length,ids.length);
  ids.forEach((id,i)=>{const originalIndex=manifest.markers.findIndex(m=>m.id===id);assert.deepEqual(compiled.dataList[i],master.dataList[originalIndex]);const t=compiled.dataList[i];assert.ok(t.matchingData.length);assert.ok(t.trackingData.length);});
  features.push({set,count:ids.length,bytes:(await readFile(`public/targets/${set}.mind`)).length});
}
const glb=await readFile('public/models/ghost.glb');assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);assert.ok(glb.length<1000000);
assert.ok((await readFile('public/markers.pdf')).length>10000);
assert.ok((await readFile('public/tutorial-marker.pdf')).length>10000);
console.log(JSON.stringify({status:'ASSETS_OK',sets:features,ghostBytes:glb.length},null,2));
