import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Floor } from "@/js/floor/floor.js";
import { showToast } from "@/js/base/ui.js";

export class QRMarker {
  // Static class attributes initialized in main.js
  static appState = null;
  static font = null;

  constructor(scene, position, font, greyDelay = 5 * 60000) {
    this.scene = scene;
    this.font = font;
    this.markerHeight = 0.8;

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
    loader.load('assets/icons/google-map-icon.glb', (gltf) => {
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
      this.markerModel.position.y = this.markerHeight;
      this.group.add(this.markerModel);
    });

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
      
      this.textLabelGroup.position.y = this.markerHeight + 0.4; // Above the diamond
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
      this.markerModel.position.y = this.markerHeight + Math.sin(t*0.5) * 0.05;
    }
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
    if (this.textMesh) {
      this.textMesh.geometry.dispose();
      if (this.textMaterialActive) this.textMaterialActive.dispose();
    }
    if (this.textBgMesh) {
      this.textBgMesh.geometry.dispose();
      if (this.textBgMaterial) this.textBgMaterial.dispose();
    }
    
    if (this.outlineMaterialActive) this.outlineMaterialActive.dispose();
    if (this.outlineMaterialGrey) this.outlineMaterialGrey.dispose();

    this.ring.material.dispose();
    this.group = null;
  }


}