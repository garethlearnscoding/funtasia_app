import { performRaycast, applyHover } from "./util.js";

export function startAnimationLoop(controls, renderer, scene, camera, mouse, appState, raycaster, infoLabel) {
  function animate() {
    requestAnimationFrame(animate);
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
