import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Floor } from "./floor.js";
import { showToast } from "./ui.js";
// import { TextGeometry }  from 'three/addons/geometries/TextGeometry.js';

export class QRMarker {

  constructor(scene, position, font, greyDelay = 5 * 60000) {
    this.scene = scene;
    this.font = font;
    this.coneHeight = 0.8;

    this.group = new THREE.Group();

    // ----- materials -----
    this.activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.greyMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
    this.outlineMaterialActive = new THREE.LineBasicMaterial({ color: 0x550000});

    // ----- ring -----
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.14, 32),
      this.activeMaterial
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;

    const ring_edges = new THREE.EdgesGeometry(this.ring.geometry);
    this.ringOutline = new THREE.LineSegments(ring_edges, this.outlineMaterialActive);
    this.ring.add(this.ringOutline);

    // ----- 3D Model for marker (temporary) -----
    const loader = new GLTFLoader();
    this.markerModel = null;
    loader.load('misc/google-map-icon.glb', (gltf) => {
      this.markerModel = gltf.scene;
      
      // Apply activeMaterial and add outlines to all meshes in the model
      this.markerModel.traverse((child) => {
        if (child.isMesh) {
          child.material = this.activeMaterial;
          
          const edges = new THREE.EdgesGeometry(child.geometry,60);
          const outline = new THREE.LineSegments(edges, this.outlineMaterialActive);
          child.add(outline);
        }
      });

      // Adjust scale and rotation as needed
      const scale = 10;
      this.markerModel.scale.set(scale, scale, scale); 
      this.markerModel.position.y = this.coneHeight;
      this.group.add(this.markerModel);
    });

    /* Original diamond (two flipped cones) commented out
    this.diamondGroup = new THREE.Group();
    const radius = 0.1
    const height = 0.2
    const coneGeom = new THREE.ConeGeometry(radius, height, 4); // 4 radial segments for a square base
    
    // Bottom cone
    this.bottomCone = new THREE.Mesh(coneGeom, this.activeMaterial);
    this.bottomCone.rotation.x = Math.PI;
    this.bottomCone.position.y = -height/2; // Shift down by half height
    
    const cone_edges = new THREE.EdgesGeometry(coneGeom);
    this.coneOutline = new THREE.LineSegments(cone_edges, this.outlineMaterialActive);
    this.bottomCone.add(this.coneOutline);

    // Top cone
    this.topCone = new THREE.Mesh(coneGeom, this.activeMaterial);
    this.topCone.position.y = height/2; // Shift up by half height
    
    const top_cone_edges = new THREE.EdgesGeometry(coneGeom);
    this.topConeOutline = new THREE.LineSegments(top_cone_edges, this.outlineMaterialActive);
    this.topCone.add(this.topConeOutline);

    this.diamondGroup.add(this.bottomCone);
    this.diamondGroup.add(this.topCone);
    
    this.diamondGroup.position.y = this.coneHeight;
    */

