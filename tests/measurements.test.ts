import {describe,it,expect} from 'vitest';
import {beginTrial,observeTrial,finishTrial,summarizeTrials} from '../src/lab/measurements';
import {SETS,isSetId} from '../src/data/sets';
describe('recognition measurements',()=>{
  it('uses the expected marker and records wrong detections',()=>{let t=beginTrial('ANSWER',100);t=observeTrial(t,'H01',400);expect(t.outcome).toBeUndefined();t=observeTrial(t,'ANSWER',2100);expect(t.durationMs).toBe(2000);expect(t.wrongIds).toEqual(['H01']);expect(t.outcome).toBe('recognized');});
  it('includes timeouts in the denominator and excludes cancellations',()=>{const a=observeTrial(beginTrial('H01',0),'H01',2000),b=finishTrial(beginTrial('H01',0),10000,'timeout'),c=finishTrial(beginTrial('H01',0),1000,'cancelled');expect(summarizeTrials([a,b,c])).toEqual({attempts:2,success:1,within3s:1,timeouts:1,wrongDetections:0});});
  it('a late detection cannot turn a timeout into a success',()=>{const t=observeTrial(beginTrial('H01',0),'H01',10001);expect(t.outcome).toBe('timeout');expect(observeTrial(t,'H01',11000)).toBe(t);});
  it('finished trials are immutable',()=>{const t=observeTrial(beginTrial('H01',0),'H01',200);expect(finishTrial(t,800,'cancelled')).toBe(t);});
  it('maps ANSWER to index 3 in the four set and index 8 in the nine set',()=>{expect(SETS.four.ids[3]).toBe('ANSWER');expect(SETS.nine.ids[8]).toBe('ANSWER');expect(isSetId('__proto__')).toBe(false);expect(isSetId('one')).toBe(true);});
});
