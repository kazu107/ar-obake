import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from 'mind-ar/src/libs/one-euro-filter.js';
import { trackingConfig } from '../src/ar/tracking-config.ts';

function filter(mode) {
  const c = trackingConfig(mode, 'still');
  return new OneEuroFilter({ minCutOff: c.filterMinCF, beta: c.filterBeta });
}

// Real MindAR filter on synthetic small alternating tilt/translation changes.
// This checks noise attenuation and lag, not the accuracy of a physical pose.
function noiseRms(mode, fps) {
  const f = filter(mode), sums = [0, 0];
  const samples = fps * 6;
  for (let i = 0; i < samples; i++) {
    const seconds = i / fps;
    const input = [Math.sin(2 * Math.PI * 5 * seconds) * .02, Math.sin(2 * Math.PI * 5 * seconds) * 1.5];
    const out = f.filter(i * 1000 / fps, input);
    if (i >= fps) out.forEach((value, index) => { sums[index] += value * value; });
  }
  return sums.map(sum => Math.sqrt(sum / (samples - fps)));
}

describe('0.1.2 comparison filter baseline', () => {
  it.each([15, 26, 37])('attenuates small static pose noise at %i updates per second', fps => {
    const stable = noiseRms('legacy', fps), previous = noiseRms('responsive', fps);
    expect(stable[0]).toBeLessThan(previous[0] * .5);
    expect(stable[1]).toBeLessThan(previous[1] * .5);
  });

  it.each([15, 26, 37])('follows a real pose change within 450 ms at %i updates per second', fps => {
    const f = filter('legacy');
    f.filter(0, [0, 0]);
    const target = [.3, 60]; // A deliberate rotation and translation, not noise.
    let out;
    for (let i = 1; i <= Math.floor(.45 * fps); i++) out = f.filter(i * 1000 / fps, target);
    expect(out[0]).toBeGreaterThan(target[0] * .9);
    expect(out[1]).toBeGreaterThan(target[1] * .9);
    expect(out[0]).toBeLessThanOrEqual(target[0]);
    expect(out[1]).toBeLessThanOrEqual(target[1]);
  });

  it('resets on reacquisition rather than interpolating from the previous location', () => {
    const f = filter('stable');
    f.filter(0, [0, 0]); f.filter(33, [.01, 1]);
    f.reset();
    expect(f.filter(2000, [.4, 100])).toEqual([.4, 100]);
  });

  it('uses stable still mode for unknown or missing URL settings', () => {
    expect(trackingConfig(null, null)).toEqual(trackingConfig('stable', 'still'));
    expect(trackingConfig('__proto__', 'invalid')).toEqual(trackingConfig('stable', 'still'));
    expect(trackingConfig('responsive', 'float').ghostMotion).toBe('float');
  });
});
