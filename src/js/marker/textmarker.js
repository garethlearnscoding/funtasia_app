import * as THREE from "three";
import { Marker, FONT_URL } from "@/js/marker/marker.js";
import { Text } from "troika-three-text";

/**
 * BaseTextMarker: Provides common functionality for text-based markers.
 * Handles text mesh creation, background, and billboarding.
 */
export class BaseTextMarker extends Marker {
  constructor(parent, position, text, level, options) {
    super(parent, position, level);
    this.scene = parent || Marker.scene || (this.appState ? this.appState.scene : null);
    this.text = text;

    // Default options, overridden by provided options
    const defaultOptions = {
      markerHeight: 0.4,
      fontSize: 0.15,
      textColor: 0x000000,
      bgColor: 0xffffff,
      bgOpacity: 0.9,
      bgPlaneHeight: 0.25,
      bgPadding: 0.1,
      bgZOffset: -0.01,
    };
    this.options = { ...defaultOptions, ...options };

    this._labelGroup = new THREE.Group();

    const textMesh = new Text();
    textMesh.text = this.text;
    textMesh.fontSize = this.options.fontSize;
    textMesh.font = FONT_URL;
    textMesh.color = this.options.textColor;
    textMesh.anchorX = 'center';
    textMesh.anchorY = 'middle';

    const bgMaterial = new THREE.MeshBasicMaterial({
      color: this.options.bgColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.options.bgOpacity,
    });
    
    // Create background with a unit width so we can scale it easily to the text width
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, this.options.bgPlaneHeight), bgMaterial);
    bgMesh.position.z = this.options.bgZOffset;

    // Sync the text and update background scale based on actual text width
    textMesh.sync(() => {
      if (textMesh.geometry && textMesh.geometry.boundingBox) {
        const width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x;
        bgMesh.scale.x = width + this.options.bgPadding;
      }
    });

    this._labelGroup.add(bgMesh);
    this._labelGroup.add(textMesh);
    this._labelGroup.position.y = this.options.markerHeight;
    this.group.add(this._labelGroup);

    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  /**
   * Updates the marker each frame: billboards the text label.
   * Subclasses should implement their specific visibility logic before calling super.animate().
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group || !camera || !this.group.visible) return;

    if (this._labelGroup) {
      this._labelGroup.quaternion.copy(camera.quaternion);
      this._labelGroup.position.y = this.options.markerHeight;
    }
  }

  clear() {
    if (this.group) {
      if (this.scene) this.scene.remove(this.group);
      this.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.group = null;
    }
    // Subclasses are responsible for removing themselves from static tracking
  }
}

export class TextMarker extends BaseTextMarker {
  static allTextMarkers = []; // Track all instances of TextMarker
  static activeLevel = null;
  static textMarkersByLevel = {};
  static textMarkersVisible = true;

  static state(isVisible) {
    TextMarker.textMarkersVisible = isVisible;
    TextMarker.allTextMarkers.forEach(marker => marker.updateVisibilityAndOpacity());
  }

  // New instance method to update visibility and opacity
  updateVisibilityAndOpacity() {
    const isVisibleLocal = TextMarker.textMarkersVisible && this.level === TextMarker.activeLevel;
    this.group.visible = isVisibleLocal;
    this.updateSyncState(); // Apply parent floor's opacity and final visibility
  }

  /**
   * @param {THREE.Scene} scene - Scene to add the marker to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} name - The text to render.
   * @param {string} level - The level/floor ID this marker belongs to.
   */
  constructor(parent, position, text, level) {
    super(parent, position, text, level, {
      markerHeight: 0.4,
      fontSize: 0.15,
      textColor: 0x000000,
      bgColor: 0xffffff,
      bgOpacity: 0.9,
      bgPlaneHeight: 0.25,
      bgPadding: 0.1,
      bgZOffset: -0.01,
    });

    // Track this instance by its level
    if (!TextMarker.textMarkersByLevel[this.level]) {
      TextMarker.textMarkersByLevel[this.level] = [];
    }
    TextMarker.textMarkersByLevel[this.level].push(this);

    TextMarker.allTextMarkers.push(this);

    // Set initial visibility and opacity
    this.updateVisibilityAndOpacity();
  }

  // Method to set active level
  static setLevel(levelId) {
    TextMarker.activeLevel = levelId;
    TextMarker.allTextMarkers.forEach(marker => marker.updateVisibilityAndOpacity());
  }

  /**
   * Updates the marker each frame: handles TextMarker-specific visibility and calls base class for billboarding.
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    super.animate(time, camera); // Call base class animate for billboarding and opacity sync
  }

  clear() {
    super.clear(); // Clear Three.js resources via BaseTextMarker

    // Remove from the static tracking dictionary
    if (TextMarker.textMarkersByLevel[this.level]) {
      const index = TextMarker.textMarkersByLevel[this.level].indexOf(this);
      if (index > -1) {
        TextMarker.textMarkersByLevel[this.level].splice(index, 1);
      }
    }

    const index = TextMarker.allTextMarkers.indexOf(this);
    if (index > -1) {
      TextMarker.allTextMarkers.splice(index, 1);
    }
  }
}

/**
 * BoothIDMarker: Displays Booth Names (e.g., "Canteen", "LT5") above interactive meshes.
 * Styled with brand colors (Mauve) to distinguish from Location TextMarkers.
 */
