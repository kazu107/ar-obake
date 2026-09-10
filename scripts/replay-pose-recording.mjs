import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { Matrix4, Quaternion, Vector3 } from 'three';

// Read the operator-selected log, but publish only aggregate metrics, never its samples or path.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputPath=process.argv[2];
if(!inputPath)throw new Error('Usage: node scripts/replay-pose-recording.mjs INPUT_JSON [SUMMARY_JSON]');
const temporary=path.join(root,'.artifacts','pose-replay');
await mkdir(temporary,{recursive:true});
const entry=path.join(temporary,'entry.ts'), compiled=path.join(temporary,'comparison.mjs');
await writeFile(entry,`export {PoseStabilizer as Previous} from ${JSON.stringify(path.join(root,'src/ar/pose-stabilizer.ts'))};\nexport {ProjectedPoseStabilizer as Current} from ${JSON.stringify(path.join(root,'src/ar/projected-pose-stabilizer.ts'))};\n`);
await build({entryPoints:[entry],outfile:compiled,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'silent'});
const {Previous,Current}=await import(pathToFileURL(compiled).href);
const log=JSON.parse(await readFile(inputPath,'utf8'));
const quaternion=p=>new Quaternion(...p.slice(3)).normalize();
const asMatrix=p=>new Matrix4().compose(new Vector3(...p.slice(0,3)),quaternion(p),new Vector3(1,1,1));
function asPose(matrix){const p=new Vector3(),q=new Quaternion(),s=new Vector3();matrix.decompose(p,q,s);return [...p.toArray(),...q.normalize().toArray()];}
function replay(samples,Filter){
  const filter=new Filter(),output=new Matrix4(),result=[];
  for(let i=0;i<samples.length;i++){
    const sample=samples[i];
    if(i)for(let t=samples[i-1].atMs+1000/60;t<sample.atMs;t+=1000/60)filter.render(t,1,output);
    filter.update(asMatrix(sample.input),1,sample.atMs);filter.render(sample.atMs,1,output);
    result.push({...sample,displayed:asPose(output)});
  }
  return result;
}
function summary(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return {mean:values.reduce((s,x)=>s+x,0)/values.length,p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};
}
function metrics(samples,field,focalPixels){
  let rows=samples.filter(s=>s.atMs>=2000);if(rows.length<3)rows=samples;
  const poses=rows.map(s=>s[field]);
  return {
    logDepthStepPercent:summary(poses.slice(1).map((p,i)=>100*Math.abs(Math.log(-p[2])-Math.log(-poses[i][2])))),
    rotationStepDegrees:summary(poses.slice(1).map((p,i)=>quaternion(p).angleTo(quaternion(poses[i]))*180/Math.PI)),
    // Difference from the latest MindAR centre, not from ground truth or DOM pixels.
    centerDifferenceVideoPixels:summary(rows.map(s=>focalPixels*Math.hypot(s[field][0]/-s[field][2]-s.input[0]/-s.input[2],s[field][1]/-s[field][2]-s.input[1]/-s.input[2]))),
  };
}
const records=[];
for(const session of log.sessions??[])for(const recording of session.poseRecordings??[]){
  const samples=recording.samples.filter(s=>s.input?.length===7&&s.displayed?.length===7&&[...s.input,...s.displayed].every(Number.isFinite)&&s.input[2]<0&&s.displayed[2]<0);
  if(recording.status!=='completed'||samples.length<3)continue;
  const height=Number(session.actualResolution?.match(/\d+/g)?.[1]);
  if(!(height>0))continue;
  const focalPixels=height/2/Math.tan(Math.PI/8);
  const previous=metrics(replay(samples,Previous),'displayed',focalPixels),current=metrics(replay(samples,Current),'displayed',focalPixels);
  records.push({appVersion:session.appVersion,mode:session.tracking?.mode,sampleCount:samples.length,
    approximateNotificationHz:1000*(samples.at(-1).updateIndex-samples[0].updateIndex)/(samples.at(-1).atMs-samples[0].atMs),
    observedInput:metrics(samples,'input',focalPixels),observedDisplayed:metrics(samples,'displayed',focalPixels),
    replayPrevious:previous,replayCurrent:current,
    replayMeanDepthStepReduction:1-current.logDepthStepPercent.mean/previous.logDepthStepPercent.mean});
}
if(!records.length)throw new Error('No completed valid pose recordings found');
const result={analyzedAt:new Date().toISOString(),method:'Replay retained input samples, hold between samples, render at 60Hz; discard first 2s. Missing intermediate recognition updates cannot be recovered. Replay is not physical-device validation.',records};
const output=process.argv[3]??path.join(root,'docs','depth-replay-summary.json');
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
