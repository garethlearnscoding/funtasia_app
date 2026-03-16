import * as THREE from "three";
import { Floor } from "./floor.js";

export class QRMarker {

  constructor(scene, position, greyDelay = 10000) {

    this.scene = scene;

    this.group = new THREE.Group();

    // ----- materials -----
    this.activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.greyMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });

    // ----- ring -----
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.5, 32),
      this.activeMaterial
    );
    this.ring.rotation.x = -Math.PI / 2;

    // ----- cone -----
    this.cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.4, 4),
      this.activeMaterial
    );
    this.cone.rotation.x = Math.PI;
    this.cone.position.y = 0.6;

    this.group.add(this.ring);
    this.group.add(this.cone);

    // position above QR
    this.group.position.copy(position);
    this.group.position.y += 1;

    this.scene.add(this.group);

    this.startTime = performance.now();
    this.greyDelay = greyDelay;

    this.isGrey = false;
  }

  animate(time) {

    if (!this.group) return;

    const t = time * 0.003;

    // floating cone only
    this.cone.position.y = 0.6 + Math.sin(t) * 0.05;

    // spinning
    this.cone.rotation.y += 0.02;

    // grey-out timer
    if (!this.isGrey && time - this.startTime > this.greyDelay) {
      this.greyOut();
    }
  }

  greyOut() {
    this.ring.material = this.greyMaterial;
    this.cone.material = this.greyMaterial;
    this.isGrey = true;
  }

  clear() {
    this.scene.remove(this.group);

    this.ring.geometry.dispose();
    this.cone.geometry.dispose();

    this.ring.material.dispose();
    this.cone.material.dispose();

    this.group = null;
  }

  static handleQRID(qrID, scene, camera, controls, appState) {
    const markerInfo = Floor.allMarkers[qrID];
    if (!markerInfo) {
      console.warn(`Marker ${qrID} not found.`);
      return;
    }

    // Store in appState for persistence across floor switches
    appState.lastScannedInfo = {
      id: qrID,
      floorId: markerInfo.floorId,
      pos: markerInfo.pos,
      startTime: performance.now()
    };

    // Trigger floor switch
    Floor.switchFloor(markerInfo.floorId, appState, camera, controls);

    // Floor.switchFloor clears activeMarkers, so we add the new one back
    // (Floor.switchFloor logic in main.js might also handle this, but handleQRID owns the specific scan)
    const marker = new QRMarker(scene, markerInfo.pos);
    appState.activeMarkers = [marker]; // Ensure it's the only one

    // Camera animation logic (matching util.js pattern)
    const markerCenter = markerInfo.pos.clone().add(new THREE.Vector3(0, 1, 0));
    
    const camPos = camera.position.clone();
    const direction = new THREE.Vector3().subVectors(camPos, controls.target);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();

    // Specific offsets for markers
    const distance = 8; 
    const heightOffset = 6;
    
    const newCamPos = markerCenter.clone()
      .add(direction.multiplyScalar(distance))
      .add(new THREE.Vector3(0, heightOffset, 0));

    appState.cameraAnim.controlsTarget.copy(markerCenter);
    appState.cameraAnim.cameraTarget.copy(newCamPos);
    appState.cameraAnim.active = true;
  }
}