    // ----- text label group -----
    if (this.font) {
      this.textLabelGroup = new THREE.Group();
      
      const message = "You are here!";
      const shapes = this.font.generateShapes(message, 0.15);
      const geometry = new THREE.ShapeGeometry(shapes);
      geometry.computeBoundingBox();
      const xMid = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
      geometry.translate(xMid, 0, 0);

      this.textMaterialActive = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });

      this.textMesh = new THREE.Mesh(geometry, this.textMaterialActive);
      
      // Background for text
      const padding = 0.05;
      const bgWidth = (geometry.boundingBox.max.x - geometry.boundingBox.min.x) + padding * 2;
      const bgHeight = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) + padding * 2;
      const bgGeom = new THREE.PlaneGeometry(bgWidth, bgHeight);
      this.textBgMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      this.textBgMesh = new THREE.Mesh(bgGeom, this.textBgMaterial);
      
      // Position BG behind text and centered
      this.textBgMesh.position.z = -0.01;
      this.textBgMesh.position.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;

      this.textLabelGroup.add(this.textBgMesh);
      this.textLabelGroup.add(this.textMesh);
      
      this.textLabelGroup.position.y = this.coneHeight + 0.4; // Above the diamond
      this.group.add(this.textLabelGroup);
    }

    this.group.add(this.ring);
    // this.group.add(this.diamondGroup);

    this.group.position.copy(position);
    this.scene.add(this.group);

    this.startTime = performance.now();
    this.greyDelay = greyDelay;
    this.isGrey = false;
  }

  animate(time, camera) {
    if (!this.group) return;

    const t = time * 0.003;

    // floating effect
    if (this.markerModel) {
      this.markerModel.position.y = this.coneHeight + Math.sin(t*0.5) * 0.05;
      // this.markerModel.rotation.y += 0.01;
    }

    /* 
    // floating diamond only
    this.diamondGroup.position.y = this.coneHeight + Math.sin(t*0.5) * 0.05;

    // spinning
    this.diamondGroup.rotation.y += 0.01;
    */

    // Bob text with diamond
    // if (this.textLabelGroup) {
    //   this.textLabelGroup.position.y = this.coneHeight + 0.4 + Math.sin(t*0.5) * 0.05;
    // }

    // Billboarding text
    if (this.textLabelGroup && camera) {
      this.textLabelGroup.quaternion.copy(camera.quaternion);
    }
    if (this.markerModel && camera) {
      // Create a target point at camera level, but same height as model
      const targetPos = new THREE.Vector3();
      camera.getWorldPosition(targetPos);
      
      const modelPos = new THREE.Vector3();
      this.markerModel.getWorldPosition(modelPos);
      
      targetPos.y = modelPos.y; // Keep target at same horizontal height
      this.markerModel.lookAt(targetPos);
    }

    // grey-out timer
    if (!this.isGrey && time - this.startTime > this.greyDelay) {
      this.greyOut();
    }
  }

  greyOut() {
    this.ring.material = this.greyMaterial;
    this.bottomCone.material = this.greyMaterial;
    this.topCone.material = this.greyMaterial;
    
    if (this.markerModel) {
      this.markerModel.traverse((child) => {
        if (child.isMesh) {
          child.material = this.greyMaterial;
        } else if (child.isLine || child.isLineSegments) {
          child.material = this.outlineMaterialGrey;
        }
      });
    }

    if (this.textLabelGroup) {
      this.group.remove(this.textLabelGroup);
    }
    this.outlineMaterialGrey = new THREE.LineBasicMaterial({ color: 0x333333 });
    if (this.coneOutline) {
      this.coneOutline.material = this.outlineMaterialGrey;
    }
    if (this.topConeOutline) {
      this.topConeOutline.material = this.outlineMaterialGrey;
    }
    this.isGrey = true;
  }

  clear() {
    this.scene.remove(this.group);

    this.ring.geometry.dispose();
    this.bottomCone.geometry.dispose();
    this.topCone.geometry.dispose();
    if (this.textMesh) {
      this.textMesh.geometry.dispose();
      if (this.textMaterialActive) this.textMaterialActive.dispose();
    }
    if (this.textBgMesh) {
      this.textBgMesh.geometry.dispose();
      if (this.textBgMaterial) this.textBgMaterial.dispose();
    }
    if (this.coneOutline) {
      this.coneOutline.geometry.dispose();
    }
    if (this.topConeOutline) {
      this.topConeOutline.geometry.dispose();
    }
    
    if (this.outlineMaterialActive) this.outlineMaterialActive.dispose();
    if (this.outlineMaterialGrey) this.outlineMaterialGrey.dispose();

    this.ring.material.dispose();
    this.bottomCone.material.dispose();
    this.topCone.material.dispose();

    this.group = null;
  }

  static handleQRID(qrID, scene, camera, controls, appState, font) {
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
    const marker = new QRMarker(scene, markerInfo.pos, font);
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

  static handleURLQR(scene, camera, controls, appState, switchFloorCb, font) {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      const handled = QRMarker.handleQRID(qrID, scene, camera, controls, appState, font);
      if (handled) return;

      // Unhandled: meaning the marker wasn't found
      showToast(`Marker "${qrID}" not found.`);
    }
    const defaultFloorId = "l1";
    switchFloorCb(defaultFloorId);
  }
}