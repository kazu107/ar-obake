import { describe, it, expect } from 'vitest';
import data from '../public/missions/prototype.json';
import { parseMission, matches, correct, type Condition } from '../src/game/mission';
import { candidates, collect, newProgress, parseProgress, memoMark, submitAnswer } from '../src/game/progress';
import { GAME_STORAGE_KEY, loadProgress, saveProgress } from '../src/storage/game-storage';
import { ScanGate } from '../src/game/scan-gate';
const m=parseMission(data);
describe('mission and deduction',()=>{
  it('starts with sixteen candidates and no assumed information',()=>{
    const left=candidates(m,[]);expect(left).toHaveLength(16);expect(memoMark(left,'color','blue')).toBe('unknown');expect(memoMark(left,'item','hat')).toBe('unknown');
  });
  it('combines three clues to identify both colour and item',()=>{
    let p=newProgress(m);p=collect(m,p,'H01');let left=candidates(m,p.markerIds);expect(left).toHaveLength(9);expect(memoMark(left,'color','green')).toBe('no');expect(memoMark(left,'item','glasses')).toBe('no');expect(memoMark(left,'color','blue')).toBe('unknown');
    p=collect(m,p,'H02');expect(candidates(m,p.markerIds)).toHaveLength(4);p=collect(m,p,'H03');left=candidates(m,p.markerIds);expect(left).toEqual([{color:'blue',item:'hat'}]);expect(memoMark(left,'color','blue')).toBe('yes');expect(memoMark(left,'item','hat')).toBe('yes');
  });
  it('is independent of collection order and ignores repeated collection',()=>{
    for(const order of [['H01','H02','H03'],['H01','H03','H02'],['H02','H01','H03'],['H02','H03','H01'],['H03','H01','H02'],['H03','H02','H01']]){
      let p=newProgress(m);for(const id of order)p=collect(m,p,id);expect(p.markerIds).toEqual(['H01','H02','H03']);expect(collect(m,p,'H01')).toBe(p);
    }
  });
  it('supports positive, negative, and correlated alternatives',()=>{
    const c:Condition={op:'any',conditions:[{op:'all',conditions:[{op:'is',field:'color',value:'blue'},{op:'is',field:'item',value:'hat'}]},{op:'all',conditions:[{op:'is',field:'color',value:'green'},{op:'not',field:'item',value:'glasses'}]}]};
    expect(matches({color:'blue',item:'hat'},c)).toBe(true);expect(matches({color:'blue',item:'ribbon'},c)).toBe(false);expect(matches({color:'green',item:'glasses'},c)).toBe(false);expect(matches({color:'green',item:'gloves'},c)).toBe(true);
  });
  it('refuses unknown markers, including the answer marker as a clue',()=>{
    expect(()=>collect(m,newProgress(m),'ANSWER')).toThrow();expect(()=>candidates(m,['H08'])).toThrow();
  });
  it('detects contradictory acquired conditions rather than generating a false memo',()=>{
    const bad={...m,hints:m.hints.map(h=>h.markerId==='H02'?{...h,condition:{op:'is',field:'color',value:'green'} as Condition}:h)};
    expect(()=>candidates(bad,['H01','H02'])).toThrow('矛盾');
  });
  it.each(['duplicate','mapping','contradiction','unknown','ambiguous'])('rejects a %s mission at load',kind=>{
    const bad=structuredClone(data);
    if(kind==='duplicate')bad.hints[1].markerId='H01';
    if(kind==='mapping')bad.answerMarker.targetIndex=0;
    if(kind==='contradiction')bad.answer.color='green';
    if(kind==='unknown')bad.hints[0].condition.conditions[0].value='orange';
    if(kind==='ambiguous')bad.hints[2].condition=structuredClone(bad.hints[1].condition);
    expect(()=>parseMission(bad)).toThrow();
  });
});
describe('answers and local restoration',()=>{
  it('permits a representative with partial or no local clues to answer and retry',()=>{
    let p=newProgress(m);p=submitAnswer(m,p,{color:'green',item:'hat'});expect(p.phase).toBe('sharing');expect(p.markerIds).toEqual([]);p=submitAnswer(m,p,{color:'blue',item:'hat'});expect(p.phase).toBe('complete');expect(p.attempts).toHaveLength(2);expect(submitAnswer(m,p,{color:'green',item:'hat'})).toBe(p);
  });
  it('requires both components of the answer',()=>{
    expect(correct(m,{color:'blue',item:'glasses'})).toBe(false);expect(()=>submitAnswer(m,newProgress(m),{color:'orange',item:'hat'})).toThrow();
  });
  it('restores from acquired marker IDs without persisting inferred memo cells',()=>{
    let p=collect(m,collect(m,newProgress(m),'H03'),'H01');p=submitAnswer(m,p,{color:'yellow',item:'gloves'});const restored=parseProgress(JSON.parse(JSON.stringify(p)),m);expect(restored).toEqual(p);expect(candidates(m,restored.markerIds)).toEqual(candidates(m,p.markerIds));
  });
  it('keeps device stores and laboratory logs separate',()=>{
    const entries=new Map<string,string>([['ar-obake-lab-v1','keep lab record']]);const store={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);}};
    expect(saveProgress(store,m,collect(m,newProgress(m),'H01'))).toBe(true);expect(loadProgress(store,m).kind).toBe('valid');expect(entries.get('ar-obake-lab-v1')).toBe('keep lab record');expect(loadProgress({getItem:()=>null,setItem(){}},m)).toEqual({kind:'missing'});
    saveProgress(store,m,newProgress(m));expect(entries.get('ar-obake-lab-v1')).toBe('keep lab record');expect(JSON.parse(entries.get(GAME_STORAGE_KEY)!).markerIds).toEqual([]);
  });
  it.each(['invalid','incompatible'])('leaves a %s saved value untouched until an explicit new game',kind=>{
    const original=kind==='invalid'?'not json':JSON.stringify({...newProgress(m),missionVersion:999});let saved=original;const store={getItem:()=>saved,setItem:(_k:string,v:string)=>{saved=v;}};
    expect(loadProgress(store,m)).toEqual({kind});expect(saved).toBe(original);
  });
  it('rejects forged completion, unknown IDs, and duplicates during restoration',()=>{
    expect(()=>parseProgress({...newProgress(m),phase:'complete'},m)).toThrow();expect(()=>parseProgress({...newProgress(m),markerIds:['H08']},m)).toThrow();expect(()=>parseProgress({...newProgress(m),markerIds:['H01','H01']},m)).toThrow();
  });
  it('reports storage failure without throwing or saving a contradictory state',()=>{
    const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};expect(loadProgress(blocked,m)).toEqual({kind:'unavailable'});expect(saveProgress(blocked,m,newProgress(m))).toBe(false);
    let writes=0;expect(saveProgress({getItem:()=>null,setItem(){writes++;}},m,{...newProgress(m),markerIds:['bad']})).toBe(false);expect(writes).toBe(0);
  });
});
describe('stable marker gating',()=>{
  it('requires continuous detection and drops a lost unrecorded hint',()=>{
    const g=new ScanGate(['H01','ANSWER']);g.found('H01',0);expect(g.eligible(449)).toBeUndefined();g.found('H01',300);expect(g.eligible(450)).toBe('H01');g.lost('H01');expect(g.eligible(900)).toBeUndefined();g.found('H01',1000);expect(g.eligible(1200)).toBeUndefined();
  });
  it('does not transfer dwell time to a different marker or a restarted camera',()=>{
    const g=new ScanGate(['H01','ANSWER']);g.found('H01',0);g.found('ANSWER',500);expect(g.eligible(600)).toBeUndefined();expect(g.eligible(950)).toBe('ANSWER');g.reset();g.found('UNKNOWN',2000);expect(g.eligible(9999)).toBeUndefined();
  });
});
