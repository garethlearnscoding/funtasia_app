/*
Class: AppState -> Stores information regarding the current appState
*/
import * as THREE from "three";

export class AppState {
  constructor() {
    this.currentFloor = null; // Will hold Floor object
    this.interactiveObjects = [];
    this.selected = null;
    this.rotationLocked = true;
    this.cameraAnim = {
      active: false,
      cameraTarget: new THREE.Vector3(),
      controlsTarget: new THREE.Vector3(),
      lerpFactor: 0.05,
      isSystemAction: false,
      viewDistanceFactor: 1.2,
      viewHeightFactor: 0.8,
    };
    this.activeMarkers = [];
    this.activeDirectoryMarker = null; // Stores the active directory marker
    this.lastScannedInfo = null;
    this.pointerStartTime = 0;
    this.isBottomSheetOpen = false;
    this.loadedAssets = new Set();
  }
}
