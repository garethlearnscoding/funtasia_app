import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function getViewportSize() {
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function setupScene() {
  const container = document.getElementById("canvas-container");
  const scene = new THREE.Scene();

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load("./assets/media/plain-background.jpeg", (texture) => {
    scene.background = texture;
  });

  const viewportSize = getViewportSize();
  const camera = new THREE.PerspectiveCamera(
    60,
    viewportSize.width / viewportSize.height,
    0.1,
    2000,
  );
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(viewportSize.width, viewportSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.target.set(0, 0, 0);
  controls.screenSpacePanning = false;
  controls.minDistance = 10;
  controls.maxDistance = 200;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI / 2.3;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.position.set(0, 5, 0);
  scene.add(dirLight);

  // Setup event listener to cancel animation on user interaction
  controls.addEventListener("start", () => {
    // We dispatch a custom event which main.js can catch to update appState
    window.dispatchEvent(new CustomEvent("camera-interaction-start"));
  });
  
  function handleResize() {
    const viewportSize = getViewportSize();
    camera.aspect = viewportSize.width / viewportSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportSize.width, viewportSize.height);
  }

  window.addEventListener("resize", handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", () => {
      window.scrollTo(0, 0);
    });
  }

  return { scene, camera, renderer, controls };
}
