import * as THREE from "three";
import { Floor } from "@/js/floor/floor.js";
import { Icon } from "@/js/marker/icon.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { TextMarker, BoothIDMarker } from "@/js/marker/textmarker.js";

export const textMarkerMap = {
  l1: {
    "Canteen": "Canteen",
    "Amphi": "Amphitheatre",
    "Atrium": "Atrium",
    "NJCLOGO": "Plaza"
  },
  l2: {
    "Hall": "Hall",
    "LT5": "LT5",
    "LT1": "LT1",
    "Amphitheatre": "Amphitheatre",
    "NJCLOGO":"Plaza",
    "Pasar Malam Food Street": "Pasar Malam Food Street"
  },
  b2: {
    "Gym": "Gymnasium"
  },
  b3: {
    "Field": "Field",
    "ISH": "ISH",
    "njcentrance": "Funtasia Entrance",
    "njcexit":"Funtasia Exit"
  },
  hall:{
    "Stage":"Stage"
  }
};

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
  "LIFT":      '--color-ctp-overlay1',
};

const zoneSchema = {
  "NONE":   '--color-ctp-overlay2',
  "GREEN":  '--color-ctp-green-300',
  "BLUE":   '--color-ctp-blue-600',
  "ORANGE": '--color-ctp-peach-400',
  "PURPLE": '--color-ctp-mauve',
  "YELLOW": '--color-ctp-yellow',
  "RED":    '--color-ctp-red',
  "BROWN":  '--color-ctp-flamingo-900',
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
    "STAIRCASE": "staircase",
    "DOOR": "door"
  };
  const model = gltf.scene;
  model.visible = false;
  scene.add(model);

  let box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  // console.log(`[Parser] Model ${floorId} center:`, center);
  model.position.sub(center);

  box = new THREE.Box3().setFromObject(model);
  const sizeVec = box.getSize(new THREE.Vector3());
  const radius = sizeVec.length() * 0.5;
  const isChildModel = dataFloorId !== floorId;
  // console.log(`[Parser] ── Model: ${floorId} (${isChildModel ? 'CHILD of ' + dataFloorId : 'FLOOR'}) ──`);
  // console.log(`[Parser]   Bounding box size: W=${sizeVec.x.toFixed(2)}, H=${sizeVec.y.toFixed(2)}, D=${sizeVec.z.toFixed(2)}`);
  // console.log(`[Parser]   Radius (half-diagonal): ${radius.toFixed(2)}`);
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
  const radiusfixed = 20;
  const cameraConfig = isChildModel
    ? {
        // Child models: wider, higher angle to fill viewport
        initialPosition: new THREE.Vector3(0, radius * 1.4, radius * 2.0),
        target: new THREE.Vector3(0, 0, 0),
        minDistance: radius * 0.1,
        maxDistance: radius * 5.0,
        near: 0.01,
        far: Math.max(radius * 1000, 2000),
      }
    : {
        // Floor models: closer, customized framing
        initialPosition: new THREE.Vector3(radiusfixed * 0.07, radiusfixed * 0.3, radiusfixed * 0.7),
        target: new THREE.Vector3(radiusfixed * 0.07, 0, radiusfixed * 0.2),
        minDistance: radius * 0.06,
        maxDistance: radius * 2,
        near: radius / 1000,
        far: Math.max(radius * 10000, 2000),
      };
  // console.log(`[Parser]   Camera Config:`, cameraConfig);
  const objects = [];
  const boothIDMarkers = [];
  const textMarkers = [];
  const boothMarkerNodes = new Set();
  const markerNames = new Set();

  // Normalize floor lookup key to match the lowercase keys in textMarkerMap
  const floorKey = floorId.toLowerCase();

  model.updateMatrixWorld(true);
  model.traverse((child) => {
    // 1. Resolve userData from parent group for split meshes
    let isSplitChild = false;
    let logicalNode = child;
    if (child.isMesh && (child.name.endsWith("_1") || child.name.endsWith("_2")) && child.parent) {
      isSplitChild = true;
      logicalNode = child.parent;
      if (Object.keys(child.userData).length === 0 && logicalNode.userData) {
        Object.assign(child.userData, logicalNode.userData);
      }
      child.userData.logicalParent = logicalNode;
    }

    // Immediately return if the object has no ROLE
    if (child.userData.ROLE === undefined) return;

    // 2. If ROLE is GREY, set its material to transparent
    if (child.isMesh && child.userData.ROLE === "GREY") {
      child.material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
      });
      return;
    }

    // 3. Add TextMarker if the logical node's name appears in textMarkerMap
    if (child.isMesh && textMarkerMap[floorKey] && logicalNode.name in textMarkerMap[floorKey]) {
      if (!markerNames.has(logicalNode.name)) {
        const pos = child.getWorldPosition(new THREE.Vector3());
        pos.y = 0;
        const tm = new TextMarker(model, pos, textMarkerMap[floorKey][logicalNode.name], floorId);
        if (tm.group) tm.group.visible = false;
        textMarkers.push(tm);
        markerNames.add(logicalNode.name);
      }
    }

    // 4. Default Zone to NONE if undefined
    if (child.userData.ZONE === undefined) { child.userData.ZONE = "NONE"; }

    // 5. Determine if the child is an interactable object (mesh with a meaningful zone)
    const role = child.userData.ROLE;
    const isInteractive = child.isMesh && role === "OBJECT";

    // 6. If not interactive, check for icon/marker registration and return
    if (!isInteractive && !isSplitChild) {
      // Register Markers globally
      if (role === "MARKER") {
        const markerId = String(child.userData.MARKERID);
        const pos = child.getWorldPosition(new THREE.Vector3());
        const entry = { pos, floorId };
        Floor.allMarkers[markerId] = entry;
        QRMarker.allMarkers[markerId] = entry;
      }

      // Collect Icons
      if (Object.keys(roledict).includes(role)) {
        let normalisedRole = roledict[role];
        if (normalisedRole === "staircase") {
          switch (child.userData?.STAIRCASEDIRECTION) {
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
          new Icon(model, normalisedRole, pos, floorId);
        }
      }
    }

    // 7. Apply material colours — miscSchema for non-interactive, zoneSchema for interactive
    if (child.isMesh) {
      let colorVal;
      if (!isInteractive) {
        colorVal = miscColours[role] !== undefined ? miscColours[role] : 0xc1c3c7;
      } else {
        colorVal = zoneColours[child.userData.ZONE];
      }

      // 8. Calculate brighter colour for the top face (_2 meshes)
      if (child.name.endsWith("_2")) {
        const baseColor = new THREE.Color(colorVal);
        baseColor.multiplyScalar(1.2);
        baseColor.r = Math.min(1.0, baseColor.r);
        baseColor.g = Math.min(1.0, baseColor.g);
        baseColor.b = Math.min(1.0, baseColor.b);
        colorVal = baseColor.getHex();
      }

      // Use opaque materials by default to prevent transparency sorting artifacts.
      // Walkways and grass (FOOT, GRASS, DRIVE) often overlap with the BASE.
      // We use polygonOffset to "nudge" them slightly forward in the depth buffer.
      const isDecoration = ["FOOT", "GRASS", "DRIVE"].includes(role);
      child.material = new THREE.MeshBasicMaterial({ 
        color: colorVal, 
        transparent: false,
        polygonOffset: isDecoration,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      if (isInteractive) child.userData.material = child.material;
    }

    if (!isInteractive) return;

    // 10. Data attribution for interactive objects
    if (child.userData.ZONE === "NONE") return;
    if (child.userData.skip) return;
    
    const lookupName = logicalNode.name;
    if (!logicalNode.name || logicalNode.name === "") {
      logicalNode.name = `${floorId}_Object_${objects.length + 1}`;
    }
    logicalNode.userData.boothId = lookupName;
    
    // Detect if this object belongs to a parent model (e.g. Canteen, ISH)
    let parentModelName = null;
    const levelChildren = Floor.childModels[dataFloorId] || {};
    let p = logicalNode.parent;
    while (p && p !== model) {
      if (levelChildren[p.name]) {
        parentModelName = p.name;
        break;
      }
      p = p.parent;
    }

    if (funtasiaData && funtasiaData[dataFloorId] && funtasiaData[dataFloorId][lookupName]) {
      let friendlyNameSet = false;
      const entry = funtasiaData[dataFloorId][lookupName];
      if (parentModelName) {
        entry["parent_model"] = parentModelName;
      }
      const boothName = entry["booth_name"];
      if (boothName && boothName !== "-") {
        logicalNode.name = boothName;
        friendlyNameSet = true;
      }
      const boothDesc = entry["booth_description"];
      if (boothDesc) {
        logicalNode.userData.boothDescription = boothDesc;
      }
      entry["Location"] = logicalNode.getWorldPosition(new THREE.Vector3());

      // Only create a marker if we found a friendly name and haven't labeled this node yet
      if (friendlyNameSet && !boothMarkerNodes.has(logicalNode.uuid)) {
          const box = new THREE.Box3().setFromObject(child);
          const pos = new THREE.Vector3();
          box.getCenter(pos);
          pos.y = box.max.y;

          const boothZone = child.userData.ZONE || "NONE";
          const markerBgColor = zoneColours[boothZone];

          const bim = new BoothIDMarker(model, pos, logicalNode.name, floorId, { bgColor: markerBgColor });
          boothIDMarkers.push(bim);
          boothMarkerNodes.add(logicalNode.uuid);
      }
    }

    if (Floor.childModels && Floor.childModels[dataFloorId] && Floor.childModels[dataFloorId][logicalNode.name]) {
      logicalNode.userData.child = Floor.childModels[dataFloorId][logicalNode.name];
    }

    if (!objects.includes(logicalNode)) {
      objects.push(logicalNode);
    }
  });
  
  return { model, interactiveObjects: objects, cameraConfig, textMarkers, boothIDMarkers };
}
