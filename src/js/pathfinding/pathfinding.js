import createGraph from 'ngraph.graph';
import path from 'ngraph.path';
import KDBush from 'kdbush';

// Main graph instance
export const navGraph = createGraph();

// O(1) lookup maps
export const objectIndex = {};
export const markerIndex = {};

const FLOOR_HEIGHT_COST = 5;

// --- Node Adding Functions ---

export function addPathNode(id, level, position) {
  console.log(`[Pathfinding Debug] addPathNode called with ID: ${id}`);
  navGraph.addNode(id, {
    type: "path",
    level,
    position,
    accessible: true,
  });
}

export function addDoorNode(id, level, position, objectId) {
  navGraph.addNode(id, {
    type: "door",
    level,
    position,
    objectId,
    accessible: true,
  });
}

export function addStaircaseNode(id, level, position, pairId) {
  navGraph.addNode(id, {
    type: "staircase",
    level,
    position,
    accessible: false,
    transitionPair: pairId,
  });
}

export function addLiftNode(id, level, position, pairId) {
  navGraph.addNode(id, {
    type: "lift",
    level,
    position,
    accessible: true,
    transitionPair: pairId,
  });
}

export function addMarkerNode(id, level, position) {
  navGraph.addNode(id, {
    type: "marker",
    level,
    position,
    accessible: true,
  });
  
  // Register in index
  markerIndex[id] = { nodeId: id, level, position };
}

// --- Connections ---

export function addManualLink(fromId, toId, weight) {
  navGraph.addLink(fromId, toId, { weight });
}

let currentConnectRadius = 15.0;

export function setConnectRadius(radius) {
  currentConnectRadius = radius;
  console.log(`[Pathfinding] Connect radius set to ${radius}. Rebuilding auto-connections...`);
  
  // Clear all automatically generated intra-floor links
  const linksToRemove = [];
  navGraph.forEachLink(link => {
    const fromNode = navGraph.getNode(link.fromId);
    const toNode = navGraph.getNode(link.toId);
    // Remove links on the same level. Inter-level manual links (e.g., stair pairs) are kept.
    if (fromNode && toNode && fromNode.data.level === toNode.data.level) {
      linksToRemove.push(link);
    }
  });
  linksToRemove.forEach(link => navGraph.removeLink(link));
  
  autoConnectNodes(currentConnectRadius);
  checkConnectivity(navGraph);
}

function buildSpatialIndex() {
  const nodeList = [];
  navGraph.forEachNode(node => nodeList.push(node));

  const index = new KDBush(nodeList.length);
  for (const node of nodeList) {
    index.add(node.data.position.x, node.data.position.z);
  }
  index.finish();

  return { index, nodeList };
}

export let lineOfSightCheck = null;

export function setLineOfSightCheck(fn) {
  lineOfSightCheck = fn;
}

export function autoConnectNodes(connectRadius = 15.0) {
  const { index, nodeList } = buildSpatialIndex();

  navGraph.forEachNode(nodeA => {
    const { x, z } = nodeA.data.position;

    const nearbyIndices = index.range(
      x - connectRadius,
      z - connectRadius,
      x + connectRadius,
      z + connectRadius
    );

    for (const i of nearbyIndices) {
      const nodeB = nodeList[i];

      if (nodeB.id === nodeA.id) continue;
      if (nodeB.data.level !== nodeA.data.level) continue;
      if (navGraph.hasLink(nodeA.id, nodeB.id)) continue;

      const dx = nodeA.data.position.x - nodeB.data.position.x;
      const dz = nodeA.data.position.z - nodeB.data.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > connectRadius) continue;

      // Ensure nodes have a clear line of sight to prevent cutting corners or shooting through walls
      if (lineOfSightCheck && !lineOfSightCheck(nodeA.data.position, nodeB.data.position, nodeA.data.level)) {
        continue;
      }

      navGraph.addLink(nodeA.id, nodeB.id, { weight: dist });
      navGraph.addLink(nodeB.id, nodeA.id, { weight: dist });
    }
  });
}

// --- Pathfinding ---

export function findPath(startNodeId, endNodeId, { accessibilityMode = false } = {}) {
  const finder = path.aStar(navGraph, {
    distance(fromNode, toNode, link) {
      const type = toNode.data.type;

      if (type === "lift" && !accessibilityMode) return Infinity;
      if (type === "staircase" && accessibilityMode) return Infinity;

      const isStart = toNode.id === startNodeId;
      if (type === "marker" && !isStart) return Infinity;

      return link.data.weight;
    },
    heuristic(fromNode, toNode) {
      const a = fromNode.data.position;
      const b = toNode.data.position;

      const dx = a.x - b.x;
      const dz = a.z - b.z;

      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const levelDiff = Math.abs(fromNode.data.level - toNode.data.level) * FLOOR_HEIGHT_COST;

      return horizontalDist + levelDiff;
    },
  });

  const rawPath = finder.find(startNodeId, endNodeId);
  if (!rawPath || rawPath.length === 0) return null;
  return rawPath.reverse();
}

