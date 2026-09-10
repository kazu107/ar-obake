import { describe, expect, it } from 'vitest';
import { appendPoseSample, type PoseRecording, type PoseSample } from '../src/lab/pose-recording';
const recording = (): PoseRecording => ({ startedAt: '2026-09-10', status: 'recording', durationMs: 0, samples: [] });
const sample = (atMs: number): PoseSample => ({ atMs, inputAtMs: atMs, updateIndex: 1, targetId: 'H01', input: [0,0,-3,0,0,0,1], displayed: [0,0,-3,0,0,0,1] });
describe('bounded numerical pose recordings', () => {
  it('retains independent copies of incoming and displayed poses', () => {
    const r = recording(), s = sample(0); expect(appendPoseSample(r, s)).toBe(true);
    s.input[0] = 100; expect(r.samples[0].input[0]).toBe(0);
  });
  it('bounds memory usage and ignores samples after recording ends', () => {
    const r = recording(); for (let i = 0; i < 120; i++) appendPoseSample(r, sample(i * 80));
    expect(r.samples).toHaveLength(110);
    const stopped = recording(); stopped.status = 'cancelled'; expect(appendPoseSample(stopped, sample(1))).toBe(false);
  });
  it('rejects malformed, non-finite, late and out-of-order samples', () => {
    const r = recording(); appendPoseSample(r, sample(100));
    expect(appendPoseSample(r, sample(90))).toBe(false);
    expect(appendPoseSample(r, sample(11000))).toBe(false);
    const invalid = sample(200); invalid.input[0] = NaN;
    expect(appendPoseSample(r, invalid)).toBe(false);
    expect(appendPoseSample(r, { ...sample(200), displayed: [] })).toBe(false);
    expect(r.samples).toHaveLength(1);
  });
});
