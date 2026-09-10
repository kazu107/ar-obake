import { Matrix4, Quaternion, Vector2, Vector3 } from 'three';
import { PROJECTION_STABILIZATION as settings } from './tracking-config';

/** Follow image-plane motion promptly, without passing depth noise into apparent size. */
export class ProjectedPoseStabilizer {
  private initialized = false;
  private lastRenderMs = 0;
  private goalLogDepth = 0;
  private logDepth = 0;
  private readonly rawPosition = new Vector3();
  private readonly rawRotation = new Quaternion();
  private readonly rawCenter = new Vector2();
  private readonly goalCenter = new Vector2();
  private readonly center = new Vector2();
  private readonly goalRotation = new Quaternion();
  private readonly rotation = new Quaternion();
  private readonly scratch = new Vector3();
  private readonly scale = new Vector3();

  reset() { this.initialized = false; }

  update(matrix: Matrix4, markerWidth: number, nowMs: number): boolean {
    if (!(markerWidth > 0) || !Number.isFinite(markerWidth) || !Number.isFinite(nowMs) ||
        !matrix.elements.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-9) return false;
    matrix.decompose(this.rawPosition, this.rawRotation, this.scratch);
    this.rawPosition.divideScalar(markerWidth); this.rawRotation.normalize();
    const depth = -this.rawPosition.z;
    if (!(depth > .01)) return false;
    this.rawCenter.set(this.rawPosition.x / depth, this.rawPosition.y / depth);
    const rawLogDepth = Math.log(depth);
    if (!this.initialized) {
      this.center.copy(this.rawCenter); this.goalCenter.copy(this.rawCenter);
      this.logDepth = this.goalLogDepth = rawLogDepth;
      this.rotation.copy(this.rawRotation); this.goalRotation.copy(this.rawRotation);
      this.initialized = true; this.lastRenderMs = nowMs;
      return true;
    }
    const centerDistance = this.goalCenter.distanceTo(this.rawCenter);
    if (centerDistance > settings.centerDeadband) {
      this.goalCenter.lerp(this.rawCenter, 1 - settings.centerDeadband / centerDistance);
    }
    const depthDelta = rawLogDepth - this.goalLogDepth;
    if (Math.abs(depthDelta) > settings.depthLogDeadband) {
      this.goalLogDepth = rawLogDepth - Math.sign(depthDelta) * settings.depthLogDeadband;
    }
    const angle = this.goalRotation.angleTo(this.rawRotation);
    if (angle > settings.rotationDeadbandRadians) {
      this.goalRotation.slerp(this.rawRotation, 1 - settings.rotationDeadbandRadians / angle);
    }
    return true;
  }

  render(nowMs: number, markerWidth: number, output: Matrix4): boolean {
    if (!this.initialized) return false;
    const dt = Math.max(0, nowMs - this.lastRenderMs);
    this.lastRenderMs = Math.max(this.lastRenderMs, nowMs);
    const centerTau = this.center.distanceTo(this.goalCenter) > .02 ? 20 : settings.centerTimeConstantMs;
    const depthTau = Math.abs(this.goalLogDepth - this.logDepth) > .08 ? 70 : settings.depthTimeConstantMs;
    const rotationTau = this.rotation.angleTo(this.goalRotation) > Math.PI / 12 ? 60 : settings.rotationTimeConstantMs;
    this.center.lerp(this.goalCenter, 1 - Math.exp(-dt / centerTau));
    this.logDepth += (this.goalLogDepth - this.logDepth) * (1 - Math.exp(-dt / depthTau));
    this.rotation.slerp(this.goalRotation, 1 - Math.exp(-dt / rotationTau)).normalize();
    const depth = Math.exp(this.logDepth);
    // Reconstruct X/Y using the stabilized depth, keeping the projected centre in place.
    this.scratch.set(this.center.x * depth, this.center.y * depth, -depth).multiplyScalar(markerWidth);
    output.compose(this.scratch, this.rotation, this.scale.setScalar(markerWidth));
    return true;
  }
}