export function getRoute(startId, destinationId, { accessibilityMode = false } = {}) {
  let startNodeId = startId;
  let endNodeId = destinationId;
  
  // Robust case-insensitive lookup
  if (!navGraph.getNode(startNodeId)) {
    navGraph.forEachNode(node => {
      if (node.id.toLowerCase() === startNodeId.toLowerCase()) startNodeId = node.id;
    });
  }
  if (!navGraph.getNode(endNodeId)) {
    navGraph.forEachNode(node => {
      if (node.id.toLowerCase() === endNodeId.toLowerCase()) endNodeId = node.id;
    });
  }
  
  // Verify they exist before proceeding to prevent ngraph crashing
  if (!navGraph.getNode(startNodeId)) {
    console.error(`[Pathfinding] startNodeId not found in graph: ${startId}`);
    return null;
  }
  if (!navGraph.getNode(endNodeId)) {
    console.error(`[Pathfinding] endNodeId not found in graph: ${destinationId}`);
    return null;
  }

  const nodePath = findPath(startNodeId, endNodeId, { accessibilityMode });

  if (!nodePath) {
    console.warn("[Pathfinding] no path found between", startNodeId, "and", endNodeId);
    return null;
  }

  return buildPathSegments(nodePath);
}

export function buildPathSegments(nodePath) {
  const segments = [];
  let currentSegment = {
    level: nodePath[0].data.level,
    nodes: [],
  };

  for (const node of nodePath) {
    if (node.data.level !== currentSegment.level) {
      segments.push(currentSegment);
      currentSegment = { level: node.data.level, nodes: [] };
    }
    currentSegment.nodes.push({
      id: node.id,
      type: node.data.type,
      position: node.data.position,
    });
  }

  segments.push(currentSegment);
  return segments;
}

// --- Dev Tools ---

export function checkConnectivity(graph) {
  const allIds = new Set();
  graph.forEachNode(node => {
    allIds.add(node.id);
    console.log(`[Pathfinding Debug] Node in graph: ${node.id}`);
  });

  if (allIds.size === 0) {
    console.warn("[Pathfinding] Graph is empty!");
    return;
  }

  const firstId = allIds.values().next().value;
  const visited = new Set([firstId]);
  const queue = [firstId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    graph.forEachLinkedNode(currentId, neighbor => {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    });
  }

  const unreachable = [...allIds].filter(id => !visited.has(id));

  if (unreachable.length > 0) {
    console.warn(`[Pathfinding] ${unreachable.length} isolated node(s) found:`, unreachable);
  } else {
    console.log(`[Pathfinding] Graph fully connected ✓ (${allIds.size} nodes)`);
  }
  console.log(allIds);
}

export function runPathfindingTestCase() {
  const allNodes = [];
  navGraph.forEachNode(n => allNodes.push(n));
  
  const footnodes = allNodes.filter(n => n.data.type === "path");
  const staircases = allNodes.filter(n => n.data.type === "staircase");
  
  console.log(`\n--- Running Pathfinding Test Case ---`);
  console.log(`Found ${footnodes.length} footnodes and ${staircases.length} staircases.`);
  
  if (footnodes.length >= 2) {
    console.log(`Testing Route: ${footnodes[0].id} -> ${footnodes[footnodes.length - 1].id}`);
    const route = getRoute(footnodes[0].id, footnodes[footnodes.length - 1].id);
    if (route) {
        console.log(`✅ Success! Route found with ${route.length} level segments. Node count: ${route.reduce((acc, seg) => acc + seg.nodes.length, 0)}`);
    } else {
        console.warn("❌ Failed. No route found. They might be isolated. Try increasing setConnectRadius().");
    }
  }
  
  if (staircases.length > 0 && footnodes.length > 0) {
    console.log(`Testing Route: ${footnodes[0].id} -> ${staircases[0].id}`);
    const route = getRoute(footnodes[0].id, staircases[0].id);
    if (route) {
        console.log(`✅ Success! Route found to staircase.`);
    } else {
        console.warn("❌ Failed. No route found to staircase. Try increasing setConnectRadius().");
    }
  }
  console.log(`-------------------------------------\n`);
}
