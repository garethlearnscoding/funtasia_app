import * as THREE from "three";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { Icon } from "@/js/marker/icon.js";
import { showToast } from "@/js/base/ui.js";

export class Navigation {
  static appState = null;

  static init(appState) {
    Navigation.appState = appState;
  }

  static switchFloor(floorId) {
    if (Navigation.appState.currentFloor && Navigation.appState.currentFloor.id === floorId) return;

    // Hide all floors first
    Object.values(Floor.floors).forEach((floor) => floor.hide());

    // Activate new floor
    const targetFloor = Floor.floors[floorId];
    if (targetFloor && targetFloor.isLoaded()) {
      targetFloor.activate(Navigation.appState.camera, Navigation.appState.controls);
      
      // Update state
      Floor.currentFloor = targetFloor;
      Navigation.appState.interactiveObjects = targetFloor.interactiveObjects;
      Navigation.appState.currentFloor = targetFloor; // Store object instead of string
      Icon.setLevel(floorId);
      console.log(`Switched to floor: ${floorId}`);
    } else {
      console.warn(`Floor ${floorId} not found or not loaded yet`);
    }

    // Update UI buttons
    document.querySelectorAll(".floor-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.floor === floorId) btn.classList.add("active");
    });

    // Clear any selected state and camera animations when swapping floors
    if (Navigation.appState.selected) {
      Navigation.appState.selected.material.emissive.setHex(0x000000);
      Navigation.appState.selected = null;
    }

    if (Navigation.appState.cameraAnim) {
      Navigation.appState.cameraAnim.active = false;
    }

    // Clear active markers
    if (Navigation.appState.activeMarkers && Navigation.appState.activeMarkers.length > 0) {
      Navigation.appState.activeMarkers.forEach(m => m.clear());
      Navigation.appState.activeMarkers = [];
    }

    // Persistence: Check if we need to re-render the last scanned marker
    const appState = Navigation.appState;
    if (appState.lastScannedInfo && appState.lastScannedInfo.floorId === floorId) {
      const startTime = appState.lastScannedInfo.startTime;
      const greyDelay = 5 * 60000;
      const now = performance.now();
      
      if (now - startTime < greyDelay) {
        const marker = new QRMarker(appState.scene, appState.lastScannedInfo.pos, QRMarker.font, greyDelay);
        // Correct the start time so it greys out at the right moment
        marker.startTime = startTime; 
        appState.activeMarkers.push(marker);
      }
    }
  }

  static handleQRID(qrID) {
    const markerInfo = Floor.allMarkers[qrID];
    if (!markerInfo) {
      console.warn(`Marker ${qrID} not found.`);
      return false;
    }

    // Store in appState for persistence across floor switches
    Navigation.appState.lastScannedInfo = {
      id: qrID,
      floorId: markerInfo.floorId,
      pos: markerInfo.pos,
      startTime: performance.now()
    };

    // Trigger floor switch
    Navigation.switchFloor(markerInfo.floorId);

    // switchFloor clears activeMarkers, so we add the new one back
    const marker = new QRMarker(Navigation.appState.scene, markerInfo.pos, QRMarker.font);
    Navigation.appState.activeMarkers = [marker]; // Ensure it's the only one

    // Camera animation logic
    const markerCenter = markerInfo.pos.clone().add(new THREE.Vector3(0, 1, 0));
    
    const camPos = Navigation.appState.camera.position.clone();
    const direction = new THREE.Vector3().subVectors(camPos, Navigation.appState.controls.target);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();

    // Specific offsets for markers
    const distance = 8; 
    const heightOffset = 6;
    
    const newCamPos = markerCenter.clone()
      .add(direction.multiplyScalar(distance))
      .add(new THREE.Vector3(0, heightOffset, 0));

    Navigation.appState.cameraAnim.controlsTarget.copy(markerCenter);
    Navigation.appState.cameraAnim.cameraTarget.copy(newCamPos);
    Navigation.appState.cameraAnim.active = true;

    return true;
  }

  static handleURLQR() {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      const handled = Navigation.handleQRID(qrID);
      if (handled) return;

      // Unhandled: meaning the marker wasn't found
      showToast(`Marker "${qrID}" not found.`);
    }
    const defaultFloorId = "l1";
    Navigation.switchFloor(defaultFloorId);
  }
}
