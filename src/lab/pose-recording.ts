export interface PoseSample {
  atMs: number;
  inputAtMs: number;
  updateIndex: number;
  targetId: string;
  // Position in marker widths, followed by quaternion x/y/z/w. No images.
  input: number[];
  displayed: number[];
}
export interface PoseRecording {
  startedAt: string;
  status: 'recording' | 'completed' | 'cancelled' | 'interrupted';
  durationMs: number;
  samples: PoseSample[];
}
export function appendPoseSample(recording: PoseRecording, sample: PoseSample): boolean {
  if (recording.status !== 'recording' || recording.samples.length >= 110 ||
      !Number.isFinite(sample.atMs) || sample.atMs < 0 || sample.atMs > 10500 ||
      !Number.isFinite(sample.inputAtMs) || sample.inputAtMs < 0 ||
      !Number.isInteger(sample.updateIndex) || sample.updateIndex < 1 ||
      typeof sample.targetId !== 'string' || sample.targetId.length > 20 ||
      !Array.isArray(sample.input) || !Array.isArray(sample.displayed) ||
      sample.input.length !== 7 || sample.displayed.length !== 7 ||
      ![...sample.input, ...sample.displayed].every(Number.isFinite)) return false;
  const previous = recording.samples[recording.samples.length - 1];
  if (previous && sample.atMs <= previous.atMs) return false;
  recording.samples.push({ ...sample, input: [...sample.input], displayed: [...sample.displayed] });
  return true;
}
