import { BoxGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, type Object3D } from 'three';

export type GhostVariantKind='plain'|'greeting'|'pumpkin'|'bat'|'sleepy'|'candy'|'book'|'bell'|'broom'|'surprised'|'detective';
export const GHOST_VARIANTS:Readonly<Record<string,GhostVariantKind>>={TUTORIAL:'greeting',H01:'pumpkin',H02:'bat',H03:'sleepy',H04:'candy',H05:'book',H06:'bell',H07:'broom',H08:'surprised',ANSWER:'detective'};
const durationMs=2000,replayIntervalMs=12000;
const ease=(t:number)=>t*t*(3-2*t);

// Gestures use their own clock. Marker visibility may flicker, but reacquiring
// a card must not repeatedly restart its greeting or change the tracked pose.
export class GhostGesture {
  private visible=false;
  private startedAt=-Infinity;
  constructor(readonly kind:GhostVariantKind,private pose:(lift:number,wave:number,phase?:number)=>void){}
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
    this.pose(lift,Math.sin(phase*Math.PI*6)*lift,phase);
  }
}

// Small procedural props share the unit shapes/materials across all anchors.
// They add no downloads and avoid the colours/accessories used in the clues.
const unitBox=new BoxGeometry(1,1,1),unitBall=new SphereGeometry(1,12,8);
const unitCylinder=new CylinderGeometry(1,1,1,10);
const materials={
  white:new MeshBasicMaterial({color:0xfffaf2,side:DoubleSide}),
  gray:new MeshBasicMaterial({color:0x89919e,side:DoubleSide}),
  dark:new MeshBasicMaterial({color:0x34245f,side:DoubleSide}),
  purple:new MeshBasicMaterial({color:0x654099,side:DoubleSide}),
  orange:new MeshBasicMaterial({color:0xf07824,side:DoubleSide}),
  brown:new MeshBasicMaterial({color:0x805330,side:DoubleSide}),
  straw:new MeshBasicMaterial({color:0xaf8258,side:DoubleSide}),
};
function part(parent:Group,geometry:BoxGeometry|SphereGeometry|CylinderGeometry,material:MeshBasicMaterial,scale:[number,number,number],position:[number,number,number],name=''):Mesh {
  const mesh=new Mesh(geometry,material);mesh.scale.set(...scale);mesh.position.set(...position);mesh.name=name;parent.add(mesh);return mesh;
}
function batCompanion():Group {
  const bat=new Group();bat.name='bat-companion';bat.position.set(-.27,.045,.145);
  part(bat,unitBall,materials.purple,[.026,.04,.021],[0,0,0]);
  for(const side of [-1,1]){
    const wing=new Group();wing.name=side<0?'bat-wing-left':'bat-wing-right';wing.position.x=side*.016;
    const shape=new Shape();shape.moveTo(0,.02);shape.quadraticCurveTo(.05,.09,.135,.025);
    shape.quadraticCurveTo(.10,.03,.092,-.015);shape.quadraticCurveTo(.055,.008,.045,-.034);shape.lineTo(0,-.022);shape.closePath();
    const mesh=new Mesh(new ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,curveSegments:5}),materials.purple);mesh.scale.x=side;wing.add(mesh);bat.add(wing);
    const ear=new Mesh(new CylinderGeometry(0,.012,.027,4),materials.purple);ear.position.set(side*.016,.042,0);bat.add(ear);
    part(bat,unitBall,materials.white,[.005,.005,.003],[side*.011,.008,.022]);
  }
  return bat;
}
function pillow():Group {
  const root=new Group();root.name='sleepy-pillow';root.position.set(0,-.12,.255);root.rotation.z=-.08;
  const shape=new Shape();shape.moveTo(-.12,-.05);shape.lineTo(.12,-.05);shape.quadraticCurveTo(.15,-.05,.15,-.025);shape.lineTo(.15,.025);shape.quadraticCurveTo(.15,.05,.12,.05);shape.lineTo(-.12,.05);shape.quadraticCurveTo(-.15,.05,-.15,.025);shape.lineTo(-.15,-.025);shape.quadraticCurveTo(-.15,-.05,-.12,-.05);
  const cushion=new Mesh(new ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2,curveSegments:3,steps:1}),materials.gray);cushion.position.z=-.018;root.add(cushion);
  for(const side of [-1,1])part(root,unitBox,materials.white,[.008,.066,.007],[side*.116,0,.033]);
  return root;
}
function wrappedCandy():Group {
  const root=new Group();root.name='wrapped-candy';root.position.set(.23,-.065,.15);
  const sweet=part(root,unitCylinder,materials.orange,[.047,.12,.047],[0,0,0]);sweet.rotation.z=Math.PI/2;
  const stripe=part(root,unitCylinder,materials.white,[.048,.021,.048],[0,0,0]);stripe.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
    const end=new Mesh(new CylinderGeometry(.018,.054,.058,6),materials.white);end.position.x=side*.084;end.rotation.z=-side*Math.PI/2;root.add(end);
  }
  root.rotation.z=.15;return root;
}
function openBook():Group {
  const root=new Group();root.name='open-book';root.position.set(0,-.125,.27);root.rotation.x=-.2;
  for(const side of [-1,1]){
    const half=new Group();half.rotation.y=side*.17;
    part(half,unitBox,materials.gray,[.133,.176,.017],[side*.067,0,0]);
    part(half,unitBox,materials.white,[.120,.158,.014],[side*.062,0,.016]);
    for(const y of [-.048,-.025,0,.025,.048])part(half,unitBox,materials.gray,[.082,.003,.002],[side*.066,y,.024]);
    root.add(half);
  }
  const page=new Group();page.name='book-turning-page';page.position.z=.034;page.visible=false;
  part(page,unitBox,materials.white,[.12,.158,.004],[.061,0,0]);root.add(page);
  return root;
}
function littleBell():Group {
  const root=new Group();root.name='little-bell';root.position.set(.30,-.085,.13);
  part(root,unitBall,materials.purple,[.025,.025,.025],[0,.103,0]);
  part(root,unitCylinder,materials.purple,[.012,.064,.012],[0,.057,0]);
  const shell=new Mesh(new CylinderGeometry(.023,.062,.10,12,1,true),materials.white);root.add(shell);
  const rim=new Mesh(new TorusGeometry(.061,.007,5,12),materials.purple);rim.position.y=-.05;rim.rotation.x=Math.PI/2;root.add(rim);
  part(root,unitBall,materials.gray,[.018,.018,.018],[0,-.053,0]);return root;
}
function littleBroom():Group {
  const root=new Group();root.name='little-broom';root.position.set(.25,-.095,.13);root.rotation.z=-.17;
  part(root,unitCylinder,materials.brown,[.012,.39,.012],[0,.045,0]);
  const brush=new Mesh(new CylinderGeometry(.025,.072,.125,8),materials.straw);brush.position.y=-.18;root.add(brush);
  for(const x of [-.04,-.02,0,.02,.04])part(root,unitCylinder,materials.brown,[.003,.08,.003],[x,-.195,.045]);
  part(root,unitCylinder,materials.dark,[.033,.02,.033],[0,-.133,0]);return root;
}
function detectiveNotebook():Group {
  const root=new Group();root.name='detective-notebook';root.position.set(-.18,-.12,.26);root.rotation.z=-.12;
  part(root,unitBox,materials.gray,[.14,.18,.023],[0,0,0]);
  part(root,unitBox,materials.white,[.113,.151,.008],[.005,-.003,.015]);
  for(const y of [-.048,-.019,.01,.039])part(root,unitBox,materials.gray,[.075,.003,.002],[.006,y,.02]);
  for(const y of [-.065,-.026,.013,.052]){
    const ring=new Mesh(new TorusGeometry(.012,.003,4,8),materials.dark);ring.rotation.y=Math.PI/2;ring.position.set(-.067,y,.005);root.add(ring);
  }
  return root;
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
  const kind=GHOST_VARIANTS[markerId]??'plain';
  if(kind==='greeting'||kind==='broom'){
    mouth.visible=false;
    const smile=new Mesh(new TorusGeometry(.034,.0055,4,12,Math.PI),new MeshBasicMaterial({color:0x101c35}));
    smile.name=kind==='greeting'?'greeting-smile':'broom-smile';smile.position.set(0,.095,.224);smile.rotation.z=Math.PI;model.add(smile);
  }
  if(kind==='surprised'){mouth.scale.set(.04,.047,.016);for(const eye of eyes)eye!.scale.set(.042,.042,.021);}
  if(kind==='sleepy'){for(const eye of eyes)eye!.scale.y=.019;mouth.scale.set(.032,.009,.013);}
  const lantern=kind==='pumpkin'?pumpkinLantern():undefined;if(lantern)model.add(lantern);
  const bat=kind==='bat'?batCompanion():undefined;if(bat)model.add(bat);
  if(kind==='sleepy')model.add(pillow());
  const candy=kind==='candy'?wrappedCandy():undefined;if(candy)model.add(candy);
  const book=kind==='book'?openBook():undefined;if(book)model.add(book);
  const bell=kind==='bell'?littleBell():undefined;if(bell)model.add(bell);
  const broom=kind==='broom'?littleBroom():undefined;if(broom)model.add(broom);
  if(kind==='detective')model.add(detectiveNotebook());
  // The detective nod is limited to its face: the tracked body stays fixed.
  const face=kind==='detective'?new Group():undefined;
  if(face){face.name='detective-face';face.position.set(0,.18,.206);model.add(face);for(const feature of [...eyes,mouth]){feature!.position.sub(face.position);face.add(feature!);}}
  const leftPosition=left.position.clone(),rightPosition=right.position.clone(),leftAngle=left.rotation.z,rightAngle=right.rotation.z,lanternY=lantern?.position.y??0;
  const eyeSizes=eyes.map(eye=>eye!.scale.clone()),candyPosition=candy?.position.clone(),page=book?.getObjectByName('book-turning-page');
  const gesture=new GhostGesture(kind,(lift,wave,phase)=>{
    left.position.copy(leftPosition);right.position.copy(rightPosition);left.rotation.z=leftAngle;right.rotation.z=rightAngle;
    if(kind==='greeting'){right.position.y+=.22*lift;right.position.z+=.07*lift;right.rotation.z+=.55*lift+.3*wave;}
    if(kind==='surprised'){
      left.position.y+=.18*lift;right.position.y+=.18*lift;left.position.z+=.06*lift;right.position.z+=.06*lift;
      left.rotation.z-=.8*lift;right.rotation.z+=.8*lift;
    }
    if(lantern){right.position.y+=.065*lift;lantern.position.y=lanternY+.065*lift;}
    if(bat){const flap=phase===undefined?0:Math.sin(phase*Math.PI*2)*.6*lift;bat.getObjectByName('bat-wing-left')!.rotation.y=flap;bat.getObjectByName('bat-wing-right')!.rotation.y=-flap;}
    // Thin the eye's depth too, so closed eyes stay closed in an oblique view.
    if(kind==='sleepy')eyes.forEach((eye,index)=>{eye!.scale.y=eyeSizes[index].y*(1-.88*lift);eye!.scale.z=eyeSizes[index].z*(1-.88*lift);});
    if(candy){candy.position.copy(candyPosition!);candy.position.y+=.04*lift;candy.position.z+=.115*lift;candy.rotation.y=.28*lift;right.position.y+=.04*lift;right.position.z+=.115*lift;}
    if(page){page.visible=phase!==undefined;page.rotation.y=phase===undefined?0:-Math.PI*ease(Math.min(1,phase/.8));left.position.y+=.035*lift;left.position.z+=.045*lift;}
    if(bell){bell.rotation.z=.20*wave;bell.position.y=-.085+.035*lift;right.rotation.z+=.16*wave;right.position.y+=.035*lift;}
    if(broom){const sweep=phase===undefined?0:Math.sin(phase*Math.PI*2)*lift;broom.rotation.z=-.17+.26*sweep;right.rotation.z+=.2*sweep;}
    if(face){face.rotation.x=-.25*lift;face.position.y=.18-.024*lift;}
  });
  return {model,gesture};
}
