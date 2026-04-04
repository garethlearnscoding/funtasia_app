import * as THREE from "three";
import { setupScene } from "@/js/base/sceneSetup.js";
import { loadModels } from "@/js/floor/modelLoader.js";
import { setupUI } from "@/js/base/ui.js";
import { setupEventListeners } from "@/js/base/event.js";
import { startAnimationLoop } from "@/js/base/animate.js";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { loadFont } from "@/js/helper/font.js";
import { Icon } from "@/js/marker/icon.js";
import { AppState } from "@/js/base/appState.js";
import { SettingsController } from "@/js/base/settings.js";
import { Navigation } from "@/js/base/navigation.js";

const { scene, camera, renderer, controls } = setupScene();

import modelL4 from "@/assets/models/v2-31-3/njc-l4-v2-31-3.glb";
import modelL3 from "@/assets/models/v2-31-3/njc-l3-v2-31-3.glb";
import modelL2 from "@/assets/models/v2-31-3/njc-l2-v2-31-3.glb";
import modelL1 from "@/assets/models/v2-31-3/njc-l1-v2-31-3.glb";
import modelB1 from "@/assets/models/v2-31-3/njc-b1-v2-31-3.glb";
import modelB2 from "@/assets/models/v2-31-3/njc-b2-v2-31-3.glb";
import modelB3 from "@/assets/models/v2-31-3/njc-b3-v2-31-3.glb";
import modelCanteen from "@/assets/models/njc-l1-canteen.glb";

const floorPaths = {
  l4: modelL4,
  l3: modelL3,
  l2: modelL2,
  l1: modelL1,
  b1: modelB1,
  b2: modelB2,
  b3: modelB3,
};

const childModelPaths = {
  canteen: modelCanteen,
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export const infoLabel = document.getElementById("info");

const appState = new AppState();
appState.scene = scene;
appState.camera = camera;
appState.renderer = renderer;
appState.controls = controls;
appState.raycaster = raycaster;
appState.mouse = mouse;
appState.infoLabel = infoLabel;

QRMarker.appState = appState;
Floor.appState = appState;
Icon.appState = appState;

Navigation.init(appState);

setupEventListeners(appState);

// Initializing the application
async function initApp() {
  const font = await loadFont();
  if (font === undefined) {
    console.log("Font not loaded");
  }
  console.log(`Font: ${font}`)
  
  // Set font as a class attribute so handleURLQR etc. don't need it passed
  QRMarker.font = font;

  const { floors } = await loadModels(appState, floorPaths);
  await loadModels(appState, childModelPaths);
  
  setupUI(floors);

  // Initialize modular Settings menu
  SettingsController.init('settings-content-area');
  const visualsSection = SettingsController.addSection('Visual Preferences');
  if (visualsSection) {
    SettingsController.addToggle(
      visualsSection,
      'Show POI Icons',
      'Toggle 3D points of interest markers',
      (state) => { Icon.state(state); },
      Icon.iconsVisible !== false
    );
  }

  const handleURLQR = () => {
    Navigation.handleURLQR();
  };

  // Listen for URL changes (back/forward or manual scan)
  window.addEventListener("popstate", handleURLQR);
  
  // Initial check
  handleURLQR();

  startAnimationLoop(appState);
}

initApp();
// Optional Console func
window.printCurrentFloorInfo = function () {
  const currentFloorId = appState.currentFloor ? appState.currentFloor.id : "None";
  console.log(`=== Info for Current Floor: ${currentFloorId} ===`);
};