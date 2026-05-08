import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Text, preloadFont } from "troika-three-text";

const BASE = ASSETS_BASE_URL;
const googleMapIconUrl = `${BASE}/icons/google-map-icon.glb`;

export const FONT_URL = "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/ttf/JetBrainsMono-Regular.ttf";
preloadFont({ font: FONT_URL }, () => {});

export class Marker {
  static appState = null;
  static scene = null;

  constructor(parent, position, level) {
    this.appState = Marker.appState;
    this.parent = parent || Marker.scene || (this.appState ? this.appState.scene : null);
    
    this.position = position ? position.clone() : new THREE.Vector3();
    this.level = level;

    this.group = new THREE.Group();
    
    if (this.parent && this.parent.type !== 'Scene') {
      // Convert world position to local position. 
      // To prevent the marker from being "offset" by current floor animations,
      // we add the parent's current Y displacement back into the result.
      // This effectively calculates the position relative to the "rest" floor height.
      const localPos = this.parent.worldToLocal(this.position.clone());
      localPos.y += this.parent.position.y; 
      this.group.position.copy(localPos);
      this.parent.updateMatrixWorld(true);
    } else {
      this.group.position.copy(this.position);
    }

    this.indicator = null; // To be populated by subclasses

    if (this.parent) {
      this.parent.add(this.group);
    }
  }

  /**
   * Synchronizes the marker's visibility and opacity with its parent floor.
   * This is modular and can be called by any subclass (TextMarker, Icon, etc.)
   */
  updateSyncState() {
    if (!this.group || !this.parent || this.parent.type === 'Scene') return;

    const targetOpacity = this.parent.userData.currentOpacity ?? 1.0;
    this.group.visible = targetOpacity > 0.01;
    
    // Only apply opacity if the group is currently visible (either by its own rules or parent's)
    if (this.group.visible) {
      if (this._materials) {
        this._materials.forEach(m => {
          // Maintain slight transparency for backgrounds if they had it originally
          const baseOpacity = (m.opacity < 1 && m.opacity > 0) ? m.opacity : 1.0;
          m.opacity = targetOpacity * baseOpacity;
        });
      }
      if (this._textMesh) {
        this._textMesh.fillOpacity = targetOpacity;
      }
    }
  }

  clear() {
    if (this.scene) {
      this.scene.remove(this.group);
    }
    
    // Subclasses should handle disposing geometries and materials of `this.indicator`
    this.group = null;
  }
}

export class LocationMarker extends Marker {
  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} level - The floor/level the marker belongs to.
   * @param {boolean} text - Whether to include the "You are here!" text label.
   * @param {boolean} showRing - Whether to show the base ring.
   */
  constructor(parent, position, level, text = false, showRing = true) {
    super(parent, position, level); // Base class handles positioning and parenting
    
    // Use the existing group created by super()
    this.scene = this.parent;
    this.markerHeight = 0.8;

    // ----- materials -----
    const activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });
    const outlineMaterialActive = new THREE.LineBasicMaterial({ color: 0x550000, transparent: true });
    this._materials = [activeMaterial, outlineMaterialActive];

    // ----- ring -----
    if (showRing) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.11, 0.14, 32),
        activeMaterial
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;

      const ringEdges = new THREE.EdgesGeometry(ring.geometry);
      const ringOutline = new THREE.LineSegments(ringEdges, outlineMaterialActive);
      ring.add(ringOutline);
      this.group.add(ring);
    }

    // ----- 3D Model -----
    // Stored on the instance so animate() can reference it after the async load
    this._markerModel = null;
    const loader = new GLTFLoader();
    loader.load(googleMapIconUrl, (gltf) => {
      this._markerModel = gltf.scene;

      this._markerModel.traverse((child) => {
        if (child.isMesh) {
          child.material = activeMaterial;
          const edges = new THREE.EdgesGeometry(child.geometry, 60);
          const outline = new THREE.LineSegments(edges, outlineMaterialActive);
          child.add(outline);
        }
      });

      const scale = 10;
      this._markerModel.scale.set(scale, scale, scale);
      this._markerModel.position.y = this.markerHeight;
      
      // Safety check: if the marker was cleared before the model finished loading
      if (this.group) {
        this.group.add(this._markerModel);
      }
    });

    // ----- text label group -----
    this._textLabelGroup = null;
    if (text) {
      this._textLabelGroup = new THREE.Group();

      const textMesh = new Text();
      textMesh.text = "You are here!";
      textMesh.fontSize = 0.15;
      textMesh.font = FONT_URL;
      textMesh.color = 0xff0000;
      textMesh.anchorX = 'center';
      textMesh.anchorY = 'middle';
      textMesh.sync();
      this._textMesh = textMesh;

      // Padded background behind the text
      // Fixed size for "You are here!" at 0.15 fontSize
      const bgWidth  = 1.2;
      const bgHeight = 0.25;
      const textBgMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      this._materials.push(textBgMaterial);
      const textBgMesh = new THREE.Mesh(new THREE.PlaneGeometry(bgWidth, bgHeight), textBgMaterial);
      textBgMesh.position.z = -0.01;

      this._textLabelGroup.add(textBgMesh);
      this._textLabelGroup.add(textMesh);
      this._textLabelGroup.position.y = this.markerHeight + 0.4;
      this.group.add(this._textLabelGroup);
    }
  }

  /**
   * Updates the marker each frame: floats the GLB model and billboards the text label.
   * Safe to call before the GLB has finished loading — _markerModel is null until then.
   * @param {number} time - Elapsed time in milliseconds (e.g. from requestAnimationFrame).
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group) return;

    // Modular sync: No Floor import needed!
    this.updateSyncState();

    const t = time * 0.003;
    // Calculate shared bobbing offset for cohesive animation
    const bobOffset = Math.sin(t * 0.5) * 0.05;

    // Floating bob + horizontal look-at on the GLB model
    if (this._markerModel) {
      this._markerModel.position.y = this.markerHeight + bobOffset;

      if (camera) {
        const targetPos = new THREE.Vector3();
        camera.getWorldPosition(targetPos);
        const modelPos = new THREE.Vector3();
        this._markerModel.getWorldPosition(modelPos);
        targetPos.y = modelPos.y; // keep horizontal — no vertical tilt
        this._markerModel.lookAt(targetPos);
      }
    }

    // Billboarding — keep the text label facing the camera + apply bobbing
    if (this._textLabelGroup && camera) {
      this._textLabelGroup.quaternion.copy(camera.quaternion);
      this._textLabelGroup.position.y = (this.markerHeight + 0.4) + bobOffset;
    }
  }
}
