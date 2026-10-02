import { type Camera, type Group, Mesh, type Object3D, Vector3 } from 'three';
import type { MarkerOrientation } from '../storage/marker-settings';
import { orientMarkerContent } from './marker-orientation';

export const SPEECH_LAYOUT={width:.72,height:.337,position:[0,.66,.2] as const,standingY:.72};

export function layoutSpeakingContent(content:Group,orientation:MarkerOrientation):void {
  orientMarkerContent(content,orientation);
  // Make room above the head without pushing the speech outside a portrait crop.
  content.scale.multiplyScalar(.85);
  if(orientation==='perpendicular')content.position.z=.32*content.scale.y+.02;
  else content.position.y=-.17;
}

// Diagnostic measured on acquisition, not on every tracking frame. Project
// actual vertices: a world-axis box invents empty corners in the tilted view.
export function speechGapPixels(model:Object3D,bubble:Object3D,camera:Camera,height:number):number {
  camera.updateMatrixWorld();
  const vertical=(object:Object3D)=>{
    object.updateWorldMatrix(true,true);
    const point=new Vector3();let top=Infinity,bottom=-Infinity;
    object.traverseVisible(part=>{
      if(!(part instanceof Mesh))return;const positions=part.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld).project(camera);const screenY=(1-point.y)*height/2;top=Math.min(top,screenY);bottom=Math.max(bottom,screenY);
      }
    });
    return {top,bottom};
  };
  return vertical(model).top-vertical(bubble).bottom;
}
