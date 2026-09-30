import {describe,it,expect} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import {createGhostVariant,GHOST_VARIANTS,GhostGesture} from '../src/ar/ghost-variations';
function template(){
  const model=new Group(),geometry=new SphereGeometry(.1,8,6),material=new MeshBasicMaterial({color:0xffffff});
  for(const name of ['ghost-arm-left','ghost-arm-right','ghost-mouth','ghost-eye-left','ghost-eye-right']){const part=new Mesh(geometry,material);part.name=name;part.position.set(name.endsWith('left')?-.24:.24,-.035,.1);model.add(part);}
  return model;
}
describe('gentle per-marker gestures',()=>{
  it('plays once, returns exactly to rest, and does not repeatedly restart on recognition flicker',()=>{
    let lift=0;const gesture=new GhostGesture('greeting',value=>{lift=value;});
    expect(gesture.setVisible(true,0)).toBe(true);gesture.update(600);expect(lift).toBe(1);
    expect(gesture.setVisible(true,700)).toBe(false);gesture.setVisible(false,800);expect(lift).toBe(0);
    expect(gesture.setVisible(true,1000)).toBe(false);gesture.update(2000);expect(lift).toBe(0);expect(gesture.isActive(2000)).toBe(false);
    gesture.setVisible(false,12500);expect(gesture.setVisible(true,12600)).toBe(true);gesture.update(13100);expect(lift).toBe(1);
  });
  it('never auto-repeats while the marker stays visible, and plain ghosts stay still',()=>{
    let lift=0;const gesture=new GhostGesture('greeting',value=>{lift=value;});gesture.setVisible(true,0);gesture.update(50000);expect(lift).toBe(0);expect(gesture.setVisible(true,50001)).toBe(false);
    const plain=new GhostGesture('plain',value=>{lift=value;});expect(plain.setVisible(true,0)).toBe(false);plain.update(500);expect(lift).toBe(0);
  });
  it.each(['TUTORIAL','H01','H08'])('moves only %s limbs/props and preserves root, template and other clones',id=>{
    const source=template(),untouched=createGhostVariant(source,'H02').model,{model,gesture}=createGhostVariant(source,id);
    model.position.set(2,3,4);model.rotation.set(.1,.2,.3);model.scale.setScalar(.65);model.updateMatrix();const original=model.matrix.clone();
    const resting=model.getObjectByName('ghost-arm-right')!.position.clone();gesture.setVisible(true,0);gesture.update(700);
    model.updateMatrix();expect(model.matrix.equals(original)).toBe(true);expect(model.getObjectByName('ghost-arm-right')!.position.y).toBeGreaterThan(resting.y);
    expect(source.getObjectByName('ghost-arm-right')!.position.y).toBe(-.035);expect(untouched.getObjectByName('ghost-arm-right')!.position.y).toBe(-.035);
    gesture.update(2000);expect(model.getObjectByName('ghost-arm-right')!.position.equals(resting)).toBe(true);
  });
  it('adds the lantern only to H01 and keeps the main white ghost body separate',()=>{
    const source=template(),pumpkin=createGhostVariant(source,'H01');expect(pumpkin.gesture.kind).toBe('pumpkin');expect(pumpkin.model.getObjectByName('pumpkin-lantern')).toBeDefined();
    expect(createGhostVariant(source,'H08').model.getObjectByName('pumpkin-lantern')).toBeUndefined();expect(source.getObjectByName('pumpkin-lantern')).toBeUndefined();
  });
  it('gives the greeting a curved smile while preserving the other ghosts and the source face',()=>{
    const source=template(),greeting=createGhostVariant(source,'TUTORIAL').model;
    expect(greeting.getObjectByName('greeting-smile')).toBeDefined();expect(greeting.getObjectByName('ghost-mouth')!.visible).toBe(false);
    expect(source.getObjectByName('ghost-mouth')!.visible).toBe(true);expect(createGhostVariant(source,'H02').model.getObjectByName('greeting-smile')).toBeUndefined();
  });
  it('rejects an outdated unnamed model instead of silently losing the intended animations',()=>{expect(()=>createGhostVariant(new Group(),'TUTORIAL')).toThrow('missing gesture parts');});
  it.each(Object.entries(GHOST_VARIANTS))('%s has an isolated %s gesture and returns every part to rest', (id,kind)=>{
    const source=template(),{model,gesture}=createGhostVariant(source,id);
    const snapshots=(root:Group|typeof model)=>{const result:unknown[]=[];root.traverse(p=>result.push([p.name,p.position.toArray(),p.quaternion.toArray().map(v=>v===0?0:v),p.scale.toArray(),p.visible]));return result;};
    const sourceRest=snapshots(source),rest=snapshots(model);expect(gesture.kind).toBe(kind);
    model.position.set(3,4,5);model.rotation.set(.2,.3,.4);model.updateMatrix();const matrix=model.matrix.clone();
    gesture.setVisible(true,0);gesture.update(700);model.updateMatrix();expect(model.matrix.equals(matrix)).toBe(true);
    expect(snapshots(source)).toEqual(sourceRest);model.position.set(0,0,0);model.rotation.set(0,0,0);
    expect(snapshots(model)).not.toEqual(rest);gesture.update(2000);expect(snapshots(model)).toEqual(rest);
    gesture.setVisible(false,2100);gesture.setVisible(true,2500);gesture.update(2700);expect(snapshots(model)).toEqual(rest);
  });
  it('keeps a low-poly bat on the shoulder and flaps only its wings',()=>{
    const {model,gesture}=createGhostVariant(template(),'H02'),bat=model.getObjectByName('bat-companion')!,position=bat.position.clone();
    gesture.setVisible(true,0);gesture.update(500);expect(bat.position.equals(position)).toBe(true);
    expect(bat.getObjectByName('bat-wing-left')!.rotation.y).toBeCloseTo(-bat.getObjectByName('bat-wing-right')!.rotation.y);
    expect(Math.abs(bat.getObjectByName('bat-wing-left')!.rotation.y)).toBeGreaterThan(.5);
  });
  it('closes the sleepy eyes and restores their authored half-open expression',()=>{
    const {model,gesture}=createGhostVariant(template(),'H03'),eye=model.getObjectByName('ghost-eye-left')!;
    const depth=eye.scale.z;expect(eye.scale.y).toBe(.019);gesture.setVisible(true,0);gesture.update(700);expect(eye.scale.y).toBeLessThan(.003);expect(eye.scale.z).toBeCloseTo(depth*.12);gesture.update(2000);expect(eye.scale.y).toBe(.019);expect(eye.scale.z).toBe(depth);
  });
  it('turns a single leaf monotonically, then hides it over the fixed open pages',()=>{
    const {model,gesture}=createGhostVariant(template(),'H05'),page=model.getObjectByName('book-turning-page')!;
    expect(page.visible).toBe(false);gesture.setVisible(true,0);gesture.update(500);const first=page.rotation.y;expect(page.visible).toBe(true);
    gesture.update(1400);expect(page.rotation.y).toBeLessThan(first);gesture.update(2000);expect(page.visible).toBe(false);
  });
  it('nods the detective face while the body and notebook stay in place',()=>{
    const {model,gesture}=createGhostVariant(template(),'ANSWER'),face=model.getObjectByName('detective-face')!,notebook=model.getObjectByName('detective-notebook')!;
    const resting=notebook.position.clone();gesture.setVisible(true,0);gesture.update(700);expect(face.rotation.x).toBeLessThan(0);expect(notebook.position.equals(resting)).toBe(true);
    gesture.setVisible(false,750);expect(face.rotation.x).toBeCloseTo(0);expect(face.position.y).toBe(.18);
  });
  it('retains a still fallback for an unknown marker',()=>{const {model,gesture}=createGhostVariant(template(),'UNKNOWN');expect(gesture.kind).toBe('plain');expect(gesture.setVisible(true,0)).toBe(false);expect(model.children).toHaveLength(5);});
});
