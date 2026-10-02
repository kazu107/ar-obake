import {describe,it,expect} from 'vitest';
import {Group,Vector3} from 'three';
import {defaultMarkerSettings,loadMarkerSettings,parseMarkerSettings,saveMarkerSettings,MARKER_SETTINGS_KEY} from '../src/storage/marker-settings';
import {orientMarkerContent} from '../src/ar/marker-orientation';
import {layoutSpeakingContent} from '../src/ar/speech-layout';
describe('per-marker device settings',()=>{
  it('makes room for speech without lifting the upright ghost off its card or moving its tracked parent',()=>{
    const tracked=new Group(),content=new Group();tracked.position.set(2,3,4);tracked.add(content);tracked.updateMatrix();const original=tracked.matrix.clone();
    layoutSpeakingContent(content,'perpendicular');content.updateMatrix();const first=content.matrix.clone();
    expect(new Vector3(0,-.32,0).applyMatrix4(content.matrix).z).toBeCloseTo(.02);expect(tracked.matrix.equals(original)).toBe(true);
    layoutSpeakingContent(content,'perpendicular');content.updateMatrix();expect(content.matrix.equals(first)).toBe(true);
  });
  it('defaults only H01-H03 to standing and supports a different choice on each card',()=>{
    const defaults=defaultMarkerSettings();expect(Object.keys(defaults)).toHaveLength(10);
    expect(Object.entries(defaults).filter(([,v])=>v==='perpendicular').map(([id])=>id)).toEqual(['H01','H02','H03']);
    const changed=parseMarkerSettings({H01:'parallel',H08:'perpendicular'});expect(changed.H01).toBe('parallel');expect(changed.H02).toBe('perpendicular');expect(changed.H08).toBe('perpendicular');expect(defaultMarkerSettings()).toEqual(defaults);
  });
  it('roundtrips independently of game saves and never overwrites corrupt settings at load',()=>{
    const values=new Map([['ar-obake-game-v1','progress']]);const store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
    expect(loadMarkerSettings(store).kind).toBe('default');const settings=parseMarkerSettings({ANSWER:'perpendicular'});
    expect(saveMarkerSettings(store,settings)).toBe(true);expect(loadMarkerSettings(store)).toEqual({settings,kind:'saved'});expect(values.get('ar-obake-game-v1')).toBe('progress');
    values.set(MARKER_SETTINGS_KEY,'{"H01":"sideways"}');expect(loadMarkerSettings(store).kind).toBe('invalid');expect(values.get(MARKER_SETTINGS_KEY)).toBe('{"H01":"sideways"}');
  });
  it.each([null,[],{H99:'parallel'},{H01:90},{H01:'invalid'},JSON.parse('{"__proto__":"parallel"}')])('rejects invalid storage/query input %j',raw=>{expect(()=>parseMarkerSettings(raw)).toThrow();});
  it('falls back cleanly when the device blocks storage and reports write failure',()=>{
    const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
    expect(loadMarkerSettings(blocked)).toEqual({settings:defaultMarkerSettings(),kind:'unavailable'});expect(saveMarkerSettings(blocked,defaultMarkerSettings())).toBe(false);
  });
  it('stands local up out of the marker plane without changing the tracked parent',()=>{
    const tracked=new Group(),content=new Group();tracked.position.set(2,3,4);tracked.add(content);tracked.updateMatrix();const original=tracked.matrix.clone();
    orientMarkerContent(content,'perpendicular');content.updateMatrix();const up=new Vector3(0,1,0).transformDirection(content.matrix);
    expect(up.z).toBeCloseTo(1);expect(up.y).toBeCloseTo(0);expect(new Vector3(0,-.32,0).applyMatrix4(content.matrix).z).toBeCloseTo(.02);expect(tracked.matrix.equals(original)).toBe(true);
    expect(content.scale.x).toBeCloseTo(.65);
    orientMarkerContent(content,'parallel');content.updateMatrix();expect(new Vector3(0,1,0).transformDirection(content.matrix).y).toBeCloseTo(1);expect(content.position.z).toBe(0);expect(content.scale.x).toBe(1);
  });
});
