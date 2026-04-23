import * as THREE from "three";
import { LocationMarker, Marker } from "./marker.js";

export class DirectoryMarker extends LocationMarker {
  constructor(position, level) {
    const scene = Marker.scene || (Marker.appState ? Marker.appState.scene : null);
    super(scene, position, false, false); // scene, position, text, showRing
    this.level = level;
  }
}
