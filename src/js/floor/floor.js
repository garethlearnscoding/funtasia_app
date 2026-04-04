import * as THREE from "three";
import { Icon } from "@/js/marker/icon.js";

import stairsIcon from "@/assets/icons/stairs.png";
import toiletsIcon from "@/assets/icons/toilets.png";
import liftsIcon from "@/assets/icons/lifts.png";

export const ICON_PATHS = {
  stairs: stairsIcon,
  toilets: toiletsIcon,
  lifts: liftsIcon,
};
/**
 * 
 */
export class Floor {
  // Static class attributes initialized in main.js
  static appState = null;

  // Static dictionary for mapping object names to child model floor IDs
  static childModels = {
    Canteen: "canteen"
  };

  // Static dictionary of all loaded floors
  static floors = {};
  
  // Static reference to the currently active floor instance
  static currentFloor = null;

  // Dictionary of all markers across all floors { id: { pos, floorId } }
  static allMarkers = {};

  // Adds floor object to Floor class attribute: dictionary 'floors'
  static registerFloor(floor) {
    Floor.floors[floor.id] = floor;
  }

  constructor(id, modelPath, infoDataPath = null) {
    this.id = id;
    this.modelPath = modelPath;
    this.infoDataPath = infoDataPath;

    this.sceneModel = null;
    this.interactiveObjects = [];
    
    // Register self
    Floor.registerFloor(this);

    // Derived during model parsing to fit the specific floor's bounds
    this.cameraConfig = {
      initialPosition: new THREE.Vector3(),
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 0,
      maxDistance: 0,
      near: 0.001,
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
  attachParsedData(model, interactiveObjects, cameraConfig) {
    this.sceneModel = model;
    this.interactiveObjects = interactiveObjects;
    this.cameraConfig = cameraConfig;
  }
}
