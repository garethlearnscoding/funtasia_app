/*
Function: animate() -> Main animation loop
*/

import { Icon } from "@/js/marker/icon.js";

export function startAnimationLoop(appState) {
  /**
  * @param {appstate} appState
  * @returns {None}
  */

  function animate() {
    requestAnimationFrame(animate);

    /*
    Utilises interpolation to smoothly re-orientate the camera upon user 'click'
    */
    if (appState.cameraAnim && appState.cameraAnim.active) {
      const lerpFactor = 0.05;
      
      appState.camera.position.lerp(appState.cameraAnim.cameraTarget, lerpFactor);
      appState.controls.target.lerp(appState.cameraAnim.controlsTarget, lerpFactor);

      /*
      Check if animation has completed -> Camera has arrived at the target location
      */
      const posDist = appState.camera.position.distanceTo(appState.cameraAnim.cameraTarget);
      const targetDist = appState.controls.target.distanceTo(appState.cameraAnim.controlsTarget);
      
      if (posDist < 0.1 && targetDist < 0.1) {
        appState.cameraAnim.active = false;
      }
    }

    appState.controls.update();
    
    
    const time = performance.now();
    /*
    Animate markers
    */
    if (appState.activeMarkers) {
      appState.activeMarkers.forEach(m => m.animate(time, appState.camera));
    }

    /*
    Animate icons
    */
    Object.values(Icon.iconsByLevel).forEach(levelIcons => {
      levelIcons.forEach(icon => icon.animate(time, appState.camera));
    });
    
    appState.renderer.render(appState.scene, appState.camera);
  }

  animate();
}
