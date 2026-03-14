import { performRaycast, applyHover } from "./util.js";

export function startAnimationLoop(controls, renderer, scene, camera, mouse, appState, raycaster, infoLabel) {
  function animate() {
    requestAnimationFrame(animate);

    // Handle camera animation
    if (appState.cameraAnim && appState.cameraAnim.active) {
      const lerpFactor = 0.05;
      
      camera.position.lerp(appState.cameraAnim.cameraTarget, lerpFactor);
      controls.target.lerp(appState.cameraAnim.controlsTarget, lerpFactor);

      // Check if we arrived
      const posDist = camera.position.distanceTo(appState.cameraAnim.cameraTarget);
      const targetDist = controls.target.distanceTo(appState.cameraAnim.controlsTarget);
      
      if (posDist < 0.1 && targetDist < 0.1) {
        appState.cameraAnim.active = false;
      }
    }

    controls.update();

    const elementAtPointer = document.elementFromPoint(
      ((mouse.x + 1) / 2) * window.innerWidth,
      ((-mouse.y + 1) / 2) * window.innerHeight,
    );

    const overUI =
      elementAtPointer &&
      elementAtPointer.closest("#bottom-sheet, #floor-selector, #close-btn");

    const intersected = overUI ? null : performRaycast(appState, raycaster, mouse, camera);
    applyHover(intersected, appState, infoLabel);

    renderer.render(scene, camera);
  }

  animate();
}
