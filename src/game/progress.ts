import { allCandidates, correct, isAnswer, matches, type Answer, type Mission } from './mission';
export interface Progress {
  schemaVersion: 1; missionId: string; missionVersion: number;
  markerIds: string[]; phase: 'exploring' | 'sharing' | 'complete'; attempts: Answer[]; tutorialComplete: boolean;
  startedAt: number; updatedAt: number;
}
export function newProgress(m:Mission):Progress { const now=Date.now();return {schemaVersion:1,missionId:m.id,missionVersion:m.version,markerIds:[],phase:'exploring',attempts:[],tutorialComplete:!m.tutorialMarker,startedAt:now,updatedAt:now}; }
export function candidates(m:Mission, ids:string[]):Answer[] {
  if(ids.some(id=>!m.hints.some(h=>h.markerId===id)))throw new Error('未知のヒントです。');
  const hints=m.hints.filter(h=>ids.includes(h.markerId));
  const result=allCandidates(m).filter(a=>hints.every(h=>matches(a,h.condition)));
  if(!result.length)throw new Error('ヒントに矛盾があります。');
  return result;
}
export type Mark = 'yes' | 'no' | 'unknown';
export function memoMark(remaining:Answer[],field:'color'|'item',value:string):Mark {
  if(!remaining.length)throw new Error('候補がありません。');
  const n=remaining.filter(c=>c[field]===value).length;
  return n===0?'no':n===remaining.length?'yes':'unknown';
}
export function collect(m:Mission,p:Progress,markerId:string):Progress {
  if(!m.hints.some(h=>h.markerId===markerId))throw new Error('ヒントのカードではありません。');
  if(p.markerIds.includes(markerId)||p.phase==='complete')return p;
  const markerIds=m.hints.map(h=>h.markerId).filter(id=>p.markerIds.includes(id)||id===markerId);
  candidates(m,markerIds);return {...p,markerIds};
}
export function submitAnswer(m:Mission,p:Progress,answer:Answer):Progress {
  if(!isAnswer(m,answer))throw new Error('色とアイテムを選んでください。');
  if(p.phase==='complete')return p;
  return {...p,phase:correct(m,answer)?'complete':'sharing',attempts:[...p.attempts,{...answer}].slice(-20)};
}
export function parseProgress(raw:unknown,m:Mission):Progress {
  if(!raw||typeof raw!=='object')throw Error('invalid');const p=raw as Progress;
  if(p.schemaVersion!==1||p.missionId!==m.id||p.missionVersion!==m.version)throw Error('incompatible');
  if(!Array.isArray(p.markerIds)||p.markerIds.length>m.hints.length||new Set(p.markerIds).size!==p.markerIds.length||
      !p.markerIds.every(v=>typeof v==='string')||!['exploring','sharing','complete'].includes(p.phase)||
      !Array.isArray(p.attempts)||p.attempts.length>20||!p.attempts.every(v=>isAnswer(m,v))||
      (p.tutorialComplete!==undefined&&typeof p.tutorialComplete!=='boolean')||
      (p.startedAt!==undefined&&(!Number.isFinite(p.startedAt)||p.startedAt<=0))||
      (p.updatedAt!==undefined&&(!Number.isFinite(p.updatedAt)||p.updatedAt<=0)))throw Error('invalid');
  candidates(m,p.markerIds);
  const won=p.attempts.some(a=>correct(m,a));
  if((p.phase==='complete')!==won || (won&&!correct(m,p.attempts[p.attempts.length-1])))throw Error('invalid');
  const tutorialComplete=p.tutorialComplete??(!m.tutorialMarker||p.markerIds.length>0||p.phase!=='exploring'||p.attempts.length>0);
  const startedAt=typeof p.startedAt==='number'?p.startedAt:Date.now(),updatedAt=typeof p.updatedAt==='number'?p.updatedAt:startedAt;
  return {schemaVersion:1,missionId:m.id,missionVersion:m.version,markerIds:m.hints.map(h=>h.markerId).filter(id=>p.markerIds.includes(id)),phase:p.phase,attempts:p.attempts.map(a=>({color:a.color,item:a.item})),tutorialComplete,startedAt,updatedAt};
}
