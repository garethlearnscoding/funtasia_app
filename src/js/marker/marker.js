import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BASE = ASSETS_BASE_URL;
const googleMapIconUrl = `${BASE}/icons/google-map-icon.glb`;

export class Marker {
  static appState = null;
  static scene = null;
  static font = null;

  constructor(position, level) {
    this.appState = Marker.appState;
    this.scene = Marker.scene || (this.appState ? this.appState.scene : null);
    
    this.position = position ? position.clone() : new THREE.Vector3();
    this.level = level;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    this.indicator = null; // To be populated by subclasses

    if (this.scene) {
      this.scene.add(this.group);
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
  // Font used to render text labels — set once before instantiation
  static font = null;

  /**
   * @param {THREE.Scene} scene - Scene to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {boolean} text - Whether to include the "You are here!" text label.
   */
  constructor(scene, position, text = false) {
    super();
    this.scene = scene;
    this.markerHeight = 0.8;
    this.group = new THREE.Group();

    // ----- materials -----
    const activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const outlineMaterialActive = new THREE.LineBasicMaterial({ color: 0x550000 });

    // ----- ring -----
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
      this.group.add(this._markerModel);
    });

    // ----- text label group -----
    this._textLabelGroup = null;
    if (text && LocationMarker.font) {
      this._textLabelGroup = new THREE.Group();

      const message = "You are here!";
      const shapes = LocationMarker.font.generateShapes(message, 0.15);
      const geometry = new THREE.ShapeGeometry(shapes);
      geometry.computeBoundingBox();
      const xMid = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
      geometry.translate(xMid, 0, 0);

      const textMaterialActive = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const textMesh = new THREE.Mesh(geometry, textMaterialActive);

      // Padded background behind the text
      const padding = 0.05;
      const bgWidth  = (geometry.boundingBox.max.x - geometry.boundingBox.min.x) + padding * 2;
      const bgHeight = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) + padding * 2;
      const textBgMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const textBgMesh = new THREE.Mesh(new THREE.PlaneGeometry(bgWidth, bgHeight), textBgMaterial);
      textBgMesh.position.z = -0.01;
      textBgMesh.position.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;

      this._textLabelGroup.add(textBgMesh);
      this._textLabelGroup.add(textMesh);
      this._textLabelGroup.position.y = this.markerHeight + 0.4;
      this.group.add(this._textLabelGroup);
    } else if (text && !LocationMarker.font) {
      console.warn("LocationMarker: text=true but LocationMarker.font is not set.");
    }

    if (position) this.group.position.copy(position);
    this.scene.add(this.group);
  }

  /**
   * Updates the marker each frame: floats the GLB model and billboards the text label.
   * Safe to call before the GLB has finished loading — _markerModel is null until then.
   * @param {number} time - Elapsed time in milliseconds (e.g. from requestAnimationFrame).
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group) return;
    const t = time * 0.003;

    // Floating bob + horizontal look-at on the GLB model
    if (this._markerModel) {
      this._markerModel.position.y = this.markerHeight + Math.sin(t * 0.5) * 0.05;

      if (camera) {
        const targetPos = new THREE.Vector3();
        camera.getWorldPosition(targetPos);
        const modelPos = new THREE.Vector3();
        this._markerModel.getWorldPosition(modelPos);
        targetPos.y = modelPos.y; // keep horizontal — no vertical tilt
        this._markerModel.lookAt(targetPos);
      }
    }

    // Billboarding — keep the text label facing the camera
    if (this._textLabelGroup && camera) {
      this._textLabelGroup.quaternion.copy(camera.quaternion);
    }
  }
}
