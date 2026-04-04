import * as THREE from "three";
import { showBottomSheet } from "@/js/base/ui.js";
import { zoneColours } from "@/js/floor/modelParser.js";
import { Navigation } from "@/js/base/navigation.js";

export function isPointerOverUI(event) {
  return !!event.target.closest("#bottom-sheet, #close-btn, #floor-selector, #directory-modal-wrapper, #settings-modal-wrapper, button, input");
}

export function performRaycast(appState) {
  if (!appState.interactiveObjects || appState.interactiveObjects.length === 0) return null;
  appState.raycaster.setFromCamera(appState.mouse, appState.camera);
  const intersects = appState.raycaster.intersectObjects(appState.interactiveObjects, true);
  return intersects.length > 0 ? intersects[0].object : null;
}

export function applySelection(target, appState) {
  if (appState.selected === target) return;

  if (appState.selected) appState.selected.material.emissive.setHex(0x000000);
  appState.selected = target;

  if (appState.selected) {
    const baseColor = new THREE.Color(zoneColours[appState.selected.userData.ZONE]);
    const emissiveColor = baseColor.clone().multiplyScalar(2);
    appState.selected.material.emissive.copy(emissiveColor);
    if (appState.infoLabel) appState.infoLabel.textContent = `Selected: ${appState.selected.name}`;
  } else {
    if (appState.infoLabel) appState.infoLabel.textContent = "Select a model";
  }
}

export function handleInteraction(event, appState) {
  if (isPointerOverUI(event)) return;

  // New: Differentiate between a simple tap and a long press/drag
  const pressDuration = Date.now() - appState.pointerStartTime;
  if (pressDuration > 100) {
    console.log(`Interaction ignored (duration: ${pressDuration}ms)`);
    return;
  }

  const targetObject = performRaycast(appState);
  applySelection(targetObject, appState);

  if (targetObject) {
    console.log(`Clicked on: ${targetObject.name}`);

    if (targetObject.userData.child) {
      Navigation.switchFloor(targetObject.userData.child);
      return;
    }

    showBottomSheet(targetObject.name);

    // Camera animation logic
    if (appState.controls) {
      // 1. Get object visual center (native Blender origin)
      const objectCenter = targetObject.getWorldPosition(new THREE.Vector3());
      
      // Still compute bounds just to know how big it is for distance calculation
      const box = new THREE.Box3().setFromObject(targetObject);
      const objectSize = box.getSize(new THREE.Vector3());

      // 2. Get current camera 2D direction
      const camPos = appState.camera.position.clone();
      const controlsTarget = appState.controls.target.clone();
      
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

export function updateMousePosition(clientX, clientY, appState) {
  const rect = appState.renderer.domElement.getBoundingClientRect();
  appState.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  appState.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

export function updateMouseFromTouch(event, appState) {
  const touch =
    (event.touches && event.touches[0]) ||
    (event.changedTouches && event.changedTouches[0]);
  if (!touch) return;
  updateMousePosition(touch.clientX, touch.clientY, appState);
}
