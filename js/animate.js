

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
    
    // Animate markers
    if (appState.activeMarkers) {
      const time = performance.now();
      appState.activeMarkers.forEach(m => m.animate(time));
    }

    renderer.render(scene, camera);
  }

  animate();
}
