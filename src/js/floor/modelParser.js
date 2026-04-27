import * as THREE from "three";
import { Icon } from "@/js/marker/icon.js";
import { Floor } from "@/js/floor/floor.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { addPathNode, addStaircaseNode, addLiftNode, addMarkerNode, autoConnectNodes, addManualLink } from "@/js/pathfinding/pathfinding.js";

function getColor(colorName) {
  const documentStyle = getComputedStyle(document.documentElement);
  let colorString = documentStyle.getPropertyValue(colorName);
  return Number("0x" + colorString.slice(1))
}

const miscSchema = {
  "BASE":      '--color-ctp-surface0',
  "DRIVE":     '--color-ctp-surface2',
  "FOOT":      '--color-ctp-flamingo',
  "GRASS":     '--color-ctp-green-900',
  "NONOBJECT": '--color-ctp-flamingo-950',
  "FTOILET":   '--color-ctp-pink',
  "MTOILET":   '--color-ctp-lavender',
  "ATOILET":   '--color-ctp-sky',
  "LIFT":      '--colot-ctp-overlay1',
};

const zoneSchema = {
  "NONE":   '--color-ctp-overlay2',
  "GREEN":  '--color-ctp-green-300',
  "BLUE":   '--color-ctp-blue-600',
  "ORANGE": '--color-ctp-peach-400',
  "PURPLE": '--color-ctp-mauve',
  "YELLOW": '--color-ctp-yellow',
  "RED":    '--color-ctp-red',
};

// Maps for runtime color lookup, initialized with static colors.
export const miscColours = { "MARKER": 0xffffff, "STAIRCASE": 0xffffff };
export const zoneColours = {};

// Helper to update color maps from schemas.
function refreshPalette(target, schema) {
  for (const [key, cssVar] of Object.entries(schema)) {
    target[key] = getColor(cssVar);
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

      if (child.userData.material) {
        child.userData.material.color.set(colorVal);
      }

      if (child.material) {
        if (!child.userData.material || (child.material === child.userData.material)) {
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

export function parseModel(gltf, floorId, scene, funtasiaData, dataFloorId = floorId) {
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
  console.log(model)
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

    if (child.name && child.name.toUpperCase().includes("FOOT")) {
      console.log(`[Pathfinding Debug] Node with FOOT in name: ${child.name}, ROLE: ${child.userData.ROLE}`);
      if (child.userData.ROLE === undefined) {
        child.userData.ROLE = "FOOTNODE";
        console.log(`[Pathfinding Debug] Auto-assigned ROLE="FOOTNODE" to ${child.name}`);
      }
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
        if (child.userData.ROLE === "FOOTNODE") {
          // If the user grouped the nodes in Blender and gave the parent the ROLE
          if (child.isGroup && child.children.length > 0) {
            console.log(`[Pathfinding Debug] Found FOOTNODE group. Registering ${child.children.length} children.`);
            child.children.forEach((subChild, index) => {
              const pos = subChild.getWorldPosition(new THREE.Vector3());
              const nameUsed = subChild.name ? subChild.name : `Foot_${index}`;
              const nodeId = `${floorId}_node_${nameUsed}`;
              console.log(`[Pathfinding Debug] Registering FOOTNODE: ID: ${nodeId}`);
              addPathNode(nodeId, floorId, pos);
              subChild.visible = false;
            });
          } else if (child.isInstancedMesh) {
            const matrix = new THREE.Matrix4();
            const pos = new THREE.Vector3();
            for (let i = 0; i < child.count; i++) {
              child.getMatrixAt(i, matrix);
              matrix.premultiply(child.matrixWorld);
              pos.setFromMatrixPosition(matrix);
              const nodeId = `${floorId}_node_${child.name}_${i}`;
              console.log(`[Pathfinding Debug] Registering FOOTNODE Instance: ID: ${nodeId}`);
              addPathNode(nodeId, floorId, pos.clone());
            }
          } else {
            // Standard single object
            const pos = child.getWorldPosition(new THREE.Vector3());
            const nodeId = `${floorId}_node_${child.name || 'Unnamed'}`;
            console.log(`[Pathfinding Debug] Registering FOOTNODE: ID: ${nodeId}`);
            addPathNode(nodeId, floorId, pos);
          }
          child.visible = false;
        }

        // Register Markers globally
        if (child.userData.ROLE === "MARKER") {
          const markerId = String(child.userData.MARKERID);
          const pos = child.getWorldPosition(new THREE.Vector3());
          const entry = { pos, floorId };
          Floor.allMarkers[markerId] = entry;
          QRMarker.allMarkers[markerId] = entry;

          const nodeId = `${floorId}_marker_${markerId}`;
          addMarkerNode(nodeId, floorId, pos);
        }

        // Collect Icons and pathfinding transitions
        if (Object.keys(roledict).includes(child.userData.ROLE)) {
          let normalisedRole = roledict[child.userData.ROLE];
          
          if (child.userData.ROLE === "STAIRCASE") {
            const pos = child.getWorldPosition(new THREE.Vector3());
            const nameUsed = child.name ? `${child.name}_${child.uuid}` : child.uuid;
            const nodeId = `${floorId}_staircase_${nameUsed}`;
            const pairId = child.userData.TRANSITIONPAIR;
            addStaircaseNode(nodeId, floorId, pos, pairId);
            if (pairId) {
              addManualLink(nodeId, pairId, 5); // Add manual cross-floor links later if pair exists, or assume 5
              addManualLink(pairId, nodeId, 5);
            }
          } else if (child.userData.ROLE === "LIFT") {
            const pos = child.getWorldPosition(new THREE.Vector3());
            const nameUsed = child.name ? `${child.name}_${child.uuid}` : child.uuid;
            const nodeId = `${floorId}_lift_${nameUsed}`;
            const pairId = child.userData.TRANSITIONPAIR;
            addLiftNode(nodeId, floorId, pos, pairId);
            if (pairId) {
              addManualLink(nodeId, pairId, 5);
              addManualLink(pairId, nodeId, 5);
            }
          }

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
    const lookupName = logicalNode.name;
    if (!logicalNode.name || logicalNode.name === "") {
      logicalNode.name = `${floorId}_Object_${objects.length + 1}`;
    }

    if (funtasiaData && funtasiaData[dataFloorId] && funtasiaData[dataFloorId][lookupName]) {
        const entry = funtasiaData[dataFloorId][lookupName];
        if (entry["Booth Name"] && entry["Booth Name"] !== "-") {
            logicalNode.name = entry["Booth Name"];
        }
        if (entry["Booth Description"]) {
            logicalNode.userData.boothDescription = entry["Booth Description"];
        }
        entry["Location"] = logicalNode.getWorldPosition(new THREE.Vector3());
    }

    if (Floor.childModels && Floor.childModels[dataFloorId] && Floor.childModels[dataFloorId][logicalNode.name]) {
      logicalNode.userData.child = Floor.childModels[dataFloorId][logicalNode.name];
    }

    if (!objects.includes(logicalNode)) {
      objects.push(logicalNode);
    }
  });

  // After parsing the model, auto-connect the graph nodes for this floor
  autoConnectNodes();
  
  return { model, interactiveObjects: objects, cameraConfig };
}
