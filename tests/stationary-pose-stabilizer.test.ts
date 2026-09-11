import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { StationaryPoseStabilizer } from '../src/ar/stationary-pose-stabilizer';
function pose(x=.04, y=.18, depth=2.5, degrees=0, width=512) {
  return new Matrix4().compose(new Vector3(x*depth*width,y*depth*width,-depth*width),
    new Quaternion().setFromAxisAngle(new Vector3(0,1,0),degrees*Math.PI/180),new Vector3().setScalar(width));
}
function settle(f:StationaryPoseStabilizer, out:Matrix4, fps=25) {
  for(let i=0;i<=fps;i++){f.update(pose(),512,i*1000/fps);f.render(i*1000/fps,512,out);}
  expect(f.state).toBe('held');
}
describe('resting pose hold and intentional motion',()=>{
  it.each([10,25,60])('holds exactly despite noise and isolated outliers at %i input Hz',fps=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();settle(f,out,fps);const held=out.clone();
    for(let i=1;i<=fps*5;i++){
      const t=1000+i*1000/fps;
      // One-frame branch errors must not move the displayed object.
      const spike=i%fps===0;
      f.update(pose(.04+(spike?-.006:.0005*Math.sin(i)),.18,spike?2.57:2.5+.008*Math.cos(i),spike?8:Math.sin(i)),512,t);
      f.render(t,512,out);expect(f.state).toBe('held');expect(out.elements).toEqual(held.elements);
    }
  });
  it.each(['translation','approach','rotation'])('releases sustained %s and catches up',kind=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();settle(f,out);
    const target=kind==='translation'?pose(.075):kind==='approach'?pose(.04,.18,2):pose(.04,.18,2.5,25);
    for(let t=1040;t<=1360;t+=40){f.update(target,512,t);f.render(t,512,out);}
    expect(f.state).toBe('following');
    for(let t=1400;t<=2400;t+=40){f.update(target,512,t);f.render(t,512,out);}
    const p=new Vector3(),q=new Quaternion(),s=new Vector3();out.decompose(p,q,s);
    if(kind==='translation')expect(p.x/-p.z).toBeGreaterThan(.073);
    if(kind==='approach')expect(-p.z/512).toBeLessThan(2.08);
    if(kind==='rotation')expect(q.angleTo(new Quaternion())*180/Math.PI).toBeGreaterThan(20);
  });
  it('accumulates slow movement instead of locking permanently to a moving reference',()=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();settle(f,out);
    for(let i=1;i<=150;i++){f.update(pose(.04+i*.00015),512,1000+i*40);f.render(1000+i*40,512,out);}
    expect(out.elements[12]/-out.elements[14]).toBeGreaterThan(.057);
  });
  it('does not infer rest from only two observations or a long gap',()=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);f.update(pose(),512,2000);f.render(2000,512,out);expect(f.state).toBe('following');
  });
  it('drops the held state and old pose when a marker is reacquired',()=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();settle(f,out);f.reset();expect(f.render(2000,512,out)).toBe(false);
    const target=pose(.2,-.1,1.5,30);f.update(target,512,2010);f.render(2010,512,out);expect(out.elements).toEqual(target.elements);expect(f.state).toBe('following');
  });
  it('rejects invalid input without corrupting a held pose',()=>{
    const f=new StationaryPoseStabilizer(),out=new Matrix4();settle(f,out);const held=out.clone(),bad=pose();bad.elements[4]=NaN;
    expect(f.update(bad,512,1100)).toBe(false);expect(f.update(pose(.04,.18,-2),512,1120)).toBe(false);expect(f.update(pose(),0,1130)).toBe(false);expect(f.update(pose(),512,10)).toBe(false);
    f.render(1200,512,out);expect(out.elements).toEqual(held.elements);
  });
});
