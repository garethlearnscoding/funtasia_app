import * as THREE from "three";
import { showBottomSheet } from "./ui.js";

const mutedColors = {
  "-1": 0xb9a6b9,
  0: 0xd97c7c,
  1: 0xe6a57e,
  2: 0x8fa7b3,
  3: 0x8fbf9f,
  4: 0xe8e2a1,
  5: 0xb9a6b9,
  6: 0xd6c1c8,
  7: 0xb1b1b1,
  8: 0xb0b0b0,
};

export function isPointerOverUI(event) {
  return !!event.target.closest("#bottom-sheet, #close-btn, #floor-selector");
}

export function performRaycast(appState, raycaster, mouse, camera) {
  if (!appState.interactiveObjects || appState.interactiveObjects.length === 0) return null;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(appState.interactiveObjects, true);
  return intersects.length > 0 ? intersects[0].object : null;
}

export function applyHover(target, appState, infoLabel) {
  if (appState.hovered === target) return;

  if (appState.hovered) appState.hovered.material.emissive.setHex(0x000000);
  appState.hovered = target;

  if (appState.hovered) {
    const baseColor = new THREE.Color(mutedColors[appState.hovered.userData.ZONE]);
    const emissiveColor = baseColor.clone().multiplyScalar(1);
    appState.hovered.material.emissive.copy(emissiveColor);
    document.body.style.cursor = "pointer";
    if (infoLabel) infoLabel.textContent = `Hovering: ${appState.hovered.name}`;
  } else {
    document.body.style.cursor = "default";
    if (infoLabel) infoLabel.textContent = "Hover over the model";
  }
}

export function handleInteraction(event, appState, raycaster, mouse, camera, infoLabel) {
  if (isPointerOverUI(event)) return;

  let targetObject = appState.hovered;
  if (!targetObject) {
    targetObject = performRaycast(appState, raycaster, mouse, camera);
    if (targetObject) applyHover(targetObject, appState, infoLabel);
  }

  if (targetObject) {
    console.log(`Clicked on: ${targetObject.name}`);
    if (infoLabel) infoLabel.textContent = `Clicked: ${targetObject.name}`;
    showBottomSheet(targetObject.name);
  }
}

export function updateMousePosition(clientX, clientY, renderer, mouse) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

export function updateMouseFromTouch(event, renderer, mouse) {
  const touch =
    (event.touches && event.touches[0]) ||
    (event.changedTouches && event.changedTouches[0]);
  if (!touch) return;
  updateMousePosition(touch.clientX, touch.clientY, renderer, mouse);
}