export class BoothIDMarker extends BaseTextMarker {
  static allBoothMarkers = []; // Track all instances of BoothIDMarker
  static activeLevel = null; 
  static boothMarkersByLevel = {};
  static boothIDsVisible = true;

  static state(isVisible) {
    BoothIDMarker.boothIDsVisible = isVisible;
    BoothIDMarker.allBoothMarkers.forEach(marker => marker.updateVisibilityAndOpacity());
  }

  // New instance method to update visibility and opacity
  updateVisibilityAndOpacity(camera) {
    const isVisibleLocal = BoothIDMarker.boothIDsVisible && this.level === BoothIDMarker.activeLevel && (this.distance < this.zoomThreshold);
    this.group.visible = isVisibleLocal;
    this.updateSyncState(); // Apply parent floor's opacity and final visibility
  }
  constructor(parent, position, text, level, customOptions = {}) {
    // Default Brand-colored background (Mauve) and text (Base)
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-mauve') || "#cba6f7";
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-base') || "#1e1e2e";
    
    super(parent, position, text, level, {
      markerHeight: 0.05, // Placed very close to the booth surface
      fontSize: 0.0267, // Smaller than location labels
      textColor: Number("0x" + textColor.slice(1)), // Use brand base color
      bgColor: Number("0x" + bgColor.slice(1)), // Default mauve background
      bgOpacity: 0.85,
      bgPlaneHeight: 0.08,
      bgPadding: 0.06,
      bgZOffset: -0.005,
      ...customOptions // Merge custom options, overriding defaults
    });

    if (!BoothIDMarker.boothMarkersByLevel[this.level]) {
      BoothIDMarker.boothMarkersByLevel[this.level] = [];
    }
    BoothIDMarker.boothMarkersByLevel[this.level].push(this);
    BoothIDMarker.allBoothMarkers.push(this);
  }

  static setLevel(levelId) {
    BoothIDMarker.activeLevel = levelId;
    BoothIDMarker.allBoothMarkers.forEach(marker => marker.updateVisibilityAndOpacity(null)); // Pass null for camera as it's not available here
  }

  animate(time, camera) {
    if (!this.group || !camera) return;

    // 1. Zoom-based visibility: only show when the camera is close
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    this.distance = camera.position.distanceTo(worldPos);
    this.zoomThreshold = 7.6; 

    this.updateVisibilityAndOpacity(camera); // Update visibility and opacity based on zoom and parent state

    if (this.group.visible) super.animate(time, camera); // Call base class animate for billboarding
  }

  clear() {
    super.clear(); // Clear Three.js resources via BaseTextMarker

    if (BoothIDMarker.boothMarkersByLevel[this.level]) {
      const index = BoothIDMarker.boothMarkersByLevel[this.level].indexOf(this);
      if (index > -1) BoothIDMarker.boothMarkersByLevel[this.level].splice(index, 1);
    }
    const index = BoothIDMarker.allBoothMarkers.indexOf(this);
    if (index > -1) BoothIDMarker.allBoothMarkers.splice(index, 1);
  }
}
