import { 
  isPointerOverUI, 
  handleInteraction, 
  updateMousePosition, 
  updateMouseFromTouch 
} from "./util.js";

export function setupEventListeners(renderer, mouse, appState, raycaster, camera, infoLabel) {
  window.addEventListener("mousemove", (event) => {
    if (isPointerOverUI(event)) return;
    updateMousePosition(event.clientX, event.clientY, renderer, mouse);
  });

  window.addEventListener("touchstart", (event) => {
    if (isPointerOverUI(event)) return;
    updateMouseFromTouch(event, renderer, mouse);
  }, { passive: false });

  window.addEventListener("touchmove", (event) => {
    if (isPointerOverUI(event)) return;
    if (event.touches.length > 0) {
      updateMouseFromTouch(event, renderer, mouse);
      event.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("touchend", (event) => {
    if (isPointerOverUI(event)) return;
    updateMouseFromTouch(event, renderer, mouse);
    event.preventDefault();
    handleInteraction(event, appState, raycaster, mouse, camera, infoLabel);
  }, { passive: false });

  window.addEventListener("click", (event) => {
    handleInteraction(event, appState, raycaster, mouse, camera, infoLabel);
  });
}
