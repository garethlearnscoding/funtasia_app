import * as THREE from "three";
import { Icon } from "@/js/marker/icon.js";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";

function getColor(colorName, defaultColor) {
  const documentStyle = getComputedStyle(document.documentElement);
  let colorString = documentStyle.getPropertyValue(colorName)
  if (colorString) {
    return Number("0x" + colorString.slice(1))
  } else {
    return defaultColor
  }
}

const miscSchema = {
  "BASE":      ['--color-ctp-base', 0x1e1e2e],
  "DRIVE":     ['--color-ctp-surface2', 0xa5ccd1],
  "FOOT":      ['--color-ctp-flamingo', 0xe6c19f],
  "GRASS":     ['--color-ctp-green-900', 0x9dcb6f],
  "NONOBJECT": ['--color-ctp-flamingo-950', 0xc1c3c7],
  "FTOILET":   ['--color-ctp-pink', 0xff8afe],
  "MTOILET":   ['--color-ctp-lavender', 0x1b17eb],
  "ATOILET":   ['--color-ctp-sky', 0x5ce1e6],
  "LIFT":      ['--colot-ctp-overlay1', 0xb0b0b0],
};

const zoneSchema = {
  "NONE":   ['--color-ctp-rosewater-700', 0xffe5e7],
  "GREEN":  ['--color-ctp-green-300', 0x00ff00],
  "BLUE":   ['--color-ctp-blue-600', 0x0066ff],
  "ORANGE": ['--color-ctp-peach-400', 0xfab387],
  "PURPLE": ['--color-ctp-mauve', 0x9900ff],
  "YELLOW": ['--color-ctp-yellow', 0xf9e2af],
  "RED":    ['--color-ctp-red', 0xf38ba8],
};

// Maps for runtime color lookup, initialized with static colors.
export const miscColours = { "MARKER": 0xffffff, "STAIRCASE": 0xffffff };
export const zoneColours = {};

// Helper to update color maps from schemas.
function refreshPalette(target, schema) {
  for (const [key, [cssVar, fallback]] of Object.entries(schema)) {
    target[key] = getColor(cssVar, fallback);
  }
}

// Re-reads CSS variables and updates the color dictionaries.
export function updateThemeColors() {
  refreshPalette(miscColours, miscSchema);
  refreshPalette(zoneColours, zoneSchema);
}

// Update theme colors immediately on module load
updateThemeColors();

// Updates the Three.js scene background and all mesh materials to match the current theme.
export function applyThemeToScene(appState) {
  updateThemeColors();

  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-base');
  if (bgColor && appState.scene) appState.scene.background.set(bgColor);

  appState.scene.traverse((child) => {
    if (child.isMesh && child.userData.ROLE) {
      const role = child.userData.ROLE;
      let colorVal;

      if (role === "OBJECT") {
        colorVal = zoneColours[child.userData.ZONE || "NONE"];
        if (child.name.endsWith("_2")) {
          const c = new THREE.Color(colorVal);
          c.multiplyScalar(1.2);
          colorVal = c.getHex();
        }
      } else {
        colorVal = miscColours[role] !== undefined ? miscColours[role] : 0xc1c3c7;
      }

      if (child.userData.material) child.userData.material.color.set(colorVal);
      
      if (child.material) {
        if (child.material === child.userData.material) {
          child.material.color.set(colorVal);
        } else {
          // If currently highlighted, update the highlight color as well
          const highlightColor = new THREE.Color(colorVal).multiplyScalar(2);
          child.material.color.copy(highlightColor);
        }
      }
    }
  });
}

let skybox = null;
let maxRadius = 0;

