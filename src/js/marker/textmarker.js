import * as THREE from "three";
import { Marker, FONT_URL } from "@/js/marker/marker.js";
import { Text } from "troika-three-text";

export class TextMarker extends Marker {
  static allTextMarkers = [];
  
  // Track active level to only show text markers for the current level
  static activeLevel = null;

  // Track markers mapped by their level
  static textMarkersByLevel = {};

  // Global visibility flag
  static textMarkersVisible = true;

  /**
   * @param {THREE.Scene} scene - Scene to add the marker to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} name - The text to render.
   * @param {string} level - The level/floor ID this marker belongs to.
   */
  constructor(scene, position, name, level) {
    super(position, level);
    this.scene = scene;
    this.name = name;
    
    // Default marker height above the position
    this.markerHeight = 0.8;

    this._textLabelGroup = new THREE.Group();

    const textMesh = new Text();
    textMesh.text = this.name;
    textMesh.fontSize = 0.15;
    textMesh.font = FONT_URL;
    textMesh.color = 0x000000;
    textMesh.anchorX = 'center';
    textMesh.anchorY = 'middle';
    textMesh.sync();

    // Padded background behind the text
    const bgWidth = 1.2;
    const bgHeight = 0.25;
    const textBgMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const textBgMesh = new THREE.Mesh(new THREE.PlaneGeometry(bgWidth, bgHeight), textBgMaterial);
    textBgMesh.position.z = -0.01;

    this._textLabelGroup.add(textBgMesh);
    this._textLabelGroup.add(textMesh);
    this._textLabelGroup.position.y = this.markerHeight;
    this.group.add(this._textLabelGroup);

    if (this.scene) {
      this.scene.add(this.group);
    }
    
    // Set initial visibility
    this.group.visible = TextMarker.textMarkersVisible && this.level === TextMarker.activeLevel;

    // Track this instance by its level
    if (!TextMarker.textMarkersByLevel[this.level]) {
      TextMarker.textMarkersByLevel[this.level] = [];
    }
    TextMarker.textMarkersByLevel[this.level].push(this);

    TextMarker.allTextMarkers.push(this);
  }

  // Method to set active level
  static setLevel(levelId) {
    TextMarker.activeLevel = levelId;
    TextMarker.updateVisibility();
  }

  // Helper method to sync visibility across instances
  static updateVisibility() {
    Object.keys(TextMarker.textMarkersByLevel).forEach((level) => {
      const isLevelActive = (level === TextMarker.activeLevel);
      TextMarker.textMarkersByLevel[level].forEach((marker) => {
        if (marker.group) {
          marker.group.visible = TextMarker.textMarkersVisible && isLevelActive;
        }
      });
    });
  }

  /**
   * Updates the marker each frame: billboards the text label.
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group) return;

    // Ensure visibility is correct
    const isVisible = TextMarker.textMarkersVisible && this.level === TextMarker.activeLevel;
    this.group.visible = isVisible;

    if (!isVisible) return;

    // Billboarding — keep the text label facing the camera
    if (this._textLabelGroup && camera) {
      this._textLabelGroup.quaternion.copy(camera.quaternion);
      this._textLabelGroup.position.y = this.markerHeight;
    }
  }

  clear() {
    if (this.group) {
      if (this.scene) {
        this.scene.remove(this.group);
      }

      this.group.traverse((child) => {
        if (child.isMesh || child.isLine || child.isLineSegments) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });

      this.group = null;
    }

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
