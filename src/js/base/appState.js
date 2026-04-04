/*
Class: AppState -> Stores information regarding the current appState
*/
import * as THREE from "three";

export class AppState {
  constructor() {
    this.currentFloor = null; // Will hold Floor object
    this.interactiveObjects = [];
    this.selected = null;
    this.cameraAnim = {
      active: false,
      cameraTarget: new THREE.Vector3(),
      controlsTarget: new THREE.Vector3(),
      progress: 0,
      speed: 1.5,
    };
    this.activeMarkers = [];
    this.lastScannedInfo = null;
    this.pointerStartTime = 0;
  }
}
