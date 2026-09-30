import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, type Object3D } from 'three';

export type GhostVariantKind='plain'|'greeting'|'pumpkin'|'surprised';
const durationMs=2000,replayIntervalMs=12000;
const ease=(t:number)=>t*t*(3-2*t);

// Gestures use their own clock. Marker visibility may flicker, but reacquiring
// a card must not repeatedly restart its greeting or change the tracked pose.
export class GhostGesture {
  private visible=false;
  private startedAt=-Infinity;
  constructor(readonly kind:GhostVariantKind,private pose:(lift:number,wave:number)=>void){}
  setVisible(visible:boolean,now:number):boolean {
    if(visible===this.visible)return false;
    this.visible=visible;
    if(!visible){this.pose(0,0);return false;}
    if(this.kind==='plain'||now-this.startedAt<replayIntervalMs)return false;
    this.startedAt=now;return true;
  }
  isActive(now:number):boolean {return this.visible&&now>=this.startedAt&&now-this.startedAt<durationMs;}
  update(now:number):void {
    if(!this.isActive(now)){this.pose(0,0);return;}
    const phase=(now-this.startedAt)/durationMs;
    // Raise, briefly hold, then return to the exact authored resting pose.
    const lift=phase<.25?ease(phase/.25):phase>.65?1-ease((phase-.65)/.35):1;
    this.pose(lift,Math.sin(phase*Math.PI*6)*lift);
  }
}

function pumpkinLantern():Group {
  const lantern=new Group();lantern.name='pumpkin-lantern';
  const orange=new MeshBasicMaterial({color:0xf07824}),rib=new MeshBasicMaterial({color:0xd8641e}),dark=new MeshBasicMaterial({color:0x34245f});
  const ball=new SphereGeometry(.085,12,8);
  const body=new Mesh(ball,orange);body.scale.set(1.08,.88,.88);lantern.add(body);
  // A few shallow lobes make it read as a pumpkin without a large mesh budget.
  for(const side of [-1,1]){const lobe=new Mesh(ball,rib);lobe.scale.set(.44,.84,.82);lobe.position.x=side*.057;lantern.add(lobe);}
  const stem=new Mesh(new CylinderGeometry(.009,.013,.029,6),dark);stem.position.y=.087;lantern.add(stem);
  const handle=new Mesh(new TorusGeometry(.058,.006,5,12,Math.PI),dark);handle.position.y=.1;lantern.add(handle);
  for(const x of [-.031,.031]){
    const eye=new Shape();eye.moveTo(-.013,-.007);eye.lineTo(.013,-.007);eye.lineTo(0,.015);eye.closePath();
    const mesh=new Mesh(new ShapeGeometry(eye),dark);mesh.position.set(x,.018,.079);lantern.add(mesh);
  }
  const mouth=new Shape();mouth.moveTo(-.034,-.014);mouth.lineTo(-.016,-.019);mouth.lineTo(0,-.014);mouth.lineTo(.016,-.019);mouth.lineTo(.034,-.014);mouth.lineTo(.024,-.033);mouth.lineTo(-.024,-.033);mouth.closePath();
  const smile=new Mesh(new ShapeGeometry(mouth),dark);smile.position.z=.081;lantern.add(smile);
  lantern.position.set(.31,-.135,.13);
  return lantern;
}

export function createGhostVariant(template:Object3D,markerId:string):{model:Object3D;gesture:GhostGesture} {
  const model=template.clone(true);
  const left=model.getObjectByName('ghost-arm-left'),right=model.getObjectByName('ghost-arm-right');
  const mouth=model.getObjectByName('ghost-mouth'),eyes=[model.getObjectByName('ghost-eye-left'),model.getObjectByName('ghost-eye-right')];
  if(!left||!right||!mouth||eyes.some(eye=>!eye))throw Error('Ghost model is missing gesture parts');
  const kind:GhostVariantKind=markerId==='TUTORIAL'?'greeting':markerId==='H01'?'pumpkin':markerId==='H08'?'surprised':'plain';
  if(kind==='greeting'){
    mouth.visible=false;
    const smile=new Mesh(new TorusGeometry(.034,.0055,4,12,Math.PI),new MeshBasicMaterial({color:0x101c35}));
    smile.name='greeting-smile';smile.position.set(0,.095,.224);smile.rotation.z=Math.PI;model.add(smile);
  }
  if(kind==='surprised'){mouth.scale.set(.04,.047,.016);for(const eye of eyes)eye!.scale.set(.042,.042,.021);}
  const lantern=kind==='pumpkin'?pumpkinLantern():undefined;if(lantern)model.add(lantern);
  const leftPosition=left.position.clone(),rightPosition=right.position.clone(),leftAngle=left.rotation.z,rightAngle=right.rotation.z,lanternY=lantern?.position.y??0;
  const gesture=new GhostGesture(kind,(lift,wave)=>{
    left.position.copy(leftPosition);right.position.copy(rightPosition);left.rotation.z=leftAngle;right.rotation.z=rightAngle;
    if(kind==='greeting'){right.position.y+=.22*lift;right.position.z+=.07*lift;right.rotation.z+=.55*lift+.3*wave;}
    if(kind==='surprised'){
      left.position.y+=.18*lift;right.position.y+=.18*lift;left.position.z+=.06*lift;right.position.z+=.06*lift;
      left.rotation.z-=.8*lift;right.rotation.z+=.8*lift;
    }
    if(lantern){right.position.y+=.065*lift;lantern.position.y=lanternY+.065*lift;}
  });
  return {model,gesture};
}
