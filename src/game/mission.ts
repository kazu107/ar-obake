import { ASSET_VERSION, SETS, isSetId, type SetId } from '../data/sets';
export interface Choice { id: string; label: string }
export interface Color extends Choice { hex: string }
export interface Item extends Choice { icon: string }
export interface Answer { color: string; item: string }
export type Condition = { op: 'is' | 'not'; field: 'color' | 'item'; value: string } |
  { op: 'all' | 'any'; conditions: Condition[] };
export interface Hint { id: string; markerId: string; targetIndex: number; speaker: string; text: string; condition: Condition }
export interface Mission {
  id: string; version: number; title: string; markerSet: SetId; assetVersion: string;
  colors: Color[]; items: Item[]; answer: Answer; answerMarker: { markerId: string; targetIndex: number }; hints: Hint[];
}
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function object(value: unknown): Record<string,unknown> { requireValue(value && typeof value === 'object' && !Array.isArray(value),'問題データの形式が違います。'); return value as Record<string,unknown>; }
function text(value: unknown, max = 200): string { requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max,'問題データの文字が不正です。'); return value; }
function id(value: unknown): string { const v=text(value,50); requireValue(/^[a-zA-Z0-9_-]+$/.test(v),'問題のIDが不正です。'); return v; }
function list(value: unknown, min: number, max: number): unknown[] { requireValue(Array.isArray(value) && value.length>=min && value.length<=max,'問題データの件数が不正です。'); return value; }
function unique(values: string[]) { requireValue(new Set(values).size===values.length,'問題のIDが重複しています。'); }

export function matches(answer: Answer, condition: Condition): boolean {
  if ('conditions' in condition) return condition.op==='all' ? condition.conditions.every(c=>matches(answer,c)) : condition.conditions.some(c=>matches(answer,c));
  return condition.op==='is' ? answer[condition.field]===condition.value : answer[condition.field]!==condition.value;
}
export function allCandidates(mission: Pick<Mission,'colors'|'items'>): Answer[] {
  return mission.colors.flatMap(c=>mission.items.map(i=>({ color:c.id, item:i.id })));
}
export function isAnswer(mission: Mission, value: unknown): value is Answer {
  if (!value || typeof value!=='object') return false;
  const a=value as Answer;
  return mission.colors.some(c=>c.id===a.color) && mission.items.some(i=>i.id===a.item);
}
export function correct(mission: Mission, answer: Answer): boolean { return answer.color===mission.answer.color && answer.item===mission.answer.item; }

export function parseMission(raw: unknown): Mission {
  const m=object(raw);
  requireValue(isSetId(m.markerSet),'マーカーセットがありません。');
  const markerSet=m.markerSet;
  const colors=list(m.colors,2,8).map(v=>{const c=object(v),hex=text(c.hex,7);requireValue(/^#[0-9a-f]{6}$/i.test(hex),'色の指定が不正です。');return {id:id(c.id),label:text(c.label,30),hex};});
  const items=list(m.items,2,8).map(v=>{const c=object(v),kind=text(c.icon,20);requireValue(['hat','glasses','tie','ribbon'].includes(kind),'アイコンがありません。');return {id:id(c.id),label:text(c.label,30),icon:kind};});
  unique(colors.map(c=>c.id));unique(items.map(c=>c.id));
  let conditionNodes=0;
  const parseCondition=(value:unknown,depth=0):Condition=>{
    requireValue(++conditionNodes<=128,'ヒントの条件が多すぎます。');
    requireValue(depth<6,'ヒントの条件が複雑すぎます。');const c=object(value);
    if(c.op==='all'||c.op==='any')return {op:c.op,conditions:list(c.conditions,1,8).map(v=>parseCondition(v,depth+1))};
    requireValue((c.op==='is'||c.op==='not')&&(c.field==='color'||c.field==='item'),'ヒントの条件が不正です。');
    const val=id(c.value);requireValue((c.field==='color'?colors:items).some(v=>v.id===val),'ヒントに未知の選択肢があります。');
    return {op:c.op,field:c.field,value:val};
  };
  const marker=(value:unknown)=>{const c=object(value),markerId=id(c.markerId);requireValue(Number.isInteger(c.targetIndex),'マーカー番号が不正です。');const targetIndex=c.targetIndex as number;requireValue((SETS[markerSet].ids as readonly string[])[targetIndex]===markerId,'印刷カードと認識データの対応が違います。');return {markerId,targetIndex};};
  const hints=list(m.hints,1,8).map(v=>{const h=object(v);return {...marker(h),id:id(h.id),speaker:text(h.speaker,40),text:text(h.text,300),condition:parseCondition(h.condition)};});
  const answerMarker=marker(m.answerMarker);unique(hints.map(h=>h.id));unique([...hints.map(h=>h.markerId),answerMarker.markerId]);
  requireValue(hints.length+1===SETS[markerSet].ids.length,'ヒントの枚数とマーカーセットが違います。');
  requireValue(m.assetVersion===ASSET_VERSION,'認識素材の版が違います。');
  requireValue(Number.isInteger(m.version) && (m.version as number)>0,'問題の版が不正です。');
  const a=object(m.answer),answer={color:id(a.color),item:id(a.item)};
  const result:Mission={id:id(m.id),version:m.version as number,title:text(m.title,80),markerSet,assetVersion:ASSET_VERSION,colors,items,answer,answerMarker,hints};
  requireValue(isAnswer(result,answer),'正解の選択肢がありません。');
  requireValue(hints.every(h=>matches(answer,h.condition)),'正解とヒントが矛盾しています。');
  requireValue(allCandidates(result).filter(a=>hints.every(h=>matches(a,h.condition))).length===1,'全ヒントから正解を1つに決められません。');
  return result;
}
