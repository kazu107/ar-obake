import { parseProgress, type Progress } from '../game/progress';
import type { Mission } from '../game/mission';
export const GAME_STORAGE_KEY = 'ar-obake-game-v1';
type Store=Pick<Storage,'getItem'|'setItem'>;
export type LoadResult = {kind:'valid';progress:Progress} | {kind:'missing'|'invalid'|'incompatible'|'unavailable'};
export function loadProgress(store:Store,m:Mission):LoadResult {
  let saved:string|null;try{saved=store.getItem(GAME_STORAGE_KEY);}catch{return {kind:'unavailable'};}
  if(saved===null)return {kind:'missing'};
  try{return {kind:'valid',progress:parseProgress(JSON.parse(saved),m)};}catch(error){return {kind:error instanceof Error&&error.message==='incompatible'?'incompatible':'invalid'};}
}
export function saveProgress(store:Store,m:Mission,p:Progress):boolean {
  try{const checked=parseProgress(p,m);store.setItem(GAME_STORAGE_KEY,JSON.stringify(checked));return true;}catch{return false;}
}
