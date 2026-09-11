import { Matrix4, Quaternion, Vector2, Vector3 } from 'three';
import { ProjectedPoseStabilizer } from './projected-pose-stabilizer';
import { STATIONARY_STABILIZATION as settings } from './tracking-config';

interface Observation { at: number; center: Vector2; depth: number; rotation: Quaternion }
const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];

/** Hold a resting pose; release only after displacement persists beyond a wider boundary. */
export class StationaryPoseStabilizer {
  private readonly moving = new ProjectedPoseStabilizer();
  private readonly displayed = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();
  private observations: Observation[] = [];
  private reference: Observation | undefined;
  private held = false;
  private initialized = false;
  private lastInputMs = -Infinity;
  private outsideSince: number | undefined;
  private outsideCount = 0;

  get state(): 'held' | 'following' { return this.held ? 'held' : 'following'; }

  reset() {
    this.moving.reset(); this.observations = []; this.reference = undefined;
    this.held = false; this.initialized = false; this.lastInputMs = -Infinity;
    this.outsideSince = undefined; this.outsideCount = 0;
  }

  update(matrix: Matrix4, markerWidth: number, nowMs: number): boolean {
    if (!(markerWidth > 0) || !Number.isFinite(markerWidth) || !Number.isFinite(nowMs) ||
        nowMs < this.lastInputMs || !matrix.elements.every(Number.isFinite) ||
        Math.abs(matrix.determinant()) < 1e-9) return false;
    matrix.decompose(this.position, this.rotation, this.scale);
    const depth = -this.position.z / markerWidth;
    if (!(depth > .01)) return false;
    const input: Observation = { at: nowMs, center: new Vector2(this.position.x/-this.position.z, this.position.y/-this.position.z),
      depth: Math.log(depth), rotation: this.rotation.clone().normalize() };
    // A gap provides no evidence of rest or sustained movement.
    if (nowMs - this.lastInputMs > 250) {
      this.observations = []; this.outsideSince = undefined; this.outsideCount = 0;
    }
    this.lastInputMs = nowMs;

    if (this.held && this.reference) {
      const centerDelta = input.center.distanceTo(this.reference.center);
      const depthDelta = Math.abs(input.depth-this.reference.depth);
      const angle = input.rotation.angleTo(this.reference.rotation);
      const outside = centerDelta > settings.centerReleaseRadius || depthDelta > settings.depthReleaseRadius || angle > settings.rotationReleaseRadians;
      if (outside) {
        this.outsideSince ??= nowMs; this.outsideCount++;
        const large = centerDelta > .02 || depthDelta > .12 || angle > Math.PI/6;
        if (nowMs-this.outsideSince >= (large ? 40 : settings.releaseMs) && this.outsideCount >= 3) {
          this.held = false; this.observations = [];
          // Seed from the held output, never from an invisible filter that drifted meanwhile.
          this.moving.reset(); this.moving.update(this.displayed, markerWidth, nowMs);
        }
      } else { this.outsideSince = undefined; this.outsideCount = 0; }
      if (this.held) return true;
    }

    this.moving.update(matrix, markerWidth, nowMs);
    this.moving.render(nowMs, markerWidth, this.displayed);
    this.initialized = true;
    this.observations.push(input);
    this.observations = this.observations.filter(p => nowMs-p.at <= settings.settleMs+100).slice(-90);
    if (this.observations.length < 5 || nowMs-this.observations[0].at < settings.settleMs) return true;
    const rows = this.observations;
    const center = new Vector2(median(rows.map(p=>p.center.x)),median(rows.map(p=>p.center.y)));
    const logDepth = median(rows.map(p=>p.depth));
    // Quaternion medoid avoids Euler wrapping and the q/-q double representation.
    const representative = rows.reduce((best,p)=>
      rows.reduce((sum,r)=>sum+p.rotation.angleTo(r.rotation),0) < rows.reduce((sum,r)=>sum+best.rotation.angleTo(r.rotation),0) ? p : best);
    const inliers = rows.filter(p => p.center.distanceTo(center) <= settings.centerSettleRadius &&
      Math.abs(p.depth-logDepth) <= settings.depthSettleRadius && p.rotation.angleTo(representative.rotation) <= settings.rotationSettleRadians);
    if (inliers.length/rows.length >= .8) {
      this.reference = { at: nowMs, center, depth: logDepth, rotation: representative.rotation.clone() };
      this.held = true; this.outsideSince = undefined; this.outsideCount = 0; this.observations = [];
    }
    return true;
  }

  render(nowMs: number, markerWidth: number, output: Matrix4): boolean {
    if (!this.initialized) return false;
    if (!this.held) this.moving.render(nowMs, markerWidth, this.displayed);
    output.copy(this.displayed);
    return true;
  }
}
