import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import { CanvasTexture, Group, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, WebGLRenderer, SRGBColorSpace, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isSetId, SETS } from '../data/sets';
import { startCameraPreview, mediaError } from './camera-preview';
import { trackingConfig } from './tracking-config';
import { PoseStabilizer } from './pose-stabilizer';
import { ProjectedPoseStabilizer } from './projected-pose-stabilizer';
import { StationaryPoseStabilizer } from './stationary-pose-stabilizer';
import { parseMission, type Mission } from '../game/mission';
import { defaultMarkerSettings, loadMarkerSettings, parseMarkerSettings } from '../storage/marker-settings';
import { orientMarkerContent } from './marker-orientation';

// A disposable browsing context owns camera, TensorFlow, worker and WebGL resources.
// Removing this frame tears down the entire AR runtime, including upstream workers.
const query = new URLSearchParams(location.search);
const requested = query.get('set');
const setId = isSetId(requested) ? requested : 'one';
const missionName = query.get('mission');
const tracking = trackingConfig(query.get('tracking'), query.get('motion'));
let orientations=defaultMarkerSettings();
try{orientations=query.has('orientations')?parseMarkerSettings(JSON.parse(query.get('orientations')!)):loadMarkerSettings(localStorage).settings;}catch{/* Storage/query unavailable: use the same defaults as staff settings. */}
const send = (type: string, data: Record<string, unknown> = {}) => parent.postMessage({ channel: 'obake-lab', type, ...data }, location.origin);
addEventListener('pointerdown',()=>send('interaction'));
let stopped = false;
let stream: MediaStream | undefined;
let controller: Controller | undefined;
let renderer: WebGLRenderer | undefined;
let currentStage = 'runtime-loading';
const abort = new AbortController();
function stop() {
  if (stopped) return;
  stopped = true;
  abort.abort();
  controller?.stopProcessVideo();
  renderer?.setAnimationLoop(null);
  stream?.getTracks().forEach(track => track.stop());
  renderer?.dispose();
}
function fail(error: unknown) {
  if (stopped) return;
  const e = mediaError(error);
  send('error', { ...e, stage: currentStage, visibility: document.visibilityState });
  stop();
}

function requestPlayback(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const panel = document.createElement('div');
    panel.className = 'playback-panel';
    const explanation = document.createElement('p');
    explanation.textContent = 'かめらを うつすために、したの ぼたんを おしてね。';
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'かめらを うつす';
    panel.append(explanation, button); document.body.append(panel);
    const cleanup = () => { panel.remove(); signal.removeEventListener('abort', cancelled); };
    const cancelled = () => { cleanup(); reject(new DOMException('Camera startup cancelled', 'AbortError')); };
    signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) { cancelled(); return; }
    send('playback-required');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await video.play();
        if (signal.aborted) return;
        cleanup(); resolve();
      } catch (error) {
        if (signal.aborted) return;
        send('diagnostic', { stage: 'video-play-user-rejected', ...mediaError(error) });
        explanation.textContent = 'かめらが とまったよ。もういちど おしてね。なおらないときは、すたっふに きいてね。';
        button.disabled = false;
      }
    });
  });
}
addEventListener('pagehide', stop);
addEventListener('error', event => fail(event.error ?? event.message));
addEventListener('unhandledrejection', event => fail(event.reason));
async function resource(path: string) {
  const response = await fetch(new URL(path, document.baseURI), { signal: abort.signal });
  if (!response.ok) throw new Error(`素材を読み込めません: ${path} (${response.status})`);
  return response.arrayBuffer();
}
async function missionResource(path: string): Promise<Mission> {
  const response = await fetch(new URL(path, document.baseURI), { signal: abort.signal });
  if (!response.ok) throw new Error(`問題を読み込めません: ${path} (${response.status})`);
  return parseMission(await response.json());
}

