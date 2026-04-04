import * as THREE from "three";

import liftIcon from "@/assets/icons/lift.png";
import stairUIcon from "@/assets/icons/stair-u.png";
import stairDIcon from "@/assets/icons/stair-d.png";
import stairUDIcon from "@/assets/icons/stair-ud.png";
import mtoiletIcon from "@/assets/icons/mtoilet.png";
import ftoiletIcon from "@/assets/icons/ftoilet.png";
import atoiletIcon from "@/assets/icons/atoilet.png";

export class Icon {
  // Static class attributes initialized in main.js
  static appState = null;

  // Class attribute dictionary matching icontype to file path
  // The path points to a folder in assets called icon
  static iconPaths = {
    'lift': liftIcon,
    'stair-u': stairUIcon,
    'stair-d': stairDIcon,
    'stair-ud': stairUDIcon,
    'mtoilet': mtoiletIcon,
    'ftoilet': ftoiletIcon,
    'atoilet': atoiletIcon
  };

  // State flag for all icons visibility
  static iconsVisible = true;
  
  // Track active level to only show icons for the current level
  static activeLevel = null;

  // Track all instances to easily update visibility later
  static allIcons = [];

  // Static scene to be set once
  static scene = null;

  constructor(type, position, level) {
    this.icontype = type;
    
    this.iconPath = Icon.iconPaths[this.icontype]; 

    this.position = position.clone();
    this.level = level;

    this.group = new THREE.Group();

    // Use TextureLoader to load high quality PNGs
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(this.iconPath);
    
    // High-quality texture settings
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16; 

    // Using SpriteMaterial / Sprite so the icon always faces the camera (billboarding)
    // similar to the text in marker.js
    this.material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: true // Enable depth test so it can be occluded by walls, or set false to see through walls
    });

    this.sprite = new THREE.Sprite(this.material);
    this.baseScale = 0.8;
    this.sprite.scale.set(this.baseScale, this.baseScale, this.baseScale);
    
    // Elevate icon slightly above floor level
    this.sprite.position.y = 0.5; 

    this.group.add(this.sprite);
    this.group.position.copy(this.position);
    if (Icon.appState && Icon.appState.scene) {
      Icon.appState.scene.add(this.group);
    } else {
      console.warn("Icon.appState.scene is not set. Icon group not added to scene.");
    }

    // Apply the current global visibility state
    this.group.visible = Icon.iconsVisible && this.level === Icon.activeLevel;

    // Track this instance for collective updates
    Icon.allIcons.push(this);
  }

  // Class method to control visibility state of all icons
  static state(isVisible) {
    Icon.iconsVisible = isVisible;
    Icon.updateVisibility();
  }

  // Method to set active level
  static setLevel(levelId) {
    Icon.activeLevel = levelId;
    Icon.updateVisibility();
  }

  // Helper method to sync visibility across instances
  static updateVisibility() {
    for (const icon of Icon.allIcons) {
      if (icon.group) {
        icon.group.visible = Icon.iconsVisible && icon.level === Icon.activeLevel;
      }
    }
  }

  // Animate method to handle dynamic scaling
  animate(time, camera) {
    if (!this.group) return;

    // Calculate distance and update scale
    const worldPos = new THREE.Vector3();
    this.sprite.getWorldPosition(worldPos);
    const distance = camera.position.distanceTo(worldPos);
    
    const factor = 0.08; 
    const targetScale = distance * factor;
    
    // Constraints:
    // 1. Zoom out: Cap at original size
    const finalScale = Math.min(this.baseScale, targetScale);
    
    // 2. Zoom in: Hide if less than a quarter of original size
    const isVisible = finalScale >= (this.baseScale / 4.5) && Icon.iconsVisible && this.level === Icon.activeLevel;
    
    this.group.visible = isVisible;
    if (isVisible) {
      this.sprite.scale.set(finalScale, finalScale, 1);
    }
  }

  // Cleanup to prevent memory leaks, similar to marker.js
  clear() {
    if (Icon.appState && Icon.appState.scene) {
      Icon.appState.scene.remove(this.group);
    }

    if (this.material) {
      if (this.material.map) this.material.map.dispose();
      this.material.dispose();
    }

    // Remove from the static tracking array
    const index = Icon.allIcons.indexOf(this);
    if (index > -1) {
      Icon.allIcons.splice(index, 1);
    }

    this.group = null;
  }
}
