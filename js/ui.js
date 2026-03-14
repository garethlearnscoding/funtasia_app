const sheet = document.getElementById("bottom-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetDesc = document.getElementById("sheet-desc");
const closeBtn = document.getElementById("close-btn");

const locationData = {}; // Placeholder

function getLocationInfo(objectName) {
  if (locationData[objectName]) {
    return locationData[objectName];
  }
  return {
    title: objectName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `This is ${objectName.replace(
      /_/g,
      " ",
    )}. Click to learn more about this location.`,
  };
}

export function showBottomSheet(objectName) {
  const locationInfo = getLocationInfo(objectName);
  sheetTitle.textContent = locationInfo.title;
  sheetDesc.textContent = locationInfo.description;
  sheet.classList.add("show");
}

export function hideBottomSheet() {
  sheet.classList.remove("show");
}

export function setupUI(floors, floorObjects, switchFloorCb) {
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  closeBtn.addEventListener("touchend", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  document.querySelectorAll(".floor-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const floorId = btn.dataset.floor;
      if (floors[floorId]) switchFloorCb(floorId, floors, floorObjects);
    });
    
    btn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const floorId = btn.dataset.floor;
      if (floors[floorId]) switchFloorCb(floorId, floors, floorObjects);
    });
  });
}

export function switchFloor(floorId, floors, floorObjects, currentState) {
  Object.keys(floors).forEach((id) => {
    if (floors[id]) floors[id].visible = false;
  });

  if (floors[floorId]) {
    floors[floorId].visible = true;
    currentState.interactiveObjects = floorObjects[floorId];
    currentState.currentFloor = floorId;
    console.log(`Switched to ${floorId}`);
  } else {
    console.warn(`Floor ${floorId} not loaded yet`);
  }

  document.querySelectorAll(".floor-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.floor === floorId) btn.classList.add("active");
  });

  if (currentState.hovered) {
    currentState.hovered.material.emissive.setHex(0x000000);
    currentState.hovered = null;
  }
}
