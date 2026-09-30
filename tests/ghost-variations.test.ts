import {describe,it,expect} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import {createGhostVariant,GhostGesture} from '../src/ar/ghost-variations';
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
});
