import * as THREE from "three";
import { animateCameraTo } from "@/js/ui_ux/animate.js";
import { zoneColours } from "@/js/floor/modelParser.js";

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

export function focusOnFloor(appState) {
  const floor = appState.currentFloor;
  if (!floor || !appState.controls) return;

  const target = floor.cameraConfig.target;
  const newCamPos = floor.cameraConfig.initialPosition;

  animateCameraTo(appState, newCamPos, target);
}

export function focusOnObject(targetObject, appState) {
  if (appState.selected === targetObject) return;

  applySelection(targetObject, appState);

  if (targetObject && appState.controls) {
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
