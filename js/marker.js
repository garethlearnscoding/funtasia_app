import * as THREE from "three";
import { Floor } from "./floor.js";
import { showToast } from "./ui.js";

export class QRMarker {

  constructor(scene, position, greyDelay = 5*60000) {
    this.scene = scene;

    this.group = new THREE.Group();

    // ----- materials -----
    this.activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.greyMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
    this.outlineMaterialActive = new THREE.LineBasicMaterial({ color: 0x550000 });
    // ----- ring -----
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.14, 32),
      this.activeMaterial
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02; // Slightly above floor

    const ring_edges = new THREE.EdgesGeometry(this.ring.geometry);
    this.ringOutline = new THREE.LineSegments(ring_edges, this.outlineMaterialActive);
    this.ring.add(this.ringOutline);
    // ----- cone -----
    const coneGeom = new THREE.ConeGeometry(0.1, 0.4, 4);
    this.cone = new THREE.Mesh(
      coneGeom,
      this.activeMaterial
    );
    
    // Create an outline for the cone to make it more visible
    const cone_edges = new THREE.EdgesGeometry(coneGeom);
    this.coneOutline = new THREE.LineSegments(cone_edges, this.outlineMaterialActive);
    this.cone.add(this.coneOutline);

    this.cone.rotation.x = Math.PI;
    this.cone.position.y = 1.3; // Float above floor

    this.group.add(this.ring);
    this.group.add(this.cone);

    // position at QR
    this.group.position.copy(position);

    this.scene.add(this.group);

    this.startTime = performance.now();
    this.greyDelay = greyDelay;

    this.isGrey = false;
  }

  animate(time) {

    if (!this.group) return;

    const t = time * 0.003;

    // floating cone only
    this.cone.position.y = 1.3 + Math.sin(t) * 0.05;

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
    if (this.coneOutline) {
      this.outlineMaterialGrey = new THREE.LineBasicMaterial({ color: 0x333333 });
      this.coneOutline.material = this.outlineMaterialGrey;
    }
    this.isGrey = true;
  }

  clear() {
    this.scene.remove(this.group);

    this.ring.geometry.dispose();
    this.cone.geometry.dispose();
    if (this.coneOutline) {
      this.coneOutline.geometry.dispose();
      if (this.outlineMaterialActive) this.outlineMaterialActive.dispose();
      if (this.outlineMaterialGrey) this.outlineMaterialGrey.dispose();
    }

    this.ring.material.dispose();
    this.cone.material.dispose();

    this.group = null;
  }

  static handleQRID(qrID, scene, camera, controls, appState) {
    const markerInfo = Floor.allMarkers[qrID];
    if (!markerInfo) {
      console.warn(`Marker ${qrID} not found.`);
      return false;
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

    return true;
  }

  static handleURLQR(scene, camera, controls, appState, switchFloorCb) {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      const handled = QRMarker.handleQRID(qrID, scene, camera, controls, appState);
      if (handled) return;

      // Unhandled: meaning the marker wasn't found
      showToast(`Marker "${qrID}" not found.`);
    }
    const defaultFloorId = "l1";
    switchFloorCb(defaultFloorId);
  }
}