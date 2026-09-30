import type { Group } from 'three';
import type { MarkerOrientation } from '../storage/marker-settings';
export function orientMarkerContent(content:Group,orientation:MarkerOrientation):void {
  // Marker XY is its surface; +Z points out of it. Rotate local +Y to +Z
  // so a ghost stands on a horizontal card, facing its lower edge.
  const standing=orientation==='perpendicular',size=standing ? .65 : 1;
  content.rotation.set(standing?Math.PI/2:0,0,0);
  // An upright ghost extends toward the camera; keep its speech in a portrait crop.
  content.scale.setScalar(size);
  // The ghost's lowest point is approximately local y=-.32.
  content.position.set(0,0,standing ? .32*size+.02 : 0);
}
