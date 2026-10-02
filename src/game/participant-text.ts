const numbers=['ぜろ','いち','に','さん','よん','ご','ろく','なな','はち','きゅう','じゅう'];
export const numberLabel=(n:number):string=>String(n);
export function markerLabel(id:string):string {
  if(id==='TUTORIAL')return 'れんしゅう';
  if(id==='ANSWER')return 'こたえ';
  const match=/^H0([1-8])$/.exec(id);
  return match?`${numbers[Number(match[1])]}ばん`:'おばけ';
}
