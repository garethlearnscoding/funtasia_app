# Three.js Basic Model Rendering Guide

This document provides a barebones guide on how to render a single 3D model (`.glb`/`.gltf`) using Three.js, including the basic scene setup, lighting, and camera controls. This ignores all advanced features like UI interaction, multiple floors, or click events.

## 1. Setup HTML Reference
You need a basic HTML structure containing a container for your 3D canvas and the Three.js library loaded via module imports.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Basic 3D Model Render</title>
    <style>
        body { margin: 0; overflow: hidden; }
        #canvas-container { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div id="canvas-container"></div>
    <script type="module" src="./main.js"></script>
</body>
</html>
```

## 2. Basic Initialization (`main.js`)
Initialize the Scene, Camera, and Renderer.

```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('canvas-container');

// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f6ff); // Light background color

// 2. Camera
// Parameters: Field of View (FOV), Aspect Ratio, Near Render Plane, Far Render Plane
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// Set default starting camera angle and position
camera.position.set(0, 50, 100); 
camera.lookAt(0, 0, 0);

// 3. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // For high DPI (Retina) displays
container.appendChild(renderer.domElement);
```

## 3. Lighting setup
Models need light to be visible. A combination of Hemisphere and Directional light is usually best for a natural look.

```javascript
// Ambient / Hemisphere light (provides soft, base illumination)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// Directional light (simulates the sun, creates shadows and depth)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(0, 100, -50); // Angle the light
scene.add(dirLight);
```

## 4. Model Loading
Use `GLTFLoader` to pull your `.glb` file into the scene.

```javascript
const loader = new GLTFLoader();
const modelUrl = './path/to/your_model.glb';

loader.load(
    modelUrl,
    function (gltf) {
        const model = gltf.scene;

        // Position the model
        model.position.set(0, 0, 0);
        
        // Optional: Center the model automatically based on its bounding box
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); 
        
        scene.add(model);
    },
    function (xhr) {
        // Log loading progress
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (error) {
        console.error('An error happened', error);
    }
);
```

## 5. Camera Controls (OrbitControls)
Allow the user to intuitively rotate, pan, and zoom around the model.

```javascript
const controls = new OrbitControls(camera, renderer.domElement);

// Smooth out interactions
controls.enableDamping = true; 
controls.dampingFactor = 0.05;

// Define View Limits (Good to prevent users from getting lost)
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;

controls.minDistance = 10; // Minimum zoom
controls.maxDistance = 200; // Maximum zoom

// Restrict vertical angle (e.g., prevent looking strictly from below the floor)
controls.maxPolarAngle = Math.PI / 2; // Can't go below the horizon
```

## 6. Animation Loop & Resize Handling
To continuously render changes and handle window resizes.

```javascript
// Fix aspect ratio when resizing the window
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// The render loop
function animate() {
    requestAnimationFrame(animate);

    // Update controls required if enableDamping is true
    controls.update(); 

    renderer.render(scene, camera);
}

// Start the loop
animate();
```
