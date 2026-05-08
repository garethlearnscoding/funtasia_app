import * as THREE from "three";
import { LocationMarker } from "@/js/marker/marker.js";
import { Floor } from "@/js/floor/floor.js";

export class QRMarker extends LocationMarker {
  // Static class attribute initialized in main.js
  static appState = null;

  // Registry of all known QR marker positions, keyed by marker ID
  // Populated by modelParser. Shape: { [qrId]: { pos: THREE.Vector3, floorId: string } }
  static allMarkers = {};

  /**
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} level - The floor/level the marker belongs to.
   * @param {number} greyDelay - Milliseconds before the marker greys out (default 5 min).
   */
  constructor(position, level, greyDelay = 5 * 60000, enableGreyOut = true) {
    const floor = Floor.floors[level];
    const parent = floor ? floor.sceneModel : null;

    // Always rendered with the text label
    super(parent, position, level, true);

    // Grey-out materials (created lazily in greyOut())
    this.greyMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
    this.outlineMaterialGrey = null;

    this.startTime = performance.now();
    this.greyDelay = greyDelay;
    this.enableGreyOut = enableGreyOut;
    this.isGrey = false;
    this.markerHeight = 0.8;
  }

  /**
   * Delegates floating/billboarding to LocationMarker.animate, then handles grey-out timer.
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    // Delegates floating/billboarding to LocationMarker.animate
    super.animate(time, camera);

    if (this.enableGreyOut && !this.isGrey && time - this.startTime > this.greyDelay) {
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