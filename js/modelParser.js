import * as THREE from "three";
import { Icon } from "./icon.js";
import { Floor } from "./floor.js";
const miscColours = {
  "BASE": 0x6e7176,
  "DRIVE": 0xa5ccd1,
  "FOOT":  0xE6c19f,
  "GRASS": 0x9dcb6f,
  "NONOBJECT": 0xc1c3c7,
  "FTOILET": 0xff8afe  ,
  "MTOILET": 0x1b17eb,
  "ATOILET": 0x5ce1e6,
  "LIFT": 0xb0b0b0,
  "MARKER":0xffffff,
  "STAIRCASE":0xffffff
};
export const zoneColours = {
  "NONE": 0xffe5e7,
  "GREEN": 0x00ff00,
  "BLUE": 0x0066ff,
  "ORANGE":  0xff7700,
  "PURPLE": 0x9900ff,
  "YELLOW": 0xffff00,
  "RED": 0xff0000,
};

let skybox = null;
let maxRadius = 0;

export function parseModel(gltf, floorId, scene) {
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
  const markers = {};
  const icons = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    // IDK if the following 2 lines are needed
    child.castShadow = false;
    child.receiveShadow = false;
    if (child.userData.ROLE === undefined){
      console.log("Undefined role:",child.name)
    };
    const isInteractive = child.userData?.ROLE === "OBJECT";
    if (child.userData.ZONE == undefined) {child.userData.ZONE = "NONE"};
    if (!isInteractive) {
      const isGrey = child.userData.ROLE === "GREY";
      child.material = new THREE.MeshStandardMaterial({
        color: miscColours[child.userData.ROLE],
        transparent: isGrey,
        opacity: isGrey ? 0 : 1,
        roughness: isGrey ? 0 : 1,
        metalness: 0,
      });

      // Collect Markers
      if (child.userData.ROLE === "MARKER") {
        const markerId = child.userData.MARKERID;
        markers[markerId] = child.getWorldPosition(new THREE.Vector3());
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
          const icon = new Icon(normalisedRole, pos, floorId);
          icons.push(icon);
        }
      }
    } else {
      child.material = new THREE.MeshStandardMaterial({
        color: zoneColours[child.userData.ZONE],
        emissive: 0x000000,
        roughness: 1,
        metalness: 1,
      });
    }

    if (!isInteractive) return;
    if (child.userData.ZONE === "NONE") return;
    if (!child.name || child.name === "") {
      child.name = `${floorId}_Object_${objects.length + 1}`;
    }

    if (Floor.childModels && Floor.childModels[child.name]) {
      child.userData.child = Floor.childModels[child.name];
    }

    objects.push(child);
  });
  
  return { model, interactiveObjects: objects, cameraConfig, markers, icons };
}
