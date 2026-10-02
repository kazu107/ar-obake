import {describe,it,expect} from 'vitest';
import main from '../public/missions/main.json';
import practice from '../public/missions/prototype.json';
import {parseMission} from '../src/game/mission';
import {collect,newProgress} from '../src/game/progress';
import {shell,welcome} from '../src/game/ui';
import * as views from '../src/game/screens';
const m=parseMission(main);
describe('participant copy and memo feedback',()=>{
  it('covers both missions and every participant view with hiragana text, digits and accessible labels',()=>{
    for(const data of [main,practice]){
      const mission=parseMission(data);let p=newProgress(mission);for(const h of mission.hints)p=collect(mission,p,h.markerId);
      const all=[welcome(mission),welcome(mission,true,true),views.memo(mission,p),views.hintList(mission,p),views.share(mission,p),views.scan(mission,p,'tutorial'),views.scan(mission,p,'explore'),views.scan(mission,p,'answer-scan'),views.choose(mission,'color',{}),views.choose(mission,'item',{}),views.confirm(mission,mission.answer),views.wrong(mission,mission.answer),views.win(mission),views.scanMemo(mission,p,{field:'item',value:'hat'})];
      for(const html of all){const wrapped=shell(html,p.markerIds.length,true,mission);const copy=wrapped.replace(/<[^>]*>/g,'')+(wrapped.match(/aria-label="([^"]*)"/g)??[]).map(v=>v.slice(12,-1)).join('');expect(copy).not.toMatch(/[\p{Script=Han}\p{Script=Katakana}A-Za-z]/u);}
    }
  });
  it('explains possible, excluded and confirmed states from collected clues rather than the hidden answer',()=>{
    const p=newProgress(m);expect(views.memoFeedback(m,p,{field:'color',value:'blue'})).toContain('この いろかも しれないよ。');
    const h1=collect(m,p,'H01');expect(views.memoFeedback(m,h1,{field:'color',value:'green'})).toContain('この いろでは ないよ。');expect(views.memoFeedback(m,h1,{field:'color',value:'blue'})).toContain('この いろかも しれないよ。');
    let complete=p;for(const h of m.hints)complete=collect(m,complete,h.markerId);
    expect(views.memoFeedback(m,complete,{field:'item',value:'hat'})).toContain('この もちものだよ！');expect(views.memoFeedback(m,complete,{field:'item',value:'ribbon'})).toContain('この もちものでは ないよ。');
    expect(views.memoFeedback(m,complete,{field:'item',value:'forged'})).toBe('');
  });
});
