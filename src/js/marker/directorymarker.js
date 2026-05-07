import * as THREE from "three";
import { LocationMarker, Marker } from "./marker.js";
import { Floor } from "@/js/floor/floor.js";

export class DirectoryMarker extends LocationMarker {
  constructor(position, level) {
    const floor = Floor.floors[level];
    // Use the sceneModel so the marker moves vertically 
    // and changes opacity with the floor
    const parent = floor ? floor.sceneModel : null;
    
    super(parent, position, level, false, false); // parent, position, level, text, showRing
    this.level = level;
  }
}
