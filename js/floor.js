import * as THREE from "three";

export const ICON_PATHS = {
  stairs: "./assets/icons/stairs.png",
  toilets: "./assets/icons/toilets.png",
  lifts: "./assets/icons/lifts.png",
};

export class Floor {
  // Static dictionary of all loaded floors
  static floors = {};
  
  // Static reference to the currently active floor instance
  static currentFloor = null;

  // Dictionary of all markers across all floors { id: { pos, floorId } }
  static allMarkers = {};

  static registerFloor(floor) {
    Floor.floors[floor.id] = floor;
  }

  static switchFloor(floorId, appState, camera, controls) {
    if (appState.currentFloor && appState.currentFloor.id === floorId) return;

    // Hide all floors first
    Object.values(Floor.floors).forEach((floor) => floor.hide());

    // Activate new floor
    const targetFloor = Floor.floors[floorId];
    if (targetFloor && targetFloor.isLoaded()) {
      targetFloor.activate(camera, controls);
      
      // Update state
      Floor.currentFloor = targetFloor;
      appState.interactiveObjects = targetFloor.interactiveObjects;
      appState.currentFloor = targetFloor; // Store object instead of string
      
      console.log(`Switched to floor: ${floorId}`);
    } else {
      console.warn(`Floor ${floorId} not found or not loaded yet`);
    }

    // Update UI buttons
    document.querySelectorAll(".floor-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.floor === floorId) btn.classList.add("active");
    });

    // Clear any selected state and camera animations when swapping floors
    if (appState.selected) {
      appState.selected.material.emissive.setHex(0x000000);
      appState.selected = null;
    }

    if (appState.cameraAnim) {
      appState.cameraAnim.active = false;
    }

    // Clear active markers
    if (appState.activeMarkers && appState.activeMarkers.length > 0) {
      appState.activeMarkers.forEach(m => m.clear());
      appState.activeMarkers = [];
    }
  }

  constructor(id, modelPath, infoDataPath = null) {
    this.id = id;
    this.modelPath = modelPath;
    this.infoDataPath = infoDataPath;

    this.sceneModel = null;
    this.interactiveObjects = [];
    
    // Register self
    Floor.registerFloor(this);
    
    // Dictionary of id : coordinate (using THREE.Vector3)
    this.markers = {};
    
    // List of "tuples" as objects/arrays: { pos: Vector3, type: string }
    this.icons = [];

    // Derived during model parsing to fit the specific floor's bounds
    this.cameraConfig = {
      initialPosition: new THREE.Vector3(),
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 0,
      maxDistance: 0,
      near: 0.1,
      far: 2000,
    };
  }

  isLoaded() {
    return this.sceneModel !== null;
  }

  /**
   * Called to show this floor and apply its specific camera constraints.
   */
  activate(camera, controls) {
    if (!this.isLoaded()) {
      console.warn(`Attempted to activate unloaded floor: ${this.id}`);
      return;
    }

    this.sceneModel.visible = true;

    // Apply specific camera config 
    controls.target.copy(this.cameraConfig.target);
    camera.position.copy(this.cameraConfig.initialPosition);
    controls.minDistance = this.cameraConfig.minDistance;
    controls.maxDistance = this.cameraConfig.maxDistance;
    camera.near = this.cameraConfig.near;
    camera.far = this.cameraConfig.far;
    
    camera.updateProjectionMatrix();
    controls.update();

    console.log(`Switched to floor: ${this.id}`);
  }

  /**
   * Called to hide this floor from view.
   */
  hide() {
    if (this.isLoaded()) {
      this.sceneModel.visible = false;
    }
  }

  /**
   * Populates the internal state after the GLTF model is parsed.
   */
  attachParsedData(model, interactiveObjects, cameraConfig, markers, icons) {
    this.sceneModel = model;
    this.interactiveObjects = interactiveObjects;
    this.cameraConfig = cameraConfig;
    this.markers = markers || {};
    this.icons = icons || [];

    // Populate global dictionary
    Object.entries(this.markers).forEach(([id, pos]) => {
      Floor.allMarkers[id] = { pos, floorId: this.id };
    });
  }
}
