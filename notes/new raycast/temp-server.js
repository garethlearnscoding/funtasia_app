import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_PATH = '/models/njc-l1-smthg.glb';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ===== ADD CONTROLS =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth movement

// light
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

// load model
const loader = new GLTFLoader();
loader.load(MODEL_PATH, (gltf) => {
  scene.add(gltf.scene);

  gltf.scene.traverse((child) => {
    if (!child.isMesh) return;

    // If this mesh has no userData, inherit from its parent
    const data = Object.keys(child.userData).length > 0
      ? child.userData
      : child.parent?.userData ?? {};

    const role = data.ROLE ?? 'NONE';
    const zone = data.ZONE ?? 'NONE';
    const name = data.name ?? child.name;

    console.log(`${child.name} → ROLE: ${role}, ZONE: ${zone}`);

    // Determine which material slot this child is (0 = wall, 1 = top)
    // Blender names them ParentName_1, ParentName_2 — _1 = slot 0, _2 = slot 1
    const suffix = child.name.split('_').pop();
    const isTop  = suffix === '2';

    // Apply your material based on role/zone/whatever you need
    child.material = getMaterialForSlot(role, zone, isTop);

    // Optionally copy userData down so children are self-contained
    child.userData = { ...data };
  });
});

function getMaterialForSlot(role, zone, isTop) {
  const zoneColors = {
    RED:    { wall: 0xcc4444, top: 0xff8888 },
    BLUE:   { wall: 0x4466cc, top: 0x88aaff },
    ORANGE: { wall: 0xcc7733, top: 0xffaa66 },
    NONE:   { wall: 0x888888, top: 0xaaaaaa },
  };

  const roleColors = {
    STAIRCASE: { wall: 0x999999, top: 0xbbbbbb },
    MARKER:    { wall: 0xffffff, top: 0xffffff },
    BASE:      { wall: 0x555555, top: 0x777777 },
    GRASS:     { wall: 0x336633, top: 0x55aa55 },
    DRIVE:     { wall: 0x444444, top: 0x666666 },
    FOOT:      { wall: 0x777755, top: 0x999977 },
    GREY:      { wall: 0x888888, top: 0xaaaaaa },
    LIFT:      { wall: 0xaaaacc, top: 0xccccee },
  };

  // Role-specific colours take priority, then fall back to zone
  const palette = roleColors[role] ?? zoneColors[zone] ?? zoneColors['NONE'];
  const hex = isTop ? palette.top : palette.wall;

  return new THREE.MeshBasicMaterial({ color: hex });
}



// resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// loop
function animate() {
  requestAnimationFrame(animate);

  controls.update(); // IMPORTANT

  renderer.render(scene, camera);
}
animate();

