import * as THREE from "three";
import { LocationMarker } from "./marker.js";
import { LocationMarker } from "@/js/marker/marker.js";

export class QRMarker extends LocationMarker {
  static knownMarkers = {};

  static storeMarker(qrID, pos, floorId) {
    QRMarker.knownMarkers[qrID] = { pos, floorId };
  }

  constructor(position, level, greyDelay = 5 * 60000) {
    super(position, level, true); // true for text label
export class QRMarker extends LocationMarker {
  // Static class attribute initialized in main.js
  static appState = null;

  /**
   * @param {THREE.Scene} scene - Scene to add the marker to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {number} greyDelay - Milliseconds before the marker greys out (default 5 min).
   */
  constructor(scene, position, greyDelay = 5 * 60000) {
    // Always rendered with the text label
    super(scene, position, true);

    // Grey-out materials (created lazily in greyOut())
    this.greyMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
    this.outlineMaterialGrey = null;

    this.startTime = performance.now();
    this.greyDelay = greyDelay;
    this.isGrey = false;
    this.markerHeight = 0.8;
  }

  /**
   * Delegates floating/billboarding to LocationMarker.animate, then handles grey-out timer.
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group || !this.indicator) return;

    const t = time * 0.003;
    const markerModel = this.indicator.getObjectByName("markerModel");
    const textLabelGroup = this.indicator.getObjectByName("textLabelGroup");

    // floating effect
    if (markerModel) {
      markerModel.position.y = this.markerHeight + Math.sin(t*0.5) * 0.05;
    }

    // Billboarding text
    if (textLabelGroup && camera) {
      textLabelGroup.quaternion.copy(camera.quaternion);
    }

    if (markerModel && camera) {
      // Create a target point at camera level, but same height as model
      const targetPos = new THREE.Vector3();
      camera.getWorldPosition(targetPos);
      
      const modelPos = new THREE.Vector3();
      markerModel.getWorldPosition(modelPos);
      
      targetPos.y = modelPos.y; // Keep target at same horizontal height
      markerModel.lookAt(targetPos);
    }

    // grey-out timer
    super.animate(time, camera);

    if (!this.isGrey && time - this.startTime > this.greyDelay) {
      this.greyOut();
    }
  }

  greyOut() {
    this.outlineMaterialGrey = new THREE.LineBasicMaterial({ color: 0x333333 });

    this.group.traverse((child) => {
      if (child.isMesh) {
        child.material = this.greyMaterial;
      } else if (child.isLine || child.isLineSegments) {
        child.material = this.outlineMaterialGrey;
      }
    });

    // Remove the text label once greyed out
    if (this._textLabelGroup) {
      this.group.remove(this._textLabelGroup);
      this._textLabelGroup = null;
    }

    this.isGrey = true;
  }

  clear() {
    if (this.group) {
      this.scene.remove(this.group);

      this.group.traverse((child) => {
        if (child.isMesh || child.isLine || child.isLineSegments) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });

      this.group = null;
    }

    if (this.greyMaterial) this.greyMaterial.dispose();
    if (this.outlineMaterialGrey) this.outlineMaterialGrey.dispose();
  }
}