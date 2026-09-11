import {describe,it,expect} from 'vitest';
import mainData from '../public/missions/main.json';
import practiceData from '../public/missions/prototype.json';
import {parseMission} from '../src/game/mission';
import {analyzeBalance,checkMainMissionBalance} from '../src/game/balance';
import {newProgress,collect,candidates,memoMark} from '../src/game/progress';
import {gameStorageKey,GAME_STORAGE_KEY,loadProgress,saveProgress} from '../src/storage/game-storage';
import {hintMarkerLabel,welcome} from '../src/game/ui';
import {memo} from '../src/game/screens';
const mission=parseMission(mainData),practice=parseMission(practiceData),report=analyzeBalance(mission);
describe('eight-hint content and omission tolerance',()=>{
  it('uses all eight existing hint cards and ANSWER at index eight',()=>{
    expect(mission.markerSet).toBe('nine');expect(mission.hints.map(h=>h.targetIndex)).toEqual([0,1,2,3,4,5,6,7]);expect(mission.answerMarker).toEqual({markerId:'ANSWER',targetIndex:8});
  });
  it('retains the intended meaning of each written hint',()=>{
    const expected=[
      (c:string,_i:string)=>c==='blue'||c==='purple',(_c:string,i:string)=>i==='hat'||i==='ribbon',
      (c:string,_i:string)=>c!=='yellow',(_c:string,i:string)=>i!=='tie',
      (c:string,_i:string)=>c==='blue'||c==='yellow',(_c:string,i:string)=>i==='hat'||i==='tie',
      (c:string,i:string)=>c!=='red'&&i!=='ribbon',(c:string,i:string)=>c!=='purple'&&i!=='glasses',
    ];
    mission.hints.forEach((h,index)=>{
      const remaining=candidates(mission,[h.markerId]);
      for(const color of mission.colors)for(const item of mission.items){expect(remaining.some(a=>a.color===color.id&&a.item===item.id)).toBe(expected[index](color.id,item.id));}
    });
  });
  it('exhausts all 256 unique subsets and keeps the correct answer in each',()=>{
    expect(report.subsets).toHaveLength(256);expect(new Set(report.subsets.map(r=>r.markerIds.join(','))).size).toBe(256);
    for(const row of report.subsets)expect(row.remaining).toContainEqual(mission.answer);
  });
  it('does not identify both answer components from any one, two, or three hints',()=>{
    expect(report.minimumHintsToSolve).toBe(4);for(const row of report.subsets.filter(r=>r.markerIds.length<=3))expect(row.remaining.length).toBeGreaterThan(1);
  });
  it('solves with every single missing hint and at least 80 percent of six-hint selections',()=>{
    expect(report.everySingleOmissionSolvable).toBe(true);expect(report.byHintCount[6]).toMatchObject({total:28,solved:24});expect(report.byHintCount[5]).toMatchObject({total:56,solved:30});expect(checkMainMissionBalance(report)).toEqual([]);
  });
  it('names the four unresolved pairs of missing cards',()=>{
    const pairs=report.subsets.filter(r=>r.markerIds.length===6&&!r.solved).map(r=>mission.hints.filter(h=>!r.markerIds.includes(h.markerId)).map(h=>h.markerId).join('+')).sort();
    expect(pairs).toEqual(['H01+H03','H02+H04','H05+H08','H06+H07']);
  });
  it('rejects an easier four-card mission as meeting the eight-hint acceptance criteria',()=>{
    expect(checkMainMissionBalance(analyzeBalance(practice)).length).toBeGreaterThan(0);
  });
  it('reports truly minimal solution sets and follows a reverse collection order',()=>{
    for(const ids of report.minimalSolutions){expect(candidates(mission,ids)).toEqual([mission.answer]);for(const removed of ids)expect(candidates(mission,ids.filter(id=>id!==removed)).length).toBeGreaterThan(1);}
    let p=newProgress(mission);for(const h of [...mission.hints].reverse())p=collect(mission,p,h.markerId);expect(p.markerIds).toEqual(mission.hints.map(h=>h.markerId));expect(candidates(mission,p.markerIds)).toEqual([mission.answer]);expect(collect(mission,p,'H08')).toBe(p);
  });
});
describe('mission selection and eight-hint memo',()=>{
  it('keeps old four-card saves, nine-card saves, and resets separate',()=>{
    const old=collect(practice,newProgress(practice),'H01');const values=new Map([[GAME_STORAGE_KEY,JSON.stringify(old)],['ar-obake-lab-v1','lab record']]);
    const store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    expect(loadProgress(store,practice)).toEqual({kind:'valid',progress:old});expect(loadProgress(store,mission)).toEqual({kind:'missing'});
    const next=collect(mission,newProgress(mission),'H08');expect(saveProgress(store,mission,next)).toBe(true);expect(loadProgress(store,mission)).toEqual({kind:'valid',progress:next});
    saveProgress(store,mission,newProgress(mission));expect(values.get(GAME_STORAGE_KEY)).toBe(JSON.stringify(old));expect(values.get('ar-obake-lab-v1')).toBe('lab record');expect(gameStorageKey(practice)).toBe(GAME_STORAGE_KEY);
  });
  it('requires an explicit reset for a changed version of the same nine-card mission',()=>{
    const raw=JSON.stringify({...newProgress(mission),missionVersion:999});let writes=0;const store={getItem:()=>raw,setItem(){writes++;}};
    expect(loadProgress(store,mission)).toEqual({kind:'incompatible'});expect(writes).toBe(0);
  });
  it('does not mistake a two-colour positive hint for a confirmed colour',()=>{
    const p=collect(mission,newProgress(mission),'H01'),left=candidates(mission,p.markerIds);
    expect(memoMark(left,'color','blue')).toBe('unknown');expect(memoMark(left,'color','purple')).toBe('unknown');expect(memoMark(left,'color','yellow')).toBe('no');
    const html=memo(mission,p);expect(html).toContain('1 / 8');expect(html.match(/class="obtained"/g)).toHaveLength(1);expect(html.match(/class="missing"/g)).toHaveLength(7);
  });
  it('takes title, card range, and total from the selected mission',()=>{
    expect(hintMarkerLabel(mission)).toBe('H01〜H08');expect(hintMarkerLabel(practice)).toBe('H01・H02・H03');
    expect(welcome(mission)).toContain('9枚のカードを印刷');expect(welcome(mission)).toContain(mission.title);expect(welcome(practice)).toContain('4枚のカードを印刷');
  });
});
