# Implementation Plan — Per-Face Materials & Interactive Raycasting

## Overview

This plan covers the end-to-end pipeline for assigning split materials to 3D building
models in Blender and consuming them interactively in Three.js. The system distinguishes
wall faces from top faces on each mesh, assigns flat unlit materials, exports the result
as a GLB, then maps the geometry groups back to application logic for raycasting and
highlighting.

---

## 1. Blender — Data Preparation

### 1.1 Geometry Integrity

Before any material work can be done, mesh geometry must be in a clean, evaluated state.
Two conditions must be satisfied:

**Modifier application.** Procedural modifiers (particularly Solidify) exist only in
Blender's modifier stack and are invisible to Python's `bmesh` API. The API reads raw
mesh data, not the evaluated result. All modifiers must be applied so that the extruded
geometry — including the top face — physically exists in the mesh data before any face
iteration occurs.

**Normal recalculation.** Face normals are the only signal used to distinguish top faces
from wall faces. A broken normal points in an arbitrary direction, causing misclassification.
Blender's `normals_make_consistent` operator analyses the topology of a closed mesh and
aligns all normals to point outward. This must run after modifier application, since
applying Solidify may introduce inverted normals on the new faces it generates.

### 1.2 Face Classification

Classification is done by comparing each face's world-space normal against the global up
vector `(0, 0, 1)` using a dot product:

- A dot product of **1.0** means the face is perfectly parallel to the XY plane — a flat top.
- A dot product of **0.0** means the face is vertical — a wall.
- A dot product of **-1.0** means the face points straight down — a bottom face.

A threshold value (`UP_THRESHOLD`) gates what counts as "top". For models where tops
are guaranteed to be axis-aligned, `0.9999` is appropriate. For sloped roofs or angled
surfaces, lower values like `0.7` (≈45°) broaden the classification.

The normal must be transformed into world space before comparison, because object-level
rotation (stored in `matrix_world`) is not baked into the raw mesh normals. Failing to
do this produces incorrect results on any rotated object.

### 1.3 Material Source

Wall colour is read from the **viewport display colour** (`mat.diffuse_color`) of the
object's existing first material. This property exists on all materials regardless of
node setup and reflects the colour visible in Blender's solid viewport — making it the
most reliable and artist-friendly source of truth.

The top colour is derived programmatically by multiplying each RGB channel by a fixed
brightness factor and clamping to 1.0. This keeps the two materials visually related
without requiring manual authoring of the top colour.

### 1.4 Material Type — Emission Shader

Standard Principled BSDF materials respond to scene lighting. For a map or architectural
viewer, lighting-independent flat colour is preferable. Blender's **Emission shader**
outputs a constant colour with no light interaction, which is the direct equivalent of
Three.js's `MeshBasicMaterial`.

When exported via glTF, Emission-based materials are tagged with the
`KHR_materials_unlit` extension. Three.js's GLTFLoader reads this extension and
automatically resolves the material to `MeshBasicMaterial` on import — no manual
replacement is required on the JavaScript side.

This extension is only written when the glTF export **Lighting Mode** is set to
`Unitless`. The default `Standard` mode strips it.

### 1.5 Material Slot Assignment

Each object receives exactly two material slots:

| Slot Index | Purpose |
|---|---|
| 0 | Wall material |
| 1 | Top material |

Slot index is assigned per-face via `face.material_index` in bmesh. This index is baked
into the mesh data on export and becomes the `materialIndex` field of each geometry
group in the GLB.

---

## 2. glTF Export — What Gets Written

When a mesh has multiple material slots with faces assigned to each, Blender writes
**geometry groups** into the exported GLB. Each group describes a contiguous range of
faces and the material slot index they belong to:

```
geometry.groups = [
  { start: 0,   count: 90,  materialIndex: 0 },  // wall faces
  { start: 90,  count: 18,  materialIndex: 1 },   // top faces
]
```

Three.js uses these groups to know which portion of the index buffer each material
applies to. Without groups, the entire mesh renders with a single material.

### The Split Mesh Problem

