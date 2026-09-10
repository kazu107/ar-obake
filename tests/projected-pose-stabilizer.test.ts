import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { ProjectedPoseStabilizer } from '../src/ar/projected-pose-stabilizer';
import { PoseStabilizer } from '../src/ar/pose-stabilizer';

function pose(cx=.05, cy=.04, depth=2, angle=0, width=512) {
  return new Matrix4().compose(new Vector3(cx*depth*width,cy*depth*width,-depth*width),
    new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),new Vector3().setScalar(width));
}
function center(m:Matrix4) { return [m.elements[12]/-m.elements[14],m.elements[13]/-m.elements[14]]; }

describe('image-plane and depth stabilization',()=>{
  it('preserves the projected centre when depth fluctuates',()=>{
    const f=new ProjectedPoseStabilizer(), out=new Matrix4();f.update(pose(),512,0);
    for(let i=1;i<=150;i++){
      f.update(pose(.05,.04,2+Math.sin(i)*.08),512,i*33);f.render(i*33,512,out);
      expect(center(out)[0]).toBeCloseTo(.05,9);expect(center(out)[1]).toBeCloseTo(.04,9);
    }
  });
  it('reduces apparent-size noise compared with the previous pose filter',()=>{
    const current=new ProjectedPoseStabilizer(), previous=new PoseStabilizer(), a=new Matrix4(),b=new Matrix4();
    current.update(pose(),512,0);previous.update(pose(),512,0);
    let aEnergy=0,bEnergy=0;
    for(let i=1;i<=180;i++){
      const t=i*1000/30, input=pose(.05,.04,2+.06*Math.sin(2*Math.PI*5*t/1000));
      current.update(input,512,t);previous.update(input,512,t);current.render(t,512,a);previous.render(t,512,b);
      if(i>30){aEnergy+=(512/-a.elements[14]-.5)**2;bEnergy+=(512/-b.elements[14]-.5)**2;}
    }
    expect(Math.sqrt(aEnergy/bEnergy)).toBeLessThan(.5);
  });
  it('follows image-plane movement promptly without waiting for depth to settle',()=>{
    const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);f.update(pose(.09,.04,1.9),512,0);
    for(let t=10;t<=200;t+=10)f.render(t,512,out);
    expect(Math.abs(center(out)[0]-.09)).toBeLessThan(.002);expect(center(out)[0]).toBeLessThanOrEqual(.09);
  });
  it('continues following gradual deliberate movement',()=>{
    const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);
    for(let i=1;i<=150;i++){f.update(pose(.05+i*.0002,.04,2-i*.002),512,i*33);f.render(i*33,512,out);}
    expect(center(out)[0]).toBeGreaterThan(.078);expect(-out.elements[14]/512).toBeLessThan(1.76);
  });
  it('catches up after a deliberate approach without overshooting',()=>{
    const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);f.update(pose(.05,.04,1.5),512,0);
    for(let t=20;t<=1000;t+=20){f.render(t,512,out);expect(-out.elements[14]/512).toBeGreaterThanOrEqual(1.5);}
    expect(-out.elements[14]/512).toBeLessThan(1.5*1.03);
  });
  it('uses elapsed time consistently at different render rates',()=>{
    const values=[15,30,60].map(fps=>{const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);f.update(pose(.06,.04,1.94,.08),512,0);for(let i=1;i<=fps;i++)f.render(i*1000/fps,512,out);return out.elements;});
    for(const v of values)v.forEach((value,i)=>expect(value).toBeCloseTo(values[0][i],7));
  });
  it.each([256,512,1024])('normalizes marker size and resets on reacquisition at width %i',width=>{
    const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(.05,.04,2,0,width),width,0);
    f.reset();expect(f.render(1,width,out)).toBe(false);f.update(pose(.2,-.1,1.4,.3,width),width,10);f.render(10,width,out);
    expect(center(out)[0]).toBeCloseTo(.2);expect(center(out)[1]).toBeCloseTo(-.1);expect(-out.elements[14]/width).toBeCloseTo(1.4);
  });
  it('rejects poses behind the camera and invalid inputs without corrupting state',()=>{
    const f=new ProjectedPoseStabilizer(),out=new Matrix4();f.update(pose(),512,0);
    expect(f.update(pose(.05,.04,-2),512,10)).toBe(false);
    const bad=pose();bad.elements[0]=NaN;expect(f.update(bad,512,10)).toBe(false);expect(f.update(pose(),0,10)).toBe(false);
    f.render(20,512,out);expect(out.elements.every(Number.isFinite)).toBe(true);expect(center(out)[0]).toBeCloseTo(.05);
  });
});
