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
const glb=await readFile('public/models/ghost-gestures-v1.glb');assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);assert.ok(glb.length<1000000);
const modelJson=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
for(const name of ['ghost-body','ghost-arm-left','ghost-arm-right','ghost-eye-left','ghost-eye-right','ghost-mouth'])assert.ok(modelJson.nodes.some(node=>node.name===name),`Missing ghost part: ${name}`);
const pdfPages=async file=>{const pdf=await readFile(file);assert.ok(pdf.length>10000);return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length;};
assert.equal(await pdfPages('public/markers.pdf'),20);
assert.equal(await pdfPages('public/tutorial-marker.pdf'),2);
assert.deepEqual(await readFile('public/markers.pdf'),await readFile('output/pdf/ar-obake-markers-duplex.pdf'));
assert.deepEqual(await readFile('public/tutorial-marker.pdf'),await readFile('output/pdf/ar-obake-tutorial-duplex.pdf'));
assert.equal(await pdfPages('public/staff-checklist.pdf'),1);
assert.deepEqual(await readFile('public/staff-checklist.pdf'),await readFile('output/pdf/ar-obake-staff-placement-checklist.pdf'));
assert.deepEqual(await readFile('public/ghost-variants-concept.png'),await readFile('output/imagegen/ghost-variants-concept-v1.png'));
console.log(JSON.stringify({status:'ASSETS_OK',sets:features,ghostBytes:glb.length,pdfPages:{all:20,tutorial:2}},null,2));
