import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseModel } from "@/js/floor/modelParser.js";
import { Floor } from "@/js/floor/floor.js";

export function loadModels(appState, floorPaths) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const floors = {}; // Will now hold Floor instances
    let loadingCount = 0;
    const totalFloors = Object.keys(floorPaths).length;

    Object.keys(floorPaths).forEach((floorId) => {
      // 1. Instantiate the Floor class before loading
      const floorInstance = new Floor(floorId, floorPaths[floorId]);
      floors[floorId] = floorInstance;

      loader.load(
        floorPaths[floorId],
        (gltf) => {
          // 2. Parse the model
          const result = parseModel(gltf, floorId, appState.scene);
          
          // 3. Attach data to the instance
          floorInstance.attachParsedData(
            result.model, 
            result.interactiveObjects, 
            result.cameraConfig
          );

          console.log(`Loaded ${floorId}: ${result.interactiveObjects.length} interactive meshes.`);
          
          loadingCount++;
          if (loadingCount === totalFloors) {
            console.log("All floors loaded!");
            resolve({ floors }); // Only returning floors now
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
