import * as THREE from "three";

let pathLines = [];
let currentRenderedRoute = null;

export function renderRoute(route, appState) {
    clearRoute(appState);

    if (!route || route.length === 0) return;

    currentRenderedRoute = route;
    const scene = appState.scene;

    route.forEach(segment => {
        const points = [];
        segment.nodes.forEach(node => {
            // Slightly elevate y to avoid z-fighting with the floor
            points.push(new THREE.Vector3(node.position.x, node.position.y + 0.5, node.position.z));
        });

        const material = new THREE.LineBasicMaterial({
            color: 0x3b82f6, // Blue
            linewidth: 3, 
            depthTest: false, // Render on top of models
            transparent: true,
            opacity: 0.8
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 999; // Ensure it renders on top
        
        line.userData.floorId = segment.level;
        
        // Hide if not on current floor
        if (appState.currentFloor && appState.currentFloor.id !== segment.level) {
            line.visible = false;
        }

        scene.add(line);
        pathLines.push(line);
    });
}

export function clearRoute(appState) {
    if (!appState || !appState.scene) return;
    
    pathLines.forEach(line => {
        appState.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    pathLines = [];
    currentRenderedRoute = null;
}

export function updateRouteVisibility(currentFloorId) {
    pathLines.forEach(line => {
        line.visible = (line.userData.floorId === currentFloorId);
    });
}
