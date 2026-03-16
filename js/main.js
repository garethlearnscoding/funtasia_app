import * as THREE from "three";
import { setupScene } from "./sceneSetup.js";
import { loadModels } from "./modelLoader.js";
import { setupUI } from "./ui.js";
import { setupEventListeners } from "./event.js";
import { startAnimationLoop } from "./animate.js";
import { Floor } from "./floor.js";
import { QRMarker } from "./marker.js";

const { scene, camera, renderer, controls } = setupScene();

const floorPaths = {
  l1: "./assets/models/njc-l1.glb",
  b1: "./assets/models/njc-b1.glb",
  b2: "./assets/models/njc-b2.glb",
  b3: "./assets/models/njc-b3.glb",
};

let appState = {
  currentFloor: null, // Will hold Floor object
  interactiveObjects: [],
  selected: null,
  cameraAnim: {
    active: false,
    cameraTarget: new THREE.Vector3(),
    controlsTarget: new THREE.Vector3(),
  },
  activeMarkers: [],
  lastScannedInfo: null
};


export const infoLabel = document.getElementById("info");

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

setupEventListeners(renderer, mouse, appState, raycaster, camera, infoLabel, controls);

// Initializing the application
async function initApp() {
  const { floors } = await loadModels(scene, camera, controls, floorPaths);
  
  // Custom switch floor callback to handle main.js state
  const switchFloorCb = (floorId) => {
    Floor.switchFloor(floorId, appState, camera, controls);
    
    // Persistence: Check if we need to re-render the last scanned marker
    if (appState.lastScannedInfo && appState.lastScannedInfo.floorId === floorId) {
      const startTime = appState.lastScannedInfo.startTime;
      const greyDelay = 10000;
      const now = performance.now();
      
      if (now - startTime < greyDelay) {
        const marker = new QRMarker(scene, appState.lastScannedInfo.pos, greyDelay);
        // Correct the start time so it greys out at the right moment
        marker.startTime = startTime; 
        appState.activeMarkers.push(marker);
      }
    }
  };
  
  setupUI(floors, switchFloorCb);

  const handleURLQR = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      QRMarker.handleQRID(qrID, scene, camera, controls, appState);
    }
  };

  // Listen for URL changes (back/forward or manual scan)
  window.addEventListener("popstate", handleURLQR);
  
  // Initial check
  const urlParams = new URLSearchParams(window.location.search);
  const qrID = urlParams.get("qrID");
  if (qrID) {
    handleURLQR();
  } else {
    const defaultFloorId = "l1";
    switchFloorCb(defaultFloorId);
  }

  startAnimationLoop(controls, renderer, scene, camera, mouse, appState, raycaster, infoLabel);
}

initApp();
// Optional Console func
window.printCurrentFloorInfo = function () {
  const currentFloorId = appState.currentFloor ? appState.currentFloor.id : "None";
  console.log(`=== Info for Current Floor: ${currentFloorId} ===`);
};