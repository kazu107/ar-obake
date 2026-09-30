const numbers=['ぜろ','いち','に','さん','よん','ご','ろく','なな','はち','きゅう','じゅう'];
export const numberLabel=(n:number):string=>numbers[n]??String(n);
export function markerLabel(id:string):string {
  if(id==='TUTORIAL')return 'れんしゅう';
  if(id==='ANSWER')return 'こたえ';
  const match=/^H0([1-8])$/.exec(id);
  return match?`${numberLabel(Number(match[1]))}ばん`:'おばけ';
}
