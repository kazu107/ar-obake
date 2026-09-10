// MindAR 1.2.5 measures filter time in milliseconds: 0.001 means 1 Hz.
// The new mode uses an almost responsive upstream pose, with rigid-pose stabilization at rendering.
export const POSE_STABILIZATION = {
  algorithm: 'pose-deadband-v1',
  positionDeadband: .004, // Marker widths, independent of camera resolution.
  rotationDeadbandRadians: 2 * Math.PI / 180,
  positionTimeConstantMs: 100,
  rotationTimeConstantMs: 160,
} as const;
export const PROJECTION_STABILIZATION = {
  algorithm: 'projection-depth-v2',
  centerDeadband: .0008, // Tangent-of-view-angle coordinates; independent of depth.
  depthLogDeadband: .01, // Approximately 1% distance/size change.
  rotationDeadbandRadians: 2.5 * Math.PI / 180,
  centerTimeConstantMs: 45,
  depthTimeConstantMs: 420,
  rotationTimeConstantMs: 240,
} as const;
export const TRACKING_PROFILES = {
  stable: { filterMinCF: 0.001, filterBeta: 1000, poseStabilization: PROJECTION_STABILIZATION },
  previous: { filterMinCF: 0.001, filterBeta: 1000, poseStabilization: POSE_STABILIZATION },
  legacy: { filterMinCF: 0.0015, filterBeta: 0.01, poseStabilization: null },
  responsive: { filterMinCF: 0.001, filterBeta: 1000, poseStabilization: null },
} as const;

export function trackingConfig(mode: string | null, motion: string | null) {
  const selected = mode === 'responsive' ? 'responsive' : mode === 'legacy' ? 'legacy' : mode === 'previous' ? 'previous' : 'stable';
  return { mode: selected, ...TRACKING_PROFILES[selected], ghostMotion: motion === 'float' ? 'float' as const : 'still' as const };
}
export type TrackingConfig = ReturnType<typeof trackingConfig>;
