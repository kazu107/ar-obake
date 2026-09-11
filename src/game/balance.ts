import { allCandidates, correct, matches, type Mission } from './mission';

/** Exhaustive content analysis, used by authoring checks rather than the player UI. */
export function analyzeBalance(mission:Mission) {
  const rows=Array.from({length:2**mission.hints.length},(_,mask)=>{
    const hints=mission.hints.filter((_,i)=>mask&(1<<i));
    const remaining=allCandidates(mission).filter(a=>hints.every(h=>matches(a,h.condition)));
    return {mask,markerIds:hints.map(h=>h.markerId),remaining,solved:remaining.length===1&&correct(mission,remaining[0])};
  });
  const byHintCount=Array.from({length:mission.hints.length+1},(_,count)=>{
    const selected=rows.filter(r=>r.markerIds.length===count),solved=selected.filter(r=>r.solved).length;
    return {count,total:selected.length,solved,solvedFraction:solved/selected.length,
      minCandidates:Math.min(...selected.map(r=>r.remaining.length)),maxCandidates:Math.max(...selected.map(r=>r.remaining.length))};
  });
  const minimalSolutions=rows.filter(r=>r.solved&&mission.hints.every((_,i)=>!(r.mask&(1<<i))||!rows[r.mask^(1<<i)].solved)).map(r=>r.markerIds);
  return {missionId:mission.id,missionVersion:mission.version,hintCount:mission.hints.length,
    subsetCount:rows.length,minimumHintsToSolve:byHintCount.find(r=>r.solved>0)?.count??null,
    everySingleOmissionSolvable:byHintCount[mission.hints.length-1].solvedFraction===1,
    byHintCount,minimalSolutions,subsets:rows.map(({mask,...r})=>r)};
}

export function checkMainMissionBalance(report:ReturnType<typeof analyzeBalance>):string[] {
  const failures:string[]=[];
  if(report.hintCount!==8)failures.push('Expected eight hints.');
  if(report.minimumHintsToSolve===null||report.minimumHintsToSolve<4)failures.push('One to three hints must not determine the answer.');
  if(!report.everySingleOmissionSolvable)failures.push('Every single missing hint must be tolerated.');
  if((report.byHintCount[6]?.solvedFraction??0)<.8)failures.push('At least 80% of six-hint combinations must solve the mission.');
  if(report.subsets.some(r=>r.remaining.length===0))failures.push('Contradictory subset found.');
  if(!report.subsets[report.subsets.length-1]?.solved)failures.push('The complete mission must identify its answer.');
  return failures;
}
