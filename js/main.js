import * as THREE from "three";
import { setupScene } from "./sceneSetup.js";
import { loadModels } from "./modelLoader.js";
import { setupUI, switchFloor } from "./ui.js";
import { setupEventListeners } from "./event.js";
import { startAnimationLoop } from "./animate.js";

const { scene, camera, renderer, controls } = setupScene();

const floorPaths = {
  b2: "./assets/models/njc-b2.glb",
  b3: "./assets/models/njc-b3.glb",
};

let appState = {
  currentFloor: "b3", // default floor
  interactiveObjects: [],
  hovered: null,
  cameraAnim: {
    active: false,
    cameraTarget: new THREE.Vector3(),
    controlsTarget: new THREE.Vector3(),
  }
};

export const infoLabel = document.getElementById("info");

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

setupEventListeners(renderer, mouse, appState, raycaster, camera, infoLabel, controls);

// Initializing the application
async function initApp() {
  const { floors, floorObjects } = await loadModels(scene, camera, controls, floorPaths);
  
  // Custom switch floor callback to handle main.js state
  const switchFloorCb = (floorId, loadedFloors, loadedFloorObjects) => {
    switchFloor(floorId, loadedFloors, loadedFloorObjects, appState);
  };
  
  setupUI(floors, floorObjects, switchFloorCb);
  
  if (floors[appState.currentFloor]) {
    switchFloorCb(appState.currentFloor, floors, floorObjects);
  } else {
    // If default doesn't exist just use the first loaded floor
    const loadedFloorIds = Object.keys(floors);
    if(loadedFloorIds.length > 0) {
      switchFloorCb(loadedFloorIds[0], floors, floorObjects);
    }
  }

  startAnimationLoop(controls, renderer, scene, camera, mouse, appState, raycaster, infoLabel);
}

initApp();

// Optional Console func
window.printCurrentFloorInfo = function () {
  console.log(`=== Info for Current Floor: ${appState.currentFloor} ===`);
  // implementation depends on whether floors is globally accessible
};