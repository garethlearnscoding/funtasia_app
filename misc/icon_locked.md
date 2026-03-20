# Icon Horizontal Locking Instructions

To implement horizontal-only camera facing for icons (instead of full 3D billboarding), follow these steps:

## 1. Use Mesh instead of Sprite
Standard `THREE.Sprite` objects always face the camera in all axes. To lock rotation, you must use a `Mesh` with `PlaneGeometry`.

**Constructor Changes:**
```javascript
// Replace SpriteMaterial with MeshBasicMaterial
this.material = new THREE.MeshBasicMaterial({ 
  map: texture, 
  transparent: true,
  side: THREE.DoubleSide,
  depthTest: true
});

// Replace Sprite with Mesh
this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
```

## 2. Implement Constrained lookAt
In the animation loop, manually update the mesh's rotation to face the camera's position, but override the Y-coordinate of the target to match the icon's own height.

**Animation Loop Logic:**
```javascript
animate(time, camera) {
  // ... visibility and scaling logic ...

  if (isVisible) {
    // 1. Calculate Target Position (Camera's position)
    const targetPos = new THREE.Vector3();
    camera.getWorldPosition(targetPos);

    // 2. Get Icon's current world position
    const iconWorldPos = new THREE.Vector3();
    this.sprite.getWorldPosition(iconWorldPos);

    // 3. Lock the vertical axis (Y)
    targetPos.y = iconWorldPos.y; 

    // 4. Force the mesh to look at the constrained target
    this.sprite.lookAt(targetPos);
  }
}
```

This ensures the icon always swivels to face the user horizontally but never leans forward/backward when the camera tilts.
