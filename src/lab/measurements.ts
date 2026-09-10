export interface Trial { expected: string; startedAtMs: number; durationMs?: number; outcome?: 'recognized'|'timeout'|'cancelled'; wrongIds: string[] }
export function beginTrial(expected: string, now: number): Trial { return { expected, startedAtMs: now, wrongIds: [] }; }
export function observeTrial(trial: Trial, id: string, now: number): Trial {
  if (trial.outcome) return trial;
  if (now-trial.startedAtMs >= 10000) return finishTrial(trial,now,'timeout');
  if(id!==trial.expected) return {...trial,wrongIds: [...trial.wrongIds,id]};
  return finishTrial(trial,now,'recognized');
}
export function finishTrial(trial: Trial, now: number, outcome: Trial['outcome']): Trial { return trial.outcome ? trial : {...trial,durationMs:Math.max(0,now-trial.startedAtMs),outcome}; }
export function summarizeTrials(trials: Trial[]) {
  const complete=trials.filter(t=>t.outcome==='recognized'||t.outcome==='timeout');
  const success=complete.filter(t=>t.outcome==='recognized');
  return {attempts:complete.length,success:success.length,within3s:success.filter(t=>t.durationMs!<=3000).length,timeouts:complete.length-success.length,wrongDetections:complete.reduce((n,t)=>n+t.wrongIds.length,0)};
}
