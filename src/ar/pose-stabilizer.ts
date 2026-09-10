import { Matrix4, Quaternion, Vector3 } from 'three';
import { POSE_STABILIZATION } from './tracking-config';

/** Stabilize the marker centre, then render a rigid pose at the display cadence. */
export class PoseStabilizer {
  private initialized = false;
  private lastRenderMs = 0;
  private readonly rawPosition = new Vector3();
  private readonly rawRotation = new Quaternion();
  private readonly goalPosition = new Vector3();
  private readonly goalRotation = new Quaternion();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scratch = new Vector3();
  private readonly scale = new Vector3();

  reset() { this.initialized = false; }

  update(matrix: Matrix4, markerWidth: number, nowMs: number): boolean {
    if (!(markerWidth > 0) || !Number.isFinite(markerWidth) || !Number.isFinite(nowMs) ||
        !matrix.elements.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-9) return false;
    matrix.decompose(this.rawPosition, this.rawRotation, this.scratch);
    this.rawPosition.divideScalar(markerWidth);
    this.rawRotation.normalize();
    if (!this.initialized) {
      this.goalPosition.copy(this.rawPosition); this.position.copy(this.rawPosition);
      this.goalRotation.copy(this.rawRotation); this.rotation.copy(this.rawRotation);
      this.lastRenderMs = nowMs; this.initialized = true;
      return true;
    }
    // A soft deadband avoids repeated corrections for sub-threshold changes.
    // Compare with the held goal, not the previous input, so slow real motion accumulates.
    const distance = this.goalPosition.distanceTo(this.rawPosition);
    if (distance > POSE_STABILIZATION.positionDeadband) {
      this.goalPosition.lerp(this.rawPosition, 1 - POSE_STABILIZATION.positionDeadband / distance);
    }
    const angle = this.goalRotation.angleTo(this.rawRotation);
    if (angle > POSE_STABILIZATION.rotationDeadbandRadians) {
      this.goalRotation.slerp(this.rawRotation, 1 - POSE_STABILIZATION.rotationDeadbandRadians / angle);
    }
    return true;
  }

  render(nowMs: number, markerWidth: number, output: Matrix4): boolean {
    if (!this.initialized) return false;
    const dt = Math.max(0, nowMs - this.lastRenderMs);
    this.lastRenderMs = Math.max(this.lastRenderMs, nowMs);
    // Larger deliberate movements catch up faster; small residual noise stays damped.
    const positionTau = this.position.distanceTo(this.goalPosition) > .08 ? 35 : POSE_STABILIZATION.positionTimeConstantMs;
    const rotationTau = this.rotation.angleTo(this.goalRotation) > Math.PI / 15 ? 50 : POSE_STABILIZATION.rotationTimeConstantMs;
    this.position.lerp(this.goalPosition, 1 - Math.exp(-dt / positionTau));
    this.rotation.slerp(this.goalRotation, 1 - Math.exp(-dt / rotationTau)).normalize();
    // Preserve the known physical scale. Averaging matrix elements can introduce shear/scale wobble.
    output.compose(this.scratch.copy(this.position).multiplyScalar(markerWidth), this.rotation, this.scale.setScalar(markerWidth));
    return true;
  }
}
