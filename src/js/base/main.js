import * as THREE from "three";
import { setupScene } from "@/js/base/sceneSetup.js";
import { setupUI } from "@/js/ui_ux/ui.js";
import { setupEventListeners } from "@/js/events/event.js";
import { startAnimationLoop } from "@/js/ui_ux/animate.js";
import { Floor } from "@/js/floor/floor.js";
import { Marker } from "@/js/marker/marker.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { loadFont } from "@/js/helper/font.js";
import { Icon } from "@/js/marker/icon.js";
import { AppState } from "@/js/base/appState.js";
import { SettingsController } from "@/js/base/settings.js";
import { Navigation } from "@/js/events/navigation.js";
import { applyThemeToScene } from "@/js/floor/modelParser.js";
import { initDirectory, fetchDirectoryData, setDirectoryData } from "@/js/feature/directory.js";

const { scene, camera, renderer, controls } = setupScene();

// Register all floors with their relative CDN paths (no static imports needed).
// Models are fetched lazily from jsDelivr on first switchFloor() call.
const floorDefs = {
  l2: `models/${VERSION}/njc-l2-${VERSION}.glb`,
  l1: `models/${VERSION}/njc-l1-${VERSION}.glb`,
  b1: `models/${VERSION}/njc-b1-${VERSION}.glb`,
  b2: `models/${VERSION}/njc-b2-${VERSION}.glb`,
  b3: `models/${VERSION}/njc-b3-${VERSION}.glb`,
};

const childModelDefs = {
  canteen:   { floorId: "l1", nodeName: "Canteen",   path: `models/${VERSION}/njc-l1-canteen-${VERSION}.glb` },
  sanctuary: { floorId: "l1", nodeName: "Sanctuary", path: `models/${VERSION}/njc-l1-sanctuary-${VERSION}.glb` },
  hall:      { floorId: "l2", nodeName: "Hall",      path: `models/${VERSION}/njc-l2-hall-${VERSION}.glb` },
  ish:       { floorId: "b3", nodeName: "ISH",       path: `models/${VERSION}/njc-b3-ish-${VERSION}.glb` },
};

// Instantiate Floor objects — they self-register into Floor.floors
Object.entries(floorDefs).forEach(([id, path]) => new Floor(id, path));
Object.entries(childModelDefs).forEach(([id, config]) => {
  const floor = new Floor(id, config.path);
  floor.parentFloorId = config.floorId;
  
  // Populate the lookup map for the parser (Parent ID -> { NodeName -> ChildID })
  if (!Floor.childModels[config.floorId]) Floor.childModels[config.floorId] = {};
  Floor.childModels[config.floorId][config.nodeName] = id;
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const appState = new AppState(  );
appState.scene = scene;
appState.camera = camera;
appState.renderer = renderer;
appState.controls = controls;
appState.raycaster = raycaster;
appState.mouse = mouse;

Marker.appState = appState;
Floor.appState = appState;

Navigation.init(appState);

setupEventListeners(appState);

// Initializing the application
async function initApp() {
  const font = await loadFont();
  if (font === undefined) {
    console.log("Font not loaded");
  }
  console.log(`Font: ${font}`);

  // Set font as a class attribute so handleURLQR etc. don't need it passed
  Marker.font = font;

  // 1. Fetch raw data
  const rawData = await fetchDirectoryData();

  // No pre-loading — floors are fetched on-demand in Navigation.switchFloor()
  // 2. Set up UI
  setupUI(Floor.floors, appState);

  // 3. Make raw data accessible globally for parsing later (handled via switchFloor param injection down the line)
  // Wait, the instructions say to pass `rawData` to floor pipeline...
  // But floor pipeline is lazy-loaded via switchFloor -> targetFloor.load()
  // I need to ensure switchFloor passes this data. Let me handle that in navigation.js
  // For now, let's keep rawData here and inject it into floor loading. Actually, I will pass it to Navigation.init
  // or store it on appState.
  appState.rawData = rawData;
  
  initDirectory(appState);

  // Initialize modular Settings menu
  SettingsController.init('settings-content-area');
  const visualsSection = SettingsController.addSection('Visual Preferences');
  const controlsSection = SettingsController.addSection('Controls');
  if (visualsSection) {
    SettingsController.addToggle(
      visualsSection,
      'Show POI Icons',
      'Toggle 3D points of interest markers',
      (state) => { Icon.state(state); },
      Icon.iconsVisible !== false
    );
    SettingsController.addToggle(
      visualsSection,
      'Dark Mode',
      'Toggle dark mode',
      (isDark) => {
          const root = document.documentElement;
          if (isDark) {
            root.classList.add('mocha');
            root.classList.remove('latte');
            localStorage.setItem('funtasia-theme', 'mocha');
          } else {
            root.classList.add('latte');
            root.classList.remove('mocha');
            localStorage.setItem('funtasia-theme', 'latte');
          };
          applyThemeToScene(appState); // update scene
        },
        document.documentElement.classList.contains('mocha') // Check if current mode is mocha
    );
  }
  if (controlsSection) {
    SettingsController.addToggle(
      controlsSection,
      'Rotation Lock',
      'Lock the rotation of the 3D model',
      (isLocked) => {
        appState.rotationLocked = isLocked;
        controls.enableRotate = !isLocked;
        controls.touches.TWO = isLocked ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
        
        // Lerp camera to front of the model when locked
        if (isLocked && appState.currentFloor && appState.currentFloor.cameraConfig) {
          const config = appState.currentFloor.cameraConfig;
          appState.cameraAnim.controlsTarget.copy(config.target);
          appState.cameraAnim.cameraTarget.copy(config.initialPosition);
          appState.cameraAnim.active = true;
        }
      },
      appState.rotationLocked
    );
  }

  const handleURLQR = () => {
    Navigation.handleURLQR();
  };

  // Listen for URL changes (back/forward or manual scan)
  window.addEventListener("popstate", handleURLQR);

  // Initial check — triggers first lazy load for the default floor
  handleURLQR();

  startAnimationLoop(appState);
}

initApp();
// Optional Console func
window.printCurrentFloorInfo = function () {
  const currentFloorId = appState.currentFloor ? appState.currentFloor.id : "None";
  console.log(`=== Info for Current Floor: ${currentFloorId} ===`);
};

window.printAllMarkers = function () {
  console.log(QRMarker.allMarkers);
};