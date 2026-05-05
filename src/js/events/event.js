import * as THREE from "three";
import { 
  isPointerOverUI, 
  getInteractionTarget, 
  updateMousePosition, 
  updateMouseFromTouch,
} from "@/js/helper/util.js";
import { focusOnObject, applySelection } from "@/js/ui_ux/cameraUtils.js";
import { showBottomSheet } from "@/js/ui_ux/ui.js";

export function setupEventListeners(appState) {
  // --- Configure OrbitControls for Google Maps behavior ---
  if (appState.controls) {
    appState.controls.enableDamping = true;
    appState.controls.dampingFactor = 0.08;
    
    // Remap: 1 finger = Pan, 2 fingers = Zoom + Rotate
    appState.controls.touches.ONE = THREE.TOUCH.PAN;
    appState.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  window.addEventListener("mousemove", (event) => {
    if (isPointerOverUI(event)) return;
    updateMousePosition(event.clientX, event.clientY, appState);
  });

  /*
  Desktop
  Function: mousedown -> Handles when the user clicks on the screen
  */
  window.addEventListener("mousedown", () => {
    appState.pointerStartTime = Date.now();
  });

  /*
  Mobile
  Function: touchstart -> Handles when the user first clicks on the screen
  */
  window.addEventListener("touchstart", (event) => {
    if (isPointerOverUI(event)) return;
    appState.pointerStartTime = Date.now();
    updateMouseFromTouch(event, appState);
  }, { passive: false });

  /*
  Mobile
  Function: touchmove -> Handles when the user moves their fingers on the screen
  */
  window.addEventListener("touchmove", (event) => {
    if (isPointerOverUI(event)) return;

    if (event.touches.length > 0) {
      updateMouseFromTouch(event, appState);
      // Only prevent default if we are interacting with the canvas
      event.preventDefault();
    }
  }, { passive: false });
  /*
  Mobile
  Function: touchend -> Handles when the user lifts their fingers off the screen
  */
  window.addEventListener("touchend", (event) => {
    if (isPointerOverUI(event)) return;
    updateMouseFromTouch(event, appState);
    
    // Only trigger selection if the touch was a quick "tap" (less than 250ms)
    const duration = Date.now() - appState.pointerStartTime;
    if (duration < 250) {
      const target = getInteractionTarget(event, appState);
      if (target) {
        focusOnObject(target, appState);
        showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
      }
    }
  }, { passive: false });

  window.addEventListener("click", (event) => {
    const target = getInteractionTarget(event, appState);
    if (target) {
      focusOnObject(target, appState);
      showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
    }
  });
  /*
  Event listener to handle when user ovverides the 3D scene by interacting with it during a camera animation
  */
  window.addEventListener("camera-interaction-start", () => {
    if (appState.cameraAnim && appState.cameraAnim.active) {
      appState.cameraAnim.active = false;
    }
  });

  window.addEventListener("bottomsheetclose", () => {
    applySelection(null, appState);
  });
}