function createSpeechBubble() {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=360;
  const context=canvas.getContext('2d')!;
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearFilter;texture.magFilter=LinearFilter;
  const mesh=new Mesh(new PlaneGeometry(.72,.337),new MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  // Keep the bubble inside a portrait camera crop while it remains attached to
  // and rotates with the recognized marker.
  mesh.position.set(.1,.36,.2);mesh.renderOrder=2;mesh.visible=false;
  const draw=(speaker:string,text:string)=>{
    context.clearRect(0,0,canvas.width,canvas.height);
    const x=12,y=12,w=744,h=282,r=34;
    context.beginPath();context.moveTo(x+r,y);context.lineTo(x+w-r,y);context.quadraticCurveTo(x+w,y,x+w,y+r);
    context.lineTo(x+w,y+h-r);context.quadraticCurveTo(x+w,y+h,x+w-r,y+h);context.lineTo(446,y+h);context.lineTo(386,348);context.lineTo(342,y+h);
    context.lineTo(x+r,y+h);context.quadraticCurveTo(x,y+h,x,y+h-r);context.lineTo(x,y+r);context.quadraticCurveTo(x,y,x+r,y);context.closePath();
    context.fillStyle='#ffffff';context.fill();context.lineWidth=12;context.strokeStyle='#101c35';context.stroke();
    context.fillStyle='#246b5a';context.font='700 30px -apple-system, BlinkMacSystemFont, "Yu Gothic UI", sans-serif';context.fillText(speaker,50,72);
    const lines=text.split('\n').slice(0,2);let fontSize=42;
    const font=()=>{context.font=`700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Yu Gothic UI", sans-serif`;};font();
    while(fontSize>28&&lines.some(line=>context.measureText(line).width>668)){fontSize--;font();}
    context.fillStyle='#101c35';lines.forEach((line,index)=>context.fillText(line,50,142+index*62));
    texture.needsUpdate=true;
  };
  return {mesh,draw};
}

async function start() {
  if (parent === window) throw new Error('トップページからカメラを開始してください。');
  send('loading', { stage: 'カメラの許可を確認しています' });
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('HTTPSのSafariから開いてください。');
  const requestedWidth = query.get('resolution') === '960' ? 960 : 640;
  const video = document.createElement('video');
  document.body.append(video);
  stream = await startCameraPreview(video, { requestedWidth, signal: abort.signal, requestPlayback,
    onStage: (stage, details) => { currentStage = stage; send('diagnostic', { stage, ...details }); },
  });
  if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
  const width=video.videoWidth, height=video.videoHeight;
  // MindAR InputLoader reads the element's width/height, not videoWidth/videoHeight.
  video.width=width;video.height=height;
  const gpuStart = performance.now();
  send('camera', { width, height });
  send('loading', { stage: '認識データとおばけを準備しています' });
  currentStage = 'assets-loading';
  const missionPromise = missionName==='main' ? missionResource('./missions/main.json') : missionName==='practice' ? missionResource('./missions/prototype.json') : Promise.resolve(undefined);
  const [targetBuffer, ghostBuffer, mission] = await Promise.all([resource(`./targets/${setId}.mind`), resource('./models/ghost.glb'), missionPromise]);
  if (mission && mission.markerSet!==setId) throw new Error('問題とマーカーセットが一致しません。');
  const ghost = (await new GLTFLoader().parseAsync(ghostBuffer, './')).scene;
  if (stopped) return;
  currentStage = 'tracking-initialization';
  renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000,0); document.body.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('描画が中断されました。カメラを開始し直してください。')); });
  const scene = new Scene(), camera = new PerspectiveCamera();
  const anchors = SETS[setId].ids.map(id => {
    const group = new Group();group.matrixAutoUpdate=false;group.visible=false;
    const content=new Group(),orientation=orientations[id];orientMarkerContent(content,orientation);
    const model=ghost.clone(true);model.position.z=.1;
    if(id==='TUTORIAL')model.traverse(object=>{if(object instanceof Mesh&&object.material instanceof MeshBasicMaterial&&object.material.color.getHex()===0xf7fcff){const material=object.material.clone();material.color.setHex(0xdff9ef);object.material=material;}});
    content.add(model);group.add(content);scene.add(group);
    return {id,group,content,orientation,model,post:new Matrix4(),input:new Matrix4(),pose:tracking.poseStabilization?.algorithm==='stationary-hold-v3'?new StationaryPoseStabilizer():tracking.poseStabilization?.algorithm==='projection-depth-v2'?new ProjectedPoseStabilizer():new PoseStabilizer(),markerWidth:1,inputAtMs:0,updateIndex:0};
  });
  const speechById=new Map(mission ? [...mission.hints.map(h=>[h.markerId,{speaker:h.speaker,text:h.text}] as const),[mission.answerMarker.markerId,{speaker:'こたえの おばけ',text:'みんなの こたえを おしえて！'}] as const,...(mission.tutorialMarker?[[mission.tutorialMarker.markerId,{speaker:mission.tutorialMarker.speaker,text:mission.tutorialMarker.text}] as const]:[])] : []);
  const speechBubble=createSpeechBubble();let spokenId='';
  send('tracking-config', { config: tracking });
  controller = new Controller({ inputWidth: width, inputHeight: height, maxTrack: 1, warmupTolerance: 3, missTolerance: 5,
    filterMinCF: tracking.filterMinCF, filterBeta: tracking.filterBeta,
    onUpdate: event => {
      if (stopped || event.type !== 'updateMatrix') return;
      const anchor = anchors[event.targetIndex]; if (!anchor) return;
      const visible = event.worldMatrix !== null;
      if (visible) {
        const now = performance.now();
        anchor.input.fromArray(event.worldMatrix!).multiply(anchor.post);
        if (tracking.poseStabilization) {
          if (!anchor.pose.update(anchor.input, anchor.markerWidth, now)) return;
          if (!anchor.group.visible) anchor.pose.render(now, anchor.markerWidth, anchor.group.matrix);
        } else anchor.group.matrix.copy(anchor.input);
        anchor.inputAtMs = now; anchor.updateIndex++;
      } else anchor.pose.reset();
      if (visible !== anchor.group.visible) send(visible ? 'found' : 'lost', { id: anchor.id, targetIndex: event.targetIndex });
      anchor.group.visible = visible;
    }
  });
  const { dimensions } = controller.addImageTargetsFromBuffer(targetBuffer);
  if (dimensions.length !== anchors.length) throw new Error('マーカーセットの対応が一致しません。');
  dimensions.forEach(([w,h],index) => { anchors[index].markerWidth=w; anchors[index].post.makeTranslation(w/2,h/2,0).scale(new Vector3(w,w,w)); });
  const projection=controller.getProjectionMatrix();
  function resize() {
    if (!renderer || stopped) return;
    const viewportWidth=innerWidth, viewportHeight=innerHeight;
    renderer.setSize(viewportWidth,viewportHeight);
    // Match the centered object-fit:cover crop used by the video element.
    camera.projectionMatrix.fromArray(projection);
    const inputRatio=width/height, outputRatio=viewportWidth/viewportHeight;
    if (inputRatio>outputRatio) camera.projectionMatrix.elements[0] *= inputRatio/outputRatio;
    else camera.projectionMatrix.elements[5] *= outputRatio/inputRatio;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  resize(); addEventListener('resize',resize);
  video.addEventListener('resize', () => { if(video.videoWidth!==width||video.videoHeight!==height) {send('restart-required',{reason:'画面の向きが変わりました。カメラを開始し直してください。'}); stop();} });
  stream.getVideoTracks()[0].addEventListener('ended', () => fail(new Error('カメラが停止しました。開始し直してください。')));
  controller.dummyRun(video);
  if (stopped) return;
  controller.processVideo(video);
  let recordingStarted = -Infinity, lastPoseSample = -Infinity;
  addEventListener('message', event => {
    if (stopped || event.source !== parent || event.origin !== location.origin ||
        event.data?.channel !== 'obake-lab' || event.data?.type !== 'record-pose') return;
    recordingStarted = performance.now(); lastPoseSample = -Infinity;
  });
  const diagnosticPosition = new Vector3(), diagnosticRotation = new Quaternion(), diagnosticScale = new Vector3();
  function readPose(matrix: Matrix4, markerWidth: number) {
    matrix.decompose(diagnosticPosition, diagnosticRotation, diagnosticScale);
    diagnosticPosition.divideScalar(markerWidth); diagnosticRotation.normalize();
    return [...diagnosticPosition.toArray(), ...diagnosticRotation.toArray()].map(value => Number(value.toFixed(6)));
  }
  let fpsTime=performance.now(), frames=0;
  renderer.setAnimationLoop(time => {
    if(stopped||!renderer)return;
    const now=performance.now();
    for(const a of anchors) if(a.group.visible && tracking.poseStabilization) a.pose.render(now,a.markerWidth,a.group.matrix);
    if(tracking.ghostMotion==='float') for(const a of anchors) if(a.group.visible) {a.model.position.y=Math.sin(time/650)*.025;a.model.rotation.y=Math.sin(time/1100)*.08;}
    const speaking=anchors.find(a=>a.group.visible),copy=speaking?speechById.get(speaking.id):undefined;
    if(speaking&&copy){
      if(speechBubble.mesh.parent!==speaking.content)speaking.content.add(speechBubble.mesh);
      if(spokenId!==speaking.id){spokenId=speaking.id;speechBubble.draw(copy.speaker,copy.text);document.body.dataset.speechId=speaking.id;document.body.dataset.speechCopy=`${copy.speaker}\n${copy.text}`;document.body.dataset.markerOrientation=speaking.orientation;send('speech-visible',{id:speaking.id,rendering:'three-mesh',orientation:speaking.orientation});}
      speechBubble.mesh.visible=true;
    }else{speechBubble.mesh.visible=false;spokenId='';delete document.body.dataset.speechId;delete document.body.dataset.speechCopy;delete document.body.dataset.markerOrientation;}
    renderer.render(scene,camera);frames++;
    if(now-recordingStarted<=10000 && now-lastPoseSample>=100) {
      const a=anchors.find(anchor=>anchor.group.visible);
      if(a) send('pose-sample',{sample:{atMs:Math.round(now-recordingStarted),inputAtMs:Math.max(0,Math.round(a.inputAtMs-recordingStarted)),updateIndex:a.updateIndex,targetId:a.id,stabilizationState:a.pose instanceof StationaryPoseStabilizer ? a.pose.state : 'following',input:readPose(a.input,a.markerWidth),displayed:readPose(a.group.matrix,a.markerWidth)}});
      lastPoseSample=now;
    }
    if(now-fpsTime>=1000){const a=anchors.find(a=>a.group.visible);send('fps',{value:frames*1000/(now-fpsTime),stabilizationState:a ? a.pose instanceof StationaryPoseStabilizer ? a.pose.state : 'following' : 'searching'});frames=0;fpsTime=now;}
  });
  currentStage = 'tracking';
  send('ready',{width,height,trackingInitMs:performance.now()-gpuStart,targetCount:dimensions.length});
}
start().catch(fail);
