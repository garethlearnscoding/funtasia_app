import * as THREE from "three";

const miscColours = {
  "BASE": 0x9c9fa5,
  "DRIVE": 0xa5ccd1,
  "FOOT":  0xE6c19f,
  "GRASS": 0x9dcb6f,
  "NONOBJECT": 0xc1c3c7,
  "FTOILET": 0xb9a6b9,
  "MTOILET": 0xd6c1c8,
  "ATOILET": 0xb1b1b1,
  "LIFT": 0xb0b0b0,
};
const zoneColours = {
  "GREEN": 0x9c9fa5,
  "BLUE": 0xa5ccd1,
  "ORANGE":  0xE6c19f,
  "PURPLE": 0x9dcb6f,
  "YELLOW": 0xb9a6b9,
  "RED": 0xd6c1c8,
};

let skybox = null;
let maxRadius = 0;

export function parseModel(gltf, floorId, scene) {
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
    minDistance: radius * 0.6,
    maxDistance: radius * 3,
    near: radius / 10,
    far: Math.max(radius * 10000, 2000), // Ensure at least default far
  };

  const objects = [];
  const markers = {};
  const icons = [];
  model.traverse((child) => {
    if (!child.isMesh) return;

    const isInteractive = child.userData?.ROLE === "OBJECT";
    if (child.userData.ZONE == undefined) {child.userData.ZONE = 0};
    if (!isInteractive) {
      child.material = new THREE.MeshStandardMaterial({
        color: miscColours[child.userData.ROLE],
        roughness: 1,
        metalness: 0,
      });

      // Collect Markers
      if (child.userData.ROLE === "MARKER") {
        const markerId = child.userData.ID || child.name;
        markers[markerId] = child.getWorldPosition(new THREE.Vector3());
      }

      // Collect Icons
      const iconTypes = ["ATOILET", "MTOILET", "FTOILET", "STAIRCASE", "LIFT"];
      if (iconTypes.includes(child.userData.ROLE)) {
        icons.push({
          pos: child.getWorldPosition(new THREE.Vector3()),
          type: child.userData.ROLE.toLowerCase().replace("toilet", "toilets"), // Normalize to your ICON_PATHS keys
        });
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
    if (!child.name || child.name === "") {
      child.name = `${floorId}_Object_${objects.length + 1}`;
    }

    objects.push(child);
  });
  
  return { model, interactiveObjects: objects, cameraConfig, markers, icons };
}
