import * as THREE from "three";
import { setupScene } from "./sceneSetup.js";
import { loadModels } from "./modelLoader.js";
import { setupUI } from "./ui.js";
import { setupEventListeners } from "./event.js";
import { startAnimationLoop } from "./animate.js";
import { Floor } from "./floor.js";
import { QRMarker } from "./marker.js";
import { loadFont } from "./font.js";
import { Icon } from "./icon.js";
import { AppState } from "./appState.js";
import { SettingsController } from "./settings.js";

const { scene, camera, renderer, controls } = setupScene();

const floorPaths = {
  l4: "./assets/models/v2-31-3/njc-l4-v2-31-3.glb",
  l3: "./assets/models/v2-31-3/njc-l3-v2-31-3.glb",
  l2: "./assets/models/v2-31-3/njc-l2-v2-31-3.glb",
  l1: "./assets/models/v2-31-3/njc-l1-v2-31-3.glb",
  b1: "./assets/models/v2-31-3/njc-b1-v2-31-3.glb",
  b2: "./assets/models/v2-31-3/njc-b2-v2-31-3.glb",
  b3: "./assets/models/v2-31-3/njc-b3-v2-31-3.glb",
};

const childModelPaths = {
  canteen: "./assets/models/njc-l1-canteen.glb",
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

// Set class attributes for static methods
QRMarker.appState = appState;
Floor.appState = appState;
Floor.QRMarker = QRMarker; // Inject to avoid circular dependency in floor.js
Icon.appState = appState;

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
    QRMarker.handleURLQR();
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