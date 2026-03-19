import * as THREE from "three";
import { showBottomSheet } from "./ui.js";
import { zoneColours } from "./modelParser.js";

export function isPointerOverUI(event) {
  return !!event.target.closest("#bottom-sheet, #close-btn, #floor-selector");
}

export function performRaycast(appState, raycaster, mouse, camera) {
  if (!appState.interactiveObjects || appState.interactiveObjects.length === 0) return null;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(appState.interactiveObjects, true);
  return intersects.length > 0 ? intersects[0].object : null;
}

export function applySelection(target, appState, infoLabel) {
  if (appState.selected === target) return;

  if (appState.selected) appState.selected.material.emissive.setHex(0x000000);
  appState.selected = target;

  if (appState.selected) {
    const baseColor = new THREE.Color(zoneColours[appState.selected.userData.ZONE]);
    const emissiveColor = baseColor.clone().multiplyScalar(2);
    appState.selected.material.emissive.copy(emissiveColor);
    if (infoLabel) infoLabel.textContent = `Selected: ${appState.selected.name}`;
  } else {
    if (infoLabel) infoLabel.textContent = "Select a model";
  }
}

export function handleInteraction(event, appState, raycaster, mouse, camera, infoLabel, controls) {
  if (isPointerOverUI(event)) return;

  // New: Differentiate between a simple tap and a long press/drag
  const pressDuration = Date.now() - appState.pointerStartTime;
  if (pressDuration > 100) {
    console.log(`Interaction ignored (duration: ${pressDuration}ms)`);
    return;
  }

  const targetObject = performRaycast(appState, raycaster, mouse, camera);
  applySelection(targetObject, appState, infoLabel);

  if (targetObject) {
    console.log(`Clicked on: ${targetObject.name}`);
    showBottomSheet(targetObject.name);

    // Camera animation logic
    if (controls) {
      // 1. Get object visual center (native Blender origin)
      const objectCenter = targetObject.getWorldPosition(new THREE.Vector3());
      
      // Still compute bounds just to know how big it is for distance calculation
      const box = new THREE.Box3().setFromObject(targetObject);
      const objectSize = box.getSize(new THREE.Vector3());

      // 2. Get current camera 2D direction
      const camPos = camera.position.clone();
      const controlsTarget = controls.target.clone();
      
      const direction = new THREE.Vector3().subVectors(camPos, controlsTarget);
      direction.y = 0; // maintain horizontal direction
      if (direction.lengthSq() < 0.001) {
          direction.set(0, 0, 1); // fallback direction
      }
      direction.normalize();

      // Snap direction to the closest cardinal direction (X or Z axis)
      if (Math.abs(direction.x) > Math.abs(direction.z)) {
          direction.set(Math.sign(direction.x), 0, 0);
      } else {
          direction.set(0, 0, Math.sign(direction.z));
      }

      // 3. Compute new camera position
      // Push back less to angle down more, and push up significantly
      console.log(objectSize.length());
      const distance = Math.max(objectSize.length(), 2) * 0.8;
      console.log(objectSize.y);
      const heightOffset = Math.max(objectSize.y, 1) * 1.5 + 5;
      
      const newCamPos = objectCenter.clone()
        .add(direction.multiplyScalar(distance))
        .add(new THREE.Vector3(0, heightOffset, 0));

      // 4. Activate animation state
      appState.cameraAnim.controlsTarget.copy(objectCenter);
      appState.cameraAnim.cameraTarget.copy(newCamPos);
      appState.cameraAnim.active = true;
    }
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
