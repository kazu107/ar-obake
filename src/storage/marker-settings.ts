import { SETS } from '../data/sets';
export type MarkerOrientation='parallel'|'perpendicular';
export type MarkerSettings=Record<string,MarkerOrientation>;
export const MARKER_SETTINGS_KEY='ar-obake-marker-settings-v1';
export function defaultMarkerSettings():MarkerSettings {
  return Object.fromEntries(SETS.ten.ids.map(id=>[id,['H01','H02','H03'].includes(id)?'perpendicular':'parallel']));
}
// Only known marker IDs and orientations can reach the AR presentation transform.
export function parseMarkerSettings(raw:unknown):MarkerSettings {
  if(typeof raw!=='object'||raw===null||Array.isArray(raw))throw Error('Invalid marker settings');
  const settings=defaultMarkerSettings();
  for(const [id,value]of Object.entries(raw)){
    if(!Object.prototype.hasOwnProperty.call(settings,id)||(value!=='parallel'&&value!=='perpendicular'))throw Error('Invalid marker orientation');
    settings[id]=value;
  }
  return settings;
}
export function loadMarkerSettings(storage:Pick<Storage,'getItem'>):{settings:MarkerSettings;kind:'saved'|'default'|'invalid'|'unavailable'} {
  let raw:string|null;
  try{raw=storage.getItem(MARKER_SETTINGS_KEY);}catch{return {settings:defaultMarkerSettings(),kind:'unavailable'};}
  if(raw===null)return {settings:defaultMarkerSettings(),kind:'default'};
  try{return {settings:parseMarkerSettings(JSON.parse(raw)),kind:'saved'};}catch{return {settings:defaultMarkerSettings(),kind:'invalid'};}
}
export function saveMarkerSettings(storage:Pick<Storage,'setItem'>,settings:MarkerSettings):boolean {
  try{storage.setItem(MARKER_SETTINGS_KEY,JSON.stringify(parseMarkerSettings(settings)));return true;}catch{return false;}
}
