import * as THREE from "three";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { Icon } from "@/js/marker/icon.js";
import { showToast, hideToast } from "@/js/base/ui.js";

export class Navigation {
  static appState = null;

  static init(appState) {
    Navigation.appState = appState;
    
    // Sync preloaded status from localStorage
    try {
      const preloaded = JSON.parse(localStorage.getItem('funtasia_preloaded_assets') || '[]');
      preloaded.forEach(url => appState.loadedAssets.add(url));
    } catch(e) {
      console.warn("Failed to parse preloaded assets from localStorage", e);
    }
  }

  static async switchFloor(floorId) {
    if (Navigation.appState.currentFloor && Navigation.appState.currentFloor.id === floorId) return;

    // Hide all floors first
    Object.values(Floor.floors).forEach((floor) => floor.hide());

    const targetFloor = Floor.floors[floorId];
    if (!targetFloor) {
      console.warn(`Floor ${floorId} not found`);
      return;
    }

    // Lazy load — fetch from jsDelivr if not yet in memory
    if (!targetFloor.isLoaded()) {
      const isPreloaded = Navigation.appState.loadedAssets.has(targetFloor.modelPath);
      
      // Only show toast if not already pre-fetched (or if user is explicitly re-triggering)
      if (!isPreloaded) {
        showToast(`Loading ${floorId.toUpperCase()}…`, 15000);
      }
      
      try {
        await targetFloor.load(Navigation.appState);
        // Mark as successful for future switches
        Navigation.appState.loadedAssets.add(targetFloor.modelPath);
      } catch (err) {
        console.error(`Failed to load floor ${floorId}:`, err);
        showToast(`Error: ${floorId.toUpperCase()} failed.`);
        return;
      } finally {
        hideToast();
      }
    }

    targetFloor.activate(Navigation.appState.camera, Navigation.appState.controls);

    // Update state
    Floor.currentFloor = targetFloor;
    Navigation.appState.interactiveObjects = targetFloor.interactiveObjects;
    Navigation.appState.currentFloor = targetFloor;
    Icon.setLevel(floorId);
    console.log(`Switched to floor: ${floorId}`);

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
        const marker = new QRMarker(appState.lastScannedInfo.pos, floorId, greyDelay);
        marker.startTime = startTime;
        appState.activeMarkers.push(marker);
      }
    }
  }

  static handleQRID(qrID) {
    const markerInfo = QRMarker.knownMarkers[qrID];
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
    const marker = new QRMarker(markerInfo.pos, markerInfo.floorId);
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
