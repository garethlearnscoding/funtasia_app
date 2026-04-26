import * as THREE from "three";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { Icon } from "@/js/marker/icon.js";
import { updateFloorUI, showToast, hideToast, hideBottomSheet } from "@/js/ui_ux/ui.js";

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

  static clearActiveMarkers() {
    const appState = Navigation.appState;
    if (appState.activeMarkers && appState.activeMarkers.length > 0) {
      appState.activeMarkers.forEach(m => {
        // Skip directory marker, we handle its persistence manually
        if (m !== appState.activeDirectoryMarker) {
            m.clear();
        }
      });
      // Filter out cleared markers, keeping the directory marker if it exists
      appState.activeMarkers = appState.activeMarkers.filter(m => m === appState.activeDirectoryMarker);
    }
  }

  static restoreLastMarker(floorId) {
    const appState = Navigation.appState;
    if (appState.lastScannedInfo && appState.lastScannedInfo.floorId === floorId) {
      const startTime = appState.lastScannedInfo.startTime;
      const greyDelay = 5 * 60000;
      const now = performance.now();
      
      if (now - startTime < greyDelay) {
        const marker = new QRMarker(appState.scene, appState.lastScannedInfo.pos, greyDelay);
        marker.startTime = startTime;
        appState.activeMarkers.push(marker);
      }
    }
  }

  static async switchFloor(floorId) {
    const appState = Navigation.appState;
    const isSameFloor = appState.currentFloor && appState.currentFloor.id === floorId;

    if (!isSameFloor) {
      updateFloorUI(floorId); // update UI first to prevent desync between thumb and text color invert
      // Store the active selected object to enable deep-back resuming
      const savedSelection = appState.selected;

      // Clear any selected state and camera animations when starting a switch
      if (appState.cameraAnim) {
        appState.cameraAnim.active = false;
      }

      hideBottomSheet();

      if (appState.selected) {
        appState.selected.traverse((child) => {
          if (child.isMesh && child.userData.material) {
            child.material = child.userData.material;
          }
        });
        appState.selected = null;
      }

      const targetFloor = Floor.floors[floorId];
      if (!targetFloor) {
        console.warn(`Floor ${floorId} not found`);
        return;
      }

      const isChildFloor = !!targetFloor.parentFloorId;
      if (appState.currentFloor && !appState.currentFloor.parentFloorId) {
        appState.previousMainFloorId = appState.currentFloor.id;
        appState.previousSelectedObject = savedSelection;
      }
      
      const exitBtn = document.getElementById("exit-child-btn");
      if (exitBtn) {
        if (isChildFloor) {
          exitBtn.style.display = "flex";
          exitBtn.onclick = async () => {
             const prevObj = appState.previousSelectedObject;
             await Navigation.switchFloor(appState.previousMainFloorId || "l1");
             
             if (prevObj) {
                const util = await import("@/js/helper/util.js");
                util.focusOnObject(prevObj, Navigation.appState);
             }
          };
        } else {
          exitBtn.style.display = "none";
        }
      }

      // Hide all floors first
      Object.values(Floor.floors).forEach((floor) => floor.hide());

      // Lazy load
      if (!targetFloor.isLoaded()) {
        const isPreloaded = appState.loadedAssets.has(targetFloor.modelPath);
        if (!isPreloaded) showToast(`Loading ${floorId.toUpperCase()}…`, 15000);
        
        try {
          await targetFloor.load(appState, appState.rawData);
          appState.loadedAssets.add(targetFloor.modelPath);
          
          // Once all main floors are loaded (or as they load), cache the data
          // Actually, we can just cache it immediately after parsing since the data object is shared
          import('@/js/feature/directory.js').then(({ setDirectoryData }) => {
             setDirectoryData(appState.rawData);
          });
        } catch (err) {
          console.error(`Failed to load floor ${floorId}:`, err);
          showToast(`Error: ${floorId.toUpperCase()} failed.`);
          return;
        } finally {
          hideToast();
        }
      }

      targetFloor.activate(appState.camera, appState.controls);

      // Update state
      Floor.currentFloor = targetFloor;
      appState.interactiveObjects = targetFloor.interactiveObjects;
      appState.currentFloor = targetFloor;
      Icon.setLevel(floorId);
      console.log(`Switched to floor: ${floorId}`);
    }

    // Always handle markers (clear previous and potentially restore current)
    Navigation.clearActiveMarkers();
    Navigation.restoreLastMarker(floorId);
    
    // Restore directory marker if it belongs to this floor
    if (appState.activeDirectoryMarker && appState.activeDirectoryMarker.level === floorId) {
      if (!appState.activeMarkers.includes(appState.activeDirectoryMarker)) {
        appState.activeMarkers.push(appState.activeDirectoryMarker);
      }
      // Make sure it's added to the current scene
      if (appState.scene && appState.activeDirectoryMarker.group) {
        appState.scene.add(appState.activeDirectoryMarker.group);
      }
    } else if (appState.activeDirectoryMarker && appState.activeDirectoryMarker.group && appState.scene) {
      // Hide it if on a different floor
      appState.scene.remove(appState.activeDirectoryMarker.group);
    }
  }

  static async handleQRID(qrID, suppressWarning = false) {
    const markerInfo = QRMarker.allMarkers[qrID];
    if (!markerInfo) {
      if (!suppressWarning) {
        console.warn(`Marker ${qrID} not found.`);
      }
      return false;
    }

    // Store in appState for persistence across floor switches
    Navigation.appState.lastScannedInfo = {
      id: qrID,
      floorId: markerInfo.floorId,
      pos: markerInfo.pos,
      startTime: performance.now()
    };

    // Trigger floor switch and await completion to avoid "snapping" override
    await Navigation.switchFloor(markerInfo.floorId);

    // Camera animation logic
    const markerCenter = markerInfo.pos.clone().add(new THREE.Vector3(0, 1, 0));
    
    const camPos = Navigation.appState.camera.position.clone();
    const direction = new THREE.Vector3().subVectors(camPos, Navigation.appState.controls.target);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();

    // Snap direction to the closest cardinal direction (X or Z axis)
    if (Math.abs(direction.x) > Math.abs(direction.z)) {
        direction.set(Math.sign(direction.x), 0, 0);
    } else {
        direction.set(0, 0, Math.sign(direction.z));
    }

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
      
      const executeAsyncCheck = async () => {
        // Attempt immediate handle (if already in registry)
        const handled = await Navigation.handleQRID(qrID, true);
        if (handled) return;

        // If not in registry, wait for floor load
        const targetFloorId = qrID.slice(0, 2);
        
        // Setup listener which will fire during switchFloor's load()
        const onFloorReady = async (e) => {
          // IMPORTANT: Wait a tiny bit to ensure switchFloor's activation 
          // doesn't stomp on the animation we're about to start.
          setTimeout(async () => {
            if (await Navigation.handleQRID(qrID)) {
              window.removeEventListener("floorReady", onFloorReady);
            }
          }, 50);
        };
        window.addEventListener("floorReady", onFloorReady);

        // Derive target floor from first 2 chars of qrID (e.g. "l1-...", "b2-...")
        await Navigation.switchFloor(targetFloorId);
      };
      
      executeAsyncCheck();
      return;
    }
    
    const defaultFloorId = "l1";
    Navigation.switchFloor(defaultFloorId);
  }
}
