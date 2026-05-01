import * as THREE from "three";
import { showBottomSheet } from "@/js/ui_ux/ui.js";
import { zoneColours } from "@/js/floor/modelParser.js";
import { animateCameraTo } from "@/js/ui_ux/animate.js";

export function isPointerOverUI(event) {
  try {
    return !!event.target.closest("#bottom-sheet, #close-btn, #floor-selector, .modal-wrapper, button, input");
  } catch {
    return false
  }
}

export function performRaycast(appState) {
  if (!appState.interactiveObjects || appState.interactiveObjects.length === 0) return null;
  appState.raycaster.setFromCamera(appState.mouse, appState.camera);
  const intersects = appState.raycaster.intersectObjects(appState.interactiveObjects, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    // Resolve child mesh to parent Group if applicable
    return hit.userData.logicalParent || hit;
  }
  return null;
}

export function applySelection(target, appState) {
  if (appState.selected === target) return;

  if (appState.selected) {
    // Restore materials on all mesh children
    appState.selected.traverse((child) => {
      if (child.isMesh && child.userData.material) {
        child.material = child.userData.material;
      }
    });
  }

  appState.selected = target;

  if (appState.selected) {
    const baseColor = new THREE.Color(zoneColours[appState.selected.userData.ZONE]);

    const wallHighlightColor = baseColor.clone().multiplyScalar(1.4); // Slightly brighter for walls
    const topHighlightColor = baseColor.clone().multiplyScalar(1.6);  // More pronounced for tops

    const wallHighlightMaterial = new THREE.MeshBasicMaterial({color: wallHighlightColor,});
    const topHighlightMaterial = new THREE.MeshBasicMaterial({color: topHighlightColor,});

    // Apply highlight to all mesh children
    appState.selected.traverse((child) => {
      if (child.isMesh && child.userData.material) {
        // Determine if the child mesh represents a wall ('_1') or a top ('_2') face
        child.material = child.name.endsWith('_1') ? wallHighlightMaterial : topHighlightMaterial;
      }
    });
  }
}

export function focusOnObject(targetObject, appState) {
  if (appState.selected === targetObject) return;

  applySelection(targetObject, appState);

  if (targetObject) {
    console.log(`Focused on: ${targetObject.name}`);

    // Pass the child floor ID if it exists so the UI can show an "Enter" button
    // Also pass the boothDescription stored in userData
    showBottomSheet(targetObject.name, targetObject.userData.child, targetObject.userData.boothDescription);

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
      // Using factors from appState to maintain a consistent angle regardless of object size
      const baseScale = Math.max(objectSize.length(), 2);
      const distance = baseScale * (appState.cameraAnim.viewDistanceFactor || 1.2);
      const heightOffset = baseScale * (appState.cameraAnim.viewHeightFactor || 0.8);

      const newCamPos = objectCenter.clone()
        .add(direction.multiplyScalar(distance))
        .add(new THREE.Vector3(0, heightOffset, 0));

      // 4. Activate animation state
      animateCameraTo(appState, newCamPos, objectCenter);
    }
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
  if (targetObject) {
    focusOnObject(targetObject, appState);
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
