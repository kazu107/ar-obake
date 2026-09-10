import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { PoseStabilizer } from '../src/ar/pose-stabilizer';

const width = 512;
function pose(x = 0, angle = 0, scale = width) {
  return new Matrix4().compose(new Vector3(x * width, 0, -3 * width),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle), new Vector3().setScalar(scale));
}
function components(matrix: Matrix4) {
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  return { position: position.divideScalar(width), rotation, scale };
}
describe('rigid pose stabilization', () => {
  it('places the first detection immediately without flying in from the origin', () => {
    const f = new PoseStabilizer(), out = new Matrix4(), input = pose(.3, .2);
    f.update(input, width, 100); f.render(100, width, out);
    out.elements.forEach((value, i) => expect(value).toBeCloseTo(input.elements[i], 8));
  });
  it.each([15, 27, 60])('holds a small alternating pose perturbation at %i updates per second', fps => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    for (let i = 1; i <= fps * 3; i++) {
      f.update(pose(Math.sin(i) * .002, Math.sin(i * 1.7) * Math.PI / 180), width, i * 1000 / fps);
      f.render(i * 1000 / fps, width, out);
      const {position, rotation} = components(out);
      expect(Math.abs(position.x)).toBeLessThan(1e-9);
      expect(rotation.angleTo(new Quaternion())).toBeLessThan(1e-7);
    }
  });
  it('follows gradual real motion instead of discarding each small increment', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    for (let i = 1; i <= 120; i++) { f.update(pose(i * .001), width, i * 33); f.render(i * 33, width, out); }
    expect(components(out).position.x).toBeGreaterThan(.11);
    expect(components(out).position.x).toBeLessThanOrEqual(.12);
  });
  it('attenuates oscillations larger than the deadband at separate tracking/render rates', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    let nextInputMs = 0, inputX = 0, inputAngle = 0;
    let rawPositionEnergy = 0, shownPositionEnergy = 0, rawAngleEnergy = 0, shownAngleEnergy = 0;
    for (let frame = 1; frame <= 240; frame++) {
      const now = frame * 1000 / 60;
      if (now >= nextInputMs) {
        const noise = Math.sin(2 * Math.PI * 5 * now / 1000);
        inputX = .012 * noise; inputAngle = 4 * Math.PI / 180 * noise;
        f.update(pose(inputX, inputAngle), width, now); nextInputMs = now + 1000 / 27;
      }
      f.render(now, width, out);
      if (now > 1000) {
        const shown = components(out);
        rawPositionEnergy += inputX ** 2; shownPositionEnergy += shown.position.x ** 2;
        rawAngleEnergy += inputAngle ** 2; shownAngleEnergy += shown.rotation.angleTo(new Quaternion()) ** 2;
      }
    }
    expect(Math.sqrt(shownPositionEnergy / rawPositionEnergy)).toBeLessThan(.5);
    expect(Math.sqrt(shownAngleEnergy / rawAngleEnergy)).toBeLessThan(.5);
  });
  it('interpolates on render frames between recognition updates', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    f.update(pose(.04, .1), width, 10);
    f.render(20, width, out); const first = components(out).position.x;
    f.render(40, width, out); const second = components(out).position.x;
    expect(first).toBeGreaterThan(0); expect(second).toBeGreaterThan(first); expect(second).toBeLessThan(.04);
  });
  it('makes smoothing depend on elapsed time rather than rendering frame count', () => {
    const results = [15, 30, 60].map(fps => {
      const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0); f.update(pose(.04, .1), width, 0);
      for (let i = 1; i <= fps; i++) f.render(i * 1000 / fps, width, out);
      return components(out);
    });
    for (const r of results) {
      expect(r.position.x).toBeCloseTo(results[0].position.x, 8);
      expect(r.rotation.angleTo(results[0].rotation)).toBeLessThan(1e-6);
    }
  });
  it('catches up to a deliberate movement while retaining a small deadband', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    f.update(pose(.5, Math.PI / 6), width, 10);
    for (let t = 20; t <= 600; t += 20) f.render(t, width, out);
    const result = components(out);
    expect(Math.abs(result.position.x - .5)).toBeLessThan(.01);
    expect(result.rotation.angleTo(components(pose(.5, Math.PI / 6)).rotation)).toBeLessThan(3 * Math.PI / 180);
  });
  it('snaps to the new pose after losing and reacquiring the marker', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(-1), width, 0); f.render(10, width, out);
    f.reset(); expect(f.render(20, width, out)).toBe(false);
    f.update(pose(1), width, 500); f.render(500, width, out);
    expect(components(out).position.x).toBeCloseTo(1);
  });
  it('keeps the rendered model rigid with a fixed marker scale', () => {
    const f = new PoseStabilizer(), out = new Matrix4(), input = pose(0, .1);
    input.elements[0] *= 1.03; input.elements[4] += 4;
    f.update(input, width, 0); f.render(0, width, out);
    const result = components(out);
    expect(result.scale.x).toBeCloseTo(width, 8); expect(result.scale.y).toBeCloseTo(width, 8); expect(result.scale.z).toBeCloseTo(width, 8);
    const x = new Vector3().setFromMatrixColumn(out, 0), y = new Vector3().setFromMatrixColumn(out, 1);
    expect(Math.abs(x.dot(y))).toBeLessThan(1e-6);
  });
  it('rejects invalid poses without poisoning the previous rendered pose', () => {
    const f = new PoseStabilizer(), out = new Matrix4(); f.update(pose(), width, 0);
    const invalid = pose(); invalid.elements[0] = NaN;
    expect(f.update(invalid, width, 20)).toBe(false); expect(f.update(pose(), 0, 20)).toBe(false);
    f.render(30, width, out); expect(out.elements.every(Number.isFinite)).toBe(true);
  });
});
