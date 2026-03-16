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

export function setupUI(floors, switchFloorCb) {
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
      if (floors[floorId] && floors[floorId].isLoaded()) switchFloorCb(floorId);
    });
    
    btn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const floorId = btn.dataset.floor;
      if (floors[floorId] && floors[floorId].isLoaded()) switchFloorCb(floorId);
    });
  });
}


