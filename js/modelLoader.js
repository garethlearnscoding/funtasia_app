import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseModel } from "./modelParser.js";

export function loadModels(scene, camera, controls, floorPaths) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const floors = {};
    const floorObjects = {};
    let loadingCount = 0;
    const totalFloors = Object.keys(floorPaths).length;

    Object.keys(floorPaths).forEach((floorId) => {
      loader.load(
        floorPaths[floorId],
        (gltf) => {
          const result = parseModel(gltf, floorId, scene, camera, controls);
          floors[floorId] = result.model;
          floorObjects[floorId] = result.interactiveObjects;
          console.log(`Loaded ${floorId}: ${result.interactiveObjects.length} interactive meshes.`);
          
          loadingCount++;
          if (loadingCount === totalFloors) {
            console.log("All floors loaded!");
            resolve({ floors, floorObjects });
          }
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading ${floorId}: ${percentComplete.toFixed(1)}%`);
          }
        },
        (error) => {
          console.error(`Error loading ${floorId}:`, error);
        },
      );
    });
  });
}
