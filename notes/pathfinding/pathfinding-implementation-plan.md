# Three.js Multi-Level Map — Pathfinding Implementation Plan

---

## Table of Contents

1. [Overview](#overview)
2. [How A\* Works](#how-a-works)
3. [JavaScript Concepts You Need](#javascript-concepts-you-need)
4. [Packages to Install](#packages-to-install)
5. [Data Structures](#data-structures)
6. [Building the Graph](#building-the-graph)
7. [Auto-Connecting Nodes with KDBush](#auto-connecting-nodes-with-kdbush)
8. [Running A\*](#running-a)
9. [Resolving Start & End Points](#resolving-start--end-points)
10. [Rendering the Path in Three.js](#rendering-the-path-in-threejs)
11. [Debug Tools](#debug-tools)
12. [Connectivity Check](#connectivity-check)
13. [Implementation Order](#implementation-order)
14. [Rules Reference](#rules-reference)

---

## Overview

Your map has:
- **5 levels**, each with walkable footpath nodes
- **Interactable objects** (rooms, facilities) — valid as **both start and end points**
- **Markers** — valid as **start points only**
- **Staircases** — level transitions, blocked in accessibility mode
- **Lifts** — level transitions, only available in accessibility mode
- **Door nodes** — the precise endpoint attached to every interactable object

The goal is: given a start (marker or object) and a destination (object), find the shortest walkable path across one or more floors, respecting accessibility rules.

---

## How A\* Works

### The Core Idea

A\* is a pathfinding algorithm. It finds the shortest path between two points in a graph (a network of connected nodes).

Imagine you're navigating a building. You want to get from the entrance to a specific room. You could:
- **Explore randomly** — inefficient, may never find the best path
- **Explore everything equally (BFS)** — guaranteed shortest path but wastes time going in useless directions
- **Use A\*** — guides exploration toward the destination using a smart estimate

### The F = G + H Formula

Every candidate node during A\* exploration gets a score:

```
F = G + H

G = actual distance walked from the start to this node (known precisely)
H = estimated distance from this node to the destination (a guess — the heuristic)
F = total estimated cost of a path through this node
```

A\* always explores whichever node has the **lowest F score** next. This keeps it focused on the most promising direction while still guaranteeing the optimal path.

### Why Euclidean Distance as the Heuristic?

The heuristic (H) must never *overestimate* the real remaining distance. If it does, A\* might skip the true shortest path.

**Euclidean distance** — the straight-line ruler distance between two points — is a perfect heuristic because:
- You can never walk a shorter distance than a straight line
- It therefore never overestimates
- It is cheap to calculate (just Pythagoras' theorem)

### The MinHeap

A\* needs to constantly pick the node with the lowest F score. A **MinHeap** is a data structure that always keeps the smallest item at the front — retrieval is O(1) (instant). `ngraph.path` handles this internally so you don't need to build one.

---

## JavaScript Concepts You Need

Before reading the code, here are the patterns used throughout.

### Objects `{}`

A container of named values:

```javascript
const node = {
  id: "L1_node_001",   // key: value
  level: 1,
  type: "path",
};

console.log(node.id);    // "L1_node_001"
console.log(node.level); // 1
```

### Arrays `[]`

An ordered list:

```javascript
const items = ["apple", "banana", "cherry"];

console.log(items[0]);    // "apple" — zero-indexed
console.log(items.length) // 3

items.push("date");       // add to end
items.unshift("fig");     // add to front
items.shift();            // remove from front
```

### `const` vs `let`

```javascript
const x = 5;  // cannot be reassigned — use for things that won't change
let y = 5;    // can be reassigned — use inside loops or when value changes
y = 10;       // fine
x = 10;       // ERROR
```

### Arrow functions `=>`

A shorter way to write a function:

```javascript
// Traditional
function add(a, b) {
  return a + b;
}

// Arrow function — same thing
const add = (a, b) => a + b;

// With a body (multiple lines)
const add = (a, b) => {
  const result = a + b;
  return result;
};
```

### Destructuring

Extract values from objects or arrays cleanly:

```javascript
// Object destructuring
const node = { id: "L1_001", level: 1, type: "path" };
const { id, level } = node;
// id = "L1_001", level = 1

// Rename while destructuring
const { id: nodeId } = node;
// nodeId = "L1_001"

// Array destructuring
const [first, second] = [10, 20];
// first = 10, second = 20

// In function parameters
function greet({ name, age }) {
  console.log(name, age);
}
greet({ name: "Alice", age: 30 }); // "Alice" 30
```

### Spread operator `...`

Copies items from one array/object into another:

```javascript
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

const obj1 = { a: 1 };
const obj2 = { ...obj1, b: 2 }; // { a: 1, b: 2 }
```

### Optional chaining `?.`

Safely accesses a property that might not exist — avoids crashes:

```javascript
const node = null;

console.log(node.position.x);   // CRASH — TypeError
console.log(node?.position?.x); // undefined — safe
```

### Nullish coalescing `??`

Returns the right side if the left is `null` or `undefined`:

```javascript
const score = null;
console.log(score ?? Infinity); // Infinity

const score2 = 5;
console.log(score2 ?? Infinity); // 5
```

### `.filter()`

Returns a new array keeping only items where the function returns `true`:

```javascript
const numbers = [1, 2, 3, 4, 5];
const evens = numbers.filter(n => n % 2 === 0); // [2, 4]
```

### `.map()`

Returns a new array where every item is transformed:

```javascript
const numbers = [1, 2, 3];
const doubled = numbers.map(n => n * 2); // [2, 4, 6]
```

### `.find()`

Returns the first item where the function returns `true`, or `undefined`:

```javascript
const nodes = [
  { id: "A", type: "door" },
  { id: "B", type: "path" },
];
const door = nodes.find(n => n.type === "door"); // { id: "A", type: "door" }
```

### `.some()`

Returns `true` if at least one item passes the test:

```javascript
const hits = [{ distance: 5 }, { distance: 0.3 }];
const blocked = hits.some(h => h.distance < 1.0); // true
```

### Classes

A blueprint for creating objects with shared behaviour:

```javascript
class Animal {
  constructor(name) {  // runs when you write "new Animal(...)"
    this.name = name;  // "this" refers to the specific instance
  }

  speak() {
    console.log(this.name + " makes a sound");
  }
}

const dog = new Animal("Rex");
dog.speak(); // "Rex makes a sound"
```

---

## Packages to Install

```bash
npm install ngraph.graph ngraph.path kdbush
```

| Package | What it does | What it replaces |
|---|---|---|
| `ngraph.graph` | Stores your navigation graph (nodes + edges) | Manual `{}` node maps and connection arrays |
| `ngraph.path` | Runs A\* with a built-in MinHeap | Your entire A\* function and MinHeap class |
| `kdbush` | Spatial index for fast proximity queries | The O(n²) double loop to find nearby nodes |

---

## Data Structures

Before writing any code, define what each thing in your map is.

### Node — every walkable point

A node is a single point in your navigation graph. Every footpath step, every door, every staircase, every lift, every marker is a node.

```javascript
// This is what gets stored inside ngraph — the "data" on each node
const nodeData = {
  type: "path",              // 'path' | 'door' | 'staircase' | 'lift' | 'marker'
  level: 2,                  // which floor: 1 to 5
  position: {
    x: 10,
    y: 4,                    // set to your floor's Y in Three.js
    z: -3,
  },
  accessible: true,          // false only for staircase nodes
  // Door nodes only:
  objectId: null,            // which object this door belongs to e.g. "obj_cafe_L1"
  // Staircase/lift nodes only:
  transitionPair: null,      // the paired node ID on the connected floor e.g. "L2_staircase_A"
};
```

**Node ID naming convention — always follow this format:**

```
L{level}_{type}_{identifier}

Examples:
  L1_node_001          — footpath node on level 1
  L1_door_cafe         — door node for the cafe on level 1
  L2_staircase_A       — staircase A on level 2
  L3_lift_B            — lift B on level 3
  L1_marker_entrance   — main entrance marker on level 1
```

This makes debugging much easier — you can read any node ID and immediately know what it is.

### Interactable Object

Every room, facility, or interactive thing in your scene:

```javascript
const mapObject = {
  id: "obj_cafe_L1",         // unique ID
  name: "Cafe",              // display name shown to user
  level: 1,
  type: "room",              // 'room' | 'toilet' | 'office' | 'facility' etc.
  mesh: threeJsMeshRef,      // reference to the Three.js object in your scene
  doorNodeId: "L1_door_cafe", // the graph node users navigate TO (or FROM)
  isInteractable: true,
};
```

> **Important:** Objects can be both start and end points. The `doorNodeId` is used in both cases.

### Marker

A named starting location — a spawn point or entrance:

```javascript
const marker = {
  id: "marker_main_entrance",
  name: "Main Entrance",
  level: 1,
  nodeId: "L1_marker_entrance", // its graph node
  startOnly: true,              // markers can only be a start, not a destination
};
```

### Staircase

A level transition that non-accessibility users take:

```javascript
const staircase = {
  id: "stair_A_L1",
  type: "staircase",
  level: 1,
  nodeId: "L1_staircase_A",          // node on THIS floor
  transitionPair: "L2_staircase_A",  // paired node on the NEXT floor
  accessible: false,                 // blocked in accessibility mode
};
```

### Lift

A level transition only available in accessibility mode:

```javascript
const lift = {
  id: "lift_A_L1",
  type: "lift",
  level: 1,
  nodeId: "L1_lift_A",
  transitionPair: "L2_lift_A",
  accessible: true,                  // only available in accessibility mode
};
```

### Index Maps — for fast lookup

Store objects and markers in flat maps so you can find them in O(1):

```javascript
// Key = object/marker ID, Value = the full object or marker
const objectIndex = {
  "obj_cafe_L1": { id: "obj_cafe_L1", doorNodeId: "L1_door_cafe", ... },
  "obj_library_L3": { id: "obj_library_L3", doorNodeId: "L3_door_library", ... },
};

const markerIndex = {
  "marker_main_entrance": { nodeId: "L1_marker_entrance", ... },
  "marker_lobby_L2": { nodeId: "L2_marker_lobby", ... },
};
```

---

## Building the Graph

```javascript
import createGraph from 'ngraph.graph';

// Create the graph — this is your entire navigation network
const graph = createGraph();

// --- FOOTPATH NODES ---
// These are placed along your walkways. Add one for each walkable point.
// Position values come from your Three.js scene.
graph.addNode("L1_node_001", {
  type: "path",
  level: 1,
  position: { x: 0, y: 0, z: 0 },
  accessible: true,
});

graph.addNode("L1_node_002", {
  type: "path",
  level: 1,
  position: { x: 2, y: 0, z: 0 },
  accessible: true,
});

// --- DOOR NODES ---
// One per interactable object. Position it just outside the door in the scene.
graph.addNode("L1_door_cafe", {
  type: "door",
  level: 1,
  position: { x: 4, y: 0, z: 1 },
  objectId: "obj_cafe_L1",
  accessible: true,
});

// --- MARKER NODES ---
graph.addNode("L1_marker_entrance", {
  type: "marker",
  level: 1,
  position: { x: -5, y: 0, z: 0 },
  accessible: true,
});

// --- STAIRCASE NODES (one per floor it connects) ---
graph.addNode("L1_staircase_A", {
  type: "staircase",
  level: 1,
  position: { x: 10, y: 0, z: 5 },
  accessible: false,
  transitionPair: "L2_staircase_A",
});

graph.addNode("L2_staircase_A", {
  type: "staircase",
  level: 2,
  position: { x: 10, y: 4, z: 5 },  // same X/Z, different Y
  accessible: false,
  transitionPair: "L1_staircase_A",
});

// --- LIFT NODES ---
graph.addNode("L1_lift_A", {
  type: "lift",
  level: 1,
  position: { x: 8, y: 0, z: 5 },
  accessible: true,
  transitionPair: "L2_lift_A",
});

graph.addNode("L2_lift_A", {
  type: "lift",
  level: 2,
  position: { x: 8, y: 4, z: 5 },
  accessible: true,
  transitionPair: "L1_lift_A",
});

// --- MANUAL CONNECTIONS ---
// For special nodes (doors, stairs, lifts, markers) — connect manually to their
// nearest path node(s). Always add both directions.

const FLOOR_HEIGHT_COST = 5; // extra cost for changing floors — tune this value

// Staircase cross-floor connection
graph.addLink("L1_staircase_A", "L2_staircase_A", { weight: FLOOR_HEIGHT_COST });
graph.addLink("L2_staircase_A", "L1_staircase_A", { weight: FLOOR_HEIGHT_COST });

// Lift cross-floor connection
graph.addLink("L1_lift_A", "L2_lift_A", { weight: FLOOR_HEIGHT_COST });
graph.addLink("L2_lift_A", "L1_lift_A", { weight: FLOOR_HEIGHT_COST });

// Door to nearest path node
graph.addLink("L1_door_cafe", "L1_node_002", { weight: 2.5 });
graph.addLink("L1_node_002", "L1_door_cafe", { weight: 2.5 });

// Marker to nearest path node
graph.addLink("L1_marker_entrance", "L1_node_001", { weight: 1.0 });
graph.addLink("L1_node_001", "L1_marker_entrance", { weight: 1.0 });
```

---

## Auto-Connecting Nodes with KDBush

Manually connecting every footpath node would be extremely tedious. KDBush builds a **spatial index** — a tree structure that makes proximity queries fast.

Without KDBush, finding all nearby nodes requires comparing every node against every other node — O(n²). With KDBush, it's O(log n).

```javascript
import KDBush from 'kdbush';

/**
 * buildSpatialIndex
 *
 * Collects all nodes from the graph into a flat array,
 * then builds a spatial tree from their X/Z positions.
 *
 * We use X and Z (not Y) because nodes sit on the floor plane —
 * Y just tells us which floor they're on, not where horizontally.
 *
 * Returns:
 *   index    — the KDBush tree (for range queries)
 *   nodeList — the flat array (so we can look up full node data by index)
 */
function buildSpatialIndex(graph) {
  const nodeList = [];

  // graph.forEachNode runs a function on every node in the graph
  graph.forEachNode(node => nodeList.push(node));

  const index = new KDBush(nodeList.length);

  for (const node of nodeList) {
    index.add(node.data.position.x, node.data.position.z);
  }

  index.finish(); // must call this before querying — builds the internal tree

  return { index, nodeList };
}

/**
 * autoConnectNodes
 *
 * For every footpath node, finds all other footpath nodes on the same floor
 * within connectRadius units, and creates a bidirectional link between them.
 *
 * Only connects "path" type nodes — door/stair/lift/marker nodes
 * should be connected manually since they need precise placement.
 *
 * connectRadius — tune this to match the spacing of your footpath nodes.
 *   Too small: nodes won't connect, graph is fragmented.
 *   Too large: nodes connect through walls.
 */
function autoConnectNodes(graph, connectRadius = 2.0) {
  const { index, nodeList } = buildSpatialIndex(graph);

  graph.forEachNode(nodeA => {
    // Only auto-connect footpath nodes
    if (nodeA.data.type !== "path") return;

    const { x, z } = nodeA.data.position;

    // range(minX, minY, maxX, maxY) returns indices of nodes within a square area
    // We then filter to a circle using actual Euclidean distance
    const nearbyIndices = index.range(
      x - connectRadius,
      z - connectRadius,
      x + connectRadius,
      z + connectRadius
    );

    for (const i of nearbyIndices) {
      const nodeB = nodeList[i];

      // Skip self
      if (nodeB.id === nodeA.id) continue;

      // Only connect nodes on the same floor
      // (cross-floor connections are handled manually via staircase/lift pairs)
      if (nodeB.data.level !== nodeA.data.level) continue;

      // Only auto-connect path nodes — leave others for manual connection
      if (nodeB.data.type !== "path") continue;

      // Skip if a link already exists in this direction
      if (graph.hasLink(nodeA.id, nodeB.id)) continue;

      // Calculate real distance (kdbush gives a square region, we want a circle)
      const dx = nodeA.data.position.x - nodeB.data.position.x;
      const dz = nodeA.data.position.z - nodeB.data.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Discard nodes in the corners of the square that are outside the circle
      if (dist > connectRadius) continue;

      // Add bidirectional link with the real distance as the weight
      graph.addLink(nodeA.id, nodeB.id, { weight: dist });
      graph.addLink(nodeB.id, nodeA.id, { weight: dist });
    }
  });
}

// Call this AFTER adding all path nodes, BEFORE adding manual special connections
autoConnectNodes(graph, 2.0);
```

---

## Running A\*

```javascript
import path from 'ngraph.path';

const FLOOR_HEIGHT_COST = 5; // cost of changing floors — should be larger than
                              // your average same-floor edge weight so A* doesn't
                              // change floors unless necessary

/**
 * findPath
 *
 * Runs A* from startNodeId to endNodeId, respecting routing rules.
 *
 * Parameters:
 *   graph            — your ngraph.graph instance
 *   startNodeId      — ID of the starting node (string)
 *   endNodeId        — ID of the destination node (string)
 *   accessibilityMode — if true, uses lifts instead of stairs
 *
 * Returns:
 *   Array of node objects from start to end, or null if no path exists.
 */
function findPath(graph, startNodeId, endNodeId, { accessibilityMode = false } = {}) {

  const finder = path.aStar(graph, {

    /**
     * distance(fromNode, toNode, link)
     *
     * Called by A* for every edge it considers.
     * Returns the "cost" of traversing this edge.
     * Returning Infinity makes the edge impassable — A* will never use it.
     *
     * This is where all routing rules are enforced.
     */
    distance(fromNode, toNode, link) {
      const type = toNode.data.type;

      // Rule 1: Lifts are only available in accessibility mode
      if (type === "lift" && !accessibilityMode) return Infinity;

      // Rule 2: Stairs are blocked in accessibility mode
      if (type === "staircase" && accessibilityMode) return Infinity;

      // Rule 3: Markers cannot be passed through mid-path.
      // A marker is only valid if it is the actual start node.
      // (Markers are start-only — they should never appear mid-route.)
      const isStart = toNode.id === startNodeId;
      if (type === "marker" && !isStart) return Infinity;

      // All other edges use their real stored weight
      return link.data.weight;
    },

    /**
     * heuristic(fromNode, toNode)
     *
     * A* calls this to estimate the remaining distance to the destination.
     * We use Euclidean (straight-line) distance on the floor plane + a floor penalty.
     *
     * This must NEVER overestimate — if it does, A* won't find the true shortest path.
     * Euclidean distance is safe because you can't walk shorter than a straight line.
     */
    heuristic(fromNode, toNode) {
      const a = fromNode.data.position;
      const b = toNode.data.position;

      const dx = a.x - b.x;
      const dz = a.z - b.z;

      // Pythagoras' theorem — straight-line distance on the horizontal plane
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      // Add a penalty if the nodes are on different floors.
      // Math.abs gives the positive difference e.g. abs(1 - 3) = 2
      const levelDiff = Math.abs(fromNode.data.level - toNode.data.level) * FLOOR_HEIGHT_COST;

      return horizontalDist + levelDiff;
    },

  });

  // finder.find() runs A* and returns an array of node objects.
  // ngraph returns the path in END → START order, so we reverse it.
  const rawPath = finder.find(startNodeId, endNodeId);

  // rawPath is an empty array (not null) if no path was found
  if (!rawPath || rawPath.length === 0) return null;

  return rawPath.reverse(); // now ordered START → END
}
```

---

## Resolving Start & End Points

The user selects objects or markers by clicking in the scene. This function translates those selections into node IDs, then calls `findPath`.

```javascript
/**
 * getRoute
 *
 * The main entry point for pathfinding.
 * Call this whenever the user selects a start and destination.
 *
 * Parameters:
 *   startId       — ID of a marker OR an interactable object
 *   destinationId — ID of a marker OR an interactable object
 *   accessibilityMode — boolean
 *
 * Returns:
 *   Array of path segments grouped by floor, ready for rendering.
 *   Null if no path found or IDs are invalid.
 */
function getRoute(startId, destinationId, { accessibilityMode = false } = {}) {

  // --- Resolve START node ---
  // Could be a marker (has .nodeId) or an object (has .doorNodeId)
  let startNodeId;

  if (markerIndex[startId]) {
    // It's a marker — use its dedicated node
    startNodeId = markerIndex[startId].nodeId;
  } else if (objectIndex[startId]) {
    // It's an interactable object — use its door node as the start
    startNodeId = objectIndex[startId].doorNodeId;
  } else {
    console.warn("getRoute: unknown start ID:", startId);
    return null;
  }

  // --- Resolve END node ---
  // Same logic — both markers and objects are valid destinations
  let endNodeId;

  if (markerIndex[destinationId]) {
    endNodeId = markerIndex[destinationId].nodeId;
  } else if (objectIndex[destinationId]) {
    endNodeId = objectIndex[destinationId].doorNodeId;
  } else {
    console.warn("getRoute: unknown destination ID:", destinationId);
    return null;
  }

  // --- Run A* ---
  const nodePath = findPath(graph, startNodeId, endNodeId, { accessibilityMode });

  if (!nodePath) {
    console.warn("getRoute: no path found between", startNodeId, "and", endNodeId);
    return null;
  }

  // --- Group into segments by floor for rendering ---
  return buildPathSegments(nodePath);
}

/**
 * buildPathSegments
 *
 * Groups a flat list of nodes into segments, one per floor.
 * This lets you render the path floor-by-floor and highlight
 * where the user changes floors.
 *
 * Input:  [nodeObj, nodeObj, nodeObj, ...]  (start → end)
 * Output: [
 *   { level: 1, nodes: [...] },
 *   { level: 2, nodes: [...] },
 * ]
 */
function buildPathSegments(nodePath) {
  const segments = [];

  // Start with the first node's floor
  let currentSegment = {
    level: nodePath[0].data.level,
    nodes: [],
  };

  for (const node of nodePath) {
    // When the floor changes, save the current segment and start a new one
    if (node.data.level !== currentSegment.level) {
      segments.push(currentSegment);
      currentSegment = { level: node.data.level, nodes: [] };
    }

    // Add a simplified version of the node for rendering
    currentSegment.nodes.push({
      id: node.id,
      type: node.data.type,
      position: node.data.position,
    });
  }

  // Don't forget the last segment
  segments.push(currentSegment);

  return segments;
}
```

---

## Rendering the Path in Three.js

```javascript
// Keep references to rendered path objects so we can clear them later
let pathRenderGroup = null;

/**
 * drawPath
 *
 * Takes the output of buildPathSegments and renders it in the scene.
 * Lines are drawn per floor. Transition nodes (stairs/lifts) get a
 * sphere marker so the user knows where to change floors.
 *
 * Parameters:
 *   segments   — output of buildPathSegments()
 *   levelGroups — your Three.js Group objects per floor e.g. { 1: group1, 2: group2 }
 *   scene      — your main Three.js scene
 */
function drawPath(segments, levelGroups, scene) {
  // Remove previous path if one exists
  if (pathRenderGroup) {
    scene.remove(pathRenderGroup);
    pathRenderGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  pathRenderGroup = new THREE.Group();
  pathRenderGroup.name = "navigation_path";

  for (const segment of segments) {
    const { level, nodes } = segment;

    // Convert node positions to Three.js Vector3 objects
    const vectors = nodes.map(n => new THREE.Vector3(
      n.position.x,
      n.position.y,
      n.position.z
    ));

    // Draw the path line for this floor
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(vectors);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00aaff,  // blue line
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    pathRenderGroup.add(line);

    // Draw a sphere at transition nodes (staircases and lifts)
    // so the user knows where to go up/down
    for (const node of nodes) {
      if (node.type !== "staircase" && node.type !== "lift") continue;

      const sphereGeometry = new THREE.SphereGeometry(0.25);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: node.type === "lift" ? 0xffaa00 : 0xff4400,
        // lift = orange, staircase = red-orange
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(node.position.x, node.position.y, node.position.z);
      pathRenderGroup.add(sphere);
    }
  }

  scene.add(pathRenderGroup);
}

/**
 * clearPath
 *
 * Call this when the user cancels navigation or selects a new route.
 */
function clearPath(scene) {
  if (pathRenderGroup) {
    scene.remove(pathRenderGroup);
    pathRenderGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    pathRenderGroup = null;
  }
}
```

---

## Debug Tools

Use these during development — you won't be able to tell if your graph is correct without visualising it.

```javascript
let debugGroup = null;

/**
 * debugDrawGraph
 *
 * Renders every node as a coloured sphere and every connection as a grey line.
 * Colour key:
 *   Green   = path node
 *   Blue    = door node
 *   Yellow  = marker node
 *   Red-orange = staircase node
 *   Purple  = lift node
 *
 * Toggle visibility with G key (see keydown listener below).
 */
function debugDrawGraph(graph, scene) {
  if (debugGroup) scene.remove(debugGroup);

  debugGroup = new THREE.Group();
  debugGroup.name = "debug_graph";

  const nodeColorMap = {
    path:      0x00ff00,
    door:      0x0000ff,
    marker:    0xffff00,
    staircase: 0xff4400,
    lift:      0xcc00ff,
  };

  // Draw all nodes
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

  // Draw all edges
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

  debugGroup.visible = false; // hidden by default
  scene.add(debugGroup);

  console.log("Debug graph rendered. Press G to toggle.");
}

// Toggle debug graph with G key
window.addEventListener("keydown", e => {
  if (e.key === "g" || e.key === "G") {
    if (debugGroup) debugGroup.visible = !debugGroup.visible;
  }
});

// What to look for when inspecting the debug graph:
//
// PROBLEM: A node with no lines coming out of it
// CAUSE:   It has no connections — it's isolated
// FIX:     Add a manual link to the nearest path node
//
// PROBLEM: A line that passes through a wall
// CAUSE:   Two nodes are within connectRadius but separated by a wall
// FIX:     Reduce connectRadius or add a wall-check with raycasting
//
// PROBLEM: No lines between floors
// CAUSE:   Staircase/lift cross-floor links not added
// FIX:     Check your graph.addLink calls for transition pairs
```

---

## Connectivity Check

Run this once after building the graph. Every node must be reachable from every other node, otherwise some routes will silently fail.

```javascript
/**
 * checkConnectivity
 *
 * Uses BFS (Breadth First Search) starting from one node.
 * If all nodes are reachable from that node, the graph is fully connected.
 * If any nodes are not reachable, they're isolated — A* can never reach them.
 *
 * Call this once during development after building your graph.
 * Fix all warnings before shipping.
 */
function checkConnectivity(graph) {
  const allIds = new Set();
  graph.forEachNode(node => allIds.add(node.id));

  if (allIds.size === 0) {
    console.warn("Graph is empty!");
    return;
  }

  // Start BFS from the first node
  const firstId = allIds.values().next().value;
  const visited = new Set([firstId]);
  const queue = [firstId];

  while (queue.length > 0) {
    const currentId = queue.shift(); // take from front

    // Visit all neighbors
    graph.forEachLinkedNode(currentId, neighbor => {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    });
  }

  const unreachable = [...allIds].filter(id => !visited.has(id));

  if (unreachable.length > 0) {
    console.warn(`${unreachable.length} isolated node(s) found:`, unreachable);
    console.warn("These nodes cannot be reached by pathfinding. Add links to connect them.");
  } else {
    console.log(`Graph fully connected ✓ (${allIds.size} nodes)`);
  }
}

// Call after building the full graph:
checkConnectivity(graph);
```

---

## Implementation Order

Follow this order to build incrementally and test at each step:

### Step 1 — Install packages
```bash
npm install ngraph.graph ngraph.path kdbush
```

### Step 2 — Set up index maps
Create `objectIndex` and `markerIndex` with all your objects and markers defined.

### Step 2.5 — Parsing the model
Loop through the model and find all objects with ROLE "door", "lift", "staircase", "toilet", "footnode","markers" and interactive objects to be added to the graph.
### Step 3 — Add all nodes to the graph
Add footpath nodes first, then door nodes, then staircase/lift pairs, then markers.
Use consistent ID naming: `L{level}_{type}_{identifier}`.

### Step 4 — Auto-connect footpath nodes
Call `autoConnectNodes(graph, 2.0)`.
Tune the radius to match your node spacing.

### Step 5 — Add manual connections
Add links for:
- Each door node → its nearest path node(s)
- Each marker node → its nearest path node(s)
- Each staircase pair (both directions)
- Each lift pair (both directions)

### Step 6 — Run connectivity check
```javascript
checkConnectivity(graph);
```
Fix every warning before continuing.

### Step 7 — Enable debug visualisation
Call `debugDrawGraph(graph, scene)` and press G to toggle.
Walk through your scene and check that:
- Every walkable area has nodes with connections
- No lines pass through walls
- Staircase and lift transition links are visible

### Step 8 — Test pathfinding
```javascript
// Test a simple same-floor route
const result = getRoute("marker_main_entrance", "obj_cafe_L1", { accessibilityMode: false });
console.log(result);

// Test a multi-floor route
const multiFloor = getRoute("marker_main_entrance", "obj_library_L3", { accessibilityMode: false });
console.log(multiFloor);

// Test accessibility mode
const accessible = getRoute("marker_main_entrance", "obj_library_L3", { accessibilityMode: true });
console.log(accessible);
```

### Step 9 — Wire up rendering
Call `drawPath(result, levelGroups, scene)` with the output of `getRoute`.

### Step 10 — Connect to your UI
Hook `getRoute` into your click handlers / selection UI.
Call `clearPath(scene)` when the user cancels or changes selection.

---

## Rules Reference

| Rule | Where enforced |
|---|---|
| Markers are start-only (not mid-path) | `distance()` in `findPath` — returns `Infinity` if marker is not the start |
| Lifts only in accessibility mode | `distance()` — returns `Infinity` if lift and not accessibility mode |
| Stairs blocked in accessibility mode | `distance()` — returns `Infinity` if staircase and accessibility mode |
| Objects valid as both start and end | `getRoute()` — resolves both start and end via `objectIndex` |
| Destination is either a door node, or a object | `getRoute()` — checks both `doorNodeId` and `objectNodeId` for objects |
| Cross-floor connections are explicit | Manual `graph.addLink` calls for staircase/lift pairs |
| Path ordered start → end | `rawPath.reverse()` in `findPath` |
