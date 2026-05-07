# Pathfinding Implementation Plan

This implementation plan covers a pathfinding algorithm for a 3D multi-level map.
The algorithm finds the shortest walkable route between two points across up to 5 floors,
respecting accessibility settings and the physical layout of the building.

---

## Table of Contents

1. [Modules](#modules)
2. [Concepts](#concepts)
3. [Execution Phases](#execution-phases)
4. [Data](#data)
5. [Scenarios](#scenarios)
6. [Building the Graph](#building-the-graph)
7. [Algorithm](#algorithm)
8. [Getting a Route](#getting-a-route)
9. [Rendering the Path](#rendering-the-path)
10. [Debug Tools](#debug-tools)
11. [URL Parameter Testing](#url-parameter-testing)
12. [Implementation Order](#implementation-order)
13. [Rules Reference](#rules-reference)

---

## Modules

```bash
npm install ngraph.graph ngraph.path
```

| Module | Purpose |
|---|---|
| `ngraph.graph` | Stores the navigation graph — all nodes and their connections |
| `ngraph.path` | Runs the A\* algorithm on that graph |

---

## Concepts

### What is a Graph?

A graph is a network of **nodes** (points) connected by **edges** (links between points).
Your navigation graph represents every walkable point in the building and how they connect.

```
[marker_entrance] -- [junction_main] -- [junction_north] -- [staircase_A]
                              |
                     [door_cafe_main]
                     [door_cafe_back]
```

Every node is a point in 3D space. Every edge has a **weight** — the Euclidean distance
between the two nodes it connects. A\* uses these weights to find the lowest-cost path.

### What is A\*?

A\* is a pathfinding algorithm that finds the shortest path between two nodes in a graph.

It scores every candidate node with:

```
F = G + H

G = actual distance walked from the start to this node  (known precisely)
H = estimated distance remaining to the destination     (the heuristic — a smart guess)
F = total estimated path cost through this node
```

A\* always explores the node with the **lowest F score** next. This keeps it focused
toward the destination rather than exploring in every direction equally.

### Why Euclidean Distance + Level Weight?

The heuristic (H) must never overestimate — if it does, A\* may miss the true shortest path.

**Euclidean distance** is the straight-line ruler distance between two points.
It never overestimates because no real path is shorter than a straight line.

A **level weight of 20** is added per floor difference. This ensures A\* treats
changing floors as expensive — it will only cross a floor when the path genuinely
requires it, not just because a node on another floor happens to be spatially close.

```
H = sqrt((x2-x1)² + (z2-z1)²) + (|levelA - levelB| × 20)
```

### Multiple Exits per Object

Each interactable object can have multiple exits. Each exit is its own door node in the graph,
connected to its own specific foot node (the path junction directly in front of that door).

When routing **to** an object, A\* runs once per exit and the shortest result is returned.
When routing **from** an object, the same logic applies — all exits are tried as starting points.

```
obj_cafe exits:
  door_cafe_main  →  connected to  →  junction_main
  door_cafe_back  →  connected to  →  junction_north

getRoute("obj_cafe", "obj_library") tries all exit combinations and returns the shortest.
```

---

## Execution Phases

Each piece of code runs at a specific phase of your application lifecycle.
Running something in the wrong phase (e.g. rebuilding the graph every frame) causes bugs or poor performance.

| Phase | When it runs | What runs in this phase |
|---|---|---|
| **Load** | Once, when the app starts | Define `objects`, `markers`, `navigationData` |
| **Parse** | Once, after load | `buildGraph()`, `checkConnectivity()`, `debugDrawGraph()` |
| **User interaction** | Every time the user selects a start/destination | `getRoute()`, `drawPath()` or `clearPath()` |
| **Render loop** | Every frame (Three.js `animate()`) | Nothing from pathfinding — never call graph functions here |
| **Dev/testing only** | During development | `checkURLParams()`, `checkConnectivity()`, `debugDrawGraph()` |

---

## Data

All navigation data is defined manually. Footpath nodes are placed only at junctions,
so proximity-based auto-connection cannot reliably determine which nodes are truly connected.

### Node Types

| Type | Description | Valid as Start | Valid as End |
|---|---|---|---|
| `path` | Junction along a walkway | No (internal only) | No (internal only) |
| `door` | Entry/exit point of an object | Yes (via object) | Yes (via object) |
| `marker` | Named spawn point / entrance | Yes | No |
| `staircase` | Floor transition — blocked in accessibility mode | No | No |
| `lift` | Floor transition — only in accessibility mode | No | No |

### Objects Map

> **Phase: Load**
> Define this once at startup. Do not modify it at runtime.

Each object can have one or more exits.
Each exit maps to exactly one foot node (the path junction directly in front of that door).

```js
// objects.js
export const objects = {

  "obj_cafe": {
    exits: {
      "L1_door_cafe_main": { node: "L1_junction_main"  },
      "L1_door_cafe_back": { node: "L1_junction_north" }
    }
  },

  "obj_library": {
    exits: {
      "L2_door_library_front": { node: "L2_junction_east" },
      "L2_door_library_side":  { node: "L2_junction_main" }
    }
  },

  // Single-exit objects use the same structure
  "obj_toilet_L1": {
    exits: {
      "L1_door_toilet": { node: "L1_junction_west" }
    }
  }

};
```

### Markers Map

> **Phase: Load**
> Define this once at startup. Do not modify it at runtime.

Each marker maps directly to the path junction node it sits nearest to.
Markers are start-only — they cannot be used as a destination.

```js
// markers.js
export const markers = {
  "marker_main_entrance": "L1_junction_main",
  "marker_lobby_L2":      "L2_junction_main",
  "marker_carpark":       "L1_junction_carpark"
};
```

### Navigation Data File

> **Phase: Load**
> Define this once at startup. This is your single source of truth —
> edit only this file when the map layout changes.

All nodes and their explicit connections are declared here.
Name nodes consistently using: `L{level}_{type}_{name}`

```js
// navigationData.js
export const navigationData = {

  nodes: {

    // -------------------------
    // LEVEL 1
    // -------------------------

    // Path nodes — junction points along walkways
    "L1_junction_main":     { type: "path",      level: 1, position: { x: 0,   y: 0, z: 0   } },
    "L1_junction_north":    { type: "path",      level: 1, position: { x: 0,   y: 0, z: 10  } },
    "L1_junction_east":     { type: "path",      level: 1, position: { x: 10,  y: 0, z: 0   } },
    "L1_junction_west":     { type: "path",      level: 1, position: { x: -10, y: 0, z: 0   } },
    "L1_junction_carpark":  { type: "path",      level: 1, position: { x: -15, y: 0, z: 5   } },

    // Door nodes — one per exit, positioned just outside each door in the scene
    // Do NOT add these to navigationData.connections —
    // buildGraph() wires them to their foot nodes automatically via the objects map
    "L1_door_cafe_main":    { type: "door",      level: 1, position: { x: 3,   y: 0, z: 4   }, objectId: "obj_cafe"      },
    "L1_door_cafe_back":    { type: "door",      level: 1, position: { x: 3,   y: 0, z: 12  }, objectId: "obj_cafe"      },
    "L1_door_toilet":       { type: "door",      level: 1, position: { x: -8,  y: 0, z: 2   }, objectId: "obj_toilet_L1" },

    // Marker nodes — one per named start location
    "L1_marker_entrance":   { type: "marker",    level: 1, position: { x: 0,   y: 0, z: -2  } },
    "L1_marker_carpark":    { type: "marker",    level: 1, position: { x: -15, y: 0, z: 7   } },

    // Staircase nodes — one node per floor they appear on
    "L1_staircase_A":       { type: "staircase", level: 1, position: { x: 10,  y: 0, z: 10  }, accessible: false, transitionPair: "L2_staircase_A" },

    // Lift nodes — one node per floor they appear on
    "L1_lift_A":            { type: "lift",      level: 1, position: { x: 9,   y: 0, z: 10  }, accessible: true,  transitionPair: "L2_lift_A"      },

    // -------------------------
    // LEVEL 2
    // -------------------------

    "L2_junction_main":      { type: "path",      level: 2, position: { x: 0,  y: 4, z: 0  } },
    "L2_junction_east":      { type: "path",      level: 2, position: { x: 10, y: 4, z: 0  } },

    "L2_door_library_front": { type: "door",      level: 2, position: { x: 8,  y: 4, z: 2  }, objectId: "obj_library" },
    "L2_door_library_side":  { type: "door",      level: 2, position: { x: 12, y: 4, z: 0  }, objectId: "obj_library" },

    "L2_marker_lobby":       { type: "marker",    level: 2, position: { x: 0,  y: 4, z: -2 } },

    "L2_staircase_A":        { type: "staircase", level: 2, position: { x: 10, y: 4, z: 10 }, accessible: false, transitionPair: "L1_staircase_A" },
    "L2_lift_A":             { type: "lift",      level: 2, position: { x: 9,  y: 4, z: 10 }, accessible: true,  transitionPair: "L1_lift_A"      },

    // ... repeat pattern for levels 3, 4, 5
  },

  // Explicit connections — every pair becomes a bidirectional link.
  // Only list each pair once — buildGraph() adds both directions automatically.
  // DO NOT add door node connections here — those are handled via the objects map.
  connections: [

    // --- Level 1 footpath junctions ---
    ["L1_junction_main",   "L1_junction_north"],
    ["L1_junction_main",   "L1_junction_east"],
    ["L1_junction_main",   "L1_junction_west"],
    ["L1_junction_west",   "L1_junction_carpark"],

    // --- Level 1 marker connections ---
    ["L1_marker_entrance", "L1_junction_main"],
    ["L1_marker_carpark",  "L1_junction_carpark"],

    // --- Level 1 staircase and lift to nearest junction ---
    ["L1_staircase_A",     "L1_junction_north"],
    ["L1_lift_A",          "L1_junction_north"],

    // --- Cross-floor transitions ---
    ["L1_staircase_A",     "L2_staircase_A"],
    ["L1_lift_A",          "L2_lift_A"],

    // --- Level 2 footpath junctions ---
    ["L2_junction_main",   "L2_junction_east"],

    // --- Level 2 marker connections ---
    ["L2_marker_lobby",    "L2_junction_main"],

    // --- Level 2 staircase and lift to nearest junction ---
    ["L2_staircase_A",     "L2_junction_main"],
    ["L2_lift_A",          "L2_junction_main"],

    // ... continue for levels 3, 4, 5
  ]
};
```

---

## Scenarios

### Scenario 1 — Marker → Object

The user starts at a named location and navigates to an interactable object.

```
Start: markers["marker_main_entrance"]          →  resolves to ["L1_junction_main"]
End:   objects["obj_library"].exits             →  resolves to ["L2_door_library_front", "L2_door_library_side"]

A* runs twice (1 start × 2 ends) and returns the shorter result.
```

```js
getRoute("marker_main_entrance", "obj_library", { accessibilityMode: false });
```

### Scenario 2 — Object → Object

The user starts at one interactable object and navigates to another.

```
Start: objects["obj_cafe"].exits    →  resolves to ["L1_door_cafe_main", "L1_door_cafe_back"]
End:   objects["obj_library"].exits →  resolves to ["L2_door_library_front", "L2_door_library_side"]

A* runs 4 times (2 starts × 2 ends) and returns the shortest result.
```

```js
getRoute("obj_cafe", "obj_library", { accessibilityMode: false });
```

### Accessibility Variant — applies to both scenarios

When `accessibilityMode: true`, staircase nodes return `Infinity` and lifts are used instead.

```js
getRoute("obj_cafe", "obj_library", { accessibilityMode: true });
```

---

## Building the Graph

> **Phase: Parse**
> Call `buildGraph()` once after your data files are loaded, before any routing.
> Store the result and reuse it — never rebuild the graph per frame or per route request.

```js
import createGraph from 'ngraph.graph';
import { navigationData } from './navigationData.js';
import { objects } from './objects.js';

/**
 * calcWeight
 * Returns the Euclidean distance between two positions on the horizontal plane.
 * Y is excluded — floor height difference is handled by the heuristic, not edge weights.
 */
function calcWeight(posA, posB) {
  const dx = posA.x - posB.x;
  const dz = posA.z - posB.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * buildGraph
 *
 * Phase: Parse — call once at startup.
 *
 * 1. Adds every node from navigationData.nodes
 * 2. Adds every connection from navigationData.connections as a bidirectional weighted link
 * 3. Loops through every exit on every object and connects each door node to its foot node
 */
function buildGraph(data, objects) {
  const graph = createGraph();

  // Step 1 — add all nodes
  for (const [id, nodeData] of Object.entries(data.nodes)) {
    graph.addNode(id, nodeData);
  }

  // Step 2 — add all explicit footpath/marker/staircase/lift connections
  for (const [idA, idB] of data.connections) {
    const nodeA = graph.getNode(idA);
    const nodeB = graph.getNode(idB);

    if (!nodeA) { console.warn(`buildGraph: node not found — "${idA}"`); continue; }
    if (!nodeB) { console.warn(`buildGraph: node not found — "${idB}"`); continue; }

    const weight = calcWeight(nodeA.data.position, nodeB.data.position);
    graph.addLink(idA, idB, { weight });
    graph.addLink(idB, idA, { weight });
  }

  // Step 3 — connect every door node to its foot node via the objects map
  for (const [, obj] of Object.entries(objects)) {
    for (const [exitId, exitData] of Object.entries(obj.exits)) {
      const exitNode     = graph.getNode(exitId);
      const junctionNode = graph.getNode(exitData.node);

      if (!exitNode)     { console.warn(`buildGraph: exit node not found — "${exitId}"`);           continue; }
      if (!junctionNode) { console.warn(`buildGraph: junction node not found — "${exitData.node}"`); continue; }

      if (graph.hasLink(exitId, exitData.node)) continue; // skip if already linked

      const weight = calcWeight(exitNode.data.position, junctionNode.data.position);
      graph.addLink(exitId, exitData.node, { weight });
      graph.addLink(exitData.node, exitId, { weight });
    }
  }

  return graph;
}

// Build once at parse time and export for use across your app
export const graph = buildGraph(navigationData, objects);
```

---

## Algorithm

> **Phase: User interaction**
> `findPath()` is called inside `getRoute()` each time the user requests a route.
> It is not called at parse time or in the render loop.

```js
import path from 'ngraph.path';

const LEVEL_WEIGHT = 20; // heuristic penalty per floor difference

/**
 * findPath
 *
 * Phase: User interaction (called by getRoute)
 *
 * Runs A* from one specific startNodeId to one specific endNodeId.
 * All routing rules are enforced in distance() by returning Infinity for blocked edges.
 *
 * Returns an array of node objects ordered start → end, or null if no path exists.
 */
function findPath(graph, startNodeId, endNodeId, { accessibilityMode = false } = {}) {

  const finder = path.aStar(graph, {

    /**
     * distance(fromNode, toNode, link)
     * Called for every edge A* considers. Returns Infinity to block an edge entirely.
     */
    distance(fromNode, toNode, link) {
      const type = toNode.data.type;

      // Lifts only usable in accessibility mode
      if (type === "lift" && !accessibilityMode) return Infinity;

      // Staircases blocked in accessibility mode
      if (type === "staircase" && accessibilityMode) return Infinity;

      // Markers are start-only — block traversal through them mid-path
      const isStart = toNode.id === startNodeId;
      if (type === "marker" && !isStart) return Infinity;

      return link.data.weight;
    },

    /**
     * heuristic(fromNode, toNode)
     * Estimates the remaining cost to the destination.
     * Euclidean distance + 20 per floor difference.
     * Must never overestimate — Euclidean distance guarantees this.
     */
    heuristic(fromNode, toNode) {
      const a = fromNode.data.position;
      const b = toNode.data.position;

      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const euclidean = Math.sqrt(dx * dx + dz * dz);

      const levelDiff    = Math.abs(fromNode.data.level - toNode.data.level);
      const levelPenalty = levelDiff * LEVEL_WEIGHT;

      return euclidean + levelPenalty;
    },

  });

  // ngraph returns path in END → START order — reverse for START → END
  const rawPath = finder.find(startNodeId, endNodeId);

  if (!rawPath || rawPath.length === 0) return null;

  return rawPath.reverse();
}
```

---

## Getting a Route

> **Phase: User interaction**
> Call `getRoute()` when the user confirms a start and destination selection.
> Call `clearPath()` when the user cancels or picks a new destination.

```js
import { objects } from './objects.js';
import { markers } from './markers.js';
import { graph }   from './graph.js';

/**
 * resolveExitIds
 *
 * Phase: User interaction (called by getRoute)
 *
 * Translates a marker ID or object ID into an array of graph node IDs.
 *
 * Markers  → one-item array containing their junction node ID
 * Objects  → array of all their exit door node IDs
 *
 * Always returns an array so getRoute can iterate consistently.
 */
function resolveExitIds(id) {
  if (markers[id] !== undefined) {
    return [markers[id]]; // markers resolve to a single node, wrapped in array
  }

  if (objects[id] !== undefined) {
    return Object.keys(objects[id].exits); // all exit node IDs for this object
  }

  console.warn(`resolveExitIds: "${id}" not found in markers or objects`);
  return [];
}

/**
 * calcPathDistance
 *
 * Sums the edge weights along a completed path to get the real total cost.
 * Used by getRoute to compare multiple paths and pick the shortest.
 */
function calcPathDistance(nodePath, graph) {
  let total = 0;

  for (let i = 0; i < nodePath.length - 1; i++) {
    const link = graph.getLink(nodePath[i].id, nodePath[i + 1].id);
    if (link) total += link.data.weight;
  }

  return total;
}

/**
 * buildPathSegments
 *
 * Phase: User interaction (called by getRoute)
 *
 * Groups a flat list of nodes into segments by floor.
 * The renderer uses these to draw the path floor-by-floor
 * and to show where the user changes levels.
 *
 * Input:  [nodeObj, nodeObj, ...]   ordered start → end
 * Output: [
 *   { level: 1, nodes: [{ id, type, position }, ...] },
 *   { level: 2, nodes: [{ id, type, position }, ...] },
 * ]
 */
function buildPathSegments(nodePath) {
  const segments = [];
  let current = { level: nodePath[0].data.level, nodes: [] };

  for (const node of nodePath) {
    if (node.data.level !== current.level) {
      segments.push(current);
      current = { level: node.data.level, nodes: [] };
    }

    current.nodes.push({
      id:       node.id,
      type:     node.data.type,
      position: node.data.position,
    });
  }

  segments.push(current);
  return segments;
}

/**
 * getRoute
 *
 * Phase: User interaction
 *
 * Main entry point — call this when the user selects a start and destination.
 * Tries every combination of start exit × end exit, returns the shortest path.
 *
 * startId       — a marker ID or object ID
 * destinationId — a marker ID or object ID
 * accessibilityMode — boolean, defaults to false
 *
 * Returns path segments grouped by floor, or null if no path is found.
 *
 * Example calls:
 *   getRoute("marker_main_entrance", "obj_library")                         // Scenario 1
 *   getRoute("obj_cafe", "obj_library")                                     // Scenario 2
 *   getRoute("obj_cafe", "obj_library", { accessibilityMode: true })        // Accessibility
 */
function getRoute(startId, destinationId, { accessibilityMode = false } = {}) {
  const startExits = resolveExitIds(startId);
  const endExits   = resolveExitIds(destinationId);

  if (startExits.length === 0 || endExits.length === 0) return null;

  let shortestPath     = null;
  let shortestDistance = Infinity;

  // Try every combination of start exit × end exit
  for (const startNodeId of startExits) {
    for (const endNodeId of endExits) {

      if (startNodeId === endNodeId) continue; // same node — skip

      const nodePath = findPath(graph, startNodeId, endNodeId, { accessibilityMode });
      if (!nodePath) continue;

      const totalDistance = calcPathDistance(nodePath, graph);

      if (totalDistance < shortestDistance) {
        shortestDistance = totalDistance;
        shortestPath     = nodePath;
      }
    }
  }

  if (!shortestPath) {
    console.warn(`getRoute: no path found — "${startId}" to "${destinationId}"`);
    return null;
  }

  return buildPathSegments(shortestPath);
}
```

---

## Rendering the Path

> **Phase: User interaction**
> Call `drawPath()` immediately after `getRoute()` returns a result.
> Call `clearPath()` when the user cancels navigation or selects a new destination.
> Never call either function inside the Three.js render loop.

```js
let pathRenderGroup = null;

/**
 * drawPath
 *
 * Phase: User interaction
 *
 * Renders the route returned by getRoute() in the Three.js scene.
 * Draws one line per floor segment.
 * Sphere markers at staircase/lift nodes indicate where the user changes floors.
 *
 * segments — output of getRoute()
 * scene    — your THREE.Scene instance
 */
function drawPath(segments, scene) {
  clearPath(scene); // always clear previous path first

  pathRenderGroup = new THREE.Group();
  pathRenderGroup.name = "navigation_path";

  for (const segment of segments) {
    const vectors = segment.nodes.map(n =>
      new THREE.Vector3(n.position.x, n.position.y, n.position.z)
    );

    // Path line for this floor
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(vectors),
      new THREE.LineBasicMaterial({ color: 0x00aaff })
    );
    pathRenderGroup.add(line);

    // Sphere at each floor transition node
    for (const node of segment.nodes) {
      if (node.type !== "staircase" && node.type !== "lift") continue;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.25),
        new THREE.MeshBasicMaterial({
          color: node.type === "lift" ? 0xffaa00 : 0xff4400
          // lift = orange  |  staircase = red-orange
        })
      );
      sphere.position.set(node.position.x, node.position.y, node.position.z);
      pathRenderGroup.add(sphere);
    }
  }

  scene.add(pathRenderGroup);
}

/**
 * clearPath
 *
 * Phase: User interaction
 *
 * Removes the rendered path from the scene and frees GPU memory.
 * Always call this before drawing a new path.
 */
function clearPath(scene) {
  if (!pathRenderGroup) return;

  pathRenderGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });

  scene.remove(pathRenderGroup);
  pathRenderGroup = null;
}
```

---

## Debug Tools

> **Phase: Parse (dev only)**
> Call `debugDrawGraph()` and `checkConnectivity()` once after `buildGraph()` during development.
> Remove or gate these calls behind a dev flag before shipping.

```js
let debugGroup = null;

/**
 * debugDrawGraph
 *
 * Phase: Parse — dev only
 *
 * Renders every node as a coloured sphere and every edge as a grey line.
 * Press G to toggle visibility.
 *
 * Colour key:
 *   Green       = path (junction) node
 *   Blue        = door node
 *   Yellow      = marker node
 *   Red-orange  = staircase node
 *   Purple      = lift node
 *
 * What to look for:
 *   Node with no lines    → isolated — add a connection for it
 *   Line through a wall   → false link — remove it from navigationData.connections
 *   No lines between floors → missing cross-floor link for a staircase/lift pair
 *   Door node not connected → check the exits map for that object
 */
function debugDrawGraph(graph, scene) {
  if (debugGroup) scene.remove(debugGroup);

  debugGroup = new THREE.Group();
  debugGroup.name = "debug_graph";

  const colorMap = {
    path:      0x00ff00,
    door:      0x0000ff,
    marker:    0xffff00,
    staircase: 0xff4400,
    lift:      0xcc00ff,
  };

  graph.forEachNode(node => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.15),
      new THREE.MeshBasicMaterial({ color: colorMap[node.data.type] ?? 0xffffff })
    );
    sphere.position.set(node.data.position.x, node.data.position.y, node.data.position.z);
    debugGroup.add(sphere);
  });

  graph.forEachLink(link => {
    const a = graph.getNode(link.fromId);
    const b = graph.getNode(link.toId);
    if (!a || !b) return;

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.data.position.x, a.data.position.y, a.data.position.z),
        new THREE.Vector3(b.data.position.x, b.data.position.y, b.data.position.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0x888888 })
    );
    debugGroup.add(line);
  });

  debugGroup.visible = false;
  scene.add(debugGroup);
  console.log("Debug graph ready — press G to toggle");
}

// Toggle debug graph visibility with G key — dev only
window.addEventListener("keydown", e => {
  if ((e.key === "g" || e.key === "G") && debugGroup) {
    debugGroup.visible = !debugGroup.visible;
  }
});

/**
 * checkConnectivity
 *
 * Phase: Parse — dev only
 *
 * BFS from the first node. Every node must be reachable from every other node.
 * Any unreachable node will cause A* to silently return null for routes involving it.
 * Fix all warnings before shipping.
 */
function checkConnectivity(graph) {
  const allIds = new Set();
  graph.forEachNode(node => allIds.add(node.id));

  const firstId = allIds.values().next().value;
  const visited = new Set([firstId]);
  const queue   = [firstId];

  while (queue.length > 0) {
    const current = queue.shift();
    graph.forEachLinkedNode(current, neighbor => {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    });
  }

  const unreachable = [...allIds].filter(id => !visited.has(id));

  if (unreachable.length > 0) {
    console.warn(`${unreachable.length} isolated node(s):`, unreachable);
  } else {
    console.log(`Graph fully connected ✓  (${allIds.size} nodes)`);
  }
}
```

---

## URL Parameter Testing

> **Phase: Parse — dev only**
> `checkURLParams()` runs once after the graph and scene are ready.
> It reads `start_id` and `end_id` from the URL and triggers a route automatically.
> Remove or gate this behind a dev flag before shipping.

This lets you test any route instantly by pasting a URL into the browser — no UI interaction needed.

### Usage

```
# Scenario 1 — marker to object
http://localhost:5173/?start_id=marker_main_entrance&end_id=obj_library

# Scenario 2 — object to object
http://localhost:5173/?start_id=obj_cafe&end_id=obj_library

# Accessibility mode
http://localhost:5173/?start_id=obj_cafe&end_id=obj_library&accessible=true

# Cross-floor route
http://localhost:5173/?start_id=marker_carpark&end_id=obj_library

# Same floor route
http://localhost:5173/?start_id=marker_main_entrance&end_id=obj_cafe
```

### Implementation

```js
/**
 * checkURLParams
 *
 * Phase: Parse — dev only
 *
 * Reads start_id, end_id, and accessible from the URL query string.
 * If both start_id and end_id are present, runs getRoute() and draws the result.
 * Logs the result to the console with full segment detail for inspection.
 *
 * Call this once after buildGraph() and scene setup are complete.
 *
 * Parameters:
 *   scene — your THREE.Scene instance (needed to draw the path)
 */
function checkURLParams(scene) {
  const params = new URLSearchParams(window.location.search);

  const startId    = params.get("start_id");
  const endId      = params.get("end_id");
  const accessible = params.get("accessible") === "true";

  // If neither param is present, do nothing — normal app startup
  if (!startId && !endId) return;

  // If only one is provided, warn the developer
  if (!startId || !endId) {
    console.warn("checkURLParams: both start_id and end_id are required.");
    console.warn(`  Received: start_id="${startId}" end_id="${endId}"`);
    return;
  }

  console.group(`checkURLParams: testing route`);
  console.log(`  start_id:   ${startId}`);
  console.log(`  end_id:     ${endId}`);
  console.log(`  accessible: ${accessible}`);

  const segments = getRoute(startId, endId, { accessibilityMode: accessible });

  if (!segments) {
    console.warn("  Result: no path found.");
    console.groupEnd();
    return;
  }

  // Log the full path detail so you can inspect every node
  console.log(`  Result: ${segments.length} floor segment(s)`);

  segments.forEach((seg, i) => {
    console.group(`  Segment ${i + 1} — Level ${seg.level} (${seg.nodes.length} nodes)`);
    seg.nodes.forEach(node => {
      console.log(`    [${node.type.padEnd(10)}] ${node.id}`);
    });
    console.groupEnd();
  });

  console.groupEnd();

  // Draw the path in the scene
  drawPath(segments, scene);
}
```

### Example console output

```
checkURLParams: testing route
  start_id:   obj_cafe
  end_id:     obj_library
  accessible: false
  Result: 2 floor segment(s)
  Segment 1 — Level 1 (4 nodes)
    [door      ] L1_door_cafe_main
    [path      ] L1_junction_main
    [path      ] L1_junction_north
    [staircase ] L1_staircase_A
  Segment 2 — Level 2 (4 nodes)
    [staircase ] L2_staircase_A
    [path      ] L2_junction_main
    [path      ] L2_junction_east
    [door      ] L2_door_library_front
```

---

## Implementation Order

### Step 1 — Install packages  `Phase: Setup`
```bash
npm install ngraph.graph ngraph.path
```

### Step 2 — Define objects and markers  `Phase: Load`
Fill in `objects.js` and `markers.js` to match every interactable object
and named location in your scene.

### Step 3 — Define navigationData  `Phase: Load`
Fill in `navigationData.js` with all nodes and connections for all 5 levels.
Use `L{level}_{type}_{name}` naming consistently.
Do not add door node connections here — those come from the objects map.

### Step 4 — Build the graph  `Phase: Parse`
```js
// Call once, after all data files are loaded
const graph = buildGraph(navigationData, objects);
```

### Step 5 — Run connectivity check  `Phase: Parse — dev only`
```js
checkConnectivity(graph);
// Fix every warning before continuing
```

### Step 6 — Draw the debug graph  `Phase: Parse — dev only`
```js
debugDrawGraph(graph, scene);
// Press G to toggle
// Check: every node has connections, no lines through walls, stairs/lifts have cross-floor links
```

### Step 7 — Test with URL parameters  `Phase: Parse — dev only`
```js
// Call after graph and scene are ready
checkURLParams(scene);
```

Then open the browser at:
```
http://localhost:5173/?start_id=marker_main_entrance&end_id=obj_cafe
http://localhost:5173/?start_id=obj_cafe&end_id=obj_library
http://localhost:5173/?start_id=obj_cafe&end_id=obj_library&accessible=true
```

Inspect the console output and verify the path nodes match your expected route.

### Step 8 — Wire up rendering  `Phase: User interaction`
```js
const segments = getRoute(startId, destinationId, { accessibilityMode });
if (segments) drawPath(segments, scene);
```

### Step 9 — Connect to your UI  `Phase: User interaction`
Hook `getRoute` into your click and selection handlers.
Call `clearPath(scene)` when the user cancels or selects a new destination.

### Step 10 — Remove dev tooling before shipping  `Phase: Cleanup`
Gate or remove these calls when building for production:
```js
// Remove or wrap in: if (import.meta.env.DEV) { ... }
checkConnectivity(graph);
debugDrawGraph(graph, scene);
checkURLParams(scene);
```

---

## Rules Reference

| Rule | Enforced in | Phase | How |
|---|---|---|---|
| Markers are start-only, never mid-path | `distance()` in `findPath` | User interaction | Returns `Infinity` if marker is not the start node |
| Lifts only in accessibility mode | `distance()` in `findPath` | User interaction | Returns `Infinity` if lift and `!accessibilityMode` |
| Staircases blocked in accessibility mode | `distance()` in `findPath` | User interaction | Returns `Infinity` if staircase and `accessibilityMode` |
| Objects valid as both start and end | `resolveExitIds()` | User interaction | Returns all exit IDs regardless of role |
| Destination resolves to nearest exit | `getRoute()` | User interaction | Runs A\* for every exit combination, picks shortest |
| Door nodes auto-connected to their foot node | `buildGraph()` | Parse | Reads `objects[id].exits` and links each exit to its node |
| Cross-floor links are explicit | `navigationData.connections` | Load | Staircase/lift pairs manually listed |
| Path ordered start → end | `findPath()` | User interaction | `rawPath.reverse()` after ngraph returns end → start |
| Edge weights are Euclidean distance | `buildGraph()` | Parse | `calcWeight()` called for every connection pair |
| Level changes cost 20 per floor | `heuristic()` in `findPath` | User interaction | `levelDiff × LEVEL_WEIGHT` added to H score |
| Graph built once and reused | `graph.js` export | Parse | Module-level constant, never rebuilt per route |