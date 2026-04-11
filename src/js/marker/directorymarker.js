import * as THREE from "three";
import { LocationMarker } from "./marker.js";

export class DirectoryMarker extends LocationMarker {
  constructor(position, level) {
    super(position, level, false); // false for no text label
  }

  animate(time, camera) {
    if (!this.group || !this.indicator) return;

    const t = time * 0.003;
    const markerModel = this.indicator.getObjectByName("markerModel");

    // floating effect
    if (markerModel) {
      markerModel.position.y = 0.8 + Math.sin(t * 0.5) * 0.05;
    }

    // Billboarding marker model to face camera
    if (markerModel && camera) {
      const targetPos = new THREE.Vector3();
      camera.getWorldPosition(targetPos);
      
      const modelPos = new THREE.Vector3();
      markerModel.getWorldPosition(modelPos);
      
      targetPos.y = modelPos.y; // Keep target at same horizontal height
      markerModel.lookAt(targetPos);
    }
  }
}
