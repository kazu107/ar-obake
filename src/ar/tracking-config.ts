// MindAR 1.2.5 measures filter time in milliseconds: 0.001 means 1 Hz.
// Keep its existing filter and tune responsiveness, without layering another one.
export const TRACKING_PROFILES = {
  stable: { filterMinCF: 0.0015, filterBeta: 0.01 },
  responsive: { filterMinCF: 0.001, filterBeta: 1000 },
} as const;

export function trackingConfig(mode: string | null, motion: string | null) {
  const selected = mode === 'responsive' ? 'responsive' : 'stable';
  return { mode: selected, ...TRACKING_PROFILES[selected], ghostMotion: motion === 'float' ? 'float' as const : 'still' as const };
}
export type TrackingConfig = ReturnType<typeof trackingConfig>;