When a mesh has multiple material slots, Blender's GLB exporter splits it into a
**parent Group node** and **child Mesh nodes** — one child per material slot. The naming
convention is:

```
ObjectName          ← Object3D (Group), carries custom properties / userData
  ObjectName_1      ← Mesh, material slot 0 (walls)
  ObjectName_2      ← Mesh, material slot 1 (top)
```

Custom properties defined in Blender (e.g. `ROLE`, `ZONE`) are exported onto the parent
Group only. The child meshes carry no userData. This means application logic that reads
`child.userData` directly will fail for split meshes — the data must be resolved from
the parent.

---

## 3. Three.js — Loading & Material Assignment

### 3.1 userData Resolution

During the scene traverse after loading, each node must be checked for the presence of
userData. If a mesh node has no userData but its parent does, the parent is the
authoritative data source. The resolved data should be copied down to the child so all
subsequent code can treat nodes uniformly without re-checking the parent.

### 3.2 Material Assignment by Slot

The `_1` / `_2` suffix on child mesh names directly encodes the material slot:

- `_1` → slot 0 → wall material
- `_2` → slot 1 → top material

This suffix is parsed from the node name at load time to determine which colour variant
to apply. Colours are looked up from two dictionaries — one for walls, one for tops —
keyed by `ROLE` or `ZONE` as appropriate, with a fallback default.

### 3.3 Object Registry

The `objects` array used for raycasting must contain **one entry per logical object**,
not one per mesh child. The parent Group is the correct entry to push, since it
represents the full logical building unit. Pushing both `_1` and `_2` would cause double
selections and complicate highlight logic. A guard (`if (!objects.includes(dataNode))`)
prevents duplicate registration.

---

## 4. Raycasting & Interactivity

### 4.1 Hit Resolution

`Raycaster.intersectObjects` with `recursive = true` returns hits against all descendant
meshes. The hit object will be one of the child meshes (`_1` or `_2`), not the parent
Group. Application logic needs the parent to access userData and to address all sibling
meshes.

A `Map<Mesh, Group>` built during the traverse (meshToParent) provides O(1) lookup from
any hit mesh to its logical parent. This is more reliable than walking `child.parent` at
raycast time, which would require null checking and may break if the scene hierarchy
changes.

### 4.2 Highlight Strategy

Highlighting must affect all child meshes of a logical object simultaneously — clicking
the wall or the top should produce the same visual result across the whole model.

The highlight function receives the parent Group and iterates its children, replacing
each mesh's current material with a highlight material. The original material reference
is stored on `mesh.userData.material` during the initial traverse so it can be restored
on deselect without re-deriving the colour.

This pattern — store → replace → restore — is preferable to mutating the material's
colour property directly, since it keeps the original material objects intact and avoids
state management edge cases when switching selections.

### 4.3 Selection State

Because `objects[]` contains parent Groups rather than meshes, all existing selection
logic that reads `userData` from the selected entry continues to work unchanged. The
raycasting change is transparent to downstream logic — the resolved node behaves
identically to how a single-mesh object did before the material split.

---

## 5. Pipeline Summary

```
Blender Mesh
  │
  ├─ 1. Apply all modifiers          (solidify → real geometry)
  ├─ 2. Recalculate normals          (reliable face direction data)
  ├─ 3. Read viewport colour         (wall colour source of truth)
  ├─ 4. Build Emission materials     (wall + brightened top)
  ├─ 5. Assign per face via bmesh    (dot product → material_index)
  └─ 6. Export GLB, Lighting: Unitless  (writes KHR_materials_unlit + groups)
         │
         ▼
  Three.js GLTFLoader
  │
  ├─ 7. Traverse scene
  │     ├─ Resolve userData from parent Group
  │     ├─ Parse _1/_2 suffix → wall or top slot
  │     ├─ Apply MeshBasicMaterial from colour dictionary
  │     ├─ Store material ref on userData for restore
  │     └─ Register parent Group in objects[] and meshToParent Map
  │
  └─ 8. Raycast
        ├─ Hit child mesh → resolve parent via meshToParent
        ├─ Read ROLE / ZONE from parent userData
        └─ Highlight by iterating parent's mesh children
```
