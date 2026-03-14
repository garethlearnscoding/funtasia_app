import * as THREE from "three";

const mutedColors = {
  "-1": 0xb9a6b9,
  0: 0xd97c7c,
  1: 0xe6a57e,
  2: 0x8fa7b3,
  3: 0x8fbf9f,
  4: 0xe8e2a1,
  5: 0xb9a6b9,
  6: 0xd6c1c8,
  7: 0xb1b1b1,
  8: 0xb0b0b0,
};

let skybox = null;
let maxRadius = 0;

export function parseModel(gltf, floorId, scene, camera, controls) {
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

  controls.target.set(0, 0, 0);
  camera.position.set(0, radius * 1, radius * 1);
  controls.minDistance = radius * 0.6;
  controls.maxDistance = radius * 3;
  camera.near = radius / 10;
  camera.far = radius * 10000;
  camera.updateProjectionMatrix();
  controls.update();

  const objects = [];
  model.traverse((child) => {
    if (!child.isMesh) return;

    const isInteractive = child.userData?.INTERACTIVE === true;
    if (child.userData?.ZONE !== undefined) {
      if (!isInteractive === true) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      child.material = new THREE.MeshStandardMaterial({
        color: mutedColors[child.userData.ZONE],
        emissive: 0x000000,
        roughness: 1,
        metalness: 1,
      });
    }

    if (child.userData.GREY === true) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });
    }
    if (child.userData?.FOOT === true) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0x545454,
        roughness: 1,
        metalness: 0,
      });
    }
    if (child.userData?.BASE === true) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0x949494,
        roughness: 1,
        metalness: 0,
      });
    }

    if (!isInteractive) return;
    if (!child.name || child.name === "") {
      child.name = `${floorId}_Object_${objects.length + 1}`;
    }

    objects.push(child);
  });
  
  return { model, interactiveObjects: objects };
}