export function parseModel(gltf, floorId, scene, funtasiaData) {
  const roledict = {
    "ATOILET": "atoilet",
    "MTOILET": "mtoilet",
    "FTOILET": "ftoilet",
    "LIFT": "lift",
    "STAIRCASE": "staircase"
  };
  const model = gltf.scene;
  model.visible = false;
  scene.add(model);

  let box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  box = new THREE.Box3().setFromObject(model);
  const sizeVec = box.getSize(new THREE.Vector3());
  const radius = sizeVec.length() * 0.5;
  maxRadius = Math.max(maxRadius, radius);

  if (!skybox) {
    const skyGeo = new THREE.BoxGeometry(1000, 1000, 1000);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
    });
    skybox = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skybox);
  }

  const cameraConfig = {
    initialPosition: new THREE.Vector3(0, radius * 1, radius * 1),
    target: new THREE.Vector3(0, 0, 0),
    minDistance: radius * 0.06,
    maxDistance: radius * 3,
    near: radius / 1000,
    far: Math.max(radius * 10000, 2000), // Ensure at least default far
  };

  const objects = [];
  model.updateMatrixWorld(true);

  model.traverse((child) => {
    let isSplitChild = false;
    let logicalNode = child;

    // Resolve userData from parent Group for split meshes
    if (child.isMesh && (child.name.endsWith("_1") || child.name.endsWith("_2")) && child.parent) {
      isSplitChild = true;
      logicalNode = child.parent;
      if (Object.keys(child.userData).length === 0 && logicalNode.userData) {
        Object.assign(child.userData, logicalNode.userData);
      }
      child.userData.logicalParent = logicalNode;
    }

    if (child.userData.ROLE === undefined) return;

    const isInteractive = child.userData?.ROLE === "OBJECT";
    if (child.userData.ZONE == undefined) { child.userData.ZONE = "NONE"; }

    if (!isInteractive) {
      if (child.isMesh) {
        const isGrey = child.userData.ROLE === "GREY";
        const colorVal = miscColours[child.userData.ROLE] !== undefined ? miscColours[child.userData.ROLE] : 0xc1c3c7;
        child.material = new THREE.MeshBasicMaterial({
          color: colorVal,
          transparent: isGrey ? true : false,
          opacity: isGrey ? 0 : 1,
        });
      }

      // Only register abstract objects like Markers and Icons at the logical node level
      // to avoid double registration for split meshes.
      if (!isSplitChild) {
        // Register Markers globally
        if (child.userData.ROLE === "MARKER") {
          const markerId = String(child.userData.MARKERID);
          const pos = child.getWorldPosition(new THREE.Vector3());
          const entry = { pos, floorId };
          Floor.allMarkers[markerId] = entry;
          QRMarker.allMarkers[markerId] = entry;
        }

        // Collect Icons
        if (Object.keys(roledict).includes(child.userData.ROLE)) {
          let normalisedRole = roledict[child.userData.ROLE];
          if (normalisedRole === "staircase") {
            switch(child.userData?.STAIRCASEDIRECTION){
              case "U":
                normalisedRole = "stair-u";
                break;
              case "D":
                normalisedRole = "stair-d";
                break;
              case "UD":
                normalisedRole = "stair-ud";
                break;
              default:
                normalisedRole = "stair-ud";
                break;
            }
          }
          if (normalisedRole) {
            const pos = child.getWorldPosition(new THREE.Vector3());
            new Icon(normalisedRole, pos, floorId);
          }
        }
      }
    } else {
      if (child.isMesh) {
        let colorVal = zoneColours[child.userData.ZONE];

        // Derived brightened top colour for `_2` meshes
        if (child.name.endsWith("_2")) {
          const baseColor = new THREE.Color(colorVal);
          baseColor.multiplyScalar(1.2);
          baseColor.r = Math.min(1.0, baseColor.r);
          baseColor.g = Math.min(1.0, baseColor.g);
          baseColor.b = Math.min(1.0, baseColor.b);
          colorVal = baseColor.getHex();
        }

        child.material = new THREE.MeshBasicMaterial({
          color: colorVal,
        });
        child.userData.material = child.material;
      }
    }

    if (!isInteractive) return;
    if (child.userData.ZONE === "NONE") return;

    if (!logicalNode.name || logicalNode.name === "") {
      logicalNode.name = `${floorId}_Object_${objects.length + 1}`;
    }

    if (funtasiaData && funtasiaData[floorId] && funtasiaData[floorId][logicalNode.name]) {
        const entry = funtasiaData[floorId][logicalNode.name];
        if (entry["Booth Name"] && entry["Booth Name"] !== "-") {
            logicalNode.name = entry["Booth Name"];
        }
        if (entry["Booth Description"]) {
            logicalNode.userData.boothDescription = entry["Booth Description"];
        }
        entry["Location"] = logicalNode.getWorldPosition(new THREE.Vector3());
    }

    if (Floor.childModels && Floor.childModels[logicalNode.name]) {
      logicalNode.userData.child = Floor.childModels[logicalNode.name];
    }

    if (!objects.includes(logicalNode)) {
      objects.push(logicalNode);
    }
  });
  
  return { model, interactiveObjects: objects, cameraConfig };
}
