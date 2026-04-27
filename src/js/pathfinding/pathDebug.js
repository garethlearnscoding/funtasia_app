import * as THREE from "three";

let debugGroup = null;

export function debugDrawGraph(graph, scene) {
  if (debugGroup) {
    scene.remove(debugGroup);
    debugGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    debugGroup = null;
  }

  debugGroup = new THREE.Group();
  debugGroup.name = "debug_graph";

  const nodeColorMap = {
    path:      0x00ff00,
    door:      0x0000ff,
    marker:    0xffff00,
    staircase: 0xff4400,
    lift:      0xcc00ff,
  };

  graph.forEachNode(node => {
    const color = nodeColorMap[node.data.type] ?? 0xffffff;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.15),
      new THREE.MeshBasicMaterial({ color })
    );

    sphere.position.set(
      node.data.position.x,
      node.data.position.y,
      node.data.position.z
    );

    debugGroup.add(sphere);
  });

  graph.forEachLink(link => {
    const fromNode = graph.getNode(link.fromId);
    const toNode = graph.getNode(link.toId);

    if (!fromNode || !toNode) return;

    const points = [
      new THREE.Vector3(
        fromNode.data.position.x,
        fromNode.data.position.y,
        fromNode.data.position.z
      ),
      new THREE.Vector3(
        toNode.data.position.x,
        toNode.data.position.y,
        toNode.data.position.z
      ),
    ];

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x888888 })
    );

    debugGroup.add(line);
  });

  debugGroup.visible = false;
  scene.add(debugGroup);

  console.log("[Pathfinding] Debug graph rendered. Press G to toggle visibility.");
}

export function setupDebugToggle() {
  window.addEventListener("keydown", e => {
    if (e.key === "g" || e.key === "G") {
      if (debugGroup) {
        debugGroup.visible = !debugGroup.visible;
        console.log(`[Pathfinding] Debug graph visible: ${debugGroup.visible}`);
      }
    }
  });
}
