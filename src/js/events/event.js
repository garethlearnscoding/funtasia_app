import { 
  isPointerOverUI, 
  getInteractionTarget, 
  updateMousePosition, 
  updateMouseFromTouch,
} from "@/js/helper/util.js";
import { focusOnObject, applySelection } from "@/js/ui_ux/cameraUtils.js";
import { showBottomSheet } from "@/js/ui_ux/ui.js";

export function setupEventListeners(appState) {
  /* 
    GESTURE ISOLATION LOGIC:
    The code below isolates Rotate (parallel 2-finger movement) and Zoom (pinch 2-finger movement) 
    by dynamically toggling OrbitControls' enableZoom and enableRotate flags.
    
    TO REVERT TO SIMPLE CONTROLS:
    1. Remove 'touchGestureMode' and 'prevTouches' variables below.
    2. In 'touchstart', remove the "Reset control state" block.
    3. In 'touchmove', remove the "Process gesture detection" block.
    4. In 'touchend', remove the "Restore default state" block.
  */
  let touchGestureMode = null;
  let prevTouches = [];

  /*
  Desktop
  Function: mousemove -> Handles when the user moves the mouse
  */
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
    
    // [GUESTURE ISOLATION] Reset control state on new touches
    if (event.touches.length === 2 || event.touches.length < 2) {
      touchGestureMode = null;
      appState.controls.enableZoom = true;
      appState.controls.enableRotate = true;
    }
    prevTouches = Array.from(event.touches).map(t => ({ clientX: t.clientX, clientY: t.clientY }));
  }, { passive: false });

  /*
  Mobile
  Function: touchmove -> Handles when the user moves their fingers on the screen
  */
  window.addEventListener("touchmove", (event) => {
    if (isPointerOverUI(event)) return;
    // TODO: Achieve a DOLLY_ROTATE setup such that both actions only occur when the conditions are met but can occur simulatenously in that same period
    // [GUESTURE ISOLATION] Process gesture detection
    if (event.touches.length === 2 && prevTouches.length === 2) {
      const p1 = prevTouches[0];
      const p2 = prevTouches[1];
      const c1 = event.touches[0];
      const c2 = event.touches[1];

      const v1 = { x: c1.clientX - p1.clientX, y: c1.clientY - p1.clientY };
      const v2 = { x: c2.clientX - p2.clientX, y: c2.clientY - p2.clientY };

      const mag1 = Math.hypot(v1.x, v1.y);
      const mag2 = Math.hypot(v2.x, v2.y);

      // Determine gesture only if fingers moved sufficiently
      if (!touchGestureMode && mag1 > 2 && mag2 > 2) {
        const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
        /*
        Camera Locking :
        - If the user is moving 2 fingers across the screen, it will only rotate if both fingers stay side by side
        - If the user is pinching / expanding the screeen, it will only zoom and not rotate
        */
        if (dot > 0.7) { 
          // Parallel movement -> Rotate Mode
          touchGestureMode = 'rotate';
          appState.controls.enableZoom = false;
          appState.controls.enableRotate = true;
        } else if (dot < -0.5) {
          // Opposite movement -> Zoom Mode
          touchGestureMode = 'zoom';
          appState.controls.enableRotate = false;
          appState.controls.enableZoom = true;
        }
      }
    }
    
    // Update previous touches
    if (event.touches.length > 0) {
      prevTouches = Array.from(event.touches).map(t => ({ clientX: t.clientX, clientY: t.clientY }));
    }

    if (event.touches.length > 0) {
      updateMouseFromTouch(event, appState);
      event.preventDefault();
    }
  }, { passive: false });
  /*
  Mobile
  Function: touchend -> Handles when the user lifts their fingers off the screen
  */
  window.addEventListener("touchend", (event) => {
    if (isPointerOverUI(event)) return;
    
    // [GUESTURE ISOLATION] Restore default state when fingers are removed
    if (event.touches.length < 2) {
      touchGestureMode = null;
      appState.controls.enableZoom = true;
      appState.controls.enableRotate = true;
    }
    prevTouches = Array.from(event.touches).map(t => ({ clientX: t.clientX, clientY: t.clientY }));

    updateMouseFromTouch(event, appState);
    event.preventDefault();
    
    const target = getInteractionTarget(event, appState);
    if (target) {
      focusOnObject(target, appState);
      showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
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